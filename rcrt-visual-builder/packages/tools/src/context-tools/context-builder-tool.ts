/**
 * Context Builder Tool - Universal Context Assembly Primitive
 * 
 * Purpose: Maintains agent.context.v1 breadcrumbs for ANY consumer
 * Scalability: Config-driven, not hardcoded for specific agents
 * 
 * Flow:
 * 1. Consumer creates context.config.v1 breadcrumb
 * 2. Context-builder subscribes to update_triggers
 * 3. On trigger, uses pgvector + filters to assemble context
 * 4. Updates/creates agent.context.v1 for consumer
 * 5. Consumer subscribes to their agent.context.v1
 */

import { RCRTTool, ToolExecutionContext } from '../index.js';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

interface ContextSource {
  schema_name: string;
  method: 'vector' | 'recent' | 'latest' | 'all' | 'tagged';
  nn?: number;
  limit?: number;
  filters?: any;
}

interface ContextConfig {
  consumer_id: string;
  consumer_type: string;
  sources: ContextSource[];
  update_triggers: any[];
  output: {
    schema_name: string;
    tags: string[];
    ttl_seconds?: number;
  };
  formatting?: {
    max_tokens?: number;
    include_metadata?: boolean;
    deduplication_threshold?: number;
  };
}

export class ContextBuilderTool implements RCRTTool {
  name = 'context-builder';
  description = 'Universal context assembly primitive - maintains context breadcrumbs for agents, workflows, and other consumers';
  category = 'system';
  version = '1.0.0';
  
  // 🎯 THE RCRT WAY: Tool subscribes to events (like agents!)
  // When these events arrive, tool.request.v1 is auto-created
  subscriptions = {
    selectors: [
      {
        comment: 'React to user messages',
        schema_name: 'user.message.v1',
        any_tags: ['user:message', 'extension:chat']
      },
      {
        comment: 'Discover new context configs',
        schema_name: 'context.config.v1'
      }
      // NOTE: Do NOT subscribe to tool.response.v1 - creates feedback loop!
    ]
  };
  
  // Track active contexts: consumerId -> { configId, contextId, lastUpdate }
  private activeContexts = new Map<string, {
    configId: string;
    contextId?: string;
    lastUpdate: Date;
    config: ContextConfig;
  }>();
  
  inputSchema = {
    type: 'object',
    properties: {
      trigger_event: {
        type: 'object',
        description: 'Event that triggered this tool (auto-passed by tools-runner)'
      }
    }
  };
  
