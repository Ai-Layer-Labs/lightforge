/**
 * Flow Executor
 * Executes flow definitions by running nodes in topological order
 */

import { 
  FlowDefinitionV1, 
  FlowExecutionStateV1,
  BreadcrumbEvent,
  Connection,
  FlowNode
} from '@rcrt-builder/core';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { BaseNode, NodeRegistry } from '@rcrt-builder/node-sdk';
// Simple helper implementations to avoid import issues
class ExecutionGraph {
  private nodes: Map<string, any> = new Map();
  private edges: Map<string, string[]> = new Map();
  
  addNode(nodeId: string, data: any) {
    this.nodes.set(nodeId, data);
    if (!this.edges.has(nodeId)) {
      this.edges.set(nodeId, []);
    }
  }
  
  addEdge(from: string, to: string) {
    if (!this.edges.has(from)) {
      this.edges.set(from, []);
    }
    this.edges.get(from)!.push(to);
  }
  
  getDependencies(nodeId: string): string[] {
    const deps: string[] = [];
    for (const [node, edges] of this.edges) {
      if (edges.includes(nodeId)) {
        deps.push(node);
      }
    }
    return deps;
  }
  
  getNodes(): string[] {
    return Array.from(this.nodes.keys());
  }
  
  topologicalSort(): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    
    const visit = (node: string) => {
      if (visited.has(node)) return;
      visited.add(node);
      const edges = this.edges.get(node) || [];
      for (const dep of edges) {
        visit(dep);
      }
      result.push(node);
    };
    
    for (const node of this.nodes.keys()) {
      visit(node);
    }
    
    return result.reverse();
  }
}

class DataTransformer {
  static applyConnectionTransform(connection: Connection, data: any): any {
    // Simple passthrough for now
    return data;
  }
}

export interface FlowExecutorOptions {
  rcrtClient: RcrtClientEnhanced;
  workspace: string;
  maxParallelNodes?: number;
  timeout?: number;
}

export class FlowExecutor {
  private flow: FlowDefinitionV1;
  private rcrtClient: RcrtClientEnhanced;
  private workspace: string;
  private nodeInstances = new Map<string, BaseNode>();
  private nodeOutputs = new Map<string, any>();
  private executionState?: FlowExecutionStateV1;
  private options: FlowExecutorOptions;
  
  constructor(flow: FlowDefinitionV1, options: FlowExecutorOptions) {
    this.flow = flow;
    this.rcrtClient = options.rcrtClient;
    this.workspace = options.workspace;
    this.options = options;
  }
  
  /**
   * Initialize the flow executor
   */
  async initialize(): Promise<void> {
    // Create node instances
    for (const node of this.flow.context.nodes) {
      const instance = await this.createNodeInstance(node);
      this.nodeInstances.set(node.id, instance);
    }
    
    // Initialize execution state
    this.executionState = await this.createExecutionState();
  }
  
  /**
   * Execute the flow with a trigger event
   */
  async execute(trigger?: BreadcrumbEvent): Promise<FlowExecutionStateV1> {
    const startTime = Date.now();
    
    try {
      // Update execution state
      await this.updateExecutionState('running');
      
      // Build execution graph
      const graph = this.buildExecutionGraph();
      
      // Get topological order
      const executionOrder = graph.getTopologicalSort();
      
      // Execute nodes in order
      for (const nodeId of executionOrder) {
        await this.executeNode(nodeId, trigger);
      }
      
      // Update final state
      await this.updateExecutionState('completed', {
        completed_at: new Date().toISOString(),
      });
      
      return this.executionState!;
    } catch (error) {
      // Update error state
      await this.updateExecutionState('failed', {
        errors: [{
          node_id: 'flow',
          error: String(error),
          timestamp: new Date().toISOString(),
        }],
      });
      
      throw error;
    }
  }
  
  /**
   * Execute nodes in parallel where possible
   */
  async executeParallel(trigger?: BreadcrumbEvent): Promise<FlowExecutionStateV1> {
    const startTime = Date.now();
    
    try {
      await this.updateExecutionState('running');
      
      const graph = this.buildExecutionGraph();
      const executed = new Set<string>();
      const executing = new Set<string>();
      const maxParallel = this.options.maxParallelNodes || 5;
      
      while (executed.size < this.flow.context.nodes.length) {
        // Find nodes ready to execute
        const ready: string[] = [];
        
        for (const node of this.flow.context.nodes) {
          if (!executed.has(node.id) && !executing.has(node.id)) {
            const deps = graph.getDependencies(node.id);
            if (deps.every(dep => executed.has(dep))) {
              ready.push(node.id);
            }
          }
        }
        
        if (ready.length === 0 && executing.size === 0) {
          throw new Error('Deadlock detected in flow execution');
        }
        
        // Execute ready nodes (up to max parallel)
        const toExecute = ready.slice(0, maxParallel - executing.size);
        const promises = toExecute.map(async nodeId => {
          executing.add(nodeId);
          try {
            await this.executeNode(nodeId, trigger);
            executed.add(nodeId);
          } finally {
            executing.delete(nodeId);
          }
        });
        
        await Promise.race(promises);
      }
      
      await this.updateExecutionState('completed', {
        completed_at: new Date().toISOString(),
      });
      
      return this.executionState!;
    } catch (error) {
      await this.updateExecutionState('failed', {
        errors: [{
          node_id: 'flow',
          error: String(error),
          timestamp: new Date().toISOString(),
        }],
      });
      
      throw error;
    }
  }
  
  /**
   * Stop the flow execution
   */
  async stop(): Promise<void> {
    // Clean up node instances
    for (const [nodeId, instance] of this.nodeInstances) {
      await instance.destroy();
    }
    this.nodeInstances.clear();
    
    // Clear outputs
    this.nodeOutputs.clear();
    
    // Update state if running
    if (this.executionState?.context.status === 'running') {
      await this.updateExecutionState('paused');
    }
  }
  
