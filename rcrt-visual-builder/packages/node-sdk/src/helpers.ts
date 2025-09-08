/**
 * Helper utilities for node development
 */

import { NodePort, Connection } from '@rcrt-builder/core';

/**
 * Transform data between connected nodes
 */
export class DataTransformer {
  private static transformers = new Map<string, (data: any) => any>();
  
  static {
    // Register built-in transformers
    this.register('breadcrumb_to_messages', (breadcrumb: any) => {
      return {
        schema_name: 'llm.messages.v1',
        messages: [
          {
            role: 'user',
            content: JSON.stringify(breadcrumb),
          },
        ],
      };
    });
    
    this.register('results_to_messages', (results: any) => {
      return {
        schema_name: 'llm.messages.v1',
        messages: [
          {
            role: 'user',
            content: `Search results:\n${JSON.stringify(results, null, 2)}`,
          },
        ],
      };
    });
    
    this.register('response_to_breadcrumb', (response: any) => {
      return {
        title: 'LLM Response',
        context: response,
        tags: ['llm:response'],
      };
    });
    
    this.register('add_keys_request', (data: any, params: any) => {
      return {
        ...data,
        keys: params.keys || [],
      };
    });
    
    this.register('build_insert_query', (data: any) => {
      return {
        query: `INSERT INTO results (data) VALUES ($1)`,
        params: [JSON.stringify(data)],
      };
    });
    
    this.register('route_name_to_port_activation', (routeName: string) => {
      return {
        activatedPort: routeName,
      };
    });
  }
  
  /**
   * Register a custom transformer
   */
  static register(name: string, transformer: (data: any, params?: any) => any): void {
    this.transformers.set(name, transformer);
  }
  
  /**
   * Transform data using a named transformer
   */
  static transform(name: string, data: any, params?: any): any {
    const transformer = this.transformers.get(name);
    if (!transformer) {
      console.warn(`Unknown transformer: ${name}`);
      return data;
    }
    return transformer(data, params);
  }
  
  /**
   * Apply connection transform
   */
  static applyConnectionTransform(connection: Connection, data: any): any {
    if (!connection.transform) {
      return data;
    }
    
    if (typeof connection.transform === 'string') {
      return this.transform(connection.transform, data);
    }
    
    if (connection.transform.type) {
      return this.transform(connection.transform.type, data, connection.transform.params);
    }
    
    return data;
  }
}

/**
 * Port validator for connections
 */
export class PortValidator {
  /**
   * Check if two ports can be connected
   */
  static canConnect(outputPort: NodePort, inputPort: NodePort): boolean {
    // Check type compatibility
    if (!this.areTypesCompatible(outputPort.type, inputPort.type)) {
      return false;
    }
    
    // Check schema compatibility if specified
    if (outputPort.schema && inputPort.schema) {
      return outputPort.schema === inputPort.schema;
    }
    
    return true;
  }
  
  /**
   * Check if port types are compatible
   */
  private static areTypesCompatible(outputType: string, inputType: string): boolean {
    // Same type is always compatible
    if (outputType === inputType) {
      return true;
    }
    
    // Data type is compatible with most types
    if (outputType === 'data' || inputType === 'data') {
      return true;
    }
    
    // Messages and response are compatible
    if (
      (outputType === 'messages' && inputType === 'response') ||
      (outputType === 'response' && inputType === 'messages')
    ) {
      return true;
    }
    
    // Operation types are compatible
    if (outputType === 'operation' && inputType === 'operation') {
      return true;
    }
    
    return false;
  }
  
