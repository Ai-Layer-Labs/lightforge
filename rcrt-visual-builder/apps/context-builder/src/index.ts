#!/usr/bin/env node
/**
 * Context-Builder Runner
 * Universal context assembly service with auto-discovery
 * 
 * Responsibilities:
 * 1. Discover context.config.v1 breadcrumbs (auto-register consumers)
 * 2. Subscribe to all update_triggers from all configs
 * 3. Invoke context-builder tool on matching events
 * 4. Maintain agent.context.v1 breadcrumbs for all consumers
 */

import dotenv from 'dotenv';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { contextBuilderTool } from '@rcrt-builder/tools';
import { jsonrepair } from 'jsonrepair';

dotenv.config();

const config = {
  rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
  workspace: process.env.WORKSPACE || 'workspace:context',
  deploymentMode: process.env.DEPLOYMENT_MODE || 'local'
};

// Track all active consumer configs
const activeConsumers = new Map<string, {
  configId: string;
  config: any;
  contextId?: string;
  triggers: any[];
}>();

async function main() {
  console.log('🏗️ Context-Builder Runner starting...');
  console.log('Configuration:', config);
  
  if (config.deploymentMode === 'docker') {
    console.log('⏳ Waiting for services to be ready...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  try {
    // Get JWT token
    const tokenRequest = {
      owner_id: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
      agent_id: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000CCC',
      roles: ['curator', 'emitter', 'subscriber']
    };
    
    const tokenResponse = await fetch(`${config.rcrtBaseUrl}/auth/token`, { 
      method: 'POST', 
      headers: { 'content-type': 'application/json' }, 
      body: JSON.stringify(tokenRequest)
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`Token request failed: ${tokenResponse.status}`);
    }
    
    const tokenData = await tokenResponse.json();
    const jwtToken = tokenData?.token;
    
    if (!jwtToken) {
      throw new Error('No token in response');
    }
    
    console.log('🔐 Obtained JWT token');
    
    // Create RCRT client
    const client = new RcrtClientEnhanced(config.rcrtBaseUrl, 'jwt', jwtToken, {
      tokenEndpoint: `${config.rcrtBaseUrl}/auth/token`,
      autoRefresh: true,
      tokenRequestBody: tokenRequest
    });

    console.log('✅ Connected to RCRT');

    // Phase 1: Discover existing context.config.v1 breadcrumbs
    console.log('🔍 Discovering existing context configurations...');
    await discoverExistingConfigs(client);
    
    // Phase 2: Start SSE listener for new configs and triggers
    console.log('📡 Starting SSE dispatcher...');
    await startSSEDispatcher(client, jwtToken);
    
  } catch (error) {
    console.error('❌ Failed to start context-builder runner:', error);
    process.exit(1);
  }
}

/**
 * Discover and register all existing context.config.v1 breadcrumbs
 */
async function discoverExistingConfigs(client: RcrtClientEnhanced): Promise<void> {
  try {
    const configs = await client.searchBreadcrumbsWithContext({
      schema_name: 'context.config.v1',
      include_context: true
    });
    
    console.log(`📋 Found ${configs.length} context configurations`);
    
    for (const configBreadcrumb of configs) {
      await registerConsumerFromConfig(client, configBreadcrumb.id, configBreadcrumb.context);
    }
    
  } catch (error) {
    console.error('Failed to discover configs:', error);
  }
}

/**
 * Register a consumer from their config breadcrumb
 */
async function registerConsumerFromConfig(
  client: RcrtClientEnhanced,
  configId: string,
  config: any
): Promise<void> {
  try {
    console.log(`📝 Registering consumer: ${config.consumer_id}`);
    
    // Invoke context-builder tool to register
    const result = await contextBuilderTool.execute(
      { action: 'register', config_id: configId },
      { 
        rcrtClient: client, 
        workspace: config.workspace || config.output?.tags?.[0] || 'workspace:default',
        agentId: 'context-builder-runner'
      }
    );
    
    if (result.success) {
      // Track this consumer
      activeConsumers.set(config.consumer_id, {
        configId,
        config,
        contextId: result.context_id,
        triggers: config.update_triggers || []
      });
      
      console.log(`✅ Registered ${config.consumer_id} → context: ${result.context_id}`);
    } else {
      console.error(`❌ Failed to register ${config.consumer_id}:`, result.error);
    }
    
  } catch (error) {
    console.error(`Failed to register consumer from ${configId}:`, error);
  }
}

/**
 * Start centralized SSE dispatcher
 * Listens for:
 * 1. New context.config.v1 breadcrumbs (auto-register)
 * 2. Events matching ANY consumer's update_triggers (update context)
 */
async function startSSEDispatcher(
  client: RcrtClientEnhanced,
  jwtToken: string
): Promise<void> {
  const connect = async (): Promise<void> => {
    try {
      console.log('📡 Connecting to SSE stream...');
      
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
      
      console.log('✅ SSE dispatcher connected');
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No SSE stream reader available');
      }
      
      // Process SSE events
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const repairedData = jsonrepair(line.slice(6));
              const eventData = JSON.parse(repairedData);
              
              if (eventData.type === 'ping') continue;
              
              // Route event to appropriate handler
              await routeEvent(client, eventData);
              
            } catch (error) {
              console.warn('Failed to parse SSE event:', line.slice(0, 100), error);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('❌ SSE dispatcher error:', error);
      // Retry connection after delay
      setTimeout(() => connect(), 5000);
    }
  };
  
  await connect();
}

