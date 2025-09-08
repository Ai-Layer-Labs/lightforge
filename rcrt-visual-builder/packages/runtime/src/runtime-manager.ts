/**
 * Runtime Manager
 * Orchestrates flows and agents
 */

import { 
  FlowDefinitionV1,
  AgentDefinitionV1,
  BreadcrumbEvent
} from '@rcrt-builder/core';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { FlowExecutor } from './executor/flow-executor';
import { AgentExecutor } from './agent/agent-executor';
import { SSEClient } from './sse/sse-client';

export interface RuntimeManagerOptions {
  rcrtUrl: string;
  workspace: string;
  authMode?: 'disabled' | 'jwt' | 'key';
  authToken?: string;
  openRouterApiKey?: string;
  autoStart?: boolean;
}

export class RuntimeManager {
  private rcrtClient: RcrtClientEnhanced;
  private workspace: string;
  private options: RuntimeManagerOptions;
  private flows = new Map<string, FlowExecutor>();
  private agents = new Map<string, AgentExecutor>();
  private sseClient?: SSEClient;
  private isRunning = false;
  
  constructor(options: RuntimeManagerOptions) {
    this.options = options;
    this.workspace = options.workspace;
    
    // Initialize RCRT client
    this.rcrtClient = new RcrtClientEnhanced(
      options.rcrtUrl,
      options.authMode || 'disabled',
      options.authToken
    );
    
    if (options.autoStart) {
      this.start().catch(error => {
        console.error('Failed to auto-start runtime:', error);
      });
    }
  }
  
  /**
   * Start the runtime manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Runtime manager already running');
      return;
    }
    
    console.log('🚀 Starting runtime manager');
    console.log(`📁 Workspace: ${this.workspace}`);
    console.log(`🔗 RCRT URL: ${this.options.rcrtUrl}`);
    
    // Load flows
    await this.loadFlows();
    
    // Load agents
    await this.loadAgents();
    
    // Start SSE monitoring
    await this.startSSEMonitoring();
    
    this.isRunning = true;
    
    console.log('✅ Runtime manager started');
    console.log(`   Flows: ${this.flows.size}`);
    console.log(`   Agents: ${this.agents.size}`);
  }
  
  /**
   * Stop the runtime manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    
    console.log('🛑 Stopping runtime manager');
    
    // Stop SSE monitoring
    if (this.sseClient) {
      this.sseClient.disconnect();
      this.sseClient = undefined;
    }
    
    // Stop all flows
    for (const [flowId, executor] of this.flows) {
      console.log(`   Stopping flow: ${flowId}`);
      await executor.stop();
    }
    this.flows.clear();
    
    // Stop all agents
    for (const [agentId, executor] of this.agents) {
      console.log(`   Stopping agent: ${agentId}`);
      await executor.stop();
    }
    this.agents.clear();
    
    this.isRunning = false;
    
    console.log('✅ Runtime manager stopped');
  }
  
  /**
   * Load flow definitions
   */
  private async loadFlows(): Promise<void> {
    const flowDefs = await this.rcrtClient.searchBreadcrumbs({
      schema_name: 'flow.definition.v1',
      tag: this.workspace,
    });
    
    console.log(`📊 Found ${flowDefs.length} flow definitions`);
    
    for (const flowDef of flowDefs) {
      await this.createFlowExecutor(flowDef as FlowDefinitionV1);
    }
  }
  
  /**
   * Load agent definitions
   */
  private async loadAgents(): Promise<void> {
    const agentDefs = await this.rcrtClient.searchBreadcrumbs({
      schema_name: 'agent.def.v1',
      tag: this.workspace,
    });
    
    console.log(`🤖 Found ${agentDefs.length} agent definitions`);
    
    for (const agentDef of agentDefs) {
      await this.createAgentExecutor(agentDef as AgentDefinitionV1);
    }
  }
  
  /**
   * Start SSE monitoring
   */
  private async startSSEMonitoring(): Promise<void> {
    const sseUrl = `${this.options.rcrtUrl}/events/stream`;
    
    this.sseClient = new SSEClient({
      url: sseUrl,
      headers: this.rcrtClient['defaultHeaders'],
      reconnectDelay: 5000,
      filters: {
        any_tags: [this.workspace],
        schema_name: 'flow.trigger.v1',
      },
      onEvent: (event) => this.handleSSEEvent(event),
      onConnect: () => console.log('✅ SSE connected'),
      onDisconnect: () => console.log('❌ SSE disconnected'),
      onError: (error) => console.error('SSE error:', error),
    });
    
    this.sseClient.connect();
  }
  
