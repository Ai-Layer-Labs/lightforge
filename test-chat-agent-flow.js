// Test Chat Agent with Tool Invocation
import fetch from 'node-fetch';

async function testChatAgent() {
  const config = {
    rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
    ownerId: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
    agentId: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000AAA',
  };

  console.log('💬 Testing Chat Agent Flow\n');

  try {
    // Get JWT token
    const tokenResp = await fetch(`${config.rcrtBaseUrl}/auth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        owner_id: config.ownerId,
        agent_id: config.agentId,
        roles: ['curator', 'emitter', 'subscriber']
      })
    });

    const { token: jwtToken } = await tokenResp.json();
    console.log('🔐 Got JWT token\n');

    // Helper to make API calls
    async function api(method, path, body = null) {
      const options = {
        method,
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      };
      if (body) options.body = JSON.stringify(body);
      
      const resp = await fetch(`${config.rcrtBaseUrl}${path}`, options);
      if (!resp.ok) {
        const error = await resp.text();
        throw new Error(`API error: ${resp.status} - ${error}`);
      }
      return resp.json();
    }

    // 1. Check if default chat agent exists
    console.log('1️⃣ Checking for default chat agent...\n');
    
    const agents = await api('GET', '/breadcrumbs?schema_name=agent.def.v1&tag=chat:default');
    if (agents.length === 0) {
      console.log('❌ No default chat agent found! Run bootstrap first.');
      return;
    }
    
    console.log(`✅ Found default chat agent: ${agents[0].title}\n`);

    // 2. Check tool catalog
    console.log('2️⃣ Checking tool catalog...\n');
    
    const catalogs = await api('GET', '/breadcrumbs?schema_name=tool.catalog.v1');
    if (catalogs.length === 0) {
      console.log('❌ No tool catalog found!');
      return;
    }
    
    // Get the catalog with transforms applied
    const catalogView = await api('GET', `/breadcrumbs/${catalogs[0].id}`);
    console.log('Tool Catalog (transformed):');
    console.log(JSON.stringify(catalogView.context, null, 2));
    console.log();

    // 3. Create a chat message
    console.log('3️⃣ Creating chat message...\n');
    
    const chatMessage = {
      schema_name: 'chat.message.v1',
      title: 'User Message',
      tags: ['chat:message', 'workspace:agents', 'user:input'],
      context: {
        user_id: config.agentId,
        message: "Hello! Can you tell me what tools you have available?",
        timestamp: new Date().toISOString()
      }
    };

    const created = await api('POST', '/breadcrumbs', chatMessage);
    console.log(`✅ Created chat message: ${created.id}\n`);

    // 4. Wait for agent response
    console.log('4️⃣ Waiting for agent response...\n');
    console.log('(Agent should process this message and create an agent.response.v1 breadcrumb)\n');
    
    // Poll for response (in real system, you'd use SSE)
    let response = null;
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const responses = await api('GET', '/breadcrumbs?schema_name=agent.response.v1&limit=1');
      if (responses.length > 0) {
        // Find response created after our message
        const recent = responses.find(r => new Date(r.created_at) > new Date(created.created_at));
        if (recent) {
          response = recent;
          break;
        }
      }
      console.log(`   Waiting... (${i+1}/10)`);
    }

    if (response) {
      console.log('✅ Got agent response!');
      const fullResponse = await api('GET', `/breadcrumbs/${response.id}`);
      console.log('\nAgent Response:');
      console.log(JSON.stringify(fullResponse.context, null, 2));
    } else {
      console.log('⏱️ No response received (agent may not be running)');
    }

    // 5. Test with tool invocation
    console.log('\n5️⃣ Testing tool invocation...\n');
    
    const toolMessage = {
      schema_name: 'chat.message.v1',
      title: 'Tool Request Message',
      tags: ['chat:message', 'workspace:agents', 'user:input'],
      context: {
        user_id: config.agentId,
        message: "Please store a file for me with the content 'Hello World' and filename 'test.txt'",
        timestamp: new Date().toISOString()
      }
    };

    const toolReq = await api('POST', '/breadcrumbs', toolMessage);
    console.log(`✅ Created tool request message: ${toolReq.id}\n`);
    console.log('(Agent should create tool.request.v1, tools-runner processes it, returns tool.response.v1)\n');

    // Monitor for tool requests
    console.log('Monitoring for tool activity...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const toolRequests = await api('GET', '/breadcrumbs?schema_name=tool.request.v1&limit=5');
    if (toolRequests.length > 0) {
      console.log(`Found ${toolRequests.length} tool requests:`);
      toolRequests.forEach(req => {
        console.log(`  - ${req.title} (tool: ${req.context.tool})`);
      });
    }

    console.log('\n🎯 Chat Agent Flow Test Complete!');
    console.log('\nKey findings:');
    console.log('- Chat agent exists: ✅');
    console.log('- Tool catalog available: ✅');
    console.log('- Message creation works: ✅');
    console.log('- Agent response: ' + (response ? '✅' : '❌ (check if agent-runner is running)'));
    console.log('- Tool requests: ' + (toolRequests.length > 0 ? '✅' : '❌ (agent may need to be running)'));

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test
testChatAgent().catch(console.error);
