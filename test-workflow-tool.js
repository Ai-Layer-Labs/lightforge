#!/usr/bin/env node

/**
 * Test script for the workflow orchestrator tool
 * Run this after starting RCRT to test workflow functionality
 */

const fs = require('fs').promises;
const path = require('path');

const CONFIG = {
  rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:7777'
};

// Helper function to sleep
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getToken() {
  const fetch = require('node-fetch');
  const response = await fetch(`${CONFIG.rcrtBaseUrl}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner_id: 'test-user',
      agent_id: 'workflow-test',
      roles: ['curator', 'emitter', 'subscriber']
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get token: ${response.status}`);
  }
  
  const data = await response.json();
  return data.token;
}

async function getToolCatalog(token) {
  const fetch = require('node-fetch');
  
  const response = await fetch(
    `${CONFIG.rcrtBaseUrl}/breadcrumbs?schema_name=tool.catalog.v1&tag=workspace:tools`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to get tool catalog: ${response.status}`);
  }
  
  const catalogs = await response.json();
  if (catalogs.length === 0) {
    throw new Error('No tool catalog found');
  }
  
  // Get full catalog details
  const catalogResponse = await fetch(
    `${CONFIG.rcrtBaseUrl}/breadcrumbs/${catalogs[0].id}/full`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  if (!catalogResponse.ok) {
    throw new Error(`Failed to get catalog details: ${catalogResponse.status}`);
  }
  
  const catalog = await catalogResponse.json();
  return catalog.context.tools;
}

async function createWorkflowRequest(token, tools) {
  const fetch = require('node-fetch');
  
  // Find tools we need from the catalog
  const numberTool = Object.entries(tools).find(([name, tool]) => 
    tool.description && tool.description.toLowerCase().includes('random')
  );
  const calcTool = Object.entries(tools).find(([name, tool]) => 
    tool.description && tool.description.toLowerCase().includes('calc') ||
    tool.description && tool.description.toLowerCase().includes('math')
  );
  
  if (!numberTool || !calcTool) {
    throw new Error('Required tools not found in catalog. Need random number and calculator tools.');
  }
  
  const [numberToolName] = numberTool;
  const [calcToolName] = calcTool;
  
  console.log(`📚 Using tools: ${numberToolName} and ${calcToolName}`);
  
  // Create a workflow request to generate two random numbers and add them
  const workflowRequest = {
    schema_name: 'tool.request.v1',
    title: 'Workflow Test: Combine Two Operations',
    tags: ['tool:request', 'workflow:test', 'workspace:tools'],
    context: {
      tool: 'workflow',
      input: {
        steps: [
          {
            id: 'num1',
            tool: numberToolName,
            input: { min: 10, max: 50 }
          },
          {
            id: 'num2',
            tool: numberToolName,
            input: { min: 10, max: 50 }
          },
          {
            id: 'sum',
            tool: calcToolName,
            input: { expression: '${num1} + ${num2}' },
            dependencies: ['num1', 'num2']
          }
        ],
        returnStep: 'sum'
      },
      requestId: `workflow-test-${Date.now()}`,
      requestedBy: 'workflow-test-script'
    }
  };
  
  console.log('📝 Creating workflow request:', JSON.stringify(workflowRequest.context.input, null, 2));
  
  const response = await fetch(`${CONFIG.rcrtBaseUrl}/breadcrumbs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(workflowRequest)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create workflow request: ${response.status} - ${error}`);
  }
  
  const result = await response.json();
  return { breadcrumbId: result.id, requestId: workflowRequest.context.requestId };
}

async function waitForResponse(token, requestId) {
  const fetch = require('node-fetch');
  const startTime = Date.now();
  const timeout = 30000; // 30 seconds
  
  console.log(`⏳ Waiting for workflow response (requestId: ${requestId})...`);
  
  while (Date.now() - startTime < timeout) {
    try {
      // Search for tool response
      const response = await fetch(
        `${CONFIG.rcrtBaseUrl}/breadcrumbs?schema_name=tool.response.v1&tag=request:${requestId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (!response.ok) {
        console.warn(`Search failed: ${response.status}`);
        await sleep(1000);
        continue;
      }
      
      const breadcrumbs = await response.json();
      
      if (breadcrumbs.length > 0) {
        // Get full breadcrumb details
        const fullResponse = await fetch(
          `${CONFIG.rcrtBaseUrl}/breadcrumbs/${breadcrumbs[0].id}/full`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        
        if (fullResponse.ok) {
          const result = await fullResponse.json();
          return result.context;
        }
      }
    } catch (error) {
      console.warn('Error checking for response:', error.message);
    }
    
    await sleep(1000);
  }
  
  throw new Error(`Timeout waiting for workflow response after ${timeout}ms`);
}

async function main() {
  console.log('🚀 Testing Workflow Orchestrator Tool');
  console.log(`📍 RCRT Base URL: ${CONFIG.rcrtBaseUrl}`);
  
  try {
    // Get auth token
    console.log('\n🔑 Getting auth token...');
    const token = await getToken();
    console.log('✅ Got token');
    
    // Get tool catalog
    console.log('\n📚 Getting tool catalog...');
    const tools = await getToolCatalog(token);
    console.log(`✅ Found ${Object.keys(tools).length} tools in catalog`);
    
    // Create workflow request
    console.log('\n🔧 Creating workflow request...');
    const { breadcrumbId, requestId } = await createWorkflowRequest(token, tools);
    console.log(`✅ Created workflow request: ${breadcrumbId}`);
    
    // Wait for response
    const response = await waitForResponse(token, requestId);
    console.log('\n✅ Workflow completed!');
    console.log('📊 Result:', JSON.stringify(response, null, 2));
    
    if (response.output) {
      console.log('\n🎯 Final result:', response.output);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
