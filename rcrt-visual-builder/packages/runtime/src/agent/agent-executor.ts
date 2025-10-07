/**
 * Agent Executor - Universal Pattern
 * Extends UniversalExecutor with LLM execution
 */

import { UniversalExecutor, type Subscription } from '../executor/universal-executor';
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
  
  constructor(options: AgentExecutorOptions) {
    super({
      rcrtClient: options.rcrtClient,
      workspace: options.workspace,
      subscriptions: options.agentDef.context.subscriptions.selectors,
      id: options.agentDef.context.agent_id
    });
    
    this.agentDef = options.agentDef.context;
    
    console.log(`🤖 [AgentExecutor] Initialized: ${this.agentDef.agent_id}`);
    console.log(`📡 Subscriptions: ${this.subscriptions.length}`);
    this.subscriptions.forEach(sub => {
      console.log(`  - ${sub.schema_name} (role: ${sub.role}, key: ${sub.key || sub.schema_name})`);
    });
  }
  
  /**
   * Execute: Call LLM with assembled context
   */
  protected async execute(trigger: any, context: Record<string, any>): Promise<any> {
    console.log(`🤖 [${this.agentDef.agent_id}] Calling LLM...`);
    
    // Extract user message from trigger
    const userMessage = trigger.context?.message || 
                       trigger.context?.content || 
                       JSON.stringify(trigger.context);
    
    // Format context for LLM (clean JSON)
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
    
    console.log(`📤 [${this.agentDef.agent_id}] Sending to LLM (model: ${this.agentDef.model})`);
    
    // Call LLM via OpenRouter tool
    const llmResponse = await this.callLLM(messages);
    
    // Parse JSON response
    const parsed = this.parseAgentResponse(llmResponse);
    
    console.log(`📥 [${this.agentDef.agent_id}] LLM response received`);
    
    return parsed;
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
   * Call LLM via OpenRouter tool
   */
  private async callLLM(messages: any[]): Promise<string> {
    // Create tool request
    const llmRequest = await this.rcrtClient.createBreadcrumb({
      schema_name: 'tool.request.v1',
      title: 'LLM Request',
      tags: ['tool:request', this.workspace],
      context: {
        tool: 'openrouter',
        input: {
          model: this.agentDef.model,
          messages: messages,
          temperature: this.agentDef.temperature || 0.7
        },
        requestId: `llm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        requestedBy: this.agentDef.agent_id
      }
    });
    
    console.log(`🔄 [${this.agentDef.agent_id}] Waiting for LLM response...`);
    
    // Wait for response (TODO: Use proper EventBridge pattern)
    // For now, poll for response
    for (let i = 0; i < 60; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const responses = await this.rcrtClient.searchBreadcrumbsWithContext({
        schema_name: 'tool.response.v1',
        tag: `request:${llmRequest.id}`,
        include_context: true,
        limit: 1
      });
      
      if (responses.length > 0) {
        const output = responses[0].context.output;
        
        // Extract content from OpenRouter response
        if (output?.choices?.[0]?.message?.content) {
          return output.choices[0].message.content;
        } else if (typeof output === 'string') {
          return output;
        } else {
          return JSON.stringify(output);
        }
      }
    }
    
    throw new Error('LLM response timeout after 30 seconds');
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
