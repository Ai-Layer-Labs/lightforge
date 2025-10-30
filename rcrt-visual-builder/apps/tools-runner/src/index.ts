#!/usr/bin/env node
/**
 * RCRT Tools Runner
 * Standalone service that registers and runs tools for the RCRT ecosystem
 * Works in Docker, local Node.js, or Electron environments
 */

import dotenv from 'dotenv';
import { createClient, RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { ToolLoader, bootstrapTools, bootstrapContextConfigs, DenoToolRuntime } from '@rcrt-builder/tools';
import { jsonrepair } from 'jsonrepair';
import { EventBridge } from './event-bridge.js';

// Track processing status to prevent legitimate RCRT duplicate events (created + updated)
const processingStatus = new Map<string, 'processing' | 'completed'>();

// Global event bridge for tools to wait for events
const globalEventBridge = new EventBridge();

// Global Deno runtime for self-contained tools (Phase 1)
let globalDenoRuntime: DenoToolRuntime | null = null;

// 🎯 CLEAN CENTRALIZED SSE DISPATCHER
// Single SSE connection that routes to individual tools (more efficient than 14 connections)
async function startCentralizedSSEDispatcher(
  client: RcrtClientEnhanced, 
  workspace: string, 
  jwtToken?: string
): Promise<void> {
  let retryAttempts = 0;
  const maxRetries = 3;
  
  const connect = async (): Promise<void> => {
    try {
      console.log('📡 Starting centralized SSE dispatcher...');
      console.log(`🔌 Connecting to SSE: ${client.baseUrl}/events/stream`);
      
      // Get current token from client (it may have been refreshed)
      const currentToken = client.getToken() || jwtToken;
      
      const response = await fetch(`${client.baseUrl}/events/stream`, {
        headers: {
          'Authorization': currentToken ? `Bearer ${currentToken}` : '',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (response.status === 401 && retryAttempts < maxRetries) {
        // Try to refresh token
        console.log('🔄 SSE got 401, attempting to refresh token...');
        const refreshed = await client.refreshTokenIfNeeded();
        if (refreshed) {
          retryAttempts++;
          return connect(); // Retry with new token
        }
      }
      
      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status}`);
      }
      
      retryAttempts = 0; // Reset on success
      
      console.log('✅ Centralized SSE dispatcher connected');
      
      // Set up periodic token refresh (every 10 minutes)
      const tokenRefreshInterval = setInterval(async () => {
        console.log('🔄 Proactively refreshing token...');
        try {
          await client.refreshTokenIfNeeded();
        } catch (error) {
          console.warn('Failed to refresh token:', error);
        }
      }, 10 * 60 * 1000); // 10 minutes
      
      const reader = response.body?.getReader();
      if (!reader) {
        clearInterval(tokenRefreshInterval);
        throw new Error('No SSE stream reader available');
      }
      
      try {
        // Process SSE events and dispatch to appropriate tools
        let buffer = '';  // Buffer for handling split JSON across chunks
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = new TextDecoder().decode(value);
          buffer += chunk;
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';  // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                // Server-generated JSON is always valid - parse directly
                // jsonrepair is ONLY for LLM output, not server events!
                const eventData = JSON.parse(line.slice(6));
                
                // 🔧 DEBUG: Log all incoming events for diagnosis
                if (eventData.type !== 'ping') {
                  console.log(`📡 SSE Event received:`, {
                    type: eventData.type,
                    schema_name: eventData.schema_name,
                    tags: eventData.tags,
                    breadcrumb_id: eventData.breadcrumb_id
                  });
                }
                
                // Feed event to bridge BEFORE dispatching
                if (eventData.type === 'breadcrumb.updated') {
                  try {
                    const breadcrumb = await client.getBreadcrumb(eventData.breadcrumb_id);
                    globalEventBridge.handleEvent(eventData, breadcrumb);
                  } catch (e) {
                    console.warn('[EventBridge] Failed to feed event:', e);
                  }
                }
                
                // Execute tools asynchronously (don't block SSE stream!)
                dispatchEventToTool(eventData, client, workspace)
                  .catch(error => {
                    console.error('❌ Tool dispatch error:', error);
                  });
              } catch (error) {
                console.warn('Failed to parse SSE event:', line, error);
              }
            }
          }
        }
      } finally {
        clearInterval(tokenRefreshInterval);
      }
    } catch (error) {
      console.error('❌ Centralized SSE dispatcher error:', error);
      // Retry connection after delay
      setTimeout(() => connect(), 5000);
    }
  };
  
  await connect();
}

/**
 * Start a continuous tool (long-running background tool)
 */
async function startContinuousTool(
  tool: any,
  denoRuntime: DenoToolRuntime,
  client: RcrtClientEnhanced,
  workspace: string
): Promise<void> {
  const toolName = tool.context.name;
  console.log(`🔄 Starting continuous tool: ${toolName}`);
  
  // Execute tool in background (it should have an infinite loop or long-running process)
  const input = tool.context.bootstrap?.input || {};
  
  try {
    // Note: This will run indefinitely until the process is killed
    const result = await denoRuntime.executeTool({
      tool_name: toolName,
      input,
      request_id: `continuous-${toolName}-${Date.now()}`,
      agent_id: 'bootstrap',
      workspace,
      trigger_event: {
        schema_name: 'system.startup.v1',
        timestamp: new Date().toISOString(),
        mode: 'continuous'
      }
    });
    
    // If the tool exits (it shouldn't for continuous tools), log it
    console.warn(`⚠️ Continuous tool ${toolName} exited:`, result);
  } catch (error) {
    console.error(`❌ Continuous tool ${toolName} error:`, error);
    // Optionally: restart the tool after a delay
    console.log(`🔄 Restarting ${toolName} in 10 seconds...`);
    setTimeout(() => {
      startContinuousTool(tool, denoRuntime, client, workspace);
    }, 10000);
  }
}

// Dispatch SSE events to appropriate tools
async function dispatchEventToTool(
  eventData: any, 
  client: RcrtClientEnhanced, 
  workspace: string
): Promise<void> {
  // 🎯 THE RCRT WAY: Check if event matches ANY tool's subscriptions (like agents!)
  if (eventData.type === 'breadcrumb.updated' || eventData.type === 'breadcrumb.created') {
    await checkToolSubscriptions(eventData, client, workspace);
  }
  
  // Only process tool.request.v1 breadcrumb events with deduplication
  const isToolRequest = eventData.schema_name === 'tool.request.v1' &&
      eventData.tags?.includes('tool:request') &&
      eventData.tags?.includes(workspace) &&
      !eventData.tags?.includes('health:check');
  
  // Process tool requests even if type is missing (SSE parsing issue workaround)
  if (isToolRequest) {
    
    // 🔧 PROPER DEDUPLICATION: Prevent processing same request while in progress
    const requestId = eventData.breadcrumb_id;
    const currentStatus = processingStatus.get(requestId);
    
    if (currentStatus === 'processing') {
      console.log(`⏭️ Request ${requestId} already being processed, skipping duplicate`);
      return;
    }
    
    if (currentStatus === 'completed') {
      console.log(`⏭️ Request ${requestId} already completed, skipping duplicate`);
      return;
    }
    
    console.log(`🎯 Processing tool request: ${requestId}`);
    processingStatus.set(requestId, 'processing'); // 🔧 Mark as processing
    
    // 🧹 Periodic cleanup of old processing entries to allow legitimate updates
    if (processingStatus.size > 100) {
      console.log(`🧹 Cleaning up ${processingStatus.size} processing entries...`);
      processingStatus.clear(); // Simple cleanup - real systems could use TTL
    }
    
    try {
      // Get full breadcrumb details
      const breadcrumb = await client.getBreadcrumb(eventData.breadcrumb_id);
      const toolName = breadcrumb.context?.tool;
      const toolInput = breadcrumb.context?.input;
      
      // 🔧 DEBUG: Log the input being passed to tools
      console.log(`🔍 Tool input debugging:`, {
        toolName,
        toolInput: JSON.stringify(toolInput, null, 2),
        hasMessages: toolInput?.messages ? 'YES' : 'NO',
        inputType: typeof toolInput,
        inputKeys: toolInput ? Object.keys(toolInput) : []
      });
      
      if (!toolName || !toolInput) {
        console.warn('❌ Invalid tool request - missing tool or input');
        return;
      }
      
      // RCRT-Native: Load tool from breadcrumbs ONLY
      console.log(`🔍 Loading tool ${toolName} from breadcrumbs...`);
      console.log(`🔍 Workspace: ${workspace}`);
      
      const { ToolLoader } = await import('@rcrt-builder/tools');
      const loader = new ToolLoader(client, workspace);
      
      // Check if tool exists as tool.code.v1 (new self-contained format)
      const newToolBreadcrumbs = await client.searchBreadcrumbs({
        schema_name: 'tool.code.v1',
        tag: `tool:${toolName}`
      });
      
      if (newToolBreadcrumbs.length > 0 && globalDenoRuntime) {
        // Execute via Deno runtime (new system)
        console.log(`🦕 Executing ${toolName} via Deno runtime (tool.code.v1)`);
        
        const startTime = Date.now();
        const executionResult = await globalDenoRuntime.executeTool({
          tool_name: toolName,
          input: toolInput,
          request_id: breadcrumb.id,
          agent_id: breadcrumb.created_by || 'tools-runner',
          workspace: workspace,
          trigger_event: eventData
        });
        
        const executionTime = Date.now() - startTime;
        
        if (!executionResult.success) {
          throw new Error(executionResult.error || 'Tool execution failed');
        }
        
        // Create response breadcrumb
        const responseRequestId = breadcrumb.context?.requestId || breadcrumb.id;
        const responseTag = responseRequestId.startsWith('llm-') ? 'request:llm' : `request:${responseRequestId}`;
        
        await client.createBreadcrumb({
          schema_name: 'tool.response.v1',
          title: `Response: ${toolName}`,
          tags: [workspace, 'tool:response', responseTag, `request:${responseRequestId}`],
          context: {
            request_id: responseRequestId,
            tool: toolName,
            status: 'success',
            output: executionResult.result,
            execution_time_ms: executionTime,
            metadata: executionResult.metadata,
            timestamp: new Date().toISOString()
          }
        });
        
        console.log(`✅ Tool ${toolName} executed successfully via Deno in ${executionTime}ms`);
        processingStatus.set(requestId, 'completed');
        return;
      }
      
      // Fallback to old system (tool.v1)
      const underlyingTool = await loader.loadToolByName(toolName);
      
      if (!underlyingTool) {
        console.error(`❌ Tool ${toolName} not found in breadcrumbs`);
        console.error(`❌ Available tools:`, await loader.discoverTools());
        
        // Create error response
        await client.createBreadcrumb({
          schema_name: 'tool.response.v1',
          title: `Error: ${toolName}`,
          tags: [workspace, 'tool:response', 'error'],
          context: {
            request_id: breadcrumb.context?.requestId || breadcrumb.id,
            tool: toolName,
            status: 'error',
            error: `Tool ${toolName} not found. Ensure it has a tool.v1 or tool.code.v1 breadcrumb.`,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
      
      console.log(`🛠️  Executing tool: ${toolName} (from tool.v1 breadcrumb)`);
      
      
      // Execute tool with proper context (including event bridge AND breadcrumb!)
      const startTime = Date.now();
      const result = await underlyingTool.execute(toolInput, {
        rcrtClient: client,
        agentId: breadcrumb.created_by || 'tools-runner',
        workspace: workspace,
        metadata: { 
          requestId: breadcrumb.id,
          breadcrumb: breadcrumb  // Pass full breadcrumb so tool can access config_id!
        },
        waitForEvent: (criteria: any, timeout?: number) => globalEventBridge.waitForEvent(criteria, timeout)
      });
      
      const executionTime = Date.now() - startTime;
      
      // Create tool.response.v1 breadcrumb
      const responseRequestId = breadcrumb.context?.requestId || breadcrumb.id;
      const responseTag = responseRequestId.startsWith('llm-') ? 'request:llm' : `request:${responseRequestId}`;
      
      await client.createBreadcrumb({
        schema_name: 'tool.response.v1',
        title: `Response: ${toolName}`,
        tags: [workspace, 'tool:response', responseTag, `request:${responseRequestId}`],
        context: {
          request_id: responseRequestId,  // Use requestId from request if available
          tool: toolName,
          status: 'success',
          output: result,
          execution_time_ms: executionTime,
          timestamp: new Date().toISOString()
        }
      });
      
      console.log(`✅ Tool ${toolName} executed successfully in ${executionTime}ms`);
      
      // 🔧 Mark as completed after successful execution
      processingStatus.set(requestId, 'completed');
      
    } catch (error) {
      console.error(`❌ Tool execution failed:`, error);
      
      // 🔧 Mark as completed even after error to prevent retries
      processingStatus.set(requestId, 'completed');
      
      try {
        const errorRequestId = eventData.context?.requestId || eventData.breadcrumb_id;
        await client.createBreadcrumb({
          schema_name: 'tool.response.v1',
          title: `Error: ${eventData.context?.tool || 'unknown'}`,
          tags: [workspace, 'tool:response', `request:${errorRequestId}`],
          context: {
            request_id: errorRequestId,  // Use requestId from request if available
            tool: eventData.context?.tool || 'unknown',
            status: 'error',
            error: String(error),
            execution_time_ms: 0,
            timestamp: new Date().toISOString()
          }
        });
      } catch (responseError) {
        console.error('Failed to create error response:', responseError);
      }
    }
  }
}

// Load environment variables
dotenv.config();

// Configuration from environment
const config = {
  // RCRT connection
  rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
  rcrtProxyUrl: process.env.RCRT_PROXY_URL || '/api/rcrt',
  tokenEndpoint: process.env.TOKEN_ENDPOINT || '/api/auth/token',
  rcrtAuthMode: process.env.RCRT_AUTH_MODE || 'disabled', // 'jwt' | 'disabled'
  rcrtJwt: process.env.RCRT_JWT,
  workspace: process.env.WORKSPACE || 'workspace:tools',
  
  // Tool configuration - RCRT-Native only, no legacy options
  enableUI: process.env.ENABLE_TOOL_UI === 'true',
  
  // Deployment mode
  deploymentMode: process.env.DEPLOYMENT_MODE || 'local', // 'docker', 'local', 'electron'
};

// Track tool subscriptions (loaded from tool.v1 breadcrumbs)
const toolSubscriptions = new Map<string, any[]>();  // toolName -> selectors

async function main() {
  console.log('🔧 RCRT Tools Runner starting...');
  console.log('Configuration:', {
    rcrtBaseUrl: config.rcrtBaseUrl,
    workspace: config.workspace,
    deploymentMode: config.deploymentMode,
    enableUI: config.enableUI,
    tokenEndpoint: config.tokenEndpoint
  });
  
  // In docker mode, wait a bit for services to be fully ready
  if (config.deploymentMode === 'docker') {
    console.log('Waiting for services to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  try {
    // Create RCRT client (supports JWT in docker mode via RCRT_JWT or tokenEndpoint)
    let client: RcrtClientEnhanced;
    let jwtToken: string | undefined; // Store JWT for centralized SSE dispatcher
    if (config.deploymentMode === 'docker') {
      if (config.rcrtAuthMode === 'jwt') {
        let token = config.rcrtJwt;
        if (!token && config.tokenEndpoint) {
          try {
            const tokenRequest = {
              owner_id: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
              agent_id: process.env.AGENT_ID || '00000000-0000-0000-0000-0000000000aa'
            };
            const resp = await fetch(config.tokenEndpoint, { 
              method: 'POST', 
              headers: { 'content-type': 'application/json' }, 
              body: JSON.stringify(tokenRequest)
            });
            if (resp.ok) {
              const json = await resp.json().catch(() => ({}));
              token = json?.token;
              if (token) {
                console.log('✅ Fetched JWT token from', config.tokenEndpoint);
              } else {
                console.warn('❌ Token endpoint returned no token:', json);
              }
            } else {
              console.warn('❌ Token endpoint failed:', resp.status, await resp.text().catch(() => 'unknown error'));
            }
          } catch (err) {
            console.warn('❌ Failed to fetch token:', err);
          }
        }
        if (!token) {
          console.warn('RCRT_AUTH_MODE=jwt but no RCRT_JWT or tokenEndpoint provided; continuing without auth');
          client = new RcrtClientEnhanced(config.rcrtBaseUrl, 'disabled');
        } else {
        jwtToken = token; // Store for centralized SSE dispatcher
        const tokenRequest = {
          owner_id: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
          agent_id: process.env.AGENT_ID || '00000000-0000-0000-0000-0000000000aa'
        };
        client = new RcrtClientEnhanced(config.rcrtBaseUrl, 'jwt', token, {
          tokenEndpoint: config.tokenEndpoint,
          autoRefresh: true,
          tokenRequestBody: tokenRequest
        });
        }
      } else {
        client = new RcrtClientEnhanced(config.rcrtBaseUrl, 'disabled');
      }
    } else {
      client = await createClient({ baseUrl: config.rcrtProxyUrl, tokenEndpoint: config.tokenEndpoint, authMode: 'jwt' });
    }

    console.log('✅ Connected to RCRT');

    // Resolve API keys strictly from RCRT Secrets (no env fallback)
    // Secret names are case-insensitive keys like: SERPAPI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY
    async function resolveSecrets(preferredNames: string[]): Promise<Record<string, string | undefined>> {
      const out: Record<string, string | undefined> = {};
      try {
        // List all secrets visible to this agent; filter by name
        const secrets = await client.listSecrets();
        for (const name of preferredNames) {
          const secret = secrets.find((s: any) => String(s?.name || '').toLowerCase() === name.toLowerCase());
          if (secret) {
            try {
              const val = await client.getSecret(secret.id);
              out[name] = val?.value;
            } catch {}
          }
        }
      } catch {}
      return out;
    }

    // Resolve secrets if needed for tools
    const desiredKeys = [
      'OPENROUTER_API_KEY',
      'ANTHROPIC_API_KEY',
      'OLLAMA_HOST'
    ];

    await resolveSecrets(desiredKeys);

    // RCRT-Native: Bootstrap tools and create catalog
    console.log('🔧 Bootstrapping RCRT tools...');
    await bootstrapTools(client, config.workspace);
    
    // 🎯 THE RCRT WAY: Bootstrap context configurations (same pattern as tools!)
    console.log('🏗️ Bootstrapping context configurations...');
    await bootstrapContextConfigs(client, config.workspace);
    
    // Initialize Deno runtime for self-contained tools (Phase 1)
    console.log('🦕 Initializing Deno Tool Runtime...');
    try {
      globalDenoRuntime = new DenoToolRuntime(client, config.workspace);
      await globalDenoRuntime.initialize();
      console.log(`✅ Deno runtime initialized with ${globalDenoRuntime.getAllTools().length} self-contained tools`);
    } catch (error) {
      console.warn('⚠️ Deno runtime initialization failed - self-contained tools disabled:', error);
      console.warn('   Install Deno to enable self-contained tools: https://deno.land/');
      globalDenoRuntime = null;
    }
    
    // Execute bootstrap tools
    if (globalDenoRuntime) {
      console.log('🚀 Running bootstrap tools...');
      try {
        const bootstrapResult = await globalDenoRuntime.executeBootstrap();
        console.log(`✅ Bootstrap complete: ${bootstrapResult.successful} successful, ${bootstrapResult.failed} failed, ${bootstrapResult.skipped} skipped`);
        
        // Start continuous tools
        const continuousTools = globalDenoRuntime.getBootstrapTools()
          .filter(t => t.context.bootstrap?.mode === 'continuous');
        
        if (continuousTools.length > 0) {
          console.log(`🔄 Starting ${continuousTools.length} continuous tool(s)...`);
          for (const tool of continuousTools) {
            startContinuousTool(tool, globalDenoRuntime, client, config.workspace)
              .catch(error => {
                console.error(`❌ Continuous tool ${tool.context.name} failed:`, error);
              });
          }
        }
      } catch (error) {
        console.error('❌ Bootstrap execution failed:', error);
      }
    }
    
    // Discover available tools
    const loader = new ToolLoader(client, config.workspace);
    const tools = await loader.discoverTools();
    console.log(`✅ ${tools.length} tools available`);
    console.log('🎯 Available tools:', tools.map((t: any) => t.name).join(', '));
    
    // Load tool subscriptions (auto-triggering via selectors!)
    await loadToolSubscriptions(client, config.workspace);

    // Update catalog periodically
    setInterval(async () => {
      try {
        const updatedTools = await loader.discoverTools();
        console.log(`📊 Catalog refresh: ${updatedTools.length} tools available`);
      } catch (error) {
        console.error('Failed to refresh tool catalog:', error);
      }
    }, 30000); // Every 30 seconds

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down tools runner...');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down tools runner...');
      process.exit(0);
    });

    // Keep alive
    console.log('🚀 Tools runner is ready and listening for requests');
    console.log(`📡 Workspace: ${config.workspace}`);
    console.log('💡 Centralized SSE dispatcher routes requests to individual tools');
    
    // Start centralized SSE dispatcher
    if (config.rcrtAuthMode === 'jwt' || jwtToken) {
      console.log('🎯 Starting centralized SSE dispatcher...');
      await startCentralizedSSEDispatcher(client, config.workspace, jwtToken);
    } else {
      console.warn('⚠️  No JWT token available for SSE - tools will not receive requests');
      // Prevent process exit
      await new Promise(() => {});
    }
    
  } catch (error) {
    console.error('❌ Failed to start tools runner:', error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

/**
 * Universal subscription matcher - works for BOTH agents AND tools!
 * Uses the SAME selector logic RCRT already has
 */
async function checkToolSubscriptions(
  eventData: any,
  client: RcrtClientEnhanced,
  workspace: string
): Promise<void> {
  // Check if event matches ANY tool's subscriptions
  for (const [toolName, selectors] of toolSubscriptions.entries()) {
    for (const selector of selectors) {
      if (matchesSelector(eventData, selector)) {
        console.log(`🔄 Event matches ${toolName} subscription, auto-invoking...`);
        
        // Auto-create tool.request.v1 (same as manual invocation!)
        await client.createBreadcrumb({
          schema_name: 'tool.request.v1',
          title: `Auto: ${toolName}`,
          tags: ['tool:request', workspace, 'auto-trigger'],
          context: {
            tool: toolName,
            input: { trigger_event: eventData },
            requestId: `auto-${Date.now()}`,
            requestedBy: 'auto-trigger'
          }
        });
      }
    }
  }
}

/**
 * Load tool subscriptions from tool.v1 breadcrumbs (once on startup)
 */
async function loadToolSubscriptions(client: RcrtClientEnhanced, workspace: string): Promise<void> {
  try {
    console.log('📡 Loading tool subscriptions...');
    const tools = await client.searchBreadcrumbsWithContext({
      schema_name: 'tool.v1',
      tag: workspace,
      include_context: true
    });
    
    for (const tool of tools) {
      if (tool.context?.subscriptions?.selectors) {
        toolSubscriptions.set(tool.context.name, tool.context.subscriptions.selectors);
        console.log(`  ✅ ${tool.context.name}: ${tool.context.subscriptions.selectors.length} selectors`);
      }
    }
    
    console.log(`📊 ${toolSubscriptions.size} tools have subscriptions`);
  } catch (error) {
    console.error('Failed to load tool subscriptions:', error);
  }
}

/**
 * Selector matching (RCRT's existing logic, reused!)
 */
function matchesSelector(event: any, selector: any): boolean {
  if (selector.schema_name && event.schema_name !== selector.schema_name) return false;
  if (selector.any_tags && !selector.any_tags.some((t: string) => event.tags?.includes(t))) return false;
  if (selector.all_tags && !selector.all_tags.every((t: string) => event.tags?.includes(t))) return false;
  return true;
}

if (require.main === module) {
  main().catch(console.error);
}
