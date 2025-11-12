/**
 * Bootstrap Context Configurations
 * Similar to bootstrap-tools.ts, this creates default context.config.v1 breadcrumbs
 * on startup to ensure context-builder has configurations to work with
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

/**
 * Default context configuration for chat agents
 * This creates context.config.v1 breadcrumb (like tool.config.v1 for openrouter)
 * Can be edited via UI to customize context assembly
 */
const defaultChatAgentContextConfig = {
  consumer_id: 'default-chat-assistant',
  consumer_type: 'agent',
  
  // Configurable: Which sources to include
  sources: [
    // User messages: Hybrid approach (recent + semantic)
    {
      schema_name: 'user.message.v1',
      method: 'recent',
      limit: 20,
      conversation_scope: 'current',  // ← Filter by current context!
      filters: { tag: 'extension:chat' }
    },
    {
      schema_name: 'user.message.v1',
      method: 'vector',
      nn: 10,  // Semantic across ALL conversations (no context filter)
      filters: { tag: 'extension:chat' }
    },
    // Agent responses: Hybrid approach
    {
      schema_name: 'agent.response.v1',
      method: 'recent',
      limit: 20,
      conversation_scope: 'current',  // ← Filter by current context!
      filters: { tag: 'workspace:agents' }
    },
    {
      schema_name: 'agent.response.v1',
      method: 'vector',
      nn: 10,  // Semantic across ALL conversations
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
    // Tools: Direct discovery (RCRT WAY - no catalog aggregation!)
    {
      schema_name: 'tool.code.v1',
      method: 'all',
      filters: { tag: 'workspace:tools' },
      limit: 50
    }
  ],
  
  // Configurable: Output configuration
  output: {
    schema_name: 'agent.context.v1',
    tags: ['agent:context', 'consumer:default-chat-assistant'],
    ttl_seconds: 3600  // How long context is cached
  },
  
  // Configurable: Formatting and optimization
  formatting: {
    max_tokens: 400000,  // Token budget for gemini-2.5-flash-lite (supports up to 1M)
    deduplication_threshold: 0.95,  // Similarity threshold for dedup (0.90-0.99)
    include_metadata: false,  // Include timestamps, IDs, etc.
    enable_summarization: false  // Future: LLM-based summarization
  },
  
  // Metadata for UI
  metadata: {
    version: '1.0.0',
    created_by: 'system',
    description: 'Hybrid context strategy: recent + semantic search',
    last_updated: new Date().toISOString()
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
        'ui:editable',  // ← Tells UI this is editable
        workspace
      ],
      context: {
        ...config,
        // Add UI metadata
        ui_config: {
          editable: true,
          category: 'context-assembly',
          icon: '🏗️',
          description: 'Configure how context is assembled for this agent'
        }
      }
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

