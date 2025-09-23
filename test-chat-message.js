// Test sending a chat message

async function sendChatMessage() {
  try {
    const tokenResp = await fetch('http://localhost:8081/auth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        owner_id: '00000000-0000-0000-0000-000000000001',
        agent_id: '00000000-0000-0000-0000-000000000AAA',
        roles: ['curator', 'emitter', 'subscriber']
      })
    });
    const { token } = await tokenResp.json();
    console.log('✅ Got JWT token');

    // Create a chat message
    const message = {
      schema_name: 'chat.message.v1',
      title: 'Test Chat Message',
      tags: ['chat:message', 'workspace:agents', 'extension:chat'],
      context: {
        message: 'Hello! What tools do you have available?',
        sender: 'user',
        conversation_id: `test-${Date.now()}`,
        timestamp: new Date().toISOString()
      }
    };

    console.log('\n💬 Sending chat message:', message.context.message);

    const createResp = await fetch('http://localhost:8081/breadcrumbs', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    const created = await createResp.json();
    console.log('✅ Chat message created:', created.id);
    
    // Wait a bit for agent to process
    console.log('\n⏳ Waiting for agent response...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check for agent responses
    const responseSearch = await fetch('http://localhost:8081/breadcrumbs?schema_name=agent.response.v1&limit=5', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const responses = await responseSearch.json();
    console.log(`\n📨 Found ${responses.length} agent responses`);
    
    if (responses.length > 0) {
      const latest = responses[0];
      
      // Get full response details
      const fullResp = await fetch(`http://localhost:8081/breadcrumbs/${latest.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const full = await fullResp.json();
      
      console.log('\n🤖 Agent Response:');
      console.log('Message:', full.context?.message || 'No message');
      
      if (full.context?.tool_requests?.length > 0) {
        console.log('\n🔧 Tool Requests:', full.context.tool_requests.length);
        full.context.tool_requests.forEach(tr => {
          console.log(`  - ${tr.tool}: ${JSON.stringify(tr.input)}`);
        });
      }
    } else {
      console.log('\n❌ No agent response found');
      
      // Check agent runner logs
      console.log('\n💡 Tip: Check agent logs with:');
      console.log('  docker logs breadcrums-agent-runner-1 --tail 50');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

sendChatMessage();
