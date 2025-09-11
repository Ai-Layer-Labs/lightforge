#!/usr/bin/env node
/**
 * RCRT Tools Runner
 * Standalone service that registers and runs tools for the RCRT ecosystem
 * Works in Docker, local Node.js, or Electron environments
 */

import dotenv from 'dotenv';
import { createClient, RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { createToolRegistry, ToolRegistry } from '@rcrt-builder/tools/registry';

// Track processing status to prevent legitimate RCRT duplicate events (created + updated)
const processingStatus = new Map<string, 'processing' | 'completed'>();

// 🎯 CLEAN CENTRALIZED SSE DISPATCHER
// Single SSE connection that routes to individual tools (more efficient than 14 connections)
async function startCentralizedSSEDispatcher(
  client: RcrtClientEnhanced, 
  registry: ToolRegistry, 
  workspace: string, 
  jwtToken: string
): Promise<void> {
  try {
    console.log('📡 Starting centralized SSE dispatcher...');
    console.log(`🔌 Connecting to SSE: ${client.baseUrl}/events/stream`);
    
    const response = await fetch(`${client.baseUrl}/events/stream`, {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`SSE connection failed: ${response.status}`);
    }
    
    console.log('✅ Centralized SSE dispatcher connected');
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No SSE stream reader available');
    }
    
    // Process SSE events and dispatch to appropriate tools
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
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
            
            await dispatchEventToTool(eventData, client, registry, workspace);
          } catch (error) {
            console.warn('Failed to parse SSE event:', line, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Centralized SSE dispatcher error:', error);
    // Retry connection after delay
    setTimeout(() => startCentralizedSSEDispatcher(client, registry, workspace, jwtToken), 5000);
  }
}

// Dispatch SSE events to appropriate tools
async function dispatchEventToTool(
  eventData: any, 
  client: RcrtClientEnhanced, 
  registry: ToolRegistry, 
  workspace: string
): Promise<void> {
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
      
      // Check if we have this tool
      const tools = registry.listTools();
      if (!tools.includes(toolName)) {
        console.warn(`❌ Unknown tool: ${toolName}. Available: ${tools.join(', ')}`);
        return;
      }
      
      console.log(`🛠️  Executing tool: ${toolName}`);
      
      // Execute the tool via registry
      const startTime = Date.now();
      const toolWrapper = registry.getTool(toolName);
      
      if (!toolWrapper) {
        throw new Error(`Tool wrapper not found: ${toolName}`);
      }
      
      // Access underlying tool and execute
      const underlyingTool = (toolWrapper as any).tool;
      if (!underlyingTool || typeof underlyingTool.execute !== 'function') {
        throw new Error(`Tool ${toolName} does not have execute method`);
      }
      
      // Execute tool with proper context
      const result = await underlyingTool.execute(toolInput, {
        rcrtClient: client,
        agentId: breadcrumb.created_by || 'tools-runner',
        workspace: workspace,
        metadata: { requestId: breadcrumb.id }
      });
      
      const executionTime = Date.now() - startTime;
      
      // Create tool.response.v1 breadcrumb
      await client.createBreadcrumb({
        schema_name: 'tool.response.v1',
        title: `Response: ${toolName}`,
        tags: [workspace, 'tool:response'],
        context: {
          request_id: breadcrumb.id,
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
        await client.createBreadcrumb({
          schema_name: 'tool.response.v1',
          title: `Error: ${eventData.context?.tool || 'unknown'}`,
          tags: [workspace, 'tool:response'],
          context: {
            request_id: eventData.breadcrumb_id,
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
  
  // Tool configuration
  enableBuiltins: process.env.ENABLE_BUILTIN_TOOLS !== 'false',
  enableLangChain: process.env.ENABLE_LANGCHAIN_TOOLS === 'true',
  enableUI: process.env.ENABLE_TOOL_UI === 'true',
  
  // Deployment mode
  deploymentMode: process.env.DEPLOYMENT_MODE || 'local', // 'docker', 'local', 'electron'
};

async function main() {
  console.log('🔧 RCRT Tools Runner starting...');
  console.log('Configuration:', {
    rcrtBaseUrl: config.rcrtBaseUrl,
    workspace: config.workspace,
    deploymentMode: config.deploymentMode,
    enableBuiltins: config.enableBuiltins,
    enableLangChain: config.enableLangChain,
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
    let applyClient: RcrtClientEnhanced | undefined;
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
        client = new RcrtClientEnhanced(config.rcrtBaseUrl, 'jwt', token, {
          tokenEndpoint: config.tokenEndpoint,
          autoRefresh: true
        });
        // applyClient should target the builder proxy so /api/forge/apply works
        // In docker mode, use the builder proxy for UI operations
        const builderUrl = process.env.BUILDER_URL || 'http://builder:3000';
        applyClient = await createClient({ 
          baseUrl: builderUrl + '/api/rcrt', 
          tokenEndpoint: config.tokenEndpoint, // Use RCRT token service
          authMode: 'jwt',
          autoRefresh: true
        });
        }
      } else {
        client = new RcrtClientEnhanced(config.rcrtBaseUrl, 'disabled');
      }
    } else {
      client = await createClient({ baseUrl: config.rcrtProxyUrl, tokenEndpoint: config.tokenEndpoint, authMode: 'jwt' });
      applyClient = client;
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

    const desiredKeys = [
      'SERPAPI_API_KEY',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'BRAVE_SEARCH_API_KEY',
      'GOOGLE_SEARCH_API_KEY',
      'GOOGLE_CSE_ID',
    ];

    const rcrtSecrets = await resolveSecrets(desiredKeys);
    const serpApiKey = rcrtSecrets.SERPAPI_API_KEY;
    const openaiApiKey = rcrtSecrets.OPENAI_API_KEY;

    // Create and configure tool registry
    const registry = await createToolRegistry(client, config.workspace, {
      enableUI: config.enableUI,
      enableBuiltins: config.enableBuiltins,
      enableLangChain: config.enableLangChain,
      langchainConfig: {
        serpApiKey,
        openaiApiKey
      },
      applyClient
    });

    console.log('✅ Tool registry initialized');
    console.log('🎯 Registered tools:', registry.listTools());

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down tools runner...');
      await registry.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down tools runner...');
      await registry.stop();
      process.exit(0);
    });

    // Keep alive
    console.log('🚀 Tools runner is ready and listening for requests');
    console.log(`📡 Workspace: ${config.workspace}`);
    console.log('💡 Centralized SSE dispatcher routes requests to individual tools');
    
    // Start centralized SSE dispatcher
    if (jwtToken) {
      console.log('🎯 Starting centralized SSE dispatcher...');
      await startCentralizedSSEDispatcher(client, registry, config.workspace, jwtToken);
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

if (require.main === module) {
  main().catch(console.error);
}
