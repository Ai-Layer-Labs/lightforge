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
    "llm_tool": "openrouter",
    "llm_config": {
      "model": "google/gemini-2.5-flash",
      "temperature": 0.7,
      "max_tokens": 2000
    },
      "system_prompt": "You are a helpful AI assistant integrated with the RCRT system.\n\nYou will receive context that may include:\n- Tool catalog: Available tools you can use\n- Chat history: Previous messages in the conversation\n\nYou dynamically discover available tools from the tool catalog breadcrumb. When you need to use a tool:\n1. Check the tool catalog in your context for available tools\n2. Create a tool.request.v1 breadcrumb with the appropriate parameters\n3. Wait for the tool.response.v1 breadcrumb with results\n\nAlways be helpful, concise, and clear. Explain what you're doing when invoking tools.\nMaintain conversation context and remember what the user has asked previously.\n\nIMPORTANT: Respond with valid JSON:\n{\n  \"action\": \"create\",\n  \"breadcrumb\": {\n    \"schema_name\": \"agent.response.v1\",\n    \"title\": \"Chat Response\",\n    \"tags\": [\"agent:response\", \"chat:output\"],\n    \"context\": {\n      \"message\": \"Your response\",\n      \"tool_requests\": [...]\n    }\n  }\n}",
    "capabilities": {
      "can_create_breadcrumbs": true,
      "can_update_own": false,
      "can_delete_own": false,
      "can_spawn_agents": false
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
          "all_tags": ["workspace:tools"]
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
