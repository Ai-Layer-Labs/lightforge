/**
 * Agent Executor - Universal Pattern
 * Extends UniversalExecutor with LLM execution
 */

import { UniversalExecutor, type Subscription } from '../executor/universal-executor';
import { EventBridge } from '../executor/event-bridge';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { extractAndParseJSON } from '../utils/json-repair';

export interface AgentDefinition {
  agent_id: string;
  model: string;
  system_prompt: string;
  temperature?: number;
  subscriptions: {
    selectors: Subscription[];
  };
  capabilities?: any;
}

export interface AgentExecutorOptions {
  agentDef: { context: AgentDefinition };
  rcrtClient: RcrtClientEnhanced;
  workspace: string;
}

export class AgentExecutorUniversal extends UniversalExecutor {
  private agentDef: AgentDefinition;
  private eventBridge: EventBridge;
  
  constructor(options: AgentExecutorOptions, eventBridge?: EventBridge) {
    super({
      rcrtClient: options.rcrtClient,
      workspace: options.workspace,
      subscriptions: options.agentDef.context.subscriptions.selectors,
      id: options.agentDef.context.agent_id
    });
    
    this.agentDef = options.agentDef.context;
    this.eventBridge = eventBridge || new EventBridge();
    
    console.log(`🤖 [AgentExecutor] Initialized: ${this.agentDef.agent_id}`);
    console.log(`📡 Subscriptions: ${this.subscriptions.length}`);
    this.subscriptions.forEach(sub => {
      console.log(`  - ${sub.schema_name} (role: ${sub.role}, key: ${sub.key || sub.schema_name})`);
    });
  }
  
  /**
   * Execute: Handle triggers based on type
   * - user.message.v1: Create LLM request (fire-and-forget)
   * - agent.context.v1: Create LLM request (fire-and-forget)
   * - tool.response.v1: Create agent response (continuation)
   */
  protected async execute(trigger: any, context: Record<string, any>): Promise<any> {
    const triggerSchema = trigger.schema_name;
    
    if (triggerSchema === 'user.message.v1' || triggerSchema === 'agent.context.v1') {
      // Fire-and-forget: Create LLM request, return immediately
      await this.createLLMRequest(trigger, context);
      return { action: 'llm_request_created', async: true };
    }
    
    if (triggerSchema === 'tool.response.v1') {
      // LLM response arrived! Parse and respond
      const llmOutput = trigger.context?.output;
      
      // Extract LLM content (this is where we might need repair)
      const llmContent = llmOutput?.choices?.[0]?.message?.content || 
                        llmOutput?.content ||
                        JSON.stringify(llmOutput);
      
      // Use jsonrepair HERE - on LLM output only!
      const parsed = this.parseAgentResponse(llmContent);
      return parsed;
    }
    
    return { action: 'unknown_trigger', schema: triggerSchema };
  }
  
  /**
   * Format assembled context for LLM
   */
  private formatContextForLLM(context: Record<string, any>): string {
    let formatted = '';
    
    for (const [key, value] of Object.entries(context)) {
      if (key === 'trigger') continue;  // Already in user message
      
      const title = this.humanizeKey(key);
      formatted += `## ${title}\n\n`;
      
      if (typeof value === 'object' && value !== null) {
        formatted += '```json\n';
        formatted += JSON.stringify(value, null, 2);
        formatted += '\n```\n\n';
      } else {
        formatted += String(value) + '\n\n';
      }
    }
    
    return formatted;
  }
  
  /**
   * Create LLM request (fire-and-forget!)
   */
  private async createLLMRequest(trigger: any, context: Record<string, any>): Promise<void> {
    // Extract user message from trigger
    const userMessage = trigger.context?.message || 
                       trigger.context?.content || 
                       JSON.stringify(trigger.context);
    
    // Format context for LLM
    const contextFormatted = this.formatContextForLLM(context);
    
    // Build messages for LLM
    const messages = [
      {
        role: 'system',
        content: this.agentDef.system_prompt
      },
      {
        role: 'user',
        content: `# Available Context\n\n${contextFormatted}\n\n# User Message\n${userMessage}`
      }
    ];
    
    console.log(`📤 [${this.agentDef.agent_id}] Creating LLM request (async)...`);
    
    const requestId = `llm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create tool request (fire-and-forget!)
    await this.rcrtClient.createBreadcrumb({
      schema_name: 'tool.request.v1',
      title: 'LLM Request',
      tags: ['tool:request', 'workspace:tools', `agent:${this.agentDef.agent_id}`],  // Tag with agent ID!
      context: {
        tool: 'openrouter',
        input: {
          model: this.agentDef.model,
          messages: messages,
          temperature: this.agentDef.temperature || 0.7
        },
        requestId: requestId,
        requestedBy: this.agentDef.agent_id
      }
    });
    
    console.log(`✅ [${this.agentDef.agent_id}] LLM request created, returning immediately`);
    // Return immediately! Response will arrive via SSE as tool.response.v1
  }
  
  /**
   * Parse agent response (extract JSON)
   */
  private parseAgentResponse(llmOutput: string): any {
    try {
      return extractAndParseJSON(llmOutput);
    } catch (error) {
      console.warn(`Failed to parse agent response, using fallback`);
      // Fallback: wrap plain text
      return {
        action: 'create',
        breadcrumb: {
          schema_name: 'agent.response.v1',
          title: 'Agent Response',
          tags: ['agent:response', 'chat:output'],
        context: {
            message: llmOutput
          }
        }
      };
    }
  }
  
  /**
   * Create agent response breadcrumb
   */
  protected async respond(trigger: any, result: any): Promise<void> {
    // If async action, don't create response (waiting for continuation)
    if (result.async) {
      console.log(`✅ [${this.agentDef.agent_id}] Async action complete, waiting for continuation`);
      return;
    }
    
    const breadcrumbDef = result.breadcrumb || result;
    
    // Add creator metadata
    const context = {
      ...breadcrumbDef.context,
      creator: {
        type: 'agent',
        agent_id: this.agentDef.agent_id
      },
      trigger_id: trigger.id
    };
    
    await this.rcrtClient.createBreadcrumb({
      schema_name: breadcrumbDef.schema_name || 'agent.response.v1',
      title: breadcrumbDef.title || 'Agent Response',
      tags: breadcrumbDef.tags || ['agent:response', 'chat:output'],
      context: context
    });
    
    console.log(`📤 [${this.agentDef.agent_id}] Response created`);
  }
  
  /**
   * Humanize key for display
   */
  private humanizeKey(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  
  /**
   * Get state for monitoring
   */
  getState() {
    return {
      agent_id: this.agentDef.agent_id,
      status: 'active',
      subscriptions: this.subscriptions.length,
      metrics: {
        events_processed: 0,
        errors: 0,
        last_activity: new Date()
      }
    };
  }
  
  /**
   * Get definition
   */
  getDefinition() {
    return { context: this.agentDef };
  }
  
  /**
   * Override vector search query (use trigger message)
   */
  private triggerMessage: string = '';
  
  protected getVectorSearchQuery(): string {
    return this.triggerMessage;
  }
}
