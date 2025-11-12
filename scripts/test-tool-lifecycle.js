#!/usr/bin/env node
/**
 * Test Tool Lifecycle End-to-End
 * 
 * Tests the complete flow:
 * 1. Create tool with timeout field error (timeout instead of timeout_ms)
 * 2. Verify validation-specialist processes it
 * 3. Execute tool to trigger timeout
 * 4. Verify tool.error.v1 creation
 * 5. Verify tool-debugger triggers
 * 6. Verify auto-fix applied
 */

const RCRT_BASE_URL = process.env.RCRT_BASE_URL || 'http://localhost:8081';
const OWNER_ID = process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001';
const AGENT_ID = process.env.AGENT_ID || '00000000-0000-0000-0000-000000000999';

let authToken = null;

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, prefix, message) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

function success(message) { log(colors.green, '✅', message); }
function error(message) { log(colors.red, '❌', message); }
function info(message) { log(colors.blue, 'ℹ️ ', message); }
function warn(message) { log(colors.yellow, '⚠️ ', message); }
function step(message) { log(colors.cyan, '🔹', message); }

async function getAuthToken() {
  try {
    const response = await fetch(`${RCRT_BASE_URL}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner_id: OWNER_ID,
        agent_id: AGENT_ID,
        roles: ['curator', 'emitter', 'subscriber']
      })
    });
    
    if (!response.ok) {
      throw new Error(`Auth failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.token;
  } catch (err) {
    error(`Failed to get auth token: ${err.message}`);
    throw err;
  }
}

async function createTestTool() {
  step('Creating test tool with intentional timeout field error...');
  
  const toolDef = {
    schema_name: 'tool.code.v1',
    title: 'Test Timeout Tool (Lifecycle Test)',
    tags: ['tool', 'workspace:tools', 'tool:test-timeout', 'test'],
    context: {
      name: 'test-timeout',
      description: 'Test tool to verify timeout field normalization',
      code: {
        language: 'typescript',
        source: `
export async function execute(input: any, context: any) {
  // Simulate slow operation
  await new Promise(resolve => setTimeout(resolve, 5000));
  return { success: true, message: 'Completed after 5 seconds' };
}
`
      },
      input_schema: {
        type: 'object',
        properties: {
          test: { type: 'string', description: 'Test parameter' }
        },
        required: []
      },
      output_schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' }
        }
      },
      limits: {
        timeout: 3000,  // ❌ WRONG: Should be timeout_ms
        memory_mb: 128,
        cpu_percent: 50
      },
      permissions: {
        net: false,
        read: false,
        write: false,
        env: false,
        run: false,
        ffi: false,
        hrtime: true
      },
      required_secrets: [],
      ui_schema: {
        configurable: false
      }
    }
  };
  
  try {
    const response = await fetch(`${RCRT_BASE_URL}/breadcrumbs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(toolDef)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create tool: ${response.status} ${await response.text()}`);
    }
    
    const data = await response.json();
    success(`Tool created with ID: ${data.id}`);
    info(`Tool has intentional error: limits.timeout instead of limits.timeout_ms`);
    return data.id;
  } catch (err) {
    error(`Failed to create test tool: ${err.message}`);
    throw err;
  }
}

