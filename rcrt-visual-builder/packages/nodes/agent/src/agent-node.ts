/**
 * Agent Node
 * Context-aware LLM wrapper that subscribes to breadcrumbs
 */

import { BaseNode, RegisterNode, NodeExecutionResult, NodeMetadata } from '@rcrt-builder/node-sdk';
import { Selector, BreadcrumbEvent, AgentDefinitionV1 } from '@rcrt-builder/core';
import { LLMNode } from '@rcrt-builder/nodes-llm';

@RegisterNode({
  schema_name: 'node.template.v1',
  title: 'Agent Node',
  tags: ['node:template', 'agent', 'core'],
  context: {
    node_type: 'AgentNode',
    category: 'agent',
    icon: '🤖',
    color: '#7828c8',
  },
})
export class AgentNode extends BaseNode {
  private llmNode?: LLMNode;
  private subscribedBreadcrumbs: Map<string, any> = new Map();
  private sseCleanup?: () => void;
  
  getMetadata(): NodeMetadata {
    return {
      type: 'AgentNode',
      category: 'agent',
      icon: '🤖',
      color: '#7828c8',
      description: 'Agent = Subscribed Context + LLM + Decision Execution',
      inputs: [
        {
          id: 'trigger',
          type: 'event',
          description: 'Triggering event',
        },
        {
          id: 'additional_context',
          type: 'data',
          description: 'Additional context to inject',
          optional: true,
        },
      ],
      outputs: [
        {
          id: 'emitter',
          type: 'operation',
          description: 'Breadcrumb emission operations',
        },
        {
          id: 'curator',
          type: 'operation',
          description: 'Curation operations (if agent has curator role)',
          optional: true,
        },
        {
          id: 'decision',
          type: 'data',
          description: 'Agent decision output',
        },
      ],
    };
  }
  
  validateConfig(config: any): boolean {
    // Subscriptions are required
    if (!config.subscriptions || !Array.isArray(config.subscriptions)) {
      return false;
    }
    
    // LLM config is required
    if (!config.llm_config || !config.llm_config.model) {
      return false;
    }
    
    return true;
  }
  
  async initialize(): Promise<void> {
    // Create internal LLM node
    this.llmNode = new LLMNode({
      ...this.context,
      config: this.context.config.llm_config,
    });
    
    await this.llmNode.initialize();
    
    // Start subscribing to breadcrumbs
    await this.startSubscriptions();
    
    // Create agent definition breadcrumb
    await this.createAgentDefinition();
  }
  
