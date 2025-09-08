/**
 * Unified Breadcrumb Node
 * Single node for all RCRT operations - replaces separate role nodes
 * This is the correct implementation that should replace emitter/subscriber/curator/search nodes
 */

import { BaseNode, RegisterNode, NodeExecutionResult } from '@rcrt-builder/node-sdk';
import { BreadcrumbCreate, Breadcrumb, SearchParams, VectorSearchParams, BreadcrumbEvent, Selector } from '@rcrt-builder/core';

type BreadcrumbOperation = 'create' | 'read' | 'update' | 'delete' | 'search' | 'vector_search' | 'subscribe';

@RegisterNode({
  schema_name: "node.template.v1",
  title: "Breadcrumb Node (Unified)",
  tags: ["node:template", "core", "breadcrumb", "v2.0.0"],
  context: {
    node_type: "BreadcrumbNode",
    category: "core",
    icon: "📝",
    color: "#0072f5",
    description: "Single node for all RCRT operations"
  }
})
export class BreadcrumbNode extends BaseNode {
  private sseCleanup?: () => void;
  private eventQueue: BreadcrumbEvent[] = [];
  
  getMetadata() {
    return {
      type: 'BreadcrumbNode',
      category: 'core',
      icon: '📝',
      inputs: [
        { id: 'trigger', type: 'event', description: 'Trigger operation', optional: true },
        { id: 'data', type: 'data', description: 'Input data for operation', optional: true },
        { id: 'breadcrumb_id', type: 'data', description: 'ID for read/update/delete', optional: true },
        { id: 'query', type: 'data', description: 'Search query', optional: true },
        { id: 'selector', type: 'data', schema: 'selector.v1', description: 'For subscribe', optional: true }
      ],
      outputs: [
        { id: 'result', type: 'data', description: 'Operation result' },
        { id: 'context', type: 'data', schema: 'context.view' },
        { id: 'full', type: 'data', schema: 'full.view' },
        { id: 'events', type: 'event', schema: 'event.stream' },
        { id: 'error', type: 'event', optional: true }
      ]
    };
  }
  
