#!/usr/bin/env node
/**
 * Load Chat Agent Definition
 * Creates a breadcrumb-based chat agent for the browser extension
 */

const fs = require('fs');

async function loadChatAgent() {
  console.log('💬 Loading chat agent definition...');
  
  // Configuration - use builder proxy like the extension
  const RCRT_BASE_URL = process.env.RCRT_BASE_URL || 'http://localhost:3000/api/rcrt';
  const OWNER_ID = process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001';
  const AGENT_ID = process.env.AGENT_ID || '00000000-0000-0000-0000-000000000AAA';
  
  try {
    // Get JWT token via builder proxy
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
    
    // Read chat agent definition
    const chatAgentDef = JSON.parse(fs.readFileSync('chat-agent-definition.json', 'utf8'));
    
    console.log(`💬 Creating chat agent: ${chatAgentDef.context.agent_name}`);
    
    // Create the agent definition as a breadcrumb
    const response = await fetch(`${RCRT_BASE_URL}/breadcrumbs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chatAgentDef)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to create chat agent:`, errorText);
      process.exit(1);
    }
    
    const result = await response.json();
    console.log(`✅ Created chat agent with ID: ${result.id}`);
    
    console.log('');
    console.log('🎉 Chat agent loaded successfully!');
    console.log('');
    console.log('📋 This agent will respond to breadcrumbs with tags:');
    console.log('   - extension:chat');
    console.log('   - user:message');
    console.log('');
    console.log('💡 To test, create a breadcrumb like:');
    console.log('   {');
    console.log('     "title": "User Chat Message",');
    console.log('     "tags": ["extension:chat", "user:message"],');
    console.log('     "context": {');
    console.log('       "content": "Hello, how are you?",');
    console.log('       "conversation_id": "chat-123"');
    console.log('     }');
    console.log('   }');
    console.log('');
    console.log('🚀 Make sure agent-runner and tools-runner are running!');
    
  } catch (error) {
    console.error('❌ Failed to load chat agent:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  loadChatAgent();
}
