// Simple script to send a chat message to the system
import fetch from 'node-fetch';

async function sendChatMessage(message) {
  const config = {
    rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
    ownerId: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
    agentId: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000AAA',
  };

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

    // Create chat message breadcrumb
    const chatMessage = {
      schema_name: 'chat.message.v1',
      title: 'User Message',
      tags: ['chat:message', 'workspace:agents', 'user:input'],
      context: {
        user_id: config.agentId,
        message: message,
        timestamp: new Date().toISOString(),
        session_id: `session-${Date.now()}`
      }
    };

    const resp = await fetch(`${config.rcrtBaseUrl}/breadcrumbs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chatMessage)
    });

    if (!resp.ok) {
      throw new Error(`Failed to create message: ${resp.status}`);
    }

    const result = await resp.json();
    console.log(`✅ Message sent! ID: ${result.id}`);
    console.log(`📨 "${message}"`);
    console.log('\nThe chat agent should pick this up and respond...');
    console.log('Check the dashboard or logs for the response.');

  } catch (error) {
    console.error('❌ Failed to send message:', error);
  }
}

// Get message from command line or use default
const message = process.argv.slice(2).join(' ') || "Hello! What tools do you have available?";

console.log('💬 Sending chat message to RCRT...\n');
sendChatMessage(message);