  validateConfig(config: any): boolean {
    const validOps = ['create', 'read', 'update', 'delete', 'search', 'vector_search', 'subscribe'];
    return !config.operation || validOps.includes(config.operation);
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const operation: BreadcrumbOperation = this.context.config.operation || 'read';
    
    // Check role requirements
    const roleRequired = this.getRoleForOperation(operation);
    if (roleRequired && !this.hasRole(roleRequired)) {
      return {
        outputs: {
          error: {
            message: `Operation '${operation}' requires '${roleRequired}' role`,
            operation,
            required_role: roleRequired
          }
        }
      };
    }
    
    try {
      switch (operation) {
        case 'create':
          return await this.handleCreate(inputs);
        case 'read':
          return await this.handleRead(inputs);
        case 'update':
          return await this.handleUpdate(inputs);
        case 'delete':
          return await this.handleDelete(inputs);
        case 'search':
          return await this.handleSearch(inputs);
        case 'vector_search':
          return await this.handleVectorSearch(inputs);
        case 'subscribe':
          return await this.handleSubscribe(inputs);
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error: any) {
      return {
        outputs: {
          error: {
            message: error.message,
            operation,
            timestamp: new Date().toISOString()
          }
        }
      };
    }
  }
  
  private async handleCreate(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const { data, trigger } = inputs;
    
    if (!data) {
      throw new Error('No data provided for create operation');
    }
    
    const breadcrumbData: BreadcrumbCreate = {
      schema_name: data.schema_name || this.context.config.default_schema || 'generic.v1',
      title: data.title || `Created by ${this.context.breadcrumb_id}`,
      tags: [
        ...(data.tags || []),
        ...(this.context.config.default_tags || []),
        this.context.workspace
      ],
      context: data.context || {}
    };
    
    // Add metadata
    breadcrumbData.context.created_by = `node:${this.context.breadcrumb_id}`;
    breadcrumbData.context.created_at = new Date().toISOString();
    
    const result = await this.createBreadcrumb(breadcrumbData);
    
    return {
      outputs: {
        result: { id: result.id, created: true },
        context: breadcrumbData.context,
        full: breadcrumbData
      }
    };
  }
  
  private async handleRead(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const { breadcrumb_id } = inputs;
    
    if (!breadcrumb_id) {
      throw new Error('No breadcrumb_id provided for read operation');
    }
    
    const breadcrumb = await this.getBreadcrumb(breadcrumb_id);
    
    return {
      outputs: {
        result: breadcrumb,
        context: breadcrumb.context,
        full: breadcrumb
      }
    };
  }
  
  private async handleUpdate(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const { breadcrumb_id, data } = inputs;
    
    if (!breadcrumb_id) {
      throw new Error('No breadcrumb_id provided for update operation');
    }
    
    if (!data) {
      throw new Error('No update data provided');
    }
    
    const current = await this.getBreadcrumb(breadcrumb_id);
    
    const updatedData = {
      ...current,
      ...data,
      context: {
        ...current.context,
        ...(data.context || {}),
        last_updated_by: `node:${this.context.breadcrumb_id}`,
        last_updated_at: new Date().toISOString()
      },
      tags: data.tags || current.tags
    };
    
    const result = await this.rcrtClient.updateBreadcrumb(
      breadcrumb_id,
      current.version,
      updatedData
    );
    
    return {
      outputs: {
        result,
        context: result.context,
        full: result
      }
    };
  }
  
  private async handleDelete(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const { breadcrumb_id } = inputs;
    
    if (!breadcrumb_id) {
      throw new Error('No breadcrumb_id provided for delete operation');
    }
    
    const current = await this.getBreadcrumb(breadcrumb_id);
    await this.rcrtClient.deleteBreadcrumb(breadcrumb_id, current.version);
    
    return {
      outputs: {
        result: { deleted: true, breadcrumb_id },
        context: {},
        full: null
      }
    };
  }
  
  private async handleSearch(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const { query, data } = inputs;
    
    const searchParams: SearchParams = {
      ...(data || {}),
      tag: this.context.workspace,
      limit: this.context.config.search_limit || 10
    };
    
    if (query) {
      searchParams.text = query;
    }
    
    const results = await this.searchBreadcrumbs(searchParams);
    
    return {
      outputs: {
        result: results,
        context: { count: results.length, params: searchParams },
        full: results
      }
    };
  }
  
  private async handleVectorSearch(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const { query } = inputs;
    
    if (!query) {
      throw new Error('No query provided for vector search');
    }
    
    const vectorParams: VectorSearchParams = {
      query: typeof query === 'string' ? query : query.text || '',
      limit: this.context.config.search_limit || 10,
      tag: this.context.workspace
    };
    
    const results = await this.rcrtClient.vectorSearch(vectorParams);
    
    return {
      outputs: {
        result: results,
        context: { count: results.length, query: vectorParams.query },
        full: results
      }
    };
  }
  
  private async handleSubscribe(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const { selector, trigger } = inputs;
    
    // Stop existing subscription if trigger is 'stop'
    if (trigger === 'stop' && this.sseCleanup) {
      this.stopSubscription();
      return {
        outputs: {
          result: { subscribed: false },
          context: { stopped_at: new Date().toISOString() }
        }
      };
    }
    
    // Start new subscription
    const finalSelector: Selector = selector || this.context.config.default_selector || {
      any_tags: [this.context.workspace]
    };
    
    if (this.sseCleanup) {
      this.stopSubscription();
    }
    
    this.sseCleanup = this.rcrtClient.startEventStream(
      (event: BreadcrumbEvent) => {
        if (event.type !== 'ping') {
          this.eventQueue.push(event);
          if (this.eventQueue.length > 100) {
            this.eventQueue.shift();
          }
        }
      },
      {
        reconnectDelay: 5000,
        filters: finalSelector
      }
    );
    
    // Return next event from queue if available
    if (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      return {
        outputs: {
          result: event,
          events: event,
          context: { 
            subscribed: true, 
            queue_size: this.eventQueue.length,
            selector: finalSelector
          }
        }
      };
    }
    
    return {
      outputs: {
        result: { subscribed: true },
        context: { 
          subscribed: true, 
          selector: finalSelector,
          started_at: new Date().toISOString()
        }
      }
    };
  }
  
  private getRoleForOperation(operation: BreadcrumbOperation): string | null {
    switch (operation) {
      case 'create':
        return 'emitter';
      case 'update':
      case 'delete':
        return 'curator';
      case 'subscribe':
        return 'subscriber';
      case 'read':
      case 'search':
      case 'vector_search':
        return null; // No special role required
      default:
        return null;
    }
  }
  
  private hasRole(role: string): boolean {
    // Check if the agent associated with this node has the required role
    // This would be configured or passed through the node config
    const agentRoles = this.context.config.agent_roles || [];
    return agentRoles.includes(role);
  }
  
  private stopSubscription() {
    if (this.sseCleanup) {
      this.sseCleanup();
      this.sseCleanup = undefined;
    }
    this.eventQueue = [];
  }
  
  async destroy() {
    this.stopSubscription();
  }
}