  outputSchema = {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      action: { type: 'string' },
      consumer_id: { type: 'string' },
      context_id: { type: 'string' },
      token_estimate: { type: 'number' },
      sources_assembled: { type: 'number' },
      error: { type: 'string' }
    }
  };
  
  examples = [
    {
      title: 'Register new context consumer',
      input: {
        action: 'register',
        config_id: 'uuid-of-context-config-breadcrumb'
      },
      output: {
        success: true,
        action: 'register',
        consumer_id: 'default-chat-assistant',
        context_id: 'uuid-of-created-context'
      },
      explanation: 'Reads context.config.v1, creates initial agent.context.v1'
    },
    {
      title: 'Update context on event',
      input: {
        action: 'update',
        consumer_id: 'default-chat-assistant',
        trigger_event: { schema_name: 'user.message.v1', breadcrumb_id: '...' }
      },
      output: {
        success: true,
        action: 'update',
        consumer_id: 'default-chat-assistant',
        context_id: 'uuid-of-updated-context',
        token_estimate: 1500,
        sources_assembled: 3
      },
      explanation: 'Uses pgvector to find relevant history, updates agent.context.v1'
    }
  ];
  
  async execute(input: any, context: ToolExecutionContext): Promise<any> {
    const { rcrtClient } = context;
    
    if (!rcrtClient) {
      return { success: false, error: 'rcrtClient required' };
    }
    
    // Simple: event triggered this, find relevant context configs and update them
    const triggerEvent = input.trigger_event || input;
    
    console.log(`🔧 context-builder triggered by: ${triggerEvent.schema_name}`);
    
    // Find ALL context.config.v1 breadcrumbs
    const configs = await rcrtClient.searchBreadcrumbsWithContext({
      schema_name: 'context.config.v1',
      include_context: true
    });
    
    console.log(`📚 Found ${configs.length} context configs`);
    
    // For each config, check if this event is relevant
    const results = [];
    for (const configBreadcrumb of configs) {
      const config = configBreadcrumb.context;
      
      // Should we update this consumer's context?
      // Simple: just update all of them (they'll filter internally)
      const result = await this.updateContextForConsumer(
        rcrtClient,
        config,
        triggerEvent
      );
      
      if (result.success) {
        results.push(result);
      }
    }
    
    return {
      success: true,
      configs_updated: results.length,
      results
    };
  }
  
  /**
   * Update context for a single consumer
   */
  private async updateContextForConsumer(
    client: RcrtClientEnhanced,
    config: any,
    triggerEvent: any
  ): Promise<any> {
    const consumerId = config.consumer_id;
    
    console.log(`🔄 Updating context for ${consumerId}...`);
    
    // Extract context_id from trigger event (RCRT way!)
    const contextIdFromTag = triggerEvent.tags?.find((t: string) => t.startsWith('context:'))?.replace('context:', '');
    const contextIdFromContext = triggerEvent.context?.context_id;
    const currentContextId = contextIdFromTag || contextIdFromContext;
    
    if (currentContextId) {
      console.log(`📌 Context ID: ${currentContextId}`);
    } else {
      console.log(`🆕 No context ID - will create new context`);
    }
    
    // Assemble context (with context_id for filtering)
    const assembled = await this.assembleContext(client, config, triggerEvent, currentContextId);
    
    // Find or create agent.context.v1
    const existing = await client.searchBreadcrumbs({
      schema_name: config.output.schema_name,
      tag: `consumer:${consumerId}`
    });
    
    const contextData = {
      consumer_id: consumerId,
      trigger_event_id: triggerEvent.breadcrumb_id,
      assembled_at: new Date().toISOString(),
      token_estimate: this.estimateTokens(assembled),
      sources_assembled: config.sources?.length || 0,
      ...assembled,
      llm_hints: this.generateLlmHints(config, assembled)
    };
    
    if (existing.length > 0) {
      console.log(`  📝 Updating existing context: ${existing[0].id}`);
      const existingBreadcrumb = await client.getBreadcrumb(existing[0].id);
      console.log(`  📌 Current version: ${existingBreadcrumb.version}`);
      
      await client.updateBreadcrumb(existing[0].id, existingBreadcrumb.version, {
        context: contextData
      });
      
      console.log(`  ✅ Update complete, fetching new version...`);
      const updated = await client.getBreadcrumb(existing[0].id);
      console.log(`  📌 New version: ${updated.version}`);
      
      return { success: true, action: 'updated', context_id: existing[0].id, version: updated.version };
    } else {
      // Create new context breadcrumb with required fields
      const created = await client.createBreadcrumb({
        schema_name: config.output.schema_name,
        title: `Context for ${consumerId}`,  // ← REQUIRED FIELD!
        tags: config.output.tags,
        ttl: config.output.ttl_seconds 
          ? new Date(Date.now() + config.output.ttl_seconds * 1000).toISOString()
          : undefined,
        context: contextData
      });
      return { success: true, action: 'created', context_id: created.id };
    }
  }
  
  /**
   * Register a new context consumer from their config breadcrumb
   */
  private async registerConsumer(
    client: RcrtClientEnhanced,
    configId: string
  ): Promise<any> {
    try {
      // 1. Fetch the context.config.v1 breadcrumb
      const configBreadcrumb = await client.getBreadcrumb(configId);
      
      if (configBreadcrumb.schema_name !== 'context.config.v1') {
        return { 
          success: false, 
          error: `Invalid schema: expected context.config.v1, got ${configBreadcrumb.schema_name}` 
        };
      }
      
      const config: ContextConfig = configBreadcrumb.context as ContextConfig;
      
      // 2. Build initial context
      const assembledContext = await this.assembleContext(client, config);
      
      // 3. Create agent.context.v1 breadcrumb (or whatever output schema)
      const contextBreadcrumb = await client.createBreadcrumb({
        schema_name: config.output.schema_name,
        title: `Context for ${config.consumer_id}`,
        tags: config.output.tags,
        ttl: config.output.ttl_seconds 
          ? new Date(Date.now() + config.output.ttl_seconds * 1000).toISOString()
          : undefined,
        context: {
          consumer_id: config.consumer_id,
          consumer_type: config.consumer_type,
          assembled_at: new Date().toISOString(),
          token_estimate: this.estimateTokens(assembledContext),
          
          // The actual context data
          ...assembledContext,
          
          // Add llm_hints for clean LLM consumption
          llm_hints: this.generateLlmHints(config, assembledContext)
        }
      });
      
      // 4. Track this active context
      this.activeContexts.set(config.consumer_id, {
        configId,
        contextId: contextBreadcrumb.id,
        lastUpdate: new Date(),
        config
      });
      
      console.log(`✅ Registered context for ${config.consumer_id} → ${contextBreadcrumb.id}`);
      
      return {
        success: true,
        action: 'register',
        consumer_id: config.consumer_id,
        context_id: contextBreadcrumb.id,
        token_estimate: this.estimateTokens(assembledContext),
        sources_assembled: config.sources.length
      };
      
    } catch (error) {
      console.error('Failed to register consumer:', error);
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Update context when a trigger event occurs
   */
  private async updateContext(
    client: RcrtClientEnhanced,
    consumerId: string,
    triggerEvent: any
  ): Promise<any> {
    try {
      // 1. Get active context info
      const activeContext = this.activeContexts.get(consumerId);
      
      if (!activeContext) {
        return { 
          success: false, 
          error: `No active context for consumer: ${consumerId}. Call 'register' first.` 
        };
      }
      
      // 2. Check if this event matches update triggers
      const shouldUpdate = this.matchesTriggers(
        triggerEvent, 
        activeContext.config.update_triggers
      );
      
      if (!shouldUpdate) {
        return { 
          success: true, 
          action: 'skipped',
          reason: 'Event does not match update triggers' 
        };
      }
      
      // 3. Assemble new context using the config
      const assembledContext = await this.assembleContext(
        client, 
        activeContext.config,
        triggerEvent  // Pass trigger for context-aware assembly
      );
      
      // 4. Update existing context breadcrumb
      if (!activeContext.contextId) {
        return { success: false, error: 'No context breadcrumb ID' };
      }
      
      const existing = await client.getBreadcrumb(activeContext.contextId);
      
      await client.updateBreadcrumb(
        activeContext.contextId,
        existing.version,
        {
          context: {
            consumer_id: activeContext.config.consumer_id,
            consumer_type: activeContext.config.consumer_type,
            assembled_at: new Date().toISOString(),
            token_estimate: this.estimateTokens(assembledContext),
            trigger_event_id: triggerEvent.breadcrumb_id,
            
            ...assembledContext,
            
            llm_hints: this.generateLlmHints(activeContext.config, assembledContext)
          }
        }
      );
      
      // Update tracking
      activeContext.lastUpdate = new Date();
      
      console.log(`✅ Updated context for ${consumerId} (trigger: ${triggerEvent.schema_name})`);
      
      return {
        success: true,
        action: 'update',
        consumer_id: consumerId,
        context_id: activeContext.contextId,
        token_estimate: this.estimateTokens(assembledContext),
        sources_assembled: activeContext.config.sources.length,
        trigger: triggerEvent.schema_name
      };
      
    } catch (error) {
      console.error('Failed to update context:', error);
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Assemble context based on configuration
   * This is where the magic happens - pgvector, filtering, deduplication
   */
  private async assembleContext(
    client: RcrtClientEnhanced,
    config: ContextConfig,
    triggerEvent?: any,
    contextId?: string | null
  ): Promise<any> {
    const assembled: any = {};
    const formatting = config.formatting || {};
    
    console.log(`🔍 Assembling context${contextId ? ` for context: ${contextId}` : ''} using ${config.sources?.length || 0} sources`);
    
    // Use trigger event for vector search query if available
    const searchQuery = triggerEvent?.context?.content || 
                       triggerEvent?.context?.message ||
                       JSON.stringify(triggerEvent?.context || {});
    
    console.log(`🔍 Assembling context for ${config.consumer_id} using ${config.sources.length} sources`);
    
    // Process each source in parallel
    const sourceResults = await Promise.all(
      config.sources.map(async (source, index) => {
        try {
          let breadcrumbs: any[] = [];
          
          switch (source.method) {
            case 'vector':
              // 🎯 USE PGVECTOR for semantic relevance!
              breadcrumbs = await client.vectorSearch({
                q: searchQuery,
                nn: source.nn || 5,
                filters: source.filters
              });
              console.log(`  📊 Vector search for ${source.schema_name}: ${breadcrumbs.length} results`);
              break;
            
            case 'recent':
              // Apply context filtering for recent searches (focused conversation)
              const recentFilters = { ...source.filters };
              
              // If source has conversation_scope: "current" and we have a contextId, filter by it
              if (source.conversation_scope === 'current' && contextId) {
                // Add context tag to filter
                const existingTags = recentFilters.any_tags || recentFilters.tag ? 
                  (Array.isArray(recentFilters.any_tags) ? recentFilters.any_tags : [recentFilters.tag]) : [];
                recentFilters.any_tags = [...existingTags, `context:${contextId}`];
                console.log(`  🎯 Filtering recent ${source.schema_name} by context:${contextId}`);
              }
              
              breadcrumbs = await client.searchBreadcrumbsWithContext({
                schema_name: source.schema_name,
                ...recentFilters,
                include_context: true,
                limit: source.limit || 10
              });
              console.log(`  📊 Recent search for ${source.schema_name}: ${breadcrumbs.length} results`);
              break;
            
            case 'latest':
              const latest = await client.searchBreadcrumbsWithContext({
                schema_name: source.schema_name,
                ...source.filters,
                include_context: true,
                limit: 1
              });
              breadcrumbs = latest;
              console.log(`  📊 Latest for ${source.schema_name}: ${breadcrumbs.length} result`);
              break;
            
            case 'tagged':
              breadcrumbs = await client.searchBreadcrumbsWithContext({
                ...source.filters,
                include_context: true
              });
              console.log(`  📊 Tagged search: ${breadcrumbs.length} results`);
              break;
            
            default:
              console.warn(`Unknown method: ${source.method}`);
          }
          
          return {
            source,
            breadcrumbs,
            index
          };
        } catch (error) {
          console.error(`Failed to fetch source ${source.schema_name}:`, error);
          return { source, breadcrumbs: [], index, error: String(error) };
        }
      })
    );
    
    // Build assembled context object
    // Handle multiple sources for same schema (hybrid mode)
    const messagesBySchema: Record<string, any[]> = {};
    
    for (const result of sourceResults) {
      if (result.breadcrumbs.length === 0) continue;
      
      const schema = result.source.schema_name;
      
      if (result.source.method === 'latest') {
        // Single breadcrumb - use full context
        const key = this.getContextKey(result.source);
        assembled[key] = result.breadcrumbs[0]?.context;
      } else if (schema === 'user.message.v1' || schema === 'agent.response.v1') {
        // Chat messages - accumulate for deduplication
        if (!messagesBySchema[schema]) {
          messagesBySchema[schema] = [];
        }
        
        const messages = result.breadcrumbs.map(b => ({
          id: b.id,  // For deduplication
          role: schema === 'user.message.v1' ? 'user' : 'assistant',
          content: b.context?.content || b.context?.message,
          timestamp: b.updated_at
        }));
        
        messagesBySchema[schema].push(...messages);
      } else {
        // Other breadcrumbs
        const key = this.getContextKey(result.source);
        if (!assembled[key]) assembled[key] = [];
        assembled[key].push(...result.breadcrumbs.map(b => b.context));
      }
    }
    
    // Deduplicate chat messages (same ID = same message from recent + vector)
    for (const [schema, messages] of Object.entries(messagesBySchema)) {
      const seen = new Set<string>();
      const deduplicated = messages.filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      
      const key = this.getContextKey({ schema_name: schema } as any);
      assembled[key] = deduplicated;
      
      console.log(`  🧹 Deduplicated ${schema}: ${messages.length} → ${deduplicated.length} messages`);
    }
    
    // 🔥 Deduplication using embedding similarity (if configured)
    // IMPORTANT: Always preserve the trigger event (newest user message)
    if (formatting.deduplication_threshold && assembled.chat_history) {
      const triggerBreadcrumbId = triggerEvent?.breadcrumb_id;
      
      assembled.chat_history = await this.deduplicateByEmbedding(
        assembled.chat_history,
        formatting.deduplication_threshold,
        triggerBreadcrumbId // Pass trigger ID to preserve it
      );
    }
    
    // Token budget enforcement
    if (formatting.max_tokens) {
      return this.enforceTokenBudget(assembled, formatting.max_tokens);
    }
    
    return assembled;
  }
  
  /**
   * Generate context key from source config
   */
  private getContextKey(source: ContextSource): string {
    // Map schema names to friendly context keys
    const keyMap: Record<string, string> = {
      'user.message.v1': 'chat_history',
      'agent.response.v1': 'agent_responses',
      'tool.response.v1': 'tool_results',
      'tool.catalog.v1': 'tool_catalog',
      'agent.def.v1': 'agent_definition',
      'workflow.state.v1': 'workflow_state'
    };
    
    return keyMap[source.schema_name] || source.schema_name.replace(/\./g, '_');
  }
  
  /**
   * Generate llm_hints for clean LLM consumption
   * 
   * NOTE: llm_hints are applied by RCRT server's transform engine on GET requests.
   * However, since the transforms are complex and may fail, we also format
   * manually in agent-executor as a fallback.
   * 
   * For now, we'll skip llm_hints and rely on manual formatting in agent-executor.
   * This is simpler and more reliable.
   */
  private generateLlmHints(config: ContextConfig, assembled: any): any {
    // Skip llm_hints for now - manual formatting is simpler and more reliable
    // The transform engine in RCRT works, but Handlebars templates are fragile
    // Better to format in TypeScript where we have full control
    return null;
    
    // Future: Could use simpler transforms like:
    // {
    //   mode: 'merge',
    //   transform: {
    //     tool_count: { type: 'literal', literal: assembled.tool_catalog?.tools?.length || 0 },
    //     message_count: { type: 'literal', literal: assembled.chat_history?.length || 0 }
    //   }
    // }
  }
  
  /**
   * Check if event matches any update trigger
   */
  private matchesTriggers(event: any, triggers: any[]): boolean {
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
      
      // Context match (simplified)
      if (trigger.context_match) {
        const matches = trigger.context_match.every((rule: any) => {
          const path = rule.path.replace('$.', '');
          const value = event.context?.[path];
          return value === rule.value;
        });
        if (!matches) continue;
      }
      
      // Matched a trigger!
      return true;
    }
    
    return false;
  }
  
  /**
   * Deduplicate messages using embedding similarity
   * Uses pgvector's cosine similarity via the API
   * IMPORTANT: Always preserves the trigger message (newest user question)
   */
  private async deduplicateByEmbedding(
    messages: any[],
    threshold: number,
    triggerBreadcrumbId?: string
  ): Promise<any[]> {
    if (messages.length <= 1) return messages;
    
    // Always keep the trigger message (the current user question)
    const triggerMessage = messages.find(m => m.id === triggerBreadcrumbId);
    
    // Simple deduplication: compare adjacent messages
    // Full implementation would use pgvector query
    const deduplicated = [messages[0]];
    
    for (let i = 1; i < messages.length; i++) {
      const current = messages[i];
      const prev = messages[i - 1];
      
      // ALWAYS preserve the trigger message
      if (triggerBreadcrumbId && current.id === triggerBreadcrumbId) {
        if (!deduplicated.find(m => m.id === triggerBreadcrumbId)) {
          deduplicated.push(current);
        }
        continue;
      }
      
      // Simple content comparison (real version would use embeddings)
      const currentText = current.content || current.message || '';
      const prevText = prev.content || prev.message || '';
      
      if (currentText !== prevText) {
        deduplicated.push(current);
      }
    }
    
    // Ensure trigger message is at the end (most recent)
    if (triggerMessage && !deduplicated.find(m => m.id === triggerBreadcrumbId)) {
      deduplicated.push(triggerMessage);
    }
    
    console.log(`  🧹 Deduplicated ${messages.length} → ${deduplicated.length} messages (preserved trigger: ${!!triggerBreadcrumbId})`);
    return deduplicated;
  }
  
  /**
   * Enforce token budget by trimming oldest/least relevant content
   */
  private enforceTokenBudget(assembled: any, maxTokens: number): any {
    let currentEstimate = this.estimateTokens(assembled);
    
    if (currentEstimate <= maxTokens) {
      return assembled; // Under budget
    }
    
    console.log(`⚠️ Context over budget: ${currentEstimate} > ${maxTokens} tokens, trimming...`);
    
    // Trim chat history first (keep most recent)
    if (assembled.chat_history && Array.isArray(assembled.chat_history)) {
      while (currentEstimate > maxTokens && assembled.chat_history.length > 1) {
        assembled.chat_history.shift(); // Remove oldest
        currentEstimate = this.estimateTokens(assembled);
      }
    }
    
    // Trim tool results if still over
    if (assembled.tool_results && Array.isArray(assembled.tool_results)) {
      while (currentEstimate > maxTokens && assembled.tool_results.length > 1) {
        assembled.tool_results.shift();
        currentEstimate = this.estimateTokens(assembled);
      }
    }
    
    console.log(`  ✂️ Trimmed to ${currentEstimate} tokens`);
    return assembled;
  }
  
  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(obj: any): number {
    return Math.ceil(JSON.stringify(obj).length / 4);
  }
  
  /**
   * Get current context for a consumer
   */
  private async getContext(
    client: RcrtClientEnhanced,
    consumerId: string
  ): Promise<any> {
    const activeContext = this.activeContexts.get(consumerId);
    
    if (!activeContext || !activeContext.contextId) {
      return { success: false, error: `No active context for ${consumerId}` };
    }
    
    try {
      const breadcrumb = await client.getBreadcrumb(activeContext.contextId);
      return {
        success: true,
        action: 'get',
        consumer_id: consumerId,
        context: breadcrumb.context,
        last_update: activeContext.lastUpdate
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Deregister a consumer (stop maintaining their context)
   */
  private async deregisterConsumer(consumerId: string): Promise<any> {
    if (!this.activeContexts.has(consumerId)) {
      return { success: false, error: `Consumer ${consumerId} not registered` };
    }
    
    this.activeContexts.delete(consumerId);
    
    console.log(`🗑️ Deregistered context for ${consumerId}`);
    
    return {
      success: true,
      action: 'deregister',
      consumer_id: consumerId
    };
  }
  
  /**
   * List all active contexts being maintained
   */
  private async listActiveContexts(): Promise<any> {
    const contexts = Array.from(this.activeContexts.entries()).map(([id, data]) => ({
      consumer_id: id,
      consumer_type: data.config.consumer_type,
      context_id: data.contextId,
      last_update: data.lastUpdate,
      sources: data.config.sources.length
    }));
    
    return {
      success: true,
      action: 'list',
      count: contexts.length,
      contexts
    };
  }
}

// Export singleton instance
export const contextBuilderTool = new ContextBuilderTool();

