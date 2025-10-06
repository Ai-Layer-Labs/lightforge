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
  
  configSchema = {
    type: 'object',
    properties: {
      apiKey: {
        type: 'string',
        description: 'OpenRouter API key',
        secret: true
      },
      defaultModel: {
        type: 'string',
        description: 'Default model when not specified',
        default: 'google/gemini-2.5-flash'
      },
      defaultTemperature: {
        type: 'number',
        description: 'Default temperature',
        default: 0.7,
        minimum: 0,
        maximum: 2
      },
      defaultMaxTokens: {
        type: 'number',
        description: 'Default max tokens',
        default: 4000,
        minimum: 1
      }
    },
    required: ['apiKey']
  };
  
  configDefaults = {
    defaultModel: 'google/gemini-2.5-flash',
    defaultTemperature: 0.7,
    defaultMaxTokens: 4000
  };
  
  examples = [
    {
      title: 'Simple question',
      input: {
        messages: [
          { role: 'user', content: 'What is 2+2?' }
        ]
      },
      output: {
        content: '2 + 2 equals 4.',
        model: 'google/gemini-2.5-flash',
        usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
        cost_estimate: 0.00001
      },
      explanation: 'Access the response with result.content. Model and usage info available.'
    },
    {
      title: 'With system prompt and temperature',
      input: {
        messages: [
          { role: 'system', content: 'You are a helpful coding assistant' },
          { role: 'user', content: 'How do I create a list in Python?' }
        ],
        temperature: 0.7
      },
      output: {
        content: 'In Python, you can create a list using square brackets: my_list = [1, 2, 3]',
        model: 'google/gemini-2.5-flash',
        usage: { total_tokens: 45 },
        cost_estimate: 0.00003
      },
      explanation: 'System prompts guide behavior. Temperature controls creativity (0-2).'
    },
    {
      title: 'Specify different model',
      input: {
        messages: [
          { role: 'user', content: 'Explain quantum computing' }
        ],
        model: 'anthropic/claude-3-haiku',
        max_tokens: 500
      },
      output: {
        content: 'Quantum computing uses quantum mechanics principles...',
        model: 'anthropic/claude-3-haiku',
        usage: { total_tokens: 120 },
        cost_estimate: 0.00015
      },
      explanation: 'Specify a different model with the model parameter. Check models catalog for available options.'
    }
  ];
  
  async initialize(context: ToolExecutionContext): Promise<void> {
    console.log('[OpenRouter] Initializing OpenRouter tool...');
    await this.ensureModelsCatalog(context);
  }
  
  async execute(input: any, context: ToolExecutionContext): Promise<any> {
    // Validate input
    const validation = this.validateInput(input);
    if (validation !== true) {
      throw new Error(validation as string);
    }
    
    // Load tool configuration from breadcrumb
    const config = await this.loadToolConfiguration(context);
    
    // Get API key from configured secret
    const apiKey = await this.getConfiguredSecret(config.apiKey, context);
    
    // Choose model from config or input
    const model = input.model || config.defaultModel || 'google/gemini-2.5-flash';
    
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
          temperature: input.temperature || config.temperature || 0.7,
          max_tokens: input.max_tokens || config.maxTokens || 4000
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
        tag: 'openrouter:models'
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
    const estimatedCosts: Record<string, number> = {
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
  
  /**
   * Ensure models catalog exists - creates it if missing
   */
  private async ensureModelsCatalog(context: ToolExecutionContext): Promise<void> {
    try {
      // Check if models catalog already exists
      const existingCatalogs = await context.rcrtClient.searchBreadcrumbs({
        tag: 'openrouter:models'
      });
      
      if (existingCatalogs.length > 0) {
        console.log('[OpenRouter] Models catalog already exists');
        return;
      }
      
      console.log('[OpenRouter] Creating models catalog...');
      
      // Fetch models from OpenRouter public API (no auth needed)
      const response = await fetch('https://openrouter.ai/api/v1/models');
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }
      
      const modelsData = await response.json();
      
      // Filter to useful models
      const usefulModels = modelsData.data.filter((model: any) => {
        const promptCost = parseFloat(model.pricing?.prompt || '0');
        const completionCost = parseFloat(model.pricing?.completion || '0');
        return promptCost > 0 && (promptCost + completionCost) < 0.05;
      });
      
      // Create models catalog breadcrumb
      await context.rcrtClient.createBreadcrumb({
        schema_name: 'openrouter.models.catalog.v1',
        title: 'OpenRouter Available Models',
        tags: ['workspace:tools', 'openrouter:models', 'models:catalog'],
        context: {
          models: usefulModels.map((model: any) => ({
            id: model.id,
            name: model.name,
            description: model.description,
            pricing: {
              prompt: model.pricing.prompt,
              completion: model.pricing.completion,
              currency: 'USD'
            },
            context_length: model.context_length,
            capabilities: {
              input_modalities: model.architecture?.input_modalities || ['text'],
              output_modalities: model.architecture?.output_modalities || ['text'],
              supports_tools: model.supported_parameters?.includes('tools') || false,
              supports_vision: model.architecture?.input_modalities?.includes('image') || false
            },
            provider: model.id.split('/')[0],
            performance: {
              max_completion_tokens: model.top_provider?.max_completion_tokens || 4096,
              is_moderated: model.top_provider?.is_moderated || false
            },
            updated_at: new Date().toISOString()
          })),
          total_models: usefulModels.length,
          total_available: modelsData.data.length,
          last_updated: new Date().toISOString(),
          source: 'https://openrouter.ai/api/v1/models',
          update_interval: '24 hours',
          filtering: 'Excluded models with cost > $50/1M tokens or no pricing'
        }
      });
      
      console.log(`[OpenRouter] Created models catalog with ${usefulModels.length} models`);
    } catch (error) {
      console.error('[OpenRouter] Failed to ensure models catalog:', error);
    }
  }
  
  /**
   * Load tool configuration from RCRT breadcrumb
   */
  private async loadToolConfiguration(context: ToolExecutionContext): Promise<any> {
    try {
      console.log('[OpenRouter] Loading tool configuration from breadcrumb...');
      
      // Ensure models catalog exists first
      await this.ensureModelsCatalog(context);
      
      // Search for tool config breadcrumb
      const configBreadcrumbs = await context.rcrtClient.searchBreadcrumbs({
        tag: 'tool:config:openrouter'
      });
      
      if (configBreadcrumbs.length > 0) {
        // Use the most recent config
        const latest = configBreadcrumbs.sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )[0];
        
        const fullBreadcrumb = await context.rcrtClient.getBreadcrumb(latest.id);
        
        console.log('[OpenRouter] Config breadcrumb context:', JSON.stringify(fullBreadcrumb.context).substring(0, 500));
        
        if (fullBreadcrumb.context?.config) {
          console.log('[OpenRouter] Loaded configuration:', fullBreadcrumb.context.config);
          return fullBreadcrumb.context.config;
        }
      }
      
      console.log('[OpenRouter] No configuration found, using defaults');
      return {
        defaultModel: 'google/gemini-2.5-flash',
        temperature: 0.7,
        maxTokens: 4000
      };
    } catch (error) {
      console.warn('[OpenRouter] Failed to load configuration, using defaults:', error);
      return {
        defaultModel: 'google/gemini-2.5-flash',
        temperature: 0.7,
        maxTokens: 4000
      };
    }
  }
  
  /**
   * Get secret by ID instead of name
   */
  private async getConfiguredSecret(secretId: string, context: ToolExecutionContext): Promise<string> {
    try {
      if (!secretId) {
        // Fallback to legacy secret name approach
        console.log('[OpenRouter] No secret ID configured, using legacy OPENROUTER_API_KEY');
        return await this.getSecret('OPENROUTER_API_KEY', context);
      }
      
      console.log('[OpenRouter] Getting configured secret:', secretId);
      const decrypted = await context.rcrtClient.getSecret(secretId, `OpenRouter:${context.agentId}`);
      
      if (!decrypted.value) {
        throw new Error('Secret value is empty');
      }
      
      return decrypted.value;
    } catch (error) {
      console.warn('[OpenRouter] Failed to get configured secret, trying fallback:', error);
      // Fallback to legacy approach
      return await this.getSecret('OPENROUTER_API_KEY', context);
    }
  }
}

