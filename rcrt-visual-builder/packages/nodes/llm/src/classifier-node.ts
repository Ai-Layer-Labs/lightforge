/**
 * Classifier LLM Node
 * Classifies input into predefined categories
 */

import { RegisterNode, NodeMetadata, NodeExecutionResult } from '@rcrt-builder/node-sdk';
import { LLMNode } from './base-llm-node';

@RegisterNode({
  schema_name: 'node.template.v1',
  title: 'Classifier LLM Node',
  tags: ['node:template', 'llm', 'classifier'],
  context: {
    node_type: 'ClassifierLLMNode',
    category: 'llm',
    icon: '🏷️',
    color: '#f5a524',
  },
})
export class ClassifierLLMNode extends LLMNode {
  getMetadata(): NodeMetadata {
    const base = super.getMetadata();
    return {
      ...base,
      type: 'ClassifierLLMNode',
      icon: '🏷️',
      color: '#f5a524',
      description: 'Classifies input into predefined categories',
    };
  }
  
  validateConfig(config: any): boolean {
    if (!super.validateConfig(config)) {
      return false;
    }
    
    // Categories are required
    if (!config.categories || !Array.isArray(config.categories) || config.categories.length === 0) {
      return false;
    }
    
    return true;
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    // Prepare classification prompt
    const categories = this.context.config.categories;
    const outputFormat = this.context.config.output_format || 'single_label';
    
    // Build system prompt for classification
    let systemPrompt = `You are a classification system. Classify the input into one of these categories: ${categories.join(', ')}.`;
    
    switch (outputFormat) {
      case 'single_label':
        systemPrompt += ' Return only the category name, nothing else.';
        break;
      case 'multi_label':
        systemPrompt += ' Return a comma-separated list of applicable categories.';
        break;
      case 'confidence_scores':
        systemPrompt += ' Return a JSON object with categories as keys and confidence scores (0-1) as values.';
        break;
    }
    
    // Override system prompt
    const originalPrompt = this.context.config.system_prompt;
    this.context.config.system_prompt = this.context.config.system_prompt_template
      ? this.context.config.system_prompt_template.replace('{categories}', categories.join(', '))
      : systemPrompt;
    
    // Execute base LLM
    const result = await super.execute(inputs);
    
    // Restore original prompt
    this.context.config.system_prompt = originalPrompt;
    
    // Parse classification result
    if (result.outputs.response) {
      const content = result.outputs.response.content;
      
      // Add classification metadata
      result.outputs.response.metadata = {
        ...result.outputs.response.metadata,
        classification: {
          categories,
          output_format: outputFormat,
          result: this.parseClassification(content, outputFormat),
        },
      };
    }
    
    return result;
  }
  
  private parseClassification(content: string, format: string): any {
    const cleaned = content.trim();
    
    switch (format) {
      case 'single_label':
        return cleaned;
        
      case 'multi_label':
        return cleaned.split(',').map(s => s.trim());
        
      case 'confidence_scores':
        try {
          return JSON.parse(cleaned);
        } catch {
          // Fallback to simple parsing
          const scores: Record<string, number> = {};
          for (const category of this.context.config.categories) {
            scores[category] = cleaned.toLowerCase().includes(category.toLowerCase()) ? 1 : 0;
          }
          return scores;
        }
        
      default:
        return cleaned;
    }
  }
}
