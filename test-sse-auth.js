// Test SSE authentication with RCRT
import fetch from 'node-fetch';
import { EventSource } from 'eventsource';

async function testSSEAuth() {
  const config = {
    rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
    ownerId: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
    agentId: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000002',
  };

  console.log('🔐 Testing SSE Authentication...\n');

  try {
    // Get JWT token
    const tokenResp = await fetch(`${config.rcrtBaseUrl}/auth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        owner_id: config.ownerId,
        agent_id: config.agentId,
        roles: ['emitter', 'subscriber']
      })
    });

    const { token: jwtToken } = await tokenResp.json();
    console.log('✅ Got JWT token\n');

    // Test 1: Try SSE with token in query parameter
    console.log('📡 Test 1: SSE with token in query parameter...');
    const sseUrl = `${config.rcrtBaseUrl}/events/stream?token=${encodeURIComponent(jwtToken)}`;
    
    const eventSource = new EventSource(sseUrl);
    
    let receivedEvents = 0;
    const maxWaitTime = 10000; // 10 seconds
    const startTime = Date.now();

    eventSource.onopen = () => {
      console.log('✅ SSE connection opened successfully!\n');
    };

    eventSource.onmessage = (event) => {
      receivedEvents++;
      try {
        const data = JSON.parse(event.data);
        console.log(`📨 Event ${receivedEvents}:`, data.type || 'unknown');
        
        if (data.type === 'ping') {
          console.log('   ↳ Received ping event');
        } else {
          console.log('   ↳ Data:', JSON.stringify(data).substring(0, 100) + '...');
        }
      } catch (error) {
        console.log(`📨 Event ${receivedEvents}: Raw data:`, event.data.substring(0, 100));
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ SSE error:', error);
      eventSource.close();
    };

    // Wait for some events or timeout
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (receivedEvents > 0 || Date.now() - startTime > maxWaitTime) {
          clearInterval(checkInterval);
          eventSource.close();
          resolve();
        }
      }, 100);
    });

    console.log(`\n📊 Summary: Received ${receivedEvents} events`);
    
    if (receivedEvents > 0) {
      console.log('✅ SSE authentication is working correctly!');
    } else {
      console.log('⚠️  No events received. This might be normal if no breadcrumbs are being created.');
    }

    // Test 2: Create a breadcrumb to trigger an event
    console.log('\n📝 Test 2: Creating a test breadcrumb to trigger SSE event...');
    
    const breadcrumbResp = await fetch(`${config.rcrtBaseUrl}/breadcrumbs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        schema_name: 'test.sse.v1',
        title: 'SSE Test Breadcrumb',
        tags: ['test:sse', 'extension:test'],
        context: {
          message: 'Testing SSE authentication',
          timestamp: new Date().toISOString()
        }
      })
    });

    if (breadcrumbResp.ok) {
      const result = await breadcrumbResp.json();
      console.log(`✅ Created test breadcrumb: ${result.id}`);
      console.log('\n💡 If SSE is working, you should see this breadcrumb event in the extension console!');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Add polyfill for EventSource if needed
if (typeof EventSource === 'undefined') {
  console.log('⚠️  EventSource not available in Node.js, install eventsource package:');
  console.log('   npm install eventsource');
  process.exit(1);
}

// Run test
testSSEAuth();
