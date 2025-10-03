#!/usr/bin/env node
/**
 * RCRT Tools Runner
 * Standalone service that registers and runs tools for the RCRT ecosystem
 * Works in Docker, local Node.js, or Electron environments
 */

import dotenv from 'dotenv';
import { createClient, RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { ToolLoader, bootstrapTools } from '@rcrt-builder/tools';
import { jsonrepair } from 'jsonrepair';
import { EventBridge } from './event-bridge.js';

// Track processing status to prevent legitimate RCRT duplicate events (created + updated)
const processingStatus = new Map<string, 'processing' | 'completed'>();

// Global event bridge for tools to wait for events
const globalEventBridge = new EventBridge();

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
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                // Use jsonrepair to handle malformed JSON
                const repairedData = jsonrepair(line.slice(6));
                const eventData = JSON.parse(repairedData);
                
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

// Dispatch SSE events to appropriate tools
async function dispatchEventToTool(
  eventData: any, 
  client: RcrtClientEnhanced, 
  workspace: string
): Promise<void> {
  // 🎯 THE RCRT WAY: Auto-trigger context-builder on matching events
  if (eventData.type === 'breadcrumb.updated') {
    // Check if this event matches ANY context config trigger
    await checkContextTriggers(eventData, client, workspace);
  }
  
  // Only process tool.request.v1 breadcrumb events with deduplication
  if (eventData.type === 'breadcrumb.updated' && 
      eventData.schema_name === 'tool.request.v1' &&
      eventData.tags?.includes('tool:request') &&
      eventData.tags?.includes(workspace) &&
      !eventData.tags?.includes('health:check')) {  // 🔧 FILTER OUT HEALTH CHECKS
    
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
      const { ToolLoader } = await import('@rcrt-builder/tools');
      const loader = new ToolLoader(client, workspace);
      const underlyingTool = await loader.loadToolByName(toolName);
      
      if (!underlyingTool) {
        console.error(`❌ Tool ${toolName} not found in breadcrumbs`);
        
        // Create error response
        await client.createBreadcrumb({
          schema_name: 'tool.response.v1',
          title: `Error: ${toolName}`,
          tags: [workspace, 'tool:response', 'error'],
          context: {
            request_id: breadcrumb.context?.requestId || breadcrumb.id,
            tool: toolName,
            status: 'error',
            error: `Tool ${toolName} not found. Ensure it has a tool.v1 breadcrumb.`,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
      
      console.log(`🛠️  Executing tool: ${toolName} (from breadcrumb)`);
      
      
      // Execute tool with proper context (including event bridge)
      const startTime = Date.now();
      const result = await underlyingTool.execute(toolInput, {
        rcrtClient: client,
        agentId: breadcrumb.created_by || 'tools-runner',
        workspace: workspace,
        metadata: { requestId: breadcrumb.id },
        waitForEvent: (criteria: any, timeout?: number) => globalEventBridge.waitForEvent(criteria, timeout)
      });
      
      const executionTime = Date.now() - startTime;
      
      // Create tool.response.v1 breadcrumb
      const responseRequestId = breadcrumb.context?.requestId || breadcrumb.id;
      await client.createBreadcrumb({
        schema_name: 'tool.response.v1',
        title: `Response: ${toolName}`,
        tags: [workspace, 'tool:response', `request:${responseRequestId}`],
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

// Track active context configurations for auto-triggering
const activeContextConfigs = new Map<string, any>();

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
    
    // Discover available tools
    const loader = new ToolLoader(client, config.workspace);
    const tools = await loader.discoverTools();
    console.log(`✅ ${tools.length} tools available`);
    console.log('🎯 Available tools:', tools.map((t: any) => t.name).join(', '));
    
    // 🎯 THE RCRT WAY: Discover context.config.v1 breadcrumbs for auto-triggering
    await discoverContextConfigs(client);

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
 * Check if event matches any context config trigger
 * If yes, auto-invoke context-builder tool
 */
async function checkContextTriggers(
  eventData: any,
  client: RcrtClientEnhanced,
  workspace: string
): Promise<void> {
  // Handle new context.config.v1 breadcrumbs (discover)
  if (eventData.schema_name === 'context.config.v1') {
    console.log(`🆕 New context config detected: ${eventData.breadcrumb_id}`);
    try {
      const configBreadcrumb = await client.getBreadcrumb(eventData.breadcrumb_id);
      activeContextConfigs.set(configBreadcrumb.context.consumer_id, configBreadcrumb);
      console.log(`✅ Registered context config for: ${configBreadcrumb.context.consumer_id}`);
    } catch (error) {
      console.error('Failed to load context config:', error);
    }
    return;
  }
  
  // Check if event matches any registered trigger
  for (const [consumerId, config] of activeContextConfigs.entries()) {
    const triggers = config.context.update_triggers || [];
    
    for (const trigger of triggers) {
      let matches = true;
      
      // Schema match
      if (trigger.schema_name && eventData.schema_name !== trigger.schema_name) {
        matches = false;
      }
      
      // Tag match
      if (matches && trigger.any_tags) {
        matches = trigger.any_tags.some((t: string) => eventData.tags?.includes(t));
      }
      
      if (matches && trigger.all_tags) {
        matches = trigger.all_tags.every((t: string) => eventData.tags?.includes(t));
      }
      
      // Context match (simplified)
      if (matches && trigger.context_match) {
        // Would need full implementation
        matches = true; // For now
      }
      
      if (matches) {
        console.log(`🔄 Event matches trigger for ${consumerId}, invoking context-builder...`);
        
        // Auto-invoke context-builder tool!
        await client.createBreadcrumb({
          schema_name: 'tool.request.v1',
          title: 'Context Builder Auto-Trigger',
          tags: ['tool:request', workspace, 'auto-trigger'],
          context: {
            tool: 'context-builder',
            input: {
              action: 'update',
              consumer_id: consumerId,
              trigger_event: {
                breadcrumb_id: eventData.breadcrumb_id,
                schema_name: eventData.schema_name,
                tags: eventData.tags
              }
            },
            requestId: `ctx-auto-${Date.now()}`,
            requestedBy: 'tools-runner-auto-trigger'
          }
        });
        
        console.log(`✅ Auto-triggered context-builder for ${consumerId}`);
        break; // Only trigger once per event
      }
    }
  }
}

/**
 * Discover existing context.config.v1 breadcrumbs on startup
 */
async function discoverContextConfigs(client: RcrtClientEnhanced): Promise<void> {
  try {
    console.log('🔍 Discovering context configurations...');
    const configs = await client.searchBreadcrumbs({
      schema_name: 'context.config.v1'
    });
    
    for (const configRef of configs) {
      const config = await client.getBreadcrumb(configRef.id);
      activeContextConfigs.set(config.context.consumer_id, config);
      console.log(`✅ Loaded context config for: ${config.context.consumer_id}`);
    }
    
    console.log(`📚 Total context configs: ${activeContextConfigs.size}`);
  } catch (error) {
    console.error('Failed to discover context configs:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
