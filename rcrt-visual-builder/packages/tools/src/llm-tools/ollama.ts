/**
 * Ollama LLM Tool
 * Fast, free, private local models via Ollama
 */

import { SimpleLLMTool } from './base.js';
import { ToolExecutionContext } from '../index.js';

export class OllamaTool extends SimpleLLMTool {
  name = 'ollama_local';
  description = 'Ollama - Fast, free, private local models';
  requiredSecrets = []; // No API key needed for local models!
  
  configSchema = {
    type: 'object',
    properties: {
      ollamaHost: {
        type: 'string',
        description: 'Ollama host URL',
        default: 'http://localhost:11434'
      },
      defaultModel: {
        type: 'string',
        description: 'Default Ollama model',
        default: 'llama3.1:8b'
      }
    }
  };
  
  configDefaults = {
    ollamaHost: 'http://localhost:11434',
    defaultModel: 'llama3.1:8b'
  };
  
  examples = [
    {
      title: 'Simple local query',
      input: {
        messages: [
          { role: 'user', content: 'What is the capital of France?' }
        ]
      },
      output: {
        content: 'The capital of France is Paris.',
        model: 'llama3.1:8b',
        usage: { total_tokens: 25 },
        cost_estimate: 0
      },
      explanation: 'Free local inference. Access response with result.content.'
    },
    {
      title: 'Code generation',
      input: {
        messages: [
          { role: 'user', content: 'Write a Python function to reverse a string' }
        ],
        model: 'codellama:7b'
      },
      output: {
        content: 'def reverse_string(s):\n    return s[::-1]',
        model: 'codellama:7b',
        usage: { total_tokens: 40 },
        cost_estimate: 0
      },
      explanation: 'Use specialized models like codellama for coding tasks. Always free!'
    }
  ];
  
  async execute(input: any, context: ToolExecutionContext): Promise<any> {
    // Validate input
    const validation = this.validateInput(input);
    if (validation !== true) {
      throw new Error(validation);
    }
    
    // Check if Ollama is available
    await this.checkOllamaHealth();
    
    // Choose model (Ollama format like "llama3.1:8b")
    const model = input.model || 'llama3.1:8b';
    
    try {
      // Call Ollama API
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          messages: input.messages,
          options: {
            temperature: input.temperature || 0.7,
            top_p: input.top_p || 0.9
          },
          stream: false
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw this.formatError(`API error ${response.status}: ${errorText}`, 'Ollama');
      }
      
      const data = await response.json();
      
      return {
        content: data.message?.content || '',
        model: model,
        usage: this.estimateUsage(data.message?.content || ''),
        cost_estimate: 0 // Free!
      };
      
    } catch (error) {
      throw this.formatError(error, 'Ollama');
    }
  }
  
  /**
   * Check if Ollama service is running and accessible
   */
  private async checkOllamaHealth(): Promise<void> {
    try {
      const healthResponse = await fetch('http://localhost:11434/api/tags', {
        method: 'GET'
      });
      
      if (!healthResponse.ok) {
        throw new Error(`Ollama health check failed: ${healthResponse.status}`);
      }
      
      console.log('[Ollama] ✅ Service is healthy and accessible');
      
    } catch (error) {
      throw new Error(`Ollama not available - ensure Ollama is running on localhost:11434. Error: ${error.message}`);
    }
  }
  
  /**
   * Estimate token usage for local models
   * Ollama doesn't provide exact token counts, so we estimate
   */
  private estimateUsage(content: string) {
    const contentTokens = this.estimateTokens(content);
    const promptTokens = contentTokens; // Rough estimate
    
    return {
      prompt_tokens: promptTokens,
      completion_tokens: contentTokens, 
      total_tokens: promptTokens + contentTokens
    };
  }
  
  /**
   * Get list of available local models
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (!response.ok) {
        throw new Error(`Failed to get Ollama models: ${response.status}`);
      }
      
      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
      
    } catch (error) {
      console.warn('[Ollama] Could not fetch available models:', error);
      return ['llama3.1:8b']; // Default fallback
    }
  }
}
