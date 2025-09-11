/**
 * OpenRouter LLM Tool 
 * Access to 100+ models via unified API with real pricing data
 */

import { SimpleLLMTool } from './base.js';
import { ToolExecutionContext } from '../index.js';

export class OpenRouterTool extends SimpleLLMTool {
  name = 'openrouter';
  description = 'OpenRouter - Access to 100+ LLM models via unified API';
  requiredSecrets = ['OPENROUTER_API_KEY'];
  
  async execute(input: any, context: ToolExecutionContext): Promise<any> {
    // Validate input
    const validation = this.validateInput(input);
    if (validation !== true) {
      throw new Error(validation);
    }
    
    // Get API key from RCRT secrets
    const apiKey = await this.getSecret('OPENROUTER_API_KEY', context);
    
    // Choose model (specific OpenRouter format like "google/gemini-2.5-flash")
    const model = input.model || 'google/gemini-2.5-flash';
    
    try {
      // Call OpenRouter API
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',  // Required by OpenRouter
          'X-Title': 'RCRT Agent System'            // Required by OpenRouter
        },
        body: JSON.stringify({
          model: model,
          messages: input.messages,
          temperature: input.temperature || 0.7,
          max_tokens: input.max_tokens || 4000
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw this.formatError(`API error ${response.status}: ${errorText}`, 'OpenRouter');
      }
      
      const data = await response.json();
      
      // Calculate cost using real model pricing
      const costEstimate = await this.calculateRealCost(data.usage, model, context);
      
      return {
        content: data.choices[0].message.content,
        model: data.model,
        usage: data.usage || {
          prompt_tokens: 0,
          completion_tokens: 0, 
          total_tokens: 0
        },
        cost_estimate: costEstimate
      };
      
    } catch (error) {
      throw this.formatError(error, 'OpenRouter');
    }
  }
  
  /**
   * Calculate real cost using OpenRouter models catalog breadcrumb
   */
  private async calculateRealCost(usage: any, model: string, context: ToolExecutionContext): Promise<number> {
    if (!usage?.total_tokens) return 0;
    
    try {
      // Get real pricing from models catalog breadcrumb
      const modelsCatalog = await context.rcrtClient.searchBreadcrumbs({
        tags: ['openrouter:models', 'models:catalog']
      });
      
      if (modelsCatalog.length > 0) {
        const models = modelsCatalog[0].context.models;
        const modelInfo = models.find((m: any) => m.id === model);
        
        if (modelInfo?.pricing) {
          // Calculate using real OpenRouter pricing
          const promptCost = (usage.prompt_tokens || 0) * parseFloat(modelInfo.pricing.prompt);
          const completionCost = (usage.completion_tokens || 0) * parseFloat(modelInfo.pricing.completion);
          return promptCost + completionCost;
        }
      }
      
      // Fallback to estimates if catalog not available
      console.warn(`[OpenRouter] Using estimated pricing for ${model} - catalog not available`);
      return this.estimateCostFallback(usage, model);
      
    } catch (error) {
      console.warn(`[OpenRouter] Error calculating real cost, using estimate:`, error);
      return this.estimateCostFallback(usage, model);
    }
  }
  
  /**
   * Fallback cost estimation if models catalog unavailable
   */
  private estimateCostFallback(usage: any, model: string): number {
    const totalTokens = usage?.total_tokens || 0;
    
    // Conservative estimates for common models
    const estimatedCosts = {
      'google/gemini-2.5-flash': 0.009,      // $9 per 1M tokens average
      'anthropic/claude-3-haiku': 0.0015,        // $1.5 per 1M tokens average  
      'openai/gpt-4o': 0.015,                    // $15 per 1M tokens average
      'openai/gpt-4o-mini': 0.0005,              // $0.5 per 1M tokens average
      'google/gemini-pro': 0.003,                // $3 per 1M tokens average
      'meta-llama/llama-3.1-8b': 0.0002,        // $0.2 per 1M tokens average
    };
    
    const costPer1K = estimatedCosts[model] || 0.005; // Default $5 per 1M tokens
    return (totalTokens / 1000) * costPer1K;
  }
}

