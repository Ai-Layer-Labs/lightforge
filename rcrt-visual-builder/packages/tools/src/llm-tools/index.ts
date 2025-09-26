/**
 * LLM Tools - Direct LLM access as tools in RCRT
 * Agents = Data + Subscriptions, Tools = Code
 */

export { SimpleLLMTool } from './base.js';
export { OpenRouterTool } from './openrouter.js';
export { OllamaTool } from './ollama.js';
export { OpenRouterModelsCatalog } from './models-catalog.js';

// Available LLM tools for registration
export const llmTools = {
  openrouter: () => new OpenRouterTool(),
  ollama_local: () => new OllamaTool()
};

// Model selection helper for supervisor agents
export class SimpleLLMChooser {
  constructor(
    private client: any,
    private workspace: string
  ) {}
  
  /**
   * Choose between OpenRouter (paid, high quality) or Ollama (free, local)
   * Simple decision logic based on task complexity and budget
   */
  chooseLLMForTask(task: { type: string, complexity: string, budget?: number }): string {
    // Simple decision logic
    if (task.complexity === 'high' && (task.budget || 5) > 0.50) {
      return 'openrouter'; // Use paid models for complex tasks
    } else {
      return 'ollama_local'; // Use free local models for simple tasks
    }
  }
  
  /**
   * Get specific OpenRouter model based on task type
   * Uses real model data from catalog when available
   */
  async getModelForOpenRouter(taskType: string, budget?: number): Promise<string> {
    try {
      // Try to get recommendations from real model catalog
      const modelsCatalog = await this.client.searchBreadcrumbs({
        tag: 'openrouter:models'
      });
      
      if (modelsCatalog.length > 0) {
        const models = modelsCatalog[0].context.models;
        
        // Filter by budget if specified
        let suitableModels = models;
        if (budget) {
          suitableModels = models.filter((model: any) => {
            const avgCost = (parseFloat(model.pricing.prompt) + parseFloat(model.pricing.completion)) * 1000;
            return avgCost <= budget;
          });
        }
        
        // Choose based on task type preferences
        const preferences = {
          'analysis': (m: any) => m.id.includes('claude') ? 10 : (m.id.includes('gpt-4') ? 8 : 5),
          'coding': (m: any) => m.id.includes('gpt-4') ? 10 : (m.id.includes('claude') ? 8 : 5),
          'creative': (m: any) => m.id.includes('claude') ? 10 : 5,
          'simple': (m: any) => m.id.includes('mini') || m.id.includes('haiku') ? 10 : 5,
          'math': (m: any) => m.id.includes('gpt-4') ? 10 : 7
        };
        
        const scorer = preferences[taskType] || preferences['simple'];
        const bestModel = suitableModels
          .map((model: any) => ({ ...model, score: scorer(model) }))
          .sort((a: any, b: any) => b.score - a.score)[0];
        
        if (bestModel) {
          console.log(`[LLM Chooser] Selected ${bestModel.id} for ${taskType} (score: ${bestModel.score})`);
          return bestModel.id;
        }
      }
      
      // Fallback to hardcoded recommendations
      console.warn('[LLM Chooser] Using fallback model selection - catalog not available');
      return this.getFallbackModel(taskType);
      
    } catch (error) {
      console.warn('[LLM Chooser] Error accessing model catalog:', error);
      return this.getFallbackModel(taskType);
    }
  }
  
  /**
   * Fallback model selection if catalog unavailable
   */
  private getFallbackModel(taskType: string): string {
    const fallbackModels = {
      'analysis': 'google/gemini-2.5-flash',    // Best for reasoning  
      'coding': 'openai/gpt-4o-mini',               // Good for code, cheaper
      'creative': 'google/gemini-2.5-flash',   // Best for creativity
      'simple': 'openai/gpt-4o-mini',              // Cost-effective
      'math': 'openai/gpt-4o-mini'                 // Good for math
    };
    
    return fallbackModels[taskType] || 'openai/gpt-4o-mini';
  }
  
  /**
   * Get Ollama model recommendation
   */
  getModelForOllama(taskType: string): string {
    const ollamaModels = {
      'analysis': 'llama3.1:8b',       // Good balance of speed and quality
      'coding': 'codellama:7b',        // Specialized for code
      'creative': 'llama3.1:8b',       // General purpose
      'simple': 'llama3.1:8b',         // Fast and capable
      'math': 'llama3.1:8b'            // General math capability
    };
    
    return ollamaModels[taskType] || 'llama3.1:8b';
  }
}