async function waitForValidation(toolId, maxWaitSeconds = 30) {
  step(`Waiting for validation-specialist to process tool (max ${maxWaitSeconds}s)...`);
  
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await fetch(`${RCRT_BASE_URL}/breadcrumbs/${toolId}/full`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        const tool = await response.json();
        
        if (tool.tags.includes('approved') && tool.tags.includes('validated')) {
          success('Tool approved by validation-specialist!');
          info(`Tags: ${tool.tags.join(', ')}`);
          return { approved: true, tool };
        } else if (tool.tags.includes('rejected')) {
          warn('Tool rejected by validation-specialist');
          return { approved: false, tool };
        }
      }
    } catch (err) {
      warn(`Error checking tool status: ${err.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  warn('Timeout waiting for validation');
  return { approved: false, timeout: true };
}

async function executeTool(toolId) {
  step('Executing tool to trigger timeout error...');
  
  const requestDef = {
    schema_name: 'tool.request.v1',
    title: 'Test Timeout Execution',
    tags: ['tool:request', 'workspace:tools', 'test'],
    context: {
      tool: 'test-timeout',
      input: { test: 'value' },
      requestId: `test-timeout-${Date.now()}`,
      requestedBy: 'test-script'
    }
  };
  
  try {
    const response = await fetch(`${RCRT_BASE_URL}/breadcrumbs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestDef)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create tool request: ${response.status}`);
    }
    
    const data = await response.json();
    success(`Tool request created: ${data.id}`);
    info('Tool will timeout after 3 seconds (timeout field) but execution takes 5 seconds');
    return data.id;
  } catch (err) {
    error(`Failed to execute tool: ${err.message}`);
    throw err;
  }
}

async function waitForToolError(requestId, maxWaitSeconds = 15) {
  step(`Waiting for tool.error.v1 to be created (max ${maxWaitSeconds}s)...`);
  
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await fetch(
        `${RCRT_BASE_URL}/breadcrumbs?schema_name=tool.error.v1&tag=tool:test-timeout`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      
      if (response.ok) {
        const errors = await response.json();
        if (errors.length > 0) {
          const latestError = errors[0];
          success('tool.error.v1 breadcrumb created!');
          info(`Error ID: ${latestError.id}`);
          info(`Error type: ${latestError.tags.find(t => t.startsWith('error:'))}`);
          return latestError;
        }
      }
    } catch (err) {
      warn(`Error checking for tool.error.v1: ${err.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  warn('Timeout waiting for tool.error.v1');
  return null;
}

async function checkDebuggerResponse(maxWaitSeconds = 30) {
  step(`Waiting for tool-debugger response (max ${maxWaitSeconds}s)...`);
  
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await fetch(
        `${RCRT_BASE_URL}/breadcrumbs?schema_name=agent.response.v1&tag=tool:debugging`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      
      if (response.ok) {
        const responses = await response.json();
        if (responses.length > 0) {
          success('tool-debugger created response!');
          const latest = responses[0];
          info(`Response: ${latest.context.message || 'No message'}`);
          return latest;
        }
      }
    } catch (err) {
      warn(`Error checking for debugger response: ${err.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  warn('Timeout waiting for tool-debugger response');
  return null;
}

async function verifyToolFixed(toolId) {
  step('Verifying tool was fixed by debugger...');
  
  try {
    const response = await fetch(`${RCRT_BASE_URL}/breadcrumbs/${toolId}/full`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch tool: ${response.status}`);
    }
    
    const tool = await response.json();
    
    // Check if timeout_ms exists and timeout doesn't
    const hasTimeoutMs = 'timeout_ms' in tool.context.limits;
    const hasTimeout = 'timeout' in tool.context.limits;
    
    if (hasTimeoutMs && !hasTimeout) {
      success('Tool FIXED! limits.timeout → limits.timeout_ms');
      info(`New value: limits.timeout_ms = ${tool.context.limits.timeout_ms}`);
      return true;
    } else if (hasTimeout && !hasTimeoutMs) {
      warn('Tool NOT fixed yet - still has limits.timeout');
      return false;
    } else if (hasTimeoutMs && hasTimeout) {
      warn('Tool has BOTH fields - partial fix?');
      return false;
    } else {
      error('Tool has NEITHER field - unexpected state');
      return false;
    }
  } catch (err) {
    error(`Failed to verify tool fix: ${err.message}`);
    return false;
  }
}

async function runFullTest() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 RCRT Tool Lifecycle End-to-End Test');
  console.log('='.repeat(70) + '\n');
  
  try {
    // Step 1: Authenticate
    info('Step 1: Authenticating...');
    authToken = await getAuthToken();
    success('Authenticated successfully\n');
    
    // Step 2: Create test tool
    info('Step 2: Creating test tool with intentional error...');
    const toolId = await createTestTool();
    console.log('');
    
    // Step 3: Wait for validation
    info('Step 3: Waiting for validation...');
    const validationResult = await waitForValidation(toolId);
    console.log('');
    
    if (!validationResult.approved) {
      error('Tool not approved - cannot continue test');
      return;
    }
    
    // Step 4: Execute tool (will timeout)
    info('Step 4: Executing tool (should timeout)...');
    const requestId = await executeTool(toolId);
    console.log('');
    
    // Step 5: Wait for error breadcrumb
    info('Step 5: Waiting for tool.error.v1...');
    const errorBreadcrumb = await waitForToolError(requestId);
    console.log('');
    
    if (!errorBreadcrumb) {
      error('No tool.error.v1 created - auto-debugging cannot trigger');
      warn('Check tools-runner logs for error creation');
      return;
    }
    
    // Step 6: Wait for debugger response
    info('Step 6: Waiting for tool-debugger response...');
    const debuggerResponse = await checkDebuggerResponse();
    console.log('');
    
    if (!debuggerResponse) {
      warn('No tool-debugger response found');
      warn('Check context-builder and agent-runner logs');
    }
    
    // Step 7: Verify fix applied
    info('Step 7: Verifying tool was fixed...');
    const isFixed = await verifyToolFixed(toolId);
    console.log('');
    
    // Summary
    console.log('='.repeat(70));
    console.log('📊 Test Summary');
    console.log('='.repeat(70));
    console.log(`✅ Tool created: ${toolId}`);
    console.log(`${validationResult.approved ? '✅' : '❌'} Validation: ${validationResult.approved ? 'Approved' : 'Failed'}`);
    console.log(`${errorBreadcrumb ? '✅' : '❌'} Error detection: ${errorBreadcrumb ? 'Yes' : 'No'}`);
    console.log(`${debuggerResponse ? '✅' : '❌'} Debugger response: ${debuggerResponse ? 'Yes' : 'No'}`);
    console.log(`${isFixed ? '✅' : '❌'} Tool fixed: ${isFixed ? 'Yes' : 'No'}`);
    console.log('='.repeat(70) + '\n');
    
    if (validationResult.approved && errorBreadcrumb && debuggerResponse && isFixed) {
      success('🎉 ALL TESTS PASSED! Complete lifecycle working end-to-end!');
    } else {
      warn('⚠️  PARTIAL SUCCESS - Some steps incomplete');
      info('Check service logs for details:');
      info('  docker compose logs context-builder -f | grep test-timeout');
      info('  docker compose logs agent-runner -f | grep test-timeout');
      info('  docker compose logs tools-runner -f | grep test-timeout');
    }
    
  } catch (err) {
    error(`Test failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

// Run the test
runFullTest().catch(console.error);

