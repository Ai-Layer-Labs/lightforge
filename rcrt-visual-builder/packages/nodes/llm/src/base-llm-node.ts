/**
 * Base LLM Node Implementation
 * Standard interface for all LLM nodes
 */

import { BaseNode, RegisterNode, NodeExecutionResult, NodeMetadata } from '@rcrt-builder/node-sdk';
import { LLMMessage, LLMResponseV1, ToolDefinition } from '@rcrt-builder/core';

// OpenRouter client interface
interface OpenRouterClient {
  complete(params: {
    model: string;
    messages: LLMMessage[];
    temperature?: number;
    max_tokens?: number;
    tools?: ToolDefinition[];
    stream?: boolean;
  }): Promise<{
    content: string;
    model: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    tool_calls?: any[];
    latency?: number;
  }>;
}

// Simple OpenRouter implementation (real implementation would use actual API)
class SimpleOpenRouterClient implements OpenRouterClient {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';
  
  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
  }
  
  async complete(params: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://rcrt-builder.local',
        'X-Title': 'RCRT Visual Builder',
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature || 0.7,
        max_tokens: params.max_tokens || 4096,
        tools: params.tools,
        stream: false,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      content: data.choices[0].message.content,
      model: data.model,
      usage: data.usage,
      tool_calls: data.choices[0].message.tool_calls,
      latency: data.latency,
    };
  }
}

@RegisterNode({
  schema_name: 'node.template.v1',
  title: 'Base LLM Node',
  tags: ['node:template', 'llm', 'base'],
  context: {
    node_type: 'LLMNode',
    category: 'llm',
    icon: '🧠',
    color: '#9353d3',
  },
})
export class LLMNode extends BaseNode {
  protected llmClient: OpenRouterClient;
  
  constructor(context: any) {
    super(context);
    
    // Get API key from config or environment
    const apiKey = this.context.config.api_key || 
                   this.context.config.openrouter_api_key ||
                   process.env.OPENROUTER_API_KEY;
    
    this.llmClient = new SimpleOpenRouterClient(apiKey);
  }
  
  getMetadata(): NodeMetadata {
    return {
      type: 'LLMNode',
      category: 'llm',
      icon: '🧠',
      color: '#9353d3',
      description: 'Base LLM node for text generation',
      inputs: [
        { 
          id: 'messages', 
          type: 'messages', 
          schema: 'llm.messages.v1',
          description: 'Input messages for the LLM',
        },
        {
          id: 'credentials',
          type: 'data',
          schema: 'secrets.credentials.v1',
          description: 'API credentials',
          optional: true,
        },
      ],
      outputs: [
        { 
          id: 'response', 
          type: 'response', 
          schema: 'llm.response.v1',
          description: 'LLM response',
        },
        { 
          id: 'tool_calls', 
          type: 'data', 
          schema: 'llm.tool_calls.v1',
          description: 'Tool calls if tools were provided',
          optional: true,
        },
      ],
    };
  }
  
  validateConfig(config: any): boolean {
    // Model is required
    if (!config.model) {
      return false;
    }
    
    // Temperature must be between 0 and 2
    if (config.temperature !== undefined) {
      if (config.temperature < 0 || config.temperature > 2) {
        return false;
      }
    }
    
    return true;
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Get messages from input
      const { messages, credentials } = inputs;
      
      if (!messages || !Array.isArray(messages)) {
        throw new Error('Invalid or missing messages input');
      }
      
      // Use credentials if provided
      let apiKey = this.context.config.api_key;
      if (credentials && credentials.OPENROUTER_API_KEY) {
        apiKey = credentials.OPENROUTER_API_KEY;
      }
      
      // Prepare messages with system prompt if configured
      const enrichedMessages: LLMMessage[] = [];
      
      if (this.context.config.system_prompt) {
        enrichedMessages.push({
          role: 'system',
          content: this.context.config.system_prompt,
        });
      }
      
      enrichedMessages.push(...messages);
      
      // Call LLM
      const response = await this.llmClient.complete({
        model: this.context.config.model,
        messages: enrichedMessages,
        temperature: this.context.config.temperature || 0.7,
        max_tokens: this.context.config.max_tokens || 4096,
        tools: this.context.config.tools,
      });
      
      // Prepare response
      const llmResponse: LLMResponseV1 = {
        schema_name: 'llm.response.v1',
        content: response.content,
        model: response.model || this.context.config.model,
        usage: response.usage,
        metadata: {
          node_id: this.context.breadcrumb_id,
          timestamp: new Date().toISOString(),
          latency_ms: Date.now() - startTime,
        },
      };
      
      // Log execution
      await this.logExecution({
        model: this.context.config.model,
        message_count: enrichedMessages.length,
        tokens_used: response.usage?.total_tokens || 0,
        latency_ms: Date.now() - startTime,
      });
      
      // Return results
      const outputs: Record<string, any> = {
        response: llmResponse,
      };
      
      if (response.tool_calls && response.tool_calls.length > 0) {
        outputs.tool_calls = {
          schema_name: 'llm.tool_calls.v1',
          tool_calls: response.tool_calls,
        };
      }
      
      return {
        outputs,
        metadata: {
          execution_time_ms: Date.now() - startTime,
          model_used: response.model || this.context.config.model,
        },
      };
    } catch (error) {
      await this.handleError(error, inputs);
      throw error;
    }
  }
}
