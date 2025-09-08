/**
 * Workflow Executor
 * Executes visual workflows by creating and managing RCRT breadcrumbs
 */

import { Node, Edge } from 'reactflow';

export interface WorkflowExecution {
  id: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  currentNode?: string;
  results: Map<string, any>;
  logs: Array<{ timestamp: Date; message: string; type: 'info' | 'error' | 'success' }>;
}

export class WorkflowExecutor {
  private rcrtUrl: string;
  private workspace: string;
  private execution?: WorkflowExecution;

  constructor(rcrtUrl = 'http://localhost:8081', workspace = 'workspace:builder') {
    this.rcrtUrl = rcrtUrl;
    this.workspace = workspace;
  }

  /**
   * Execute a workflow
   */
  async execute(nodes: Node[], edges: Edge[], input: any): Promise<WorkflowExecution> {
    this.execution = {
      id: `exec-${Date.now()}`,
      status: 'running',
      results: new Map(),
      logs: []
    };

    try {
      // Find start node
      const startNode = nodes.find(n => n.type === 'start');
      if (!startNode) throw new Error('No start node found');

      this.log('info', '🚀 Starting workflow execution');

      // Build execution graph
      const graph = this.buildExecutionGraph(nodes, edges);
      
      // Execute from start node
      await this.executeNode(startNode, nodes, edges, graph, input);

      this.execution.status = 'complete';
      this.log('success', '✅ Workflow completed successfully');
    } catch (error: any) {
      this.execution.status = 'failed';
      this.log('error', `❌ Workflow failed: ${error.message}`);
      throw error;
    }

    return this.execution;
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: Node, 
    nodes: Node[], 
    edges: Edge[], 
    graph: Map<string, string[]>,
    input: any
  ): Promise<any> {
    if (!this.execution) return;
    
    this.execution.currentNode = node.id;
    this.log('info', `📍 Executing node: ${node.data.label || node.type}`);

    let result = input;

    switch (node.type) {
      case 'start':
        result = input;
        break;

      case 'intention':
        result = await this.executeIntentionNode(node, input);
        break;

      case 'agent':
        result = await this.executeAgentNode(node, input);
        break;

      default:
        this.log('info', `⏭️ Skipping unknown node type: ${node.type}`);
    }

    // Store result
    this.execution.results.set(node.id, result);

    // Execute next nodes
    const nextNodeIds = graph.get(node.id) || [];
    for (const nextId of nextNodeIds) {
      const nextNode = nodes.find(n => n.id === nextId);
      if (nextNode) {
        // For intention nodes, route based on result
        if (node.type === 'intention' && result.route) {
          const edge = edges.find(e => e.source === node.id && e.target === nextId);
          if (edge?.sourceHandle === result.route) {
            await this.executeNode(nextNode, nodes, edges, graph, result.data || result);
          }
        } else {
          await this.executeNode(nextNode, nodes, edges, graph, result);
        }
      }
    }

    return result;
  }

  /**
   * Execute intention detection node
   */
  private async executeIntentionNode(node: Node, input: any): Promise<any> {
    this.log('info', `🎯 Detecting intent with ${node.data.model}`);
    
    try {
      // Create a classifier breadcrumb
      const response = await fetch(`${this.rcrtUrl}/breadcrumbs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace: this.workspace,
          schema_name: 'llm.classifier.v1',
          title: `Intent Detection - ${node.id}`,
          tags: ['workflow', 'intent', node.id],
          context: {
            model: node.data.model || 'gpt-4',
            prompt: `Classify the user intent: "${input}"
            
Categories:
1. Technical support question
2. Sales inquiry
3. General question

Respond with just the number (1, 2, or 3).`,
            input: input
          }
        })
      });

      if (!response.ok) throw new Error('Failed to create classifier');
      
      // Simulate LLM response (in production, this would call the actual LLM)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock routing logic
      const routes = ['1', '2'];
      const route = routes[Math.floor(Math.random() * routes.length)];
      
      this.log('success', `✅ Intent detected: Route ${route}`);
      
      return {
        route,
        data: input
      };
    } catch (error: any) {
      this.log('error', `Failed to detect intent: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute agent node
   */
  private async executeAgentNode(node: Node, input: any): Promise<any> {
    this.log('info', `🤖 Processing with ${node.data.label} (${node.data.model})`);
    
    try {
      // Create an agent breadcrumb
      const response = await fetch(`${this.rcrtUrl}/breadcrumbs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace: this.workspace,
          schema_name: 'agent.definition.v1',
          title: node.data.label,
          tags: ['workflow', 'agent', node.id],
          context: {
            agent_id: node.id,
            model: node.data.model,
            system_prompt: `You are ${node.data.label}. Process this request: ${input}`,
            temperature: 0.7,
            max_tokens: 1000
          }
        })
      });

      if (!response.ok) throw new Error('Failed to create agent');
      
      // Simulate agent processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const result = `${node.data.label} processed: "${input}" using ${node.data.model}`;
      this.log('success', `✅ ${node.data.label} completed`);
      
      return result;
    } catch (error: any) {
      this.log('error', `Agent failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build execution graph from nodes and edges
   */
  private buildExecutionGraph(nodes: Node[], edges: Edge[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    for (const edge of edges) {
      if (!graph.has(edge.source)) {
        graph.set(edge.source, []);
      }
      graph.get(edge.source)!.push(edge.target);
    }
    
    return graph;
  }

  /**
   * Add log entry
   */
  private log(type: 'info' | 'error' | 'success', message: string) {
    if (this.execution) {
      this.execution.logs.push({
        timestamp: new Date(),
        type,
        message
      });
    }
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  /**
   * Get execution status
   */
  getStatus(): WorkflowExecution | undefined {
    return this.execution;
  }
}
