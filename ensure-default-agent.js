#!/usr/bin/env node
/**
 * Ensure Default Agent Script
 * Guarantees the default chat agent is loaded in the system
 * Can be run multiple times safely
 */

const fs = require('fs').promises;
const path = require('path');

const CONFIG = {
  rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
  maxRetries: 30,
  retryDelay: 2000
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForService(url, maxRetries = 30) {
  console.log(`⏳ Waiting for ${url} to be ready...`);
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(url, { 
        method: 'GET',
        timeout: 5000 
      });
      
      if (response.ok) {
        console.log('✅ Service is ready!');
        return true;
      }
    } catch (error) {
      // Service not ready yet
    }
    
    if (i < maxRetries - 1) {
      process.stdout.write('.');
      await sleep(CONFIG.retryDelay);
    }
  }
  
  console.log('\n❌ Service did not become ready in time');
  return false;
}

async function getToken() {
  const fetch = require('node-fetch');
  const response = await fetch(`${CONFIG.rcrtBaseUrl}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner_id: '00000000-0000-0000-0000-000000000001',
      agent_id: '00000000-0000-0000-0000-000000000AAA',
      roles: ['curator', 'emitter', 'subscriber']
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get token: ${response.status}`);
  }
  
  const data = await response.json();
  return data.token;
}

async function checkAgentExists(token) {
  const fetch = require('node-fetch');
  const response = await fetch(
    `${CONFIG.rcrtBaseUrl}/breadcrumbs?schema_name=agent.def.v1&tag=workspace:agents`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to search agents: ${response.status}`);
  }
  
  const agents = await response.json();
  return agents.some(a => a.title === 'Default Chat Assistant');
}

async function loadDefaultAgent(token) {
  const fetch = require('node-fetch');
  
  // Read the agent definition
  const agentPath = path.join(__dirname, 'bootstrap-breadcrumbs/system/default-chat-agent.json');
  const agentData = JSON.parse(await fs.readFile(agentPath, 'utf-8'));
  
  // Create the breadcrumb
  const response = await fetch(`${CONFIG.rcrtBaseUrl}/breadcrumbs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(agentData)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create agent: ${response.status} - ${error}`);
  }
  
  const result = await response.json();
  return result.id;
}

async function ensureDefaultAgent() {
  console.log('🤖 Ensuring Default Chat Agent...');
  
  try {
    // Wait for RCRT to be ready
    const isReady = await waitForService(`${CONFIG.rcrtBaseUrl}/health`, CONFIG.maxRetries);
    if (!isReady) {
      throw new Error('RCRT service is not ready');
    }
    
    // Get authentication token
    console.log('🔐 Getting authentication token...');
    const token = await getToken();
    
    // Check if agent already exists
    console.log('🔍 Checking for existing agent...');
    const exists = await checkAgentExists(token);
    
    if (exists) {
      console.log('✅ Default Chat Assistant already exists');
      return;
    }
    
    // Load the agent
    console.log('📝 Loading Default Chat Assistant...');
    const agentId = await loadDefaultAgent(token);
    console.log(`✅ Default Chat Assistant created: ${agentId}`);
    
    // Wait a moment for agent-runner to pick it up
    console.log('⏳ Waiting for agent-runner to register the agent...');
    await sleep(5000);
    
    console.log('✅ Default agent setup complete!');
    
  } catch (error) {
    console.error('❌ Failed to ensure default agent:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  ensureDefaultAgent().catch(console.error);
}

module.exports = { ensureDefaultAgent };
