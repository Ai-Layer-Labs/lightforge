#!/usr/bin/env node
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/index.ts
import dotenv from "dotenv";
import { RcrtClientEnhanced } from "@rcrt-builder/sdk";
var processingStatus = /* @__PURE__ */ new Map();
async function startAgentSSEDispatcher(client, workspace, jwtToken) {
  try {
    console.log("\u{1F4E1} Starting agent SSE dispatcher...");
    console.log(`\u{1F50C} Connecting to SSE: ${client.baseUrl}/events/stream`);
    const response = await fetch(`${client.baseUrl}/events/stream`, {
      headers: {
        "Authorization": `Bearer ${jwtToken}`,
        "Accept": "text/event-stream",
        "Cache-Control": "no-cache"
      }
    });
    if (!response.ok) {
      throw new Error(`SSE connection failed: ${response.status}`);
    }
    console.log("\u2705 Agent SSE dispatcher connected");
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No SSE stream reader available");
    }
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const eventData = JSON.parse(line.slice(6));
            if (eventData.type !== "ping") {
              console.log(`\u{1F4E1} Agent Event:`, {
                type: eventData.type,
                schema_name: eventData.schema_name,
                tags: eventData.tags,
                breadcrumb_id: eventData.breadcrumb_id
              });
            }
            await processEventForAgents(eventData, client, workspace);
          } catch (error) {
            console.warn("Failed to parse SSE event:", line, error);
          }
        }
      }
    }
  } catch (error) {
    console.error("\u274C Agent SSE dispatcher error:", error);
    setTimeout(() => startAgentSSEDispatcher(client, workspace, jwtToken), 5e3);
  }
}
async function processEventForAgents(eventData, client, workspace) {
  if (eventData.type === "breadcrumb.created" || eventData.type === "breadcrumb.updated") {
    const breadcrumbId = eventData.breadcrumb_id;
    if (processingStatus.get(breadcrumbId) === "processing") {
      console.log(`\u23ED\uFE0F Breadcrumb ${breadcrumbId} already being processed, skipping`);
      return;
    }
    console.log(`\u{1F3AF} Processing breadcrumb for agents: ${breadcrumbId}`);
    processingStatus.set(breadcrumbId, "processing");
    if (processingStatus.size > 100) {
      processingStatus.clear();
    }
    try {
      console.log(`\u{1F50D} Fetching breadcrumb details for: ${eventData.breadcrumb_id}`);
      let triggerBreadcrumb;
      try {
        triggerBreadcrumb = await client.getBreadcrumb(eventData.breadcrumb_id);
      } catch (fetchError) {
        console.error(`\u274C Failed to fetch breadcrumb ${eventData.breadcrumb_id}:`, fetchError.message);
        return;
      }
      if (!triggerBreadcrumb) {
        console.warn(`\u274C No breadcrumb found for ID: ${eventData.breadcrumb_id}`);
        return;
      }
      console.log(`\u{1F4CB} Got breadcrumb:`, {
        id: triggerBreadcrumb.id,
        title: triggerBreadcrumb.title,
        tags: triggerBreadcrumb.tags,
        schema_name: triggerBreadcrumb.schema_name || "none"
      });
      const agentDefinitions = await findMatchingAgents(client, triggerBreadcrumb, workspace);
      for (const agentDef of agentDefinitions) {
        await processAgentExecution(client, triggerBreadcrumb, agentDef, workspace);
      }
      processingStatus.set(breadcrumbId, "completed");
    } catch (error) {
      console.error("Failed to process event for agents:", error);
      processingStatus.set(breadcrumbId, "completed");
    }
  }
}
async function findMatchingAgents(client, triggerBreadcrumb, workspace) {
  try {
    const agentBreadcrumbs = await client.searchBreadcrumbs("agent definition", {
      tags: ["agent:definition", workspace]
    });
    const matchingAgents = [];
    for (const agentBreadcrumb of agentBreadcrumbs) {
      const agentDef = agentBreadcrumb.context;
      if (agentDef && agentDef.triggers) {
        for (const trigger of agentDef.triggers) {
          if (await matchesSelector(triggerBreadcrumb, trigger.selector)) {
            console.log(`\u{1F3AF} Agent ${agentDef.agent_name} matches trigger`);
            matchingAgents.push(agentDef);
            break;
          }
        }
      }
    }
    return matchingAgents;
  } catch (error) {
    console.error("Error finding matching agents:", error);
    return [];
  }
}
async function matchesSelector(breadcrumb, selector) {
  if (selector.any_tags) {
    const hasAnyTag = selector.any_tags.some(
      (tag) => breadcrumb.tags?.includes(tag)
    );
    if (!hasAnyTag) return false;
  }
  if (selector.all_tags) {
    const hasAllTags = selector.all_tags.every(
      (tag) => breadcrumb.tags?.includes(tag)
    );
    if (!hasAllTags) return false;
  }
  if (selector.context_match) {
    for (const match of selector.context_match) {
      const value = getNestedValue(breadcrumb.context, match.path);
      switch (match.op) {
        case "eq":
          if (value !== match.value) return false;
          break;
        case "contains_any":
          if (!Array.isArray(match.value)) return false;
          const strValue = String(value || "").toLowerCase();
          const hasAny = match.value.some(
            (v) => strValue.includes(String(v).toLowerCase())
          );
          if (!hasAny) return false;
          break;
        case "gt":
          if (!(value > match.value)) return false;
          break;
        case "lt":
          if (!(value < match.value)) return false;
          break;
      }
    }
  }
  return true;
}
function getNestedValue(obj, path) {
  const keys = path.replace(/^\$\./, "").split(".");
  let current = obj;
  for (const key of keys) {
    if (current && typeof current === "object") {
      current = current[key];
    } else {
      return void 0;
    }
  }
  return current;
}
async function processAgentExecution(client, triggerBreadcrumb, agentDef, workspace) {
  console.log(`\u{1F916} Processing agent: ${agentDef.agent_name}`);
  try {
    const llmResponse = await callLLM(client, agentDef.llm_config, triggerBreadcrumb);
    await processLLMResponse(client, llmResponse, agentDef, triggerBreadcrumb, workspace);
    console.log(`\u2705 Agent ${agentDef.agent_name} completed successfully`);
  } catch (error) {
    console.error(`\u274C Agent ${agentDef.agent_name} failed:`, error);
    await client.createBreadcrumb({
      schema_name: "agent.response.v1",
      title: `${agentDef.agent_name} Error`,
      tags: ["agent:response", "agent:error", workspace],
      context: {
        agent_name: agentDef.agent_name,
        response_to: triggerBreadcrumb.id,
        error: error.message,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  }
}
async function callLLM(client, llmConfig, triggerBreadcrumb) {
  const contextText = `**Breadcrumb Context:**
Title: ${triggerBreadcrumb.title}
Tags: ${triggerBreadcrumb.tags?.join(", ") || "none"}
Context: ${JSON.stringify(triggerBreadcrumb.context, null, 2)}`;
  const toolRequest = await client.createBreadcrumb({
    schema_name: "tool.request.v1",
    title: "LLM Request for Agent",
    tags: ["tool:request", "workspace:tools"],
    context: {
      tool: "openrouter",
      input: {
        messages: [
          {
            role: "system",
            content: llmConfig.system_prompt + "\n\nPlease respond with valid JSON matching the required schema."
          },
          {
            role: "user",
            content: contextText
          }
        ],
        model: llmConfig.model || "google/gemini-2.5-flash",
        temperature: 0.7,
        max_tokens: 4e3
      }
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 2e3));
  try {
    const responses = await client.searchBreadcrumbs(`tool response`, {
      limit: 5,
      tags: ["tool:response"]
    });
    const matchingResponse = responses.find(
      (r) => r.context?.tool === "openrouter" && r.context?.status === "success"
    );
    if (matchingResponse) {
      const output = matchingResponse.context?.output;
      if (output && output.content) {
        try {
          const parsed = JSON.parse(output.content);
          return parsed;
        } catch (parseError) {
          console.warn("LLM returned non-JSON response, wrapping in response_text");
          return {
            response_text: output.content || "LLM response received but could not parse",
            confidence: 0.7
          };
        }
      }
    }
    return {
      response_text: "I processed your request but encountered an issue getting a proper response.",
      confidence: 0.1
    };
  } catch (error) {
    console.error("Error getting LLM response:", error);
    return {
      response_text: "I encountered an error while processing your request.",
      confidence: 0
    };
  }
}
async function processLLMResponse(client, llmResponse, agentDef, triggerBreadcrumb, workspace) {
  await client.createBreadcrumb({
    schema_name: "agent.response.v1",
    title: `${agentDef.agent_name} Response`,
    tags: ["agent:response", workspace],
    context: {
      agent_name: agentDef.agent_name,
      response_to: triggerBreadcrumb.id,
      content: llmResponse.response_text,
      confidence: llmResponse.confidence || 0.8,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  if (llmResponse.tools_to_invoke) {
    for (const toolRequest of llmResponse.tools_to_invoke) {
      console.log(`\u{1F6E0}\uFE0F Agent ${agentDef.agent_name} invoking tool: ${toolRequest.tool}`);
      await client.createBreadcrumb({
        schema_name: "tool.request.v1",
        title: `Tool Request: ${toolRequest.tool}`,
        tags: ["tool:request", "workspace:tools"],
        context: {
          tool: toolRequest.tool,
          input: toolRequest.input,
          requested_by: agentDef.agent_name,
          reason: toolRequest.reason || "Agent decision",
          agent_request_id: triggerBreadcrumb.id
        }
      });
    }
  }
  if (llmResponse.create_breadcrumbs) {
    for (const breadcrumb of llmResponse.create_breadcrumbs) {
      console.log(`\u{1F4DD} Agent ${agentDef.agent_name} creating breadcrumb: ${breadcrumb.title}`);
      await client.createBreadcrumb({
        schema_name: breadcrumb.schema_name || "agent.created.v1",
        title: breadcrumb.title,
        tags: [...breadcrumb.tags || [], workspace, `created-by:${agentDef.agent_name}`],
        context: {
          ...breadcrumb.context,
          created_by_agent: agentDef.agent_name,
          created_from: triggerBreadcrumb.id,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    }
  }
}
dotenv.config();
var config = {
  rcrtBaseUrl: process.env.RCRT_BASE_URL || "http://localhost:8081",
  workspace: process.env.WORKSPACE || "workspace:agents",
  deploymentMode: process.env.DEPLOYMENT_MODE || "local"
};
async function main() {
  console.log("\u{1F916} RCRT Agent Runner starting...");
  console.log("Configuration:", config);
  if (config.deploymentMode === "docker") {
    console.log("Waiting for services to be ready...");
    await new Promise((resolve) => setTimeout(resolve, 1e4));
  }
  try {
    const tokenRequest = {
      owner_id: process.env.OWNER_ID || "00000000-0000-0000-0000-000000000001",
      agent_id: process.env.AGENT_ID || "00000000-0000-0000-0000-000000000AAA",
      roles: ["curator", "emitter", "subscriber"]
    };
    const resp = await fetch(`${config.rcrtBaseUrl}/auth/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(tokenRequest)
    });
    if (!resp.ok) {
      throw new Error(`Token request failed: ${resp.status}`);
    }
    const json = await resp.json();
    const jwtToken = json?.token;
    if (!jwtToken) {
      throw new Error("No token in response");
    }
    console.log("\u2705 Obtained JWT token for agent runner");
    const client = new RcrtClientEnhanced(config.rcrtBaseUrl, "jwt", jwtToken, {
      autoRefresh: true
    });
    console.log("\u2705 Connected to RCRT");
    console.log("\u2705 Agent runner initialized (no registry needed - agents are data!)");
    process.on("SIGINT", () => {
      console.log("\n\u{1F6D1} Shutting down agent runner...");
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      console.log("\n\u{1F6D1} Shutting down agent runner...");
      process.exit(0);
    });
    console.log("\u{1F680} Agent runner ready - listening for agent execution events");
    console.log(`\u{1F916} Workspace: ${config.workspace}`);
    await startAgentSSEDispatcher(client, config.workspace, jwtToken);
  } catch (error) {
    console.error("\u274C Failed to start agent runner:", error);
    process.exit(1);
  }
}
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});
if (__require.main === module) {
  main().catch(console.error);
}
//# sourceMappingURL=index.js.map