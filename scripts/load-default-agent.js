#!/usr/bin/env node
/**
 * Load the default chat agent into RCRT
 */

const fs = require('fs');
const path = require('path');

const RCRT_BASE_URL = process.env.RCRT_BASE_URL || 'http://localhost:8081';

async function getToken() {
  const tokenRequest = {
    owner_id: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
    agent_id: process.env.AGENT_ID || '00000000-0000-0000-0000-0000000000dd',
    roles: ['curator', 'emitter', 'subscriber']
  };
  
  const resp = await fetch(`${RCRT_BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(tokenRequest)
  });
  
  if (!resp.ok) {
    throw new Error(`Failed to get token: ${resp.status}`);
  }
  
  const json = await resp.json();
  return json.token;
}

async function loadAgent() {
  console.log('🤖 Loading default chat agent...');
  
  try {
    // Get JWT token
    const token = await getToken();
    console.log('✅ Got JWT token');
    
    // Load agent definition
    const agentDef = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'bootstrap-breadcrumbs', 'system', 'default-chat-agent.json'), 'utf8'));
    
    // Create the agent definition breadcrumb
    const response = await fetch(`${RCRT_BASE_URL}/breadcrumbs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(agentDef)
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create agent: ${error}`);
    }
    
    const result = await response.json();
    console.log(`✅ Default chat agent loaded with ID: ${result.id}`);
    console.log('');
    console.log('📋 Agent Details:');
    console.log(`   • Name: ${agentDef.title}`);
    console.log(`   • ID: ${agentDef.context.agent_id}`);
    console.log(`   • Model: ${agentDef.context.model}`);
    console.log(`   • Subscriptions: Listens for chat.message.v1 breadcrumbs`);
    console.log('');
    console.log('🚀 To test the agent, use: node test-chat.js "Your message here"');
    
  } catch (error) {
    console.error('❌ Error loading agent:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  loadAgent().catch(console.error);
}
