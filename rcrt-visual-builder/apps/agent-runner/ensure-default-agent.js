#!/usr/bin/env node
/**
 * Ensure Default Agent for Agent Runner
 * This script is run by the agent-runner at startup to ensure
 * the default chat agent is always available
 */

import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIG = {
  rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://rcrt:8080',
  maxRetries: 10,
  retryDelay: 1000
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loadDefaultAgentDefinition() {
  // Try multiple possible locations for the agent definition
  const possiblePaths = [
    '/app/bootstrap-breadcrumbs/system/default-chat-agent.json',
    path.join(__dirname, '../../../bootstrap-breadcrumbs/system/default-chat-agent.json'),
    path.join(__dirname, 'default-chat-agent.json')
  ];
  
  for (const agentPath of possiblePaths) {
    try {
      const data = await fs.readFile(agentPath, 'utf-8');
      console.log(`✅ Found agent definition at: ${agentPath}`);
      return JSON.parse(data);
    } catch (error) {
      // Try next path
    }
  }
  
  // If not found in files, return the hardcoded definition
  console.log('⚠️  Using hardcoded agent definition');
  return {
    "schema_name": "agent.def.v1",
    "title": "Default Chat Assistant",
    "tags": ["agent:def", "workspace:agents", "chat:default", "system:bootstrap"],
    "context": {
      "agent_id": "default-chat-assistant",
      "model": "google/gemini-2.5-flash",
      "temperature": 0.7,
      "max_tokens": 2000,
      "system_prompt": "You are a helpful AI assistant integrated with the RCRT system.\n\nYou dynamically discover available tools from the tool catalog breadcrumb. You can use tools to help answer questions and perform tasks.\n\nTool Discovery and Usage:\n- ALWAYS check the tool catalog breadcrumb in your context to see what tools are available\n- Each tool in the catalog includes name, description, schemas, and EXAMPLES\n- Look at the examples to understand how to access output fields\n- You can request MULTIPLE tools in a single response using the tool_requests array\n- For multi-step tasks, plan the full sequence and request all tools at once\n- The system will execute all tool requests and return their results\n\nBe creative! Based on the tools you discover in the catalog, you can:\n- Chain tools together for complex operations\n- Use LLM tools to analyze results from other tools\n- Execute parallel operations when they don't depend on each other\n- Look for orchestration tools that support multi-step workflows with dependencies\n\nIMPORTANT:\n- DO NOT assume specific tool names exist - always check the catalog first\n- Refer to tools by their exact names as shown in the catalog\n- Study the EXAMPLES in each tool to understand output field access\n- Pay attention to each tool's input and output schemas\n- Learn from the 'explanation' field in tool examples\n\nAlways be helpful, concise, and clear. Explain what you're doing when invoking tools.\n\nIMPORTANT: Respond with valid JSON:\n{\n  \"action\": \"create\",\n  \"breadcrumb\": {\n    \"schema_name\": \"agent.response.v1\",\n    \"title\": \"Chat Response\",\n    \"tags\": [\"agent:response\", \"chat:output\"],\n    \"context\": {\n      \"message\": \"Your response\",\n      \"tool_requests\": [\n        {\"tool\": \"tool_name\", \"input\": {...}, \"requestId\": \"unique_id\"},\n        {\"tool\": \"another_tool\", \"input\": {...}, \"requestId\": \"unique_id2\"}\n      ]\n    }\n  }\n}",
      "capabilities": {
        "can_create_breadcrumbs": true,
        "can_update_own": true,
        "can_delete_own": false,
        "can_spawn_agents": true
      },
      "subscriptions": {
        "selectors": [
          {
            "any_tags": ["user:message", "chat:message"],
            "schema_name": "user.message.v1"
          },
          {
            "schema_name": "tool.catalog.v1",
            "all_tags": ["workspace:tools"]
          },
          {
            "schema_name": "tool.response.v1",
            "all_tags": ["workspace:tools"],
            "context_match": [
              {"path": "$.requestedBy", "op": "eq", "value": "default-chat-assistant"}
            ]
          },
          {
            "comment": "Subscribe to workflow progress updates",
            "schema_name": "agent.response.v1",
            "all_tags": ["workflow:progress"]
          },
          {
            "comment": "Subscribe to workflow-initiated tool responses",
            "schema_name": "tool.response.v1",
            "all_tags": ["workspace:tools", "tool:response"]
          },
          {
            "comment": "Subscribe to system feedback for self-improvement",
            "schema_name": "system.message.v1",
            "all_tags": ["system:message", "agent:learning"]
          }
        ]
      },
      "metadata": {
        "version": "2.0.0",
        "created_by": "bootstrap",
        "purpose": "General purpose chat interface",
        "features": [
          "Dynamic tool discovery",
          "Context-aware responses",
          "Tool invocation capability"
        ]
      }
    }
  };
}

async function ensureDefaultAgent(rcrtClient) {
  console.log('🤖 [Bootstrap] Checking for default chat agent...');
  
  try {
    // Search for existing default agent
    const agents = await rcrtClient.searchBreadcrumbs({
      schema_name: 'agent.def.v1',
      tag: 'workspace:agents'
    });
    
    const hasDefaultAgent = agents.some(a => 
      a.title === 'Default Chat Assistant' || 
      a.context?.agent_id === 'default-chat-assistant'
    );
    
    if (hasDefaultAgent) {
      console.log('✅ [Bootstrap] Default chat agent already exists');
      return true;
    }
    
    console.log('📝 [Bootstrap] Loading default chat agent...');
    
    // Load agent definition
    const agentData = await loadDefaultAgentDefinition();
    
    // Create the agent
    await rcrtClient.createBreadcrumb(agentData);
    
    console.log('✅ [Bootstrap] Default chat agent created successfully');
    
    // Give agent-runner time to register it
    await sleep(2000);
    
    return true;
    
  } catch (error) {
    console.error('❌ [Bootstrap] Failed to ensure default agent:', error.message);
    return false;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const getToken = async () => {
    const tokenRequest = {
      owner_id: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
      agent_id: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000AAA',
      roles: ['curator', 'emitter', 'subscriber']
    };
    
    const resp = await fetch(`${CONFIG.rcrtBaseUrl}/auth/token`, { 
      method: 'POST', 
      headers: { 'content-type': 'application/json' }, 
      body: JSON.stringify(tokenRequest)
    });
    
    if (!resp.ok) {
      throw new Error(`Token request failed: ${resp.status}`);
    }
    
    const json = await resp.json();
    return json?.token;
  };

  const main = async () => {
    try {
      // Wait for RCRT to be ready
      await sleep(5000); // Give RCRT time to start
      
      const token = await getToken();
      const client = new RcrtClientEnhanced(CONFIG.rcrtBaseUrl, 'jwt', token);
      
      await ensureDefaultAgent(client);
      process.exit(0);
    } catch (error) {
      console.error('Failed to ensure default agent:', error);
      process.exit(1);
    }
  };
  
  main();
}

export { ensureDefaultAgent };
