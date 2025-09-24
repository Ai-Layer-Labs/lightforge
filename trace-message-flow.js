#!/usr/bin/env node

const fetch = require('node-fetch');

const RCRT_BASE_URL = process.env.RCRT_BASE_URL || 'http://localhost:8081';
const TOKEN = process.env.RCRT_TOKEN || '';

async function authenticate() {
  const response = await fetch(`${RCRT_BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner_id: '00000000-0000-0000-0000-000000000001',
      agent_id: '00000000-0000-0000-0000-000000000003',
      roles: ['curator']
    })
  });
  
  if (!response.ok) {
    throw new Error(`Auth failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.token;
}

async function getRecentBreadcrumbs(token, limit = 10) {
  const response = await fetch(`${RCRT_BASE_URL}/breadcrumbs?limit=${limit}&sort=desc`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get breadcrumbs: ${response.status}`);
  }
  
  return response.json();
}

async function getBreadcrumbFull(token, id) {
  const response = await fetch(`${RCRT_BASE_URL}/breadcrumbs/${id}/full`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get breadcrumb ${id}: ${response.status}`);
  }
  
  return response.json();
}

async function traceMessageFlow() {
  try {
    console.log('🔐 Authenticating...');
    const token = await authenticate();
    
    console.log('📋 Getting recent breadcrumbs...');
    const breadcrumbs = await getRecentBreadcrumbs(token, 20);
    
    console.log(`\n📊 Found ${breadcrumbs.length} recent breadcrumbs\n`);
    
    // Find user messages
    const userMessages = breadcrumbs.filter(b => 
      b.schema_name === 'user.message.v1' || 
      b.tags?.includes('user:message') ||
      b.tags?.includes('extension:chat')
    );
    
    console.log(`\n👤 USER MESSAGES (${userMessages.length} found):`);
    for (const msg of userMessages) {
      const full = await getBreadcrumbFull(token, msg.id);
      console.log(`\n  ID: ${msg.id}`);
      console.log(`  Created: ${new Date(msg.created_at).toLocaleString()}`);
      console.log(`  Title: ${msg.title}`);
      console.log(`  Tags: ${msg.tags?.join(', ')}`);
      console.log(`  Context:`, JSON.stringify(full.context, null, 2));
    }
    
    // Find tool requests
    const toolRequests = breadcrumbs.filter(b => 
      b.schema_name === 'tool.request.v1' || 
      b.tags?.includes('tool:request')
    );
    
    console.log(`\n🔧 TOOL REQUESTS (${toolRequests.length} found):`);
    for (const req of toolRequests) {
      const full = await getBreadcrumbFull(token, req.id);
      console.log(`\n  ID: ${req.id}`);
      console.log(`  Created: ${new Date(req.created_at).toLocaleString()}`);
      console.log(`  Title: ${req.title}`);
      console.log(`  Tags: ${req.tags?.join(', ')}`);
      console.log(`  Context:`, JSON.stringify(full.context, null, 2));
    }
    
    // Find tool responses
    const toolResponses = breadcrumbs.filter(b => 
      b.schema_name === 'tool.response.v1' || 
      b.tags?.includes('tool:response')
    );
    
    console.log(`\n✅ TOOL RESPONSES (${toolResponses.length} found):`);
    for (const resp of toolResponses) {
      const full = await getBreadcrumbFull(token, resp.id);
      console.log(`\n  ID: ${resp.id}`);
      console.log(`  Created: ${new Date(resp.created_at).toLocaleString()}`);
      console.log(`  Title: ${resp.title}`);
      console.log(`  Tags: ${resp.tags?.join(', ')}`);
      console.log(`  Tool: ${full.context?.tool}`);
      console.log(`  Status: ${full.context?.status}`);
      
      // For tool responses, show just the first part of the output
      if (full.context?.output?.content) {
        const content = full.context.output.content;
        const preview = content.substring(0, 200) + (content.length > 200 ? '...' : '');
        console.log(`  Output preview: ${preview}`);
      }
      
      // Show the input that was sent to the tool
      if (full.context?.input) {
        console.log(`  Input sent to tool:`, JSON.stringify(full.context.input, null, 2));
      }
    }
    
    // Find agent responses
    const agentResponses = breadcrumbs.filter(b => 
      b.schema_name === 'agent.response.v1' || 
      b.tags?.includes('agent:response')
    );
    
    console.log(`\n🤖 AGENT RESPONSES (${agentResponses.length} found):`);
    for (const resp of agentResponses) {
      const full = await getBreadcrumbFull(token, resp.id);
      console.log(`\n  ID: ${resp.id}`);
      console.log(`  Created: ${new Date(resp.created_at).toLocaleString()}`);
      console.log(`  Title: ${resp.title}`);
      console.log(`  Tags: ${resp.tags?.join(', ')}`);
      console.log(`  Context:`, JSON.stringify(full.context, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

traceMessageFlow();