  /**
   * Create a node instance
   */
  private async createNodeInstance(node: FlowNode): Promise<BaseNode> {
    // Get node template
    const template = await this.rcrtClient.searchBreadcrumbs({
      schema_name: 'node.template.v1',
      any_tags: [`node:template:${node.type}`],
    });
    
    if (template.length === 0) {
      throw new Error(`Node template not found: ${node.type}`);
    }
    
    // Create node context
    const context = {
      breadcrumb_id: `${this.flow.context.flow_id}-${node.id}`,
      config: node.config,
      rcrtClient: this.rcrtClient,
      workspace: this.workspace,
    };
    
    // Try to get node class from registry
    let NodeClass = NodeRegistry.getNodeClass(node.type);
    
    if (!NodeClass) {
      // Try to load from template executor info
      const executorInfo = template[0].context.executor;
      if (executorInfo) {
        try {
          const module = require(executorInfo.module);
          NodeClass = module[executorInfo.handler] || module.default;
        } catch (error) {
          console.warn(`Failed to load node executor: ${error}`);
        }
      }
    }
    
    if (!NodeClass) {
      // Fallback to a generic node
      const { BaseNode } = await import('@rcrt-builder/node-sdk');
      NodeClass = BaseNode;
    }
    
    const instance = new NodeClass(context);
    await instance.initialize();
    
    return instance;
  }
  
  /**
   * Execute a single node
   */
  private async executeNode(nodeId: string, trigger?: BreadcrumbEvent): Promise<void> {
    const node = this.flow.context.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    
    const instance = this.nodeInstances.get(nodeId);
    if (!instance) {
      throw new Error(`Node instance not found: ${nodeId}`);
    }
    
    try {
      // Update node state
      await this.updateNodeState(nodeId, 'running');
      
      // Gather inputs
      const inputs = await this.gatherNodeInputs(nodeId, trigger);
      
      // Execute node
      const result = await instance.execute(inputs);
      
      // Store outputs
      this.nodeOutputs.set(nodeId, result.outputs);
      
      // Update node state
      await this.updateNodeState(nodeId, 'completed', {
        outputs: result.outputs,
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      // Update error state
      await this.updateNodeState(nodeId, 'failed', {
        error: String(error),
      });
      
      throw new Error(`Node ${nodeId} failed: ${error}`);
    }
  }
  
  /**
   * Gather inputs for a node
   */
  private async gatherNodeInputs(nodeId: string, trigger?: BreadcrumbEvent): Promise<Record<string, any>> {
    const inputs: Record<string, any> = {};
    
    // Add trigger if this is a trigger node
    if (trigger && nodeId === 'node_trigger') {
      inputs.trigger = trigger;
    }
    
    // Get connections to this node
    const connections = this.flow.context.connections.filter(c => c.to.node === nodeId);
    
    for (const conn of connections) {
      const sourceOutputs = this.nodeOutputs.get(conn.from.node);
      if (sourceOutputs) {
        let value = sourceOutputs[conn.from.port];
        
        // Apply transform if specified
        if (conn.transform) {
          value = DataTransformer.applyConnectionTransform(conn, value);
        }
        
        inputs[conn.to.port] = value;
      }
    }
    
    return inputs;
  }
  
  /**
   * Build execution graph
   */
  private buildExecutionGraph(): ExecutionGraph {
    const graph = new ExecutionGraph();
    
    // Add all nodes
    for (const node of this.flow.context.nodes) {
      graph.addNode(node.id, node);
    }
    
    // Add edges based on connections
    for (const conn of this.flow.context.connections) {
      graph.addEdge(conn.from.node, conn.to.node);
    }
    
    return graph;
  }
  
  /**
   * Create execution state breadcrumb
   */
  private async createExecutionState(): Promise<FlowExecutionStateV1> {
    const nodeStates: Record<string, any> = {};
    
    for (const node of this.flow.context.nodes) {
      nodeStates[node.id] = {
        status: 'pending',
      };
    }
    
    const state: FlowExecutionStateV1 = {
      schema_name: 'flow.execution.v1',
      title: `Execution: ${this.flow.context.flow_id}`,
      tags: ['flow:execution', this.workspace],
      context: {
        flow_id: this.flow.context.flow_id,
        execution_id: `exec-${Date.now()}`,
        status: 'pending',
        started_at: new Date().toISOString(),
        node_states: nodeStates,
      },
      id: '',
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    const result = await this.rcrtClient.createBreadcrumb(state);
    state.id = result.id;
    
    return state;
  }
  
  /**
   * Update execution state
   */
  private async updateExecutionState(status: string, updates?: any): Promise<void> {
    if (!this.executionState) return;
    
    this.executionState.context.status = status;
    
    if (updates) {
      Object.assign(this.executionState.context, updates);
    }
    
    const updated = await this.rcrtClient.updateBreadcrumb(
      this.executionState.id!,
      this.executionState.version,
      {
        context: this.executionState.context,
      }
    );
    
    this.executionState.version = updated.version;
  }
  
  /**
   * Update node state
   */
  private async updateNodeState(nodeId: string, status: string, updates?: any): Promise<void> {
    if (!this.executionState) return;
    
    this.executionState.context.node_states[nodeId] = {
      ...this.executionState.context.node_states[nodeId],
      status,
      ...updates,
    };
    
    if (status === 'running') {
      this.executionState.context.current_node = nodeId;
      this.executionState.context.node_states[nodeId].started_at = new Date().toISOString();
    }
    
    await this.updateExecutionState(this.executionState.context.status);
  }
}
