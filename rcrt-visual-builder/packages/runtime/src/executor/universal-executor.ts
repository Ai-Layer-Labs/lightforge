/**
 * Universal Executor - Base class for Agents, Tools, Workflows
 * 
 * Core Pattern:
 * 1. Receive SSE event (trigger or context notification)
 * 2. Determine event role from subscription
 * 3. If trigger: Fetch all context subscriptions from DB
 * 4. Execute (polymorphic - LLM for agents, function for tools)
 * 5. Create response breadcrumb
 * 
 * Key Principles:
 * - Zero hardcoded schema names
 * - Zero hardcoded key mappings
 * - Pure data-driven
 * - Fully dynamic
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

export interface ContextMatch {
  path: string;
  op: string;
  value: any;
}

export interface Subscription {
  // Routing
  schema_name: string;
  any_tags?: string[];
  all_tags?: string[];
  context_match?: ContextMatch[];
  
  // Behavior (explicit, required) - Only 'trigger' used now
  role: 'trigger';
  
  // Context key (explicit, defaults to schema_name)
  key?: string;
  
  // Fetch strategy
  fetch: {
    method: 'event_data' | 'latest' | 'recent' | 'vector';
    limit?: number;
    nn?: number;
  };
  
  // Metadata
  comment?: string;
  priority?: number;
}

export interface UniversalExecutorOptions {
  rcrtClient: RcrtClientEnhanced;
  workspace: string;
  subscriptions: Subscription[];
  id: string;  // agent_id or tool name
}

export abstract class UniversalExecutor {
  protected rcrtClient: RcrtClientEnhanced;
  protected workspace: string;
  protected subscriptions: Subscription[];
  protected id: string;
  
  constructor(options: UniversalExecutorOptions) {
    this.rcrtClient = options.rcrtClient;
    this.workspace = options.workspace;
    this.subscriptions = options.subscriptions;
    this.id = options.id;
  }
  
  /**
   * Process ANY SSE event generically
   * Pure data-driven - no hardcoding
   */
  async processSSEEvent(event: any): Promise<void> {
    // Skip pings
    if (event.type === 'ping') return;
    
    console.log(`📨 [${this.id}] Event: ${event.schema_name}`);
    
    try {
      // Find matching subscription
      const subscription = this.findMatchingSubscription(event);
      
      if (!subscription) {
        console.log(`⏭️ [${this.id}] No subscription for ${event.schema_name}`);
        console.log(`🔍 [${this.id}] Event tags:`, event.tags);
        console.log(`🔍 [${this.id}] Available subscriptions:`, 
          this.subscriptions.map(s => ({
            schema: s.schema_name,
            role: s.role,
            all_tags: s.all_tags,
            any_tags: s.any_tags
          }))
        );
        return;
      }
      
      // Check role
      if (subscription.role !== 'trigger') {
        // Ignore non-trigger subscriptions (context handled by context-builder)
        return;
      }
      
      // TRIGGER! Process now
      console.log(`🎯 [${this.id}] ${event.schema_name} is TRIGGER - processing...`);
      
      // Fetch the trigger breadcrumb (with llm_hints applied)
      const triggerBreadcrumb = await this.rcrtClient.getBreadcrumb(event.breadcrumb_id);
      
      // Skip self-created
      if (this.isSelfCreated(triggerBreadcrumb)) {
        console.log(`⏭️ [${this.id}] Skipping self-created event`);
        return;
      }
      
      // Execute (context is IN the trigger for agent.context.v1!)
      console.log(`🔄 [${this.id}] Executing with pre-assembled context...`);
      const result = await this.execute(triggerBreadcrumb, {});
      
      // Create response
      await this.respond(triggerBreadcrumb, result);
      
      console.log(`✅ [${this.id}] ${event.schema_name} processed successfully`);
      
    } catch (error) {
      console.error(`❌ [${this.id}] Error processing event:`, error);
      throw error;
    }
  }
  
  
  // REMOVED: fetchContextSource() - No longer needed
  // Context is pre-assembled by context-builder service
  
  /**
   * Find subscription matching this event
   * Pure selector matching
   */
  private findMatchingSubscription(event: any): Subscription | null {
    for (const sub of this.subscriptions) {
      if (this.matchesSelector(event, sub)) {
        return sub;
      }
    }
    return null;
  }
  
  /**
   * Check if event matches subscription selector
   * Pure matching logic
   */
  private matchesSelector(event: any, subscription: Subscription): boolean {
    // Schema name match
    if (subscription.schema_name && event.schema_name !== subscription.schema_name) {
      return false;
    }
    
    // Tag matching
    if (subscription.any_tags) {
      const hasAny = subscription.any_tags.some(tag => event.tags?.includes(tag));
      if (!hasAny) return false;
    }
    
    if (subscription.all_tags) {
      const hasAll = subscription.all_tags.every(tag => event.tags?.includes(tag));
      if (!hasAll) return false;
    }
    
    // Context matching - SKIP for initial routing
    // SSE events don't have full breadcrumb context
    // We'll check context_match after fetching the breadcrumb if needed
    // For now, if schema + tags match, route the event
    
    return true;
  }
  
  /**
   * Check if breadcrumb was self-created
   */
  private isSelfCreated(breadcrumb: any): boolean {
    return breadcrumb.created_by === this.id || 
           breadcrumb.context?.creator?.agent_id === this.id ||
           breadcrumb.context?.creator?.tool === this.id;
  }
  
  /**
   * Helper: Get value by JSONPath
   */
  private getValueByPath(obj: any, path: string): any {
    if (!obj) return undefined;
    
    const cleanPath = path.startsWith('$.') ? path.substring(2) : path;
    const parts = cleanPath.split('.');
    
    let current = obj;
    for (const part of parts) {
      if (!current) return undefined;
      current = current[part];
    }
    
    return current;
  }
  
  /**
   * Helper: Compare values for context matching
   */
  private compareValues(actual: any, expected: any, op: string): boolean {
    switch (op) {
      case 'eq':
        return actual === expected;
      case 'ne':
        return actual !== expected;
      case 'contains_any':
        if (Array.isArray(actual) && Array.isArray(expected)) {
          return expected.some(e => actual.includes(e));
        }
        return false;
      case 'gt':
        return actual > expected;
      case 'lt':
        return actual < expected;
      default:
        return false;
    }
  }
  
  /**
   * Override in subclass for vector search query
   */
  protected getVectorSearchQuery(): string {
    return '';
  }
  
  // ============ ABSTRACT METHODS ============
  
  /**
   * Execute with assembled context (polymorphic!)
   * - Agent: Call LLM
   * - Tool: Run function
   * - Workflow: Execute steps
   */
  protected abstract execute(trigger: any, context: Record<string, any>): Promise<any>;
  
  /**
   * Create response breadcrumb
   * - Agent: agent.response.v1
   * - Tool: tool.response.v1
   * - Workflow: workflow.result.v1
   */
  protected abstract respond(trigger: any, result: any): Promise<void>;
}