  /**
   * Validate all connections in a flow
   */
  static validateFlow(nodes: any[], connections: Connection[]): string[] {
    const errors: string[] = [];
    
    // Create port maps
    const nodePorts = new Map<string, { inputs: NodePort[]; outputs: NodePort[] }>();
    for (const node of nodes) {
      nodePorts.set(node.id, {
        inputs: node.config?.ports?.inputs || [],
        outputs: node.config?.ports?.outputs || [],
      });
    }
    
    // Validate each connection
    for (const conn of connections) {
      const fromNode = nodePorts.get(conn.from.node);
      const toNode = nodePorts.get(conn.to.node);
      
      if (!fromNode) {
        errors.push(`Connection ${conn.id}: Source node ${conn.from.node} not found`);
        continue;
      }
      
      if (!toNode) {
        errors.push(`Connection ${conn.id}: Target node ${conn.to.node} not found`);
        continue;
      }
      
      const outputPort = fromNode.outputs.find(p => p.id === conn.from.port);
      const inputPort = toNode.inputs.find(p => p.id === conn.to.port);
      
      if (!outputPort) {
        errors.push(`Connection ${conn.id}: Output port ${conn.from.port} not found on ${conn.from.node}`);
        continue;
      }
      
      if (!inputPort) {
        errors.push(`Connection ${conn.id}: Input port ${conn.to.port} not found on ${conn.to.node}`);
        continue;
      }
      
      if (!this.canConnect(outputPort, inputPort)) {
        errors.push(
          `Connection ${conn.id}: Incompatible ports - ${outputPort.type} (${outputPort.schema || 'any'}) to ${inputPort.type} (${inputPort.schema || 'any'})`
        );
      }
    }
    
    return errors;
  }
}

/**
 * Execution graph builder for flows
 */
export class ExecutionGraph {
  private nodes = new Map<string, any>();
  private edges = new Map<string, Set<string>>();
  private inDegree = new Map<string, number>();
  
  /**
   * Add a node to the graph
   */
  addNode(id: string, data: any): void {
    this.nodes.set(id, data);
    if (!this.edges.has(id)) {
      this.edges.set(id, new Set());
      this.inDegree.set(id, 0);
    }
  }
  
  /**
   * Add an edge to the graph
   */
  addEdge(from: string, to: string): void {
    if (!this.edges.has(from)) {
      this.edges.set(from, new Set());
      this.inDegree.set(from, 0);
    }
    if (!this.edges.has(to)) {
      this.edges.set(to, new Set());
      this.inDegree.set(to, 0);
    }
    
    this.edges.get(from)!.add(to);
    this.inDegree.set(to, this.inDegree.get(to)! + 1);
  }
  
  /**
   * Get topological sort of nodes
   */
  getTopologicalSort(): string[] {
    const result: string[] = [];
    const queue: string[] = [];
    const degree = new Map(this.inDegree);
    
    // Find all nodes with no incoming edges
    for (const [node, count] of degree) {
      if (count === 0) {
        queue.push(node);
      }
    }
    
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      
      // Reduce in-degree for all neighbors
      for (const neighbor of this.edges.get(node) || []) {
        const newDegree = degree.get(neighbor)! - 1;
        degree.set(neighbor, newDegree);
        
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }
    
    // Check for cycles
    if (result.length !== this.nodes.size) {
      throw new Error('Cycle detected in execution graph');
    }
    
    return result;
  }
  
  /**
   * Get node data
   */
  getNode(id: string): any {
    return this.nodes.get(id);
  }
  
  /**
   * Get node dependencies
   */
  getDependencies(id: string): string[] {
    const deps: string[] = [];
    
    for (const [node, edges] of this.edges) {
      if (edges.has(id)) {
        deps.push(node);
      }
    }
    
    return deps;
  }
  
  /**
   * Get node dependents
   */
  getDependents(id: string): string[] {
    return Array.from(this.edges.get(id) || []);
  }
}

/**
 * Context builder for LLM nodes
 */
export class ContextBuilder {
  private context: any[] = [];
  
  /**
   * Add breadcrumb to context
   */
  addBreadcrumb(breadcrumb: any): this {
    this.context.push({
      type: 'breadcrumb',
      data: breadcrumb,
    });
    return this;
  }
  
  /**
   * Add search results to context
   */
  addSearchResults(results: any[]): this {
    this.context.push({
      type: 'search_results',
      data: results,
    });
    return this;
  }
  
  /**
   * Add tool results to context
   */
  addToolResults(tool: string, results: any): this {
    this.context.push({
      type: 'tool_result',
      tool,
      data: results,
    });
    return this;
  }
  
  /**
   * Build context as LLM messages
   */
  buildMessages(): any[] {
    const messages: any[] = [];
    
    // Add context as system message
    if (this.context.length > 0) {
      messages.push({
        role: 'system',
        content: `Context:\n${JSON.stringify(this.context, null, 2)}`,
      });
    }
    
    return messages;
  }
  
  /**
   * Build context as structured data
   */
  buildStructured(): any {
    return {
      items: this.context,
      count: this.context.length,
      timestamp: new Date().toISOString(),
    };
  }
}
