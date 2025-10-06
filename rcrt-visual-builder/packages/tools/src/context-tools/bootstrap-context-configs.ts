/**
 * Bootstrap Context Configurations
 * Similar to bootstrap-tools.ts, this creates default context.config.v1 breadcrumbs
 * on startup to ensure context-builder has configurations to work with
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

/**
 * Default context configuration for chat agents
 * This is the DATA that configures how context-builder operates
 */
const defaultChatAgentContextConfig = {
  consumer_id: 'default-chat-assistant',
  consumer_type: 'agent',
  sources: [
    // User messages: Hybrid approach (recent + semantic)
    {
      schema_name: 'user.message.v1',
      method: 'recent',
      limit: 3,  // Always include last 3 for conversational flow
      filters: { tag: 'extension:chat' }
    },
    {
      schema_name: 'user.message.v1',
      method: 'vector',
      nn: 5,  // Plus 5 most relevant for context/memory
      filters: { tag: 'extension:chat' }
    },
    // Agent responses: Hybrid approach
    {
      schema_name: 'agent.response.v1',
      method: 'recent',
      limit: 2,  // Last 2 responses
      filters: { tag: 'workspace:agents' }
    },
    {
      schema_name: 'agent.response.v1',
      method: 'vector',
      nn: 3,  // Plus 3 most relevant
      filters: { tag: 'workspace:agents' }
    },
    // Tool results: Recent only (chronological makes sense here)
    {
      schema_name: 'tool.response.v1',
      method: 'recent',
      limit: 3,
      filters: {
        context_match: [{
          path: '$.requestedBy',
          op: 'eq',
          value: 'default-chat-assistant'
        }]
      }
    },
    // Tool catalog: Latest only
    {
      schema_name: 'tool.catalog.v1',
      method: 'latest',
      filters: { tag: 'workspace:tools' }
    }
  ],
  output: {
    schema_name: 'agent.context.v1',
    tags: ['agent:context', 'consumer:default-chat-assistant'],
    ttl_seconds: 3600
  },
  formatting: {
    max_tokens: 4000,
    deduplication_threshold: 0.95
  }
};

/**
 * Bootstrap default context configurations
 * Called by tools-runner on startup (just like bootstrapTools)
 */
export async function bootstrapContextConfigs(
  client: RcrtClientEnhanced,
  workspace: string
): Promise<void> {
  console.log('🏗️ Bootstrapping context configurations...');
  
  // Bootstrap default chat agent config
  await bootstrapConfig(
    client,
    'default-chat-assistant',
    defaultChatAgentContextConfig,
    workspace
  );
  
  console.log('✅ Context configurations bootstrapped');
}

/**
 * Bootstrap a single context configuration
 */
async function bootstrapConfig(
  client: RcrtClientEnhanced,
  consumerId: string,
  config: any,
  workspace: string
): Promise<void> {
  try {
    // Check if config already exists
    const existing = await client.searchBreadcrumbs({
      schema_name: 'context.config.v1',
      tag: `consumer:${consumerId}`
    });
    
    const configBreadcrumb = {
      schema_name: 'context.config.v1',
      title: `Context Config for ${consumerId}`,
      tags: [
        'context:config',
        `consumer:${consumerId}`,
        workspace
      ],
      context: config
    };
    
    if (existing.length > 0) {
      // Update existing
      const existingBreadcrumb = await client.getBreadcrumb(existing[0].id);
      await client.updateBreadcrumb(
        existing[0].id,
        existingBreadcrumb.version,
        {
          title: configBreadcrumb.title,
          tags: configBreadcrumb.tags,
          context: configBreadcrumb.context
        }
      );
      console.log(`✅ Updated context config for ${consumerId}`);
    } else {
      // Create new
      await client.createBreadcrumb(configBreadcrumb);
      console.log(`✅ Created context config for ${consumerId}`);
    }
    
  } catch (error) {
    console.error(`❌ Failed to bootstrap context config for ${consumerId}:`, error);
  }
}

