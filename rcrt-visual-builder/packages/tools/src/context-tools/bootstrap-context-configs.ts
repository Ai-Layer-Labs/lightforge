/**
 * Bootstrap Context Configurations
 * Similar to bootstrap-tools.ts, this creates default context.config.v1 breadcrumbs
 * on startup to ensure context-builder has configurations to work with
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

/**
 * Default context configuration for chat agents
 */
const defaultChatAgentConfig = {
  consumer_id: 'default-chat-assistant',
  consumer_type: 'agent',
  sources: [
    {
      schema_name: 'user.message.v1',
      method: 'vector',
      nn: 5,
      filters: { tag: 'extension:chat' }
    },
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
    {
      schema_name: 'tool.catalog.v1',
      method: 'latest',
      filters: { tag: 'workspace:tools' }
    }
  ],
  update_triggers: [
    {
      schema_name: 'user.message.v1',
      any_tags: ['user:message', 'extension:chat']
    },
    {
      schema_name: 'tool.response.v1',
      context_match: [{
        path: '$.requestedBy',
        op: 'eq',
        value: 'default-chat-assistant'
      }]
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
    defaultChatAgentConfig,
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

