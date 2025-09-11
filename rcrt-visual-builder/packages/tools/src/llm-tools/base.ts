/**
 * Simple LLM Tool Base Class
 * Agents = Data + Subscriptions, Tools = Code
 */

import { RCRTTool, ToolExecutionContext } from '../index.js';

export abstract class SimpleLLMTool implements RCRTTool {
  abstract name: string;
  abstract description: string;
  category = 'llm';
  version = '1.0.0';
  
  get inputSchema() {
    return {
      type: 'object',
      properties: {
        messages: { 
          type: 'array', 
          description: 'Chat messages in OpenAI format',
          items: { 
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['system', 'user', 'assistant'] },
              content: { type: 'string' }
            },
            required: ['role', 'content']
          }
        },
        temperature: { type: 'number', default: 0.7, minimum: 0, maximum: 2 },
        max_tokens: { type: 'number', default: 4000, minimum: 1 },
        model: { type: 'string', description: 'Specific model to use (optional)' }
      },
      required: ['messages']
    };
  }
  
  get outputSchema() {
    return {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Generated response content' },
        model: { type: 'string', description: 'Model that generated the response' },
        usage: { 
          type: 'object',
          properties: {
            prompt_tokens: { type: 'number' },
            completion_tokens: { type: 'number' },
            total_tokens: { type: 'number' }
          }
        },
        cost_estimate: { type: 'number', description: 'Estimated cost in USD' }
      },
      required: ['content', 'model']
    };
  }
  
  // Subclasses implement this
  abstract execute(input: any, context: ToolExecutionContext): Promise<any>;
  
  // Helper for getting secrets from RCRT
  protected async getSecret(secretName: string, context: ToolExecutionContext): Promise<string> {
    try {
      const secrets = await context.rcrtClient.listSecrets();
      const secret = secrets.find(s => s.name.toLowerCase() === secretName.toLowerCase());
      if (!secret) {
        throw new Error(`${secretName} not found in RCRT secrets`);
      }
      
      const decrypted = await context.rcrtClient.getSecret(secret.id, `LLM:${this.name}:${context.agentId}`);
      if (!decrypted.value) {
        throw new Error(`${secretName} is empty`);
      }
      
      return decrypted.value;
    } catch (error) {
      throw new Error(`Failed to get secret ${secretName}: ${error.message}`);
    }
  }
  
  // Helper for input validation
  protected validateInput(input: any): boolean | string {
    if (!input || typeof input !== 'object') {
      return 'Input must be an object';
    }
    
    if (!Array.isArray(input.messages)) {
      return 'Input must contain a "messages" array';
    }
    
    if (input.messages.length === 0) {
      return 'Messages array cannot be empty';
    }
    
    for (const msg of input.messages) {
      if (!msg.role || !msg.content) {
        return 'Each message must have "role" and "content" fields';
      }
      if (!['system', 'user', 'assistant'].includes(msg.role)) {
        return 'Message role must be "system", "user", or "assistant"';
      }
    }
    
    return true;
  }
  
  // Helper to estimate tokens (rough approximation)
  protected estimateTokens(text: string): number {
    // Very rough estimate: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
  
  // Helper to format error messages
  protected formatError(error: any, provider: string): Error {
    const message = error.message || String(error);
    return new Error(`${provider} LLM error: ${message}`);
  }
}
