/**
 * Supervisor Agent Node
 * Manages and coordinates other agents
 */

import { RegisterNode, NodeMetadata, NodeExecutionResult } from '@rcrt-builder/node-sdk';
import { AgentNode } from './agent-node';

@RegisterNode({
  schema_name: 'node.template.v1',
  title: 'Supervisor Agent Node',
  tags: ['node:template', 'agent', 'supervisor'],
  context: {
    node_type: 'SupervisorNode',
    category: 'agent',
    icon: '👨‍💼',
    color: '#dc2626',
  },
})
export class SupervisorNode extends AgentNode {
  private managedAgents = new Map<string, any>();
  
  getMetadata(): NodeMetadata {
    const base = super.getMetadata();
    return {
      ...base,
      type: 'SupervisorNode',
      icon: '👨‍💼',
      color: '#dc2626',
      description: 'Supervisor agent that manages other agents',
      inputs: [
        ...base.inputs,
        {
          id: 'agent_reports',
          type: 'data',
          description: 'Reports from managed agents',
          optional: true,
        },
      ],
      outputs: [
        ...base.outputs,
        {
          id: 'commands',
          type: 'data',
          description: 'Commands to managed agents',
        },
        {
          id: 'spawn_agent',
          type: 'operation',
          description: 'Spawn new agent operations',
          optional: true,
        },
      ],
    };
  }
  
  validateConfig(config: any): boolean {
    if (!super.validateConfig(config)) {
      return false;
    }
    
    // Supervisor capabilities should include agent management
    if (!config.capabilities?.can_spawn_agents) {
      console.warn('Supervisor node should have can_spawn_agents capability');
    }
    
    return true;
  }
  