/**
 * Route events to appropriate handlers
 */
async function routeEvent(client: RcrtClientEnhanced, event: any): Promise<void> {
  // Handler 1: New context.config.v1 → Register new consumer
  if (event.schema_name === 'context.config.v1' && event.type === 'breadcrumb.updated') {
    console.log(`🆕 New context config detected: ${event.breadcrumb_id}`);
    
    try {
      const configBreadcrumb = await client.getBreadcrumb(event.breadcrumb_id);
      await registerConsumerFromConfig(client, event.breadcrumb_id, configBreadcrumb.context);
    } catch (error) {
      console.error('Failed to register new consumer:', error);
    }
    return;
  }
  
  // Handler 2: Event matches a consumer's update_triggers → Update context
  for (const [consumerId, consumerData] of activeConsumers.entries()) {
    if (matchesTriggers(event, consumerData.triggers)) {
      console.log(`🔄 Event matches trigger for ${consumerId}, updating context...`);
      
      try {
        // Invoke context-builder to update
        const result = await contextBuilderTool.execute(
          {
            action: 'update',
            consumer_id: consumerId,
            trigger_event: event
          },
          {
            rcrtClient: client,
            workspace: consumerData.config.workspace || 'workspace:default',
            agentId: 'context-builder-runner'
          }
        );
        
        if (result.success) {
          console.log(`  ✅ Updated context for ${consumerId} (${result.token_estimate} tokens)`);
        } else if (result.action !== 'skipped') {
          console.warn(`  ⚠️ Update failed for ${consumerId}:`, result.error);
        }
        
      } catch (error) {
        console.error(`Failed to update context for ${consumerId}:`, error);
      }
    }
  }
}

/**
 * Check if event matches any trigger
 */
function matchesTriggers(event: any, triggers: any[]): boolean {
  for (const trigger of triggers) {
    // Schema match
    if (trigger.schema_name && event.schema_name !== trigger.schema_name) {
      continue;
    }
    
    // Tag match
    if (trigger.any_tags) {
      const hasAnyTag = trigger.any_tags.some((t: string) => 
        event.tags?.includes(t)
      );
      if (!hasAnyTag) continue;
    }
    
    if (trigger.all_tags) {
      const hasAllTags = trigger.all_tags.every((t: string) => 
        event.tags?.includes(t)
      );
      if (!hasAllTags) continue;
    }
    
    // Context match (simplified)
    if (trigger.context_match) {
      const matches = trigger.context_match.every((rule: any) => {
        const path = rule.path.replace('$.', '');
        const parts = path.split('.');
        let value = event.context;
        for (const part of parts) {
          value = value?.[part];
        }
        
        switch (rule.op) {
          case 'eq': return value === rule.value;
          case 'ne': return value !== rule.value;
          case 'contains': return Array.isArray(value) && value.includes(rule.value);
          default: return true;
        }
      });
      if (!matches) continue;
    }
    
    // Matched a trigger!
    return true;
  }
  
  return false;
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down context-builder runner...');
  
  // List final stats
  const stats = Array.from(activeConsumers.entries()).map(([id, data]) => ({
    consumer: id,
    context_id: data.contextId
  }));
  
  console.log(`📊 Maintained ${stats.length} contexts:`, stats);
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down context-builder runner...');
  process.exit(0);
});

// Error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { activeConsumers };

