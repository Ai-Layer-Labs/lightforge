#!/usr/bin/env node
/**
 * Test Chat Flow
 * Simulates the extension sending a chat message via breadcrumb
 */

async function testChatFlow() {
  console.log('🧪 Testing RCRT chat flow...');
  
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
    
    // Create a test chat message breadcrumb (simulating what the extension would do)
    const chatMessage = {
      schema_name: 'user.message.v1',
      title: 'Test Extension Chat Message',
      tags: ['extension:chat', 'user:message'],
      context: {
        content: 'Hello! Can you help me list my files?',
        conversation_id: `test-chat-${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: 'test-script'
      }
    };
    
    console.log('📝 Creating test chat message breadcrumb...');
    
    const response = await fetch(`${RCRT_BASE_URL}/breadcrumbs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chatMessage)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to create chat message:`, errorText);
      process.exit(1);
    }
    
    const result = await response.json();
    console.log(`✅ Created chat message breadcrumb with ID: ${result.id}`);
    
    console.log('');
    console.log('🎯 Expected flow:');
    console.log('1. ✅ Chat message breadcrumb created');
    console.log('2. 🔄 Agent-runner should detect the message (tags: extension:chat, user:message)');
    console.log('3. 🔄 Agent-runner should call OpenRouter LLM tool');
    console.log('4. 🔄 Tools-runner should execute OpenRouter tool');
    console.log('5. 🔄 Agent-runner should create agent.response.v1 breadcrumb');
    console.log('6. 🔄 Extension should receive SSE event and display response');
    console.log('');
    console.log('💡 Check the agent-runner and tools-runner logs to see if they processed this message!');
    console.log('💡 You can also search for breadcrumbs with tags: agent:response, extension:chat');
    
    // Wait a bit and then check for responses
    console.log('');
    console.log('⏳ Waiting 5 seconds to check for agent responses...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Search for agent responses
    const searchResponse = await fetch(`${RCRT_BASE_URL}/breadcrumbs/search?q=agent response&limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (searchResponse.ok) {
      const responses = await searchResponse.json();
      const chatResponses = responses.filter(r => 
        r.tags?.includes('agent:response') && r.tags?.includes('extension:chat')
      );
      
      if (chatResponses.length > 0) {
        console.log('🎉 Found agent responses:');
        chatResponses.forEach(response => {
          console.log(`  - ${response.title} (${response.id})`);
          console.log(`    Content: ${response.context?.content || 'No content'}`);
        });
      } else {
        console.log('⏰ No agent responses found yet. The agent might still be processing or there might be an issue.');
        console.log('   Check that:');
        console.log('   - Agent-runner is running and connected');
        console.log('   - Tools-runner is running and connected');
        console.log('   - Chat agent definition has been loaded');
        console.log('   - OpenRouter API key is configured in secrets');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testChatFlow();
}
