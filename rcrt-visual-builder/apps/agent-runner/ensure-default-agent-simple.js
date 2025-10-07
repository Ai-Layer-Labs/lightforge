#!/usr/bin/env node
/**
 * Simple Default Agent Loader
 * Ensures the default chat agent exists in the system
 */

const CONFIG = {
  rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://rcrt:8080',
  maxRetries: 30,
  retryDelay: 2000
};

const defaultAgentDef = {
  "schema_name": "agent.def.v1",
  "title": "Default Chat Assistant",
  "tags": ["agent:def", "workspace:agents", "chat:default", "system:bootstrap"],
  "context": {
    "agent_id": "default-chat-assistant",
    "model": "openrouter/google/gemini-2.0-flash-exp:free",
    "temperature": 0.7,
    "max_tokens": 2000,
    "system_prompt": "You are a helpful AI assistant.\n\nYou receive context that may include:\n- browser: The current webpage the user is viewing\n- tools: Available tools\n- history: Recent conversation\n- tool_results: Results from tools\n\nWhen asked about the page, reference the 'browser' context.\n\nRespond with valid JSON:\n\n{\n  \"action\": \"create\",\n  \"breadcrumb\": {\n    \"schema_name\": \"agent.response.v1\",\n    \"title\": \"Chat Response\",\n    \"tags\": [\"agent:response\", \"chat:output\"],\n    \"context\": {\n      \"message\": \"Your response to the user\"\n    }\n  }\n}",
    "capabilities": {
      "can_create_breadcrumbs": true,
      "can_update_own": true,
      "can_delete_own": false,
      "can_spawn_agents": false
    },
    "subscriptions": {
      "comment": "Clean explicit subscriptions - universal executor pattern",
      "selectors": [
        {
          "comment": "Pre-built context from context-builder triggers processing",
          "schema_name": "agent.context.v1",
          "all_tags": ["consumer:default-chat-assistant"],
          "role": "trigger",
          "key": "assembled_context",
          "fetch": {"method": "event_data"}
        },
        {
          "comment": "Current browser page - fetched when triggered",
          "schema_name": "browser.page.context.v1",
          "any_tags": ["browser:active-tab"],
          "role": "context",
          "key": "browser",
          "fetch": {"method": "latest", "limit": 1}
        },
        {
          "comment": "Available tools - fetched when triggered",
          "schema_name": "tool.catalog.v1",
          "role": "context",
          "key": "tools",
          "fetch": {"method": "latest", "limit": 1}
        },
        {
          "comment": "Recent conversation history",
          "schema_name": "user.message.v1",
          "any_tags": ["extension:chat"],
          "role": "context",
          "key": "history",
          "fetch": {"method": "recent", "limit": 10}
        },
        {
          "comment": "Recent tool results (historical context)",
          "schema_name": "tool.response.v1",
          "all_tags": ["workspace:tools"],
          "role": "context",
          "key": "tool_results",
          "fetch": {"method": "recent", "limit": 5}
        },
        {
          "comment": "Tool responses trigger continuation (filter by request tag)",
          "schema_name": "tool.response.v1",
          "all_tags": ["tool:response", "request:llm"],
          "role": "trigger",
          "key": "tool_response",
          "fetch": {"method": "event_data"}
        }
      ]
    },
    "metadata": {
      "version": "3.0.0",
      "architecture": "universal-executor",
      "created_by": "system",
      "purpose": "Clean universal executor with explicit subscriptions",
      "features": [
        "Browser context awareness",
        "Dynamic tool discovery",
        "Fetch-on-trigger pattern",
        "Zero hardcoding",
        "Fully composable"
      ]
    }
  }
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🤖 Ensuring default chat agent...');
  
  // Wait for RCRT to be ready
  console.log('⏳ Waiting for RCRT to be ready...');
  await sleep(10000);
  
  try {
    // Get token
    const tokenResp = await fetch(`${CONFIG.rcrtBaseUrl}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner_id: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
        agent_id: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000AAA',
        roles: ['curator', 'emitter', 'subscriber']
      })
    });
    
    if (!tokenResp.ok) {
      throw new Error(`Failed to get token: ${tokenResp.status}`);
    }
    
    const { token } = await tokenResp.json();
    
    // Check if agent exists
    const searchResp = await fetch(
      `${CONFIG.rcrtBaseUrl}/breadcrumbs?schema_name=agent.def.v1&tag=workspace:agents`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    if (!searchResp.ok) {
      throw new Error(`Failed to search agents: ${searchResp.status}`);
    }
    
    const agents = await searchResp.json();
    const hasDefaultAgent = agents.some(a => 
      a.title === 'Default Chat Assistant' || 
      a.context?.agent_id === 'default-chat-assistant'
    );
    
    if (hasDefaultAgent) {
      console.log('✅ Default chat agent already exists');
      return;
    }
    
    // Create agent
    console.log('📝 Creating default chat agent...');
    const createResp = await fetch(`${CONFIG.rcrtBaseUrl}/breadcrumbs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(defaultAgentDef)
    });
    
    if (!createResp.ok) {
      const error = await createResp.text();
      throw new Error(`Failed to create agent: ${createResp.status} - ${error}`);
    }
    
    const result = await createResp.json();
    console.log(`✅ Default chat agent created: ${result.id}`);
    
  } catch (error) {
    console.error('❌ Failed to ensure default agent:', error.message);
    // Don't exit with error - let agent-runner continue
  }
}

// Run
main().catch(console.error);
