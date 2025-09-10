#!/usr/bin/env tsx
/**
 * RCRT Tools Demo
 * Shows how to use the tool system with LangChain integration
 */

import { createClient } from '@rcrt-builder/sdk';
import { createToolRegistry } from '@rcrt-builder/tools/registry';
import { builtinTools } from '@rcrt-builder/tools';

async function main() {
  console.log('🔧 RCRT Tools Demo starting...');

  // Create RCRT client
  const client = await createClient({
    baseUrl: 'http://localhost:8081', // Direct to RCRT for this demo
    authMode: 'disabled' // Assuming dev mode
  });

  const workspace = 'workspace:tools-demo';

  // Create tool registry
  const registry = await createToolRegistry(client, workspace, {
    enableBuiltins: true,
    enableLangChain: true,
    enableUI: true,
    langchainConfig: {
      serpApiKey: process.env.SERPAPI_API_KEY
    }
  });

  console.log('✅ Tools registered:', registry.listTools());

  // Demo: Request tool execution
  console.log('\n🚀 Testing echo tool...');
  await client.createBreadcrumb({
    schema_name: 'tool.request.v1',
    title: 'Echo Test',
    tags: [workspace, 'tool:request'],
    context: {
      tool: 'echo',
      input: { message: 'Hello from RCRT Tools!' }
    }
  });

  console.log('\n🧮 Testing calculator...');
  await client.createBreadcrumb({
    schema_name: 'tool.request.v1',
    title: 'Calculator Test',
    tags: [workspace, 'tool:request'],
    context: {
      tool: 'calculator',
      input: { expression: '2 + 2 * 3' }
    }
  });

  if (process.env.SERPAPI_API_KEY) {
    console.log('\n🔍 Testing search...');
    await client.createBreadcrumb({
      schema_name: 'tool.request.v1',
      title: 'Search Test',
      tags: [workspace, 'tool:request'],
      context: {
        tool: 'serpapi',
        input: { query: 'electric bikes 2024' }
      }
    });
  }

  // Listen for results
  console.log('\n📡 Listening for tool results...');
  const stopListening = client.startEventStream((evt) => {
    if (evt.type === 'created' || evt.type === 'updated') {
      client.getBreadcrumb(evt.breadcrumb_id!).then(breadcrumb => {
        if (breadcrumb.schema_name === 'tool.response.v1') {
          console.log(`✅ Tool result from ${breadcrumb.context.tool}:`, breadcrumb.context.result);
        } else if (breadcrumb.schema_name === 'tool.error.v1') {
          console.log(`❌ Tool error from ${breadcrumb.context.tool}:`, breadcrumb.context.error);
        }
      }).catch(console.error);
    }
  }, {
    filters: { any_tags: [workspace] }
  });

  // Keep running for a bit to see results
  console.log('⏱️  Waiting for results (10 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Cleanup
  stopListening();
  await registry.stop();
  console.log('🏁 Demo completed');
}

if (require.main === module) {
  main().catch(console.error);
}