  async initialize(): Promise<void> {
    await super.initialize();
    
    // Subscribe to agent metrics
    await this.subscribeToAgentMetrics();
    
    // Load managed agents
    await this.loadManagedAgents();
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Get agent reports if provided
      const agentReports = inputs.agent_reports || [];
      
      // Update managed agents status
      for (const report of agentReports) {
        if (report.agent_id) {
          this.managedAgents.set(report.agent_id, {
            ...this.managedAgents.get(report.agent_id),
            last_report: report,
            last_report_time: Date.now(),
          });
        }
      }
      
      // Build supervisor context
      const supervisorContext = {
        managed_agents: Array.from(this.managedAgents.values()),
        agent_reports: agentReports,
        system_metrics: await this.getSystemMetrics(),
      };
      
      // Add supervisor context to inputs
      const enhancedInputs = {
        ...inputs,
        additional_context: {
          ...inputs.additional_context,
          supervisor: supervisorContext,
        },
      };
      
      // Execute base agent logic
      const result = await super.execute(enhancedInputs);
      
      // Process supervisor-specific decisions
      const commands = await this.processSupervision(result.outputs.decision);
      
      // Add supervisor outputs
      result.outputs.commands = commands;
      
      if (commands.some(cmd => cmd.type === 'spawn')) {
        result.outputs.spawn_agent = commands.filter(cmd => cmd.type === 'spawn');
      }
      
      // Log supervision metrics
      await this.logExecution({
        managed_agents_count: this.managedAgents.size,
        commands_issued: commands.length,
        reports_processed: agentReports.length,
        latency_ms: Date.now() - startTime,
      });
      
      return result;
    } catch (error) {
      await this.handleError(error, inputs);
      throw error;
    }
  }
  
  private async subscribeToAgentMetrics(): Promise<void> {
    // Subscribe to agent metrics breadcrumbs
    const metricsSubscription = {
      schema_name: 'agent.metrics.v1',
      any_tags: [this.context.workspace],
    };
    
    // This would be handled by the base agent's subscription system
    if (!this.context.config.subscriptions) {
      this.context.config.subscriptions = [];
    }
    this.context.config.subscriptions.push(metricsSubscription);
  }
  
  private async loadManagedAgents(): Promise<void> {
    // Load agent definitions that this supervisor manages
    const agentDefs = await this.rcrtClient.searchBreadcrumbs({
      schema_name: 'agent.def.v1',
      any_tags: [this.context.workspace, `supervisor:${this.context.breadcrumb_id}`],
    });
    
    for (const agentDef of agentDefs) {
      this.managedAgents.set(agentDef.context.agent_id, {
        id: agentDef.context.agent_id,
        definition: agentDef,
        status: 'unknown',
        created_at: agentDef.created_at,
      });
    }
  }
  
  private async getSystemMetrics(): Promise<any> {
    // Get system-wide metrics
    const metrics = {
      total_breadcrumbs: 0,
      active_agents: this.managedAgents.size,
      recent_errors: 0,
      avg_response_time: 0,
    };
    
    // Count breadcrumbs in workspace
    const breadcrumbs = await this.rcrtClient.searchBreadcrumbs({
      tag: this.context.workspace,
    });
    metrics.total_breadcrumbs = breadcrumbs.length;
    
    // Check for recent errors
    const errors = await this.rcrtClient.searchBreadcrumbs({
      schema_name: 'node.error.v1',
      tag: this.context.workspace,
    });
    
    const recentErrorTime = Date.now() - 5 * 60 * 1000; // Last 5 minutes
    metrics.recent_errors = errors.filter(e => 
      new Date(e.created_at).getTime() > recentErrorTime
    ).length;
    
    return metrics;
  }
  
  private async processSupervision(decision: any): Promise<any[]> {
    const commands: any[] = [];
    
    // Parse supervisor decision for commands
    if (decision.commands && Array.isArray(decision.commands)) {
      for (const cmd of decision.commands) {
        commands.push(await this.processCommand(cmd));
      }
    }
    
    // Check for agent spawning
    if (decision.spawn_agent) {
      const spawnCommand = await this.createSpawnCommand(decision.spawn_agent);
      commands.push(spawnCommand);
    }
    
    // Check for agent termination
    if (decision.terminate_agent) {
      const terminateCommand = await this.createTerminateCommand(decision.terminate_agent);
      commands.push(terminateCommand);
    }
    
    // Check for scaling decisions
    if (decision.scale) {
      const scaleCommands = await this.createScaleCommands(decision.scale);
      commands.push(...scaleCommands);
    }
    
    return commands;
  }
  
  private async processCommand(cmd: any): Promise<any> {
    return {
      type: cmd.type || 'instruction',
      target: cmd.target || 'all',
      action: cmd.action,
      parameters: cmd.parameters,
      priority: cmd.priority || 'normal',
      timestamp: new Date().toISOString(),
    };
  }
  
  private async createSpawnCommand(agentSpec: any): Promise<any> {
    // Create agent definition breadcrumb
    const agentDef = {
      schema_name: 'agent.def.v1',
      title: agentSpec.title || 'Managed Agent',
      tags: [
        'agent:def',
        this.context.workspace,
        `supervisor:${this.context.breadcrumb_id}`,
      ],
      context: {
        agent_id: `agent-${Date.now()}`,
        ...agentSpec,
      },
    };
    
    const result = await this.createBreadcrumb(agentDef);
    
    return {
      type: 'spawn',
      agent_id: result.id,
      definition: agentDef,
      timestamp: new Date().toISOString(),
    };
  }
  
  private async createTerminateCommand(agentId: string): Promise<any> {
    // Mark agent as terminated
    const agent = this.managedAgents.get(agentId);
    if (agent) {
      agent.status = 'terminated';
      agent.terminated_at = new Date().toISOString();
    }
    
    return {
      type: 'terminate',
      agent_id: agentId,
      timestamp: new Date().toISOString(),
    };
  }
  
  private async createScaleCommands(scaleSpec: any): Promise<any[]> {
    const commands: any[] = [];
    
    if (scaleSpec.up) {
      // Create new agent instances
      for (let i = 0; i < scaleSpec.up; i++) {
        const spawnCommand = await this.createSpawnCommand({
          ...scaleSpec.template,
          title: `Scaled Agent ${i + 1}`,
        });
        commands.push(spawnCommand);
      }
    }
    
    if (scaleSpec.down) {
      // Select agents to terminate
      const agentsToTerminate = Array.from(this.managedAgents.keys())
        .slice(0, scaleSpec.down);
      
      for (const agentId of agentsToTerminate) {
        const terminateCommand = await this.createTerminateCommand(agentId);
        commands.push(terminateCommand);
      }
    }
    
    return commands;
  }
}
