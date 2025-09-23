#!/usr/bin/env tsx
/**
 * Test script for the modern agent-runner
 * Creates a test agent definition and triggers it
 */

import { createClient, RcrtClientEnhanced } from '@rcrt-builder/sdk';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
  workspace: process.env.WORKSPACE || 'workspace:agents',
};

async function main() {
  console.log('🧪 Testing Modern Agent Runner...\n');

  // Get JWT token
  const tokenRequest = {
    owner_id: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
    agent_id: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000TEST',
    roles: ['curator', 'emitter', 'subscriber']
  };
  
  const resp = await fetch(`${config.rcrtBaseUrl}/auth/token`, { 
    method: 'POST', 
    headers: { 'content-type': 'application/json' }, 
    body: JSON.stringify(tokenRequest)
  });
  
  const { token } = await resp.json();
  const client = new RcrtClientEnhanced(config.rcrtBaseUrl, 'jwt', token);

  // Step 1: Create a test agent definition
  console.log('📝 Creating test agent definition...');
  
  const agentDef = await client.createBreadcrumb({
    schema_name: 'agent.def.v1',
    title: 'Test Echo Agent',
    tags: [config.workspace, 'agent:def', 'test'],
    context: {
      agent_id: 'test-echo-agent',
      agent_name: 'Echo Agent',
      description: 'Test agent that echoes messages',
      model: 'openrouter/openai/gpt-3.5-turbo',
      system_prompt: `You are an echo agent. When you receive a message, respond with:
        1. Acknowledge you received it
        2. Echo back the key information
        3. Add a fun fact about the number of words in the message
        
        Always respond with JSON containing:
        - action: "create"
        - breadcrumb: object with title, tags, and context for the response`,
      
      subscriptions: {
        selectors: [
          {
            all_tags: ['test:trigger', config.workspace],
            schema_name: 'test.message.v1'
          }
        ]
      },
      
      capabilities: {
        can_create_breadcrumbs: true,
        can_update_own: false,
        can_spawn_agents: false
      },
      
      temperature: 0.7,
      max_tokens: 500
    }
  });
  
  console.log(`✅ Created agent definition: ${agentDef.id}`);
  console.log('⏳ Waiting for agent to be registered...\n');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Step 2: Create a trigger event
  console.log('🎯 Creating trigger event...');
  
  const trigger = await client.createBreadcrumb({
    schema_name: 'test.message.v1',
    title: 'Test Message for Echo Agent',
    tags: ['test:trigger', config.workspace],
    context: {
      message: 'Hello, modern agent runner! This is a test message with exactly thirteen words.',
      timestamp: new Date().toISOString(),
      test_id: `test-${Date.now()}`
    }
  });
  
  console.log(`✅ Created trigger: ${trigger.id}`);
  console.log('⏳ Waiting for agent response...\n');
  
  // Step 3: Wait and check for response
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const responses = await client.searchBreadcrumbs({
    tag: 'agent:metrics',
    created_after: new Date(Date.now() - 60000).toISOString()
  });
  
  if (responses.length > 0) {
    console.log('📊 Agent Metrics:');
    responses.forEach(r => {
      console.log(`  - Agent: ${r.context.agent_id}`);
      console.log(`    Events: ${r.context.metrics.total_events_processed}`);
      console.log(`    Errors: ${r.context.metrics.error_count}`);
    });
  }
  
  // Check for agent response
  const agentResponses = await client.searchBreadcrumbs({
    tag: 'test',
    created_after: trigger.created_at
  });
  
  console.log(`\n📬 Found ${agentResponses.length} potential responses`);
  
  agentResponses.forEach(r => {
    console.log(`\n  Response: ${r.title}`);
    console.log(`  Tags: ${r.tags.join(', ')}`);
    console.log(`  Context:`, JSON.stringify(r.context, null, 2));
  });
  
  console.log('\n✅ Test complete!');
}

main().catch(console.error);
