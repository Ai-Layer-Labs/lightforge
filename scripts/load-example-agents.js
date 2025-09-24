#!/usr/bin/env node
/**
 * Load Example Agent Definitions
 * Creates breadcrumb-based agent definitions following RCRT philosophy
 */

const fs = require('fs');
const path = require('path');

async function loadExampleAgents() {
  console.log('🤖 Loading example agent definitions...');
  
  // Configuration
  const RCRT_BASE_URL = process.env.RCRT_BASE_URL || 'http://localhost:8081';
  const OWNER_ID = process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001';
  const AGENT_ID = process.env.AGENT_ID || '00000000-0000-0000-0000-000000000AAA';
  
  try {
    // Get JWT token
    const tokenResponse = await fetch(`${RCRT_BASE_URL}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner_id: OWNER_ID,
        agent_id: AGENT_ID,
        roles: ['curator', 'emitter']
      })
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`Token request failed: ${tokenResponse.status}`);
    }
    
    const tokenData = await tokenResponse.json();
    const token = tokenData.token;
    
    console.log('✅ Obtained JWT token');
    
    // Read agent definitions
    const agentDefinitions = JSON.parse(fs.readFileSync('example-agent-definitions.json', 'utf8'));
    
    console.log(`📋 Found ${agentDefinitions.length} agent definitions to load`);
    
    // Create each agent definition as a breadcrumb
    for (const agentDef of agentDefinitions) {
      console.log(`🤖 Creating agent: ${agentDef.context.agent_name}`);
      
      const response = await fetch(`${RCRT_BASE_URL}/breadcrumbs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(agentDef)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to create agent ${agentDef.context.agent_name}:`, errorText);
        continue;
      }
      
      const result = await response.json();
      console.log(`✅ Created agent ${agentDef.context.agent_name} with ID: ${result.id}`);
    }
    
    console.log('🎉 All example agents loaded successfully!');
    console.log('');
    console.log('💡 These agents are now pure data/context breadcrumbs that:');
    console.log('   - Define triggers (what events activate them)');
    console.log('   - Specify context gathering (what info to send to LLM)'); 
    console.log('   - Configure LLM behavior (system prompt, response schema)');
    console.log('   - Process structured LLM responses (invoke tools, create breadcrumbs)');
    console.log('');
    console.log('🚀 Start the agent-runner to begin processing these agents!');
    
  } catch (error) {
    console.error('❌ Failed to load example agents:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  loadExampleAgents();
}
