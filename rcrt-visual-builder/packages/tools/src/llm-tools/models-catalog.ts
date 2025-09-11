/**
 * OpenRouter Models Catalog Manager
 * Fetches and maintains real model data as breadcrumb
 * Following RCRT principle: Data stored as breadcrumbs, not in code
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

export class OpenRouterModelsCatalog {
  constructor(
    private client: RcrtClientEnhanced, 
    private workspace: string
  ) {}
  
  async initializeModelsCatalog(): Promise<void> {
    console.log('[OpenRouter] Initializing models catalog...');
    
    try {
      // Check for existing model catalog
      const existing = await this.client.searchBreadcrumbs({
        tags: ['openrouter:models', 'models:catalog']
      });
      
      if (existing.length === 0 || this.shouldUpdateCatalog(existing[0])) {
        await this.updateModelsCatalog();
      } else {
        console.log(`[OpenRouter] ✅ Using existing models catalog with ${existing[0].context.total_models} models`);
      }
    } catch (error) {
      console.error('[OpenRouter] ❌ Failed to initialize models catalog:', error);
      // Continue without catalog - tools will use estimated pricing
    }
  }
  
  private async updateModelsCatalog(): Promise<void> {
    try {
      console.log('[OpenRouter] 📡 Fetching current models from OpenRouter API...');
      
      // Fetch current models from OpenRouter API
      const response = await fetch('https://openrouter.ai/api/v1/models');
      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }
      
      const modelsData = await response.json();
      
      // Filter to useful models (skip very expensive or experimental ones)
      const usefulModels = modelsData.data.filter((model: any) => {
        const promptCost = parseFloat(model.pricing?.prompt || '0');
        const completionCost = parseFloat(model.pricing?.completion || '0');
        
        // Skip if too expensive (over $50 per 1M tokens) or free models without pricing
        return promptCost > 0 && (promptCost + completionCost) < 0.05;
      });
      
      // Create/update models catalog breadcrumb
      const catalogBreadcrumb = await this.client.createBreadcrumb({
        schema_name: 'openrouter.models.catalog.v1',
        title: 'OpenRouter Available Models',
        tags: [this.workspace, 'openrouter:models', 'models:catalog'],
        context: {
          models: usefulModels.map((model: any) => ({
            id: model.id,                                    // "google/gemini-2.5-flash"
            name: model.name,                                // "Claude 3.5 Sonnet" 
            description: model.description,
            pricing: {
              prompt: model.pricing.prompt,                  // Per token cost
              completion: model.pricing.completion,          // Per token cost
              currency: 'USD'
            },
            context_length: model.context_length,            // Max context size
            capabilities: {
              input_modalities: model.architecture?.input_modalities || ['text'],
              output_modalities: model.architecture?.output_modalities || ['text'],
              supports_tools: model.supported_parameters?.includes('tools') || false,
              supports_vision: model.architecture?.input_modalities?.includes('image') || false
            },
            provider: model.id.split('/')[0],                // "anthropic", "openai", etc.
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
      }, `openrouter-models-catalog-${Date.now()}`);
      
      console.log(`[OpenRouter] ✅ Updated models catalog: ${usefulModels.length}/${modelsData.data.length} models`);
      
    } catch (error) {
      console.error('[OpenRouter] ❌ Failed to update models catalog:', error);
      throw error;
    }
  }
  
  private shouldUpdateCatalog(existingCatalog: any): boolean {
    if (!existingCatalog.context?.last_updated) return true;
    
    // Update daily or if older than 24 hours
    const lastUpdate = new Date(existingCatalog.context.last_updated);
    const hoursOld = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
    
    console.log(`[OpenRouter] Models catalog is ${hoursOld.toFixed(1)} hours old`);
    return hoursOld >= 24;
  }
  
  /**
   * Get model recommendations for task types
   */
  async getModelRecommendations(taskType: string): Promise<any[]> {
    const modelsCatalog = await this.client.searchBreadcrumbs({
      tags: ['openrouter:models', 'models:catalog']
    });
    
    if (modelsCatalog.length === 0) {
      console.warn('[OpenRouter] No models catalog available for recommendations');
      return [];
    }
    
    const models = modelsCatalog[0].context.models;
    
    // Simple task-based recommendations
    const recommendations = {
      'analysis': (m: any) => m.id.includes('claude') ? 10 : (m.id.includes('gpt-4') ? 8 : 5),
      'coding': (m: any) => m.id.includes('gpt-4') ? 10 : (m.id.includes('claude') ? 8 : 5),
      'creative': (m: any) => m.id.includes('claude') ? 10 : 5,
      'simple': (m: any) => m.id.includes('mini') || m.id.includes('haiku') ? 10 : 5,
      'math': (m: any) => m.id.includes('gpt-4') ? 10 : 7
    };
    
    const scorer = recommendations[taskType] || recommendations['simple'];
    
    return models
      .map((model: any) => ({ ...model, score: scorer(model) }))
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 5); // Top 5 recommendations
  }
}