  /**
   * Handle SSE events
   */
  private async handleSSEEvent(event: BreadcrumbEvent): Promise<void> {
    // Skip ping events
    if (event.type === 'ping') {
      return;
    }
    
    // Check for flow triggers
    if (event.tags?.includes('flow:trigger')) {
      await this.triggerFlow(event);
    }
    
    // Check for new definitions
    if (event.type === 'breadcrumb.created') {
      const breadcrumb = await this.rcrtClient.getBreadcrumb(event.breadcrumb_id!);
      
      if (breadcrumb.schema_name === 'flow.definition.v1') {
        console.log(`📊 New flow detected: ${breadcrumb.context.flow_id}`);
        await this.createFlowExecutor(breadcrumb as FlowDefinitionV1);
      } else if (breadcrumb.schema_name === 'agent.def.v1') {
        console.log(`🤖 New agent detected: ${breadcrumb.context.agent_id}`);
        await this.createAgentExecutor(breadcrumb as AgentDefinitionV1);
      }
    }
    
    // Check for deletions
    if (event.type === 'breadcrumb.deleted') {
      // Handle flow/agent removal
      const flowId = event.tags?.find(t => t.startsWith('flow:'))?.replace('flow:', '');
      const agentId = event.tags?.find(t => t.startsWith('agent:'))?.replace('agent:', '');
      
      if (flowId && this.flows.has(flowId)) {
        console.log(`📊 Flow deleted: ${flowId}`);
        const executor = this.flows.get(flowId)!;
        await executor.stop();
        this.flows.delete(flowId);
      }
      
      if (agentId && this.agents.has(agentId)) {
        console.log(`🤖 Agent deleted: ${agentId}`);
        const executor = this.agents.get(agentId)!;
        await executor.stop();
        this.agents.delete(agentId);
      }
    }
  }
  
  /**
   * Create flow executor
   */
  private async createFlowExecutor(flowDef: FlowDefinitionV1): Promise<void> {
    // Ensure we have the flow_id
    const flowId = flowDef.context?.flow_id || flowDef.id || `flow-${Date.now()}`;
    
    // Skip if already exists
    if (this.flows.has(flowId)) {
      return;
    }
    
    // Skip if no actual flow definition
    if (!flowDef.context || !flowDef.context.nodes) {
      console.warn(`   ⚠️  Skipping flow without definition: ${flowDef.title}`);
      return;
    }
    
    const executor = new FlowExecutor(flowDef, {
      rcrtClient: this.rcrtClient,
      workspace: this.workspace,
      maxParallelNodes: 5,
    });
    
    await executor.initialize();
    this.flows.set(flowId, executor);
    
    console.log(`   ✅ Flow loaded: ${flowId}`);
  }
  
  /**
   * Create agent executor
   */
  private async createAgentExecutor(agentDef: AgentDefinitionV1): Promise<void> {
    // Ensure we have the agent_id
    const agentId = agentDef.context?.agent_id || agentDef.id || `agent-${Date.now()}`;
    
    // Skip if already exists
    if (this.agents.has(agentId)) {
      return;
    }
    
    // Skip if no actual agent definition
    if (!agentDef.context || !agentDef.context.model) {
      console.warn(`   ⚠️  Skipping agent without definition: ${agentDef.title}`);
      return;
    }
    
    const executor = new AgentExecutor({
      agentDef,
      rcrtClient: this.rcrtClient,
      workspace: this.workspace,
      openRouterApiKey: this.options.openRouterApiKey,
      autoStart: true,
      metricsInterval: 60000, // 1 minute
    });
    
    this.agents.set(agentId, executor);
    
    console.log(`   ✅ Agent loaded: ${agentId}`);
  }
  
  /**
   * Trigger a flow
   */
  private async triggerFlow(event: BreadcrumbEvent): Promise<void> {
    const flowId = event.tags?.find(t => t.startsWith('flow:'))?.replace('flow:', '');
    
    if (!flowId) {
      console.warn('Flow trigger without flow ID');
      return;
    }
    
    const executor = this.flows.get(flowId);
    if (!executor) {
      console.warn(`Flow not found: ${flowId}`);
      return;
    }
    
    console.log(`⚡ Triggering flow: ${flowId}`);
    
    try {
      await executor.execute(event);
      console.log(`✅ Flow completed: ${flowId}`);
    } catch (error) {
      console.error(`❌ Flow failed: ${flowId}`, error);
    }
  }
  
  /**
   * Execute a flow manually
   */
  async executeFlow(flowId: string, trigger?: BreadcrumbEvent): Promise<void> {
    const executor = this.flows.get(flowId);
    if (!executor) {
      throw new Error(`Flow not found: ${flowId}`);
    }
    
    await executor.execute(trigger);
  }
  
  /**
   * Get runtime stats
   */
  getStats(): {
    running: boolean;
    flows: number;
    agents: number;
    workspace: string;
  } {
    return {
      running: this.isRunning,
      flows: this.flows.size,
      agents: this.agents.size,
      workspace: this.workspace,
    };
  }
  
  /**
   * Get flow executor
   */
  getFlow(flowId: string): FlowExecutor | undefined {
    return this.flows.get(flowId);
  }
  
  /**
   * Get agent executor
   */
  getAgent(agentId: string): AgentExecutor | undefined {
    return this.agents.get(agentId);
  }
}
