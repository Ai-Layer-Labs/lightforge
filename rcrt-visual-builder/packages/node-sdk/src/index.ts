/**
 * Node SDK for RCRT Visual Builder
 * Base classes and interfaces for building nodes
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { 
  NodePort, 
  NodeExecutionResult, 
  NodeContext,
  BreadcrumbBase 
} from '@rcrt-builder/core';

// Node configuration interface
export interface NodeConfig {
  [key: string]: any;
}

// Node metadata interface
export interface NodeMetadata {
  type: string;
  category: string;
  icon: string;
  color?: string;
  description?: string;
  inputs: NodePort[];
  outputs: NodePort[];
  version?: string;
}

// Node template decorator data
export interface NodeTemplate {
  schema_name: string;
  title: string;
  tags: string[];
  context: {
    node_type: string;
    category: string;
    icon: string;
    color: string;
    description?: string;
  };
}

/**
 * Base class for all nodes
 */
export abstract class BaseNode {
  protected context: NodeContext;
  protected rcrtClient: RcrtClientEnhanced;
  
  constructor(context: NodeContext) {
    this.context = context;
    this.rcrtClient = context.rcrtClient;
  }
  
  /**
   * Define node metadata
   */
  abstract getMetadata(): NodeMetadata;
  
  /**
   * Validate configuration
   */
  abstract validateConfig(config: NodeConfig): boolean;
  
  /**
   * Execute node logic
   */
  abstract execute(inputs: Record<string, any>): Promise<NodeExecutionResult>;
  
  /**
   * Initialize node (optional)
   */
  async initialize(): Promise<void> {
    // Override in subclasses if needed
  }
  
  /**
   * Cleanup resources (optional)
   */
  async destroy(): Promise<void> {
    // Override in subclasses if needed
  }
  
  // Helper methods
  
  /**
   * Get a breadcrumb by ID
   */
  protected async getBreadcrumb(id: string) {
    return this.rcrtClient.getBreadcrumb(id);
  }
  
  /**
   * Create a new breadcrumb
   */
  protected async createBreadcrumb(data: Partial<BreadcrumbBase>) {
    return this.rcrtClient.createBreadcrumb({
      title: data.title || 'Node Created Breadcrumb',
      context: data.context || {},
      tags: [...(data.tags || []), this.context.workspace],
      schema_name: data.schema_name,
    });
  }
  
  /**
   * Update an existing breadcrumb
   */
  protected async updateBreadcrumb(id: string, version: number, updates: any) {
    return this.rcrtClient.updateBreadcrumb(id, version, updates);
  }
  
  /**
   * Search breadcrumbs in workspace
   */
  protected async searchWorkspace(params: any) {
    return this.rcrtClient.searchBreadcrumbs({
      ...params,
      tag: this.context.workspace,
    });
  }
  
  /**
   * Log execution metadata
   */
  protected async logExecution(data: any) {
    await this.createBreadcrumb({
      schema_name: 'node.execution.v1',
      title: `Node Execution: ${this.context.breadcrumb_id}`,
      tags: ['node:execution', `node:${this.getMetadata().type}`],
      context: {
        node_id: this.context.breadcrumb_id,
        node_type: this.getMetadata().type,
        timestamp: new Date().toISOString(),
        ...data,
      },
    });
  }
  
  /**
   * Handle errors gracefully
   */
  protected async handleError(error: any, inputs?: any) {
    await this.createBreadcrumb({
      schema_name: 'node.error.v1',
      title: `Node Error: ${this.context.breadcrumb_id}`,
      tags: ['node:error', `node:${this.getMetadata().type}`],
      context: {
        node_id: this.context.breadcrumb_id,
        node_type: this.getMetadata().type,
        error: error.message || String(error),
        stack: error.stack,
        inputs,
        timestamp: new Date().toISOString(),
      },
    });
    
    throw error;
  }
}

/**
 * Node Registry for managing node templates
 */
export class NodeRegistry {
  private static templates = new Map<string, any>();
  private static instances = new Map<string, typeof BaseNode>();
  
  /**
   * Register a node class with its template
   */
  static register(NodeClass: typeof BaseNode, template: NodeTemplate) {
    const className = NodeClass.name;
    this.instances.set(className, NodeClass);
    this.templates.set(className, template);
    
    // Store template metadata on the class
    (NodeClass as any).__template = template;
  }
  
  /**
   * Get a node class by name
   */
  static getNodeClass(name: string): typeof BaseNode | undefined {
    return this.instances.get(name);
  }
  
  /**
   * Get a node template by name
   */
  static getTemplate(name: string): NodeTemplate | undefined {
    return this.templates.get(name);
  }
  
  /**
   * Get all registered node types
   */
  static getNodeTypes(): string[] {
    return Array.from(this.instances.keys());
  }
  
  /**
   * Create a node instance
   */
  static createNode(type: string, context: NodeContext): BaseNode {
    const NodeClass = this.instances.get(type);
    if (!NodeClass) {
      throw new Error(`Unknown node type: ${type}`);
    }
    return new NodeClass(context);
  }
}

/**
 * Decorator for auto-registering nodes
 */
export function RegisterNode(template: NodeTemplate) {
  return function(target: any) {
    NodeRegistry.register(target, template);
    return target;
  };
}

/**
 * Helper to create a standardized node response
 */
export function createNodeResponse(
  outputs: Record<string, any>,
  metadata?: Record<string, any>
): NodeExecutionResult {
  return {
    outputs,
    metadata: {
      ...metadata,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Helper to validate required inputs
 */
export function validateInputs(
  inputs: Record<string, any>,
  required: string[]
): void {
  for (const key of required) {
    if (!(key in inputs) || inputs[key] === undefined) {
      throw new Error(`Missing required input: ${key}`);
    }
  }
}

/**
 * Helper to validate input types
 */
export function validateInputTypes(
  inputs: Record<string, any>,
  types: Record<string, string>
): void {
  for (const [key, expectedType] of Object.entries(types)) {
    if (key in inputs) {
      const actualType = typeof inputs[key];
      if (actualType !== expectedType) {
        throw new Error(
          `Invalid type for input ${key}: expected ${expectedType}, got ${actualType}`
        );
      }
    }
  }
}

/**
 * Export types from core
 */
export type { 
  NodePort, 
  NodeContext, 
  NodeExecutionResult 
} from '@rcrt-builder/core';