  async destroy(): Promise<void> {
    // Stop subscriptions
    if (this.sseCleanup) {
      this.sseCleanup();
      this.sseCleanup = undefined;
    }
    
    // Clean up LLM node
    if (this.llmNode) {
      await this.llmNode.destroy();
      this.llmNode = undefined;
    }
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Get trigger event
      const trigger = inputs.trigger;
      const additionalContext = inputs.additional_context;
      
      // Build context from subscriptions
      const context = await this.buildContext(trigger, additionalContext);
      
      // Prepare messages for LLM
      const messages = this.buildMessages(trigger, context);
      
      // Call LLM with context
      if (!this.llmNode) {
        throw new Error('LLM node not initialized');
      }
      
      const llmResult = await this.llmNode.execute({ messages });
      
      // Parse decision from LLM response
      const decision = this.parseDecision(llmResult.outputs.response.content);
      
      // Execute decision
      const operations = await this.executeDecision(decision);
      
      // Log execution
      await this.logExecution({
        trigger_type: trigger?.type || 'manual',
        context_size: context.length,
        decision: decision.action,
        operations_count: operations.length,
        latency_ms: Date.now() - startTime,
      });
      
      return {
        outputs: {
          emitter: operations.filter(op => op.type === 'emit'),
          curator: operations.filter(op => op.type === 'curate'),
          decision,
        },
        metadata: {
          execution_time_ms: Date.now() - startTime,
          context_breadcrumbs: context.length,
          operations_executed: operations.length,
        },
      };
    } catch (error) {
      await this.handleError(error, inputs);
      throw error;
    }
  }
  
  private async startSubscriptions(): Promise<void> {
    const subscriptions: Selector[] = this.context.config.subscriptions || [];
    
    // Subscribe to events via SSE
    for (const selector of subscriptions) {
      this.sseCleanup = this.rcrtClient.startEventStream(
        (event: BreadcrumbEvent) => this.handleBreadcrumbEvent(event),
        {
          filters: selector,
          agentId: this.context.breadcrumb_id,
        }
      );
    }
    
    // Load initial breadcrumbs
    for (const selector of subscriptions) {
      const breadcrumbs = await this.rcrtClient.searchBreadcrumbs(selector);
      for (const breadcrumb of breadcrumbs) {
        this.subscribedBreadcrumbs.set(breadcrumb.id, breadcrumb);
      }
    }
  }
  
  private handleBreadcrumbEvent(event: BreadcrumbEvent): void {
    // Skip ping events
    if (event.type === 'ping' || !event.breadcrumb_id) {
      return;
    }
    
    switch (event.type) {
      case 'breadcrumb.created':
      case 'breadcrumb.updated':
        // Fetch and cache the breadcrumb
        this.rcrtClient.getBreadcrumb(event.breadcrumb_id).then(breadcrumb => {
          this.subscribedBreadcrumbs.set(breadcrumb.id, breadcrumb);
        }).catch(error => {
          console.error(`Failed to fetch breadcrumb ${event.breadcrumb_id}:`, error);
        });
        break;
        
      case 'breadcrumb.deleted':
        this.subscribedBreadcrumbs.delete(event.breadcrumb_id);
        break;
    }
  }
  
  private async buildContext(trigger: any, additionalContext?: any): Promise<any[]> {
    const context: any[] = [];
    
    // Add subscribed breadcrumbs
    for (const breadcrumb of this.subscribedBreadcrumbs.values()) {
      context.push({
        type: 'subscription',
        data: breadcrumb,
      });
    }
    
    // Add trigger
    if (trigger) {
      context.push({
        type: 'trigger',
        data: trigger,
      });
    }
    
    // Add additional context
    if (additionalContext) {
      context.push({
        type: 'additional',
        data: additionalContext,
      });
    }
    
    // Add memory if configured
    if (this.context.config.memory?.type === 'breadcrumb') {
      const memoryBreadcrumbs = await this.rcrtClient.searchBreadcrumbs({
        schema_name: 'agent.memory.v1',
        any_tags: [`agent:${this.context.breadcrumb_id}`, 'agent:memory'],
      });
      
      for (const memory of memoryBreadcrumbs) {
        context.push({
          type: 'memory',
          data: memory,
        });
      }
    }
    
    return context;
  }
  
  private buildMessages(trigger: any, context: any[]): any[] {
    const messages: any[] = [];
    
    // System prompt
    const systemPrompt = this.context.config.llm_config.system_prompt || 
      'You are an agent that processes context and makes decisions.';
    
    messages.push({
      role: 'system',
      content: systemPrompt,
    });
    
    // Add context as a message
    if (context.length > 0) {
      messages.push({
        role: 'system',
        content: `Current context (${context.length} items):\n${JSON.stringify(context, null, 2)}`,
      });
    }
    
    // Add trigger as user message
    const triggerMessage = trigger 
      ? `Process this event: ${JSON.stringify(trigger)}`
      : 'What should I do based on the current context?';
    
    messages.push({
      role: 'user',
      content: triggerMessage,
    });
    
    return messages;
  }
  
  private parseDecision(content: string): any {
    // Try to parse as JSON
    try {
      return JSON.parse(content);
    } catch {
      // Fallback to simple parsing
      const cleaned = content.trim();
      
      // Look for action patterns
      if (cleaned.toLowerCase().includes('create')) {
        return {
          action: 'create',
          details: cleaned,
        };
      } else if (cleaned.toLowerCase().includes('update')) {
        return {
          action: 'update',
          details: cleaned,
        };
      } else if (cleaned.toLowerCase().includes('delete')) {
        return {
          action: 'delete',
          details: cleaned,
        };
      } else if (cleaned.toLowerCase().includes('none') || cleaned.toLowerCase().includes('nothing')) {
        return {
          action: 'none',
          details: cleaned,
        };
      }
      
      return {
        action: 'unknown',
        details: cleaned,
      };
    }
  }
  
  private async executeDecision(decision: any): Promise<any[]> {
    const operations: any[] = [];
    
    // Check capabilities
    const capabilities = this.context.config.capabilities || {};
    
    switch (decision.action) {
      case 'create':
        if (capabilities.can_create_breadcrumbs) {
          const breadcrumb = decision.breadcrumb || decision.data;
          if (breadcrumb) {
            const result = await this.createBreadcrumb(breadcrumb);
            operations.push({
              type: 'emit',
              operation: 'create',
              breadcrumb_id: result.id,
            });
          }
        }
        break;
        
      case 'update':
        if (capabilities.can_update_own) {
          const { id, version, updates } = decision;
          if (id && version && updates) {
            await this.rcrtClient.updateBreadcrumb(id, version, updates);
            operations.push({
              type: 'curate',
              operation: 'update',
              breadcrumb_id: id,
            });
          }
        }
        break;
        
      case 'delete':
        if (capabilities.can_delete_own) {
          const { id, version } = decision;
          if (id) {
            await this.rcrtClient.deleteBreadcrumb(id, version);
            operations.push({
              type: 'curate',
              operation: 'delete',
              breadcrumb_id: id,
            });
          }
        }
        break;
        
      case 'spawn':
        if (capabilities.can_spawn_agents) {
          const agentDef = decision.agent_def;
          if (agentDef) {
            const result = await this.createBreadcrumb({
              ...agentDef,
              schema_name: 'agent.def.v1',
            });
            operations.push({
              type: 'emit',
              operation: 'spawn_agent',
              agent_id: result.id,
            });
          }
        }
        break;
    }
    
    return operations;
  }
  
  private async createAgentDefinition(): Promise<void> {
    const agentDef: Partial<AgentDefinitionV1> = {
      schema_name: 'agent.def.v1',
      title: `Agent: ${this.context.breadcrumb_id}`,
      tags: ['agent:def', this.context.workspace, `agent:${this.context.breadcrumb_id}`],
      context: {
        agent_id: this.context.breadcrumb_id,
        model: this.context.config.llm_config.model,
        system_prompt: this.context.config.llm_config.system_prompt || '',
        capabilities: this.context.config.capabilities || {},
        subscriptions: {
          selectors: this.context.config.subscriptions || [],
        },
        memory: this.context.config.memory,
      },
    };
    
    await this.createBreadcrumb(agentDef);
  }
}
