#!/usr/bin/env node
/**
 * Configure Agent LLM - Links agent to existing LLM config
 */

const fetch = require('node-fetch');

const config = {
  rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
  ownerId: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
  agentId: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000AAA',
};

async function getToken() {
  const response = await fetch(`${config.rcrtBaseUrl}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner_id: config.ownerId,
      agent_id: config.agentId,
      roles: ['curator', 'emitter', 'subscriber']
    })
  });
  const data = await response.json();
  return data.token;
}

async function main() {
  console.log('🔧 Configuring Agent LLM...');
  
  try {
    const token = await getToken();
    
    // 1. Find LLM config
    console.log('🔍 Finding LLM configuration...');
    const configResponse = await fetch(
      `${config.rcrtBaseUrl}/breadcrumbs?schema_name=tool.config.v1&tag=tool:config:openrouter`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    const configs = await configResponse.json();
    
    if (configs.length === 0) {
      console.log('❌ No LLM config found!');
      console.log('   Create one via Dashboard UI:');
      console.log('   1. Visit http://localhost:8082');
      console.log('   2. Find openrouter tool node');
      console.log('   3. Configure it (creates tool.config.v1 breadcrumb)');
      process.exit(1);
    }
    
    const llmConfigId = configs[0].id;
    console.log(`✅ Found LLM config: ${llmConfigId}`);
    
    // 2. Find agent
    console.log('🔍 Finding default chat agent...');
    const agentResponse = await fetch(
      `${config.rcrtBaseUrl}/breadcrumbs?schema_name=agent.def.v1&tag=workspace:agents`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    const agents = await agentResponse.json();
    const agent = agents.find(a => a.title === 'Default Chat Assistant');
    
    if (!agent) {
      console.log('❌ Default Chat Assistant not found!');
      process.exit(1);
    }
    
    console.log(`✅ Found agent: ${agent.id}`);
    
    // 3. Get full agent details
    const agentDetailResponse = await fetch(
      `${config.rcrtBaseUrl}/breadcrumbs/${agent.id}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    const agentDetails = await agentDetailResponse.json();
    
    // 4. Update agent with llm_config_id
    console.log(`🔧 Setting llm_config_id to ${llmConfigId}...`);
    
    const updateResponse = await fetch(
      `${config.rcrtBaseUrl}/breadcrumbs/${agent.id}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'If-Match': agentDetails.version.toString()
        },
        body: JSON.stringify({
          context: {
            ...agentDetails.context,
            llm_config_id: llmConfigId
          }
        })
      }
    );
    
    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Failed to update agent: ${error}`);
    }
    
    console.log('✅ Agent configured!');
    console.log('');
    console.log('Agent will now use LLM config:');
    console.log(`  ID: ${llmConfigId}`);
    console.log(`  Config: ${configs[0].context?.config?.defaultModel || 'default'}`);
    console.log('');
    console.log('✨ Agent is ready! Send a chat message to test.');
    
  } catch (error) {
    console.error('❌ Failed to configure agent:', error.message);
    process.exit(1);
  }
}

main();
