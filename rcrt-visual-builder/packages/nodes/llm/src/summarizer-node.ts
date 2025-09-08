/**
 * Summarizer LLM Node
 * Summarizes input content in various formats
 */

import { RegisterNode, NodeMetadata, NodeExecutionResult } from '@rcrt-builder/node-sdk';
import { LLMNode } from './base-llm-node';

@RegisterNode({
  schema_name: 'node.template.v1',
  title: 'Summarizer LLM Node',
  tags: ['node:template', 'llm', 'summarizer'],
  context: {
    node_type: 'SummarizerLLMNode',
    category: 'llm',
    icon: '📄',
    color: '#17c964',
  },
})
export class SummarizerLLMNode extends LLMNode {
  getMetadata(): NodeMetadata {
    const base = super.getMetadata();
    return {
      ...base,
      type: 'SummarizerLLMNode',
      icon: '📄',
      color: '#17c964',
      description: 'Summarizes content in various formats',
    };
  }
  
  validateConfig(config: any): boolean {
    if (!super.validateConfig(config)) {
      return false;
    }
    
    // Validate summary type if provided
    if (config.summary_type) {
      const validTypes = ['brief', 'detailed', 'bullet_points', 'key_insights', 'executive', 'technical'];
      if (!validTypes.includes(config.summary_type)) {
        return false;
      }
    }
    
    // Validate max length if provided
    if (config.max_length !== undefined) {
      if (typeof config.max_length !== 'number' || config.max_length <= 0) {
        return false;
      }
    }
    
    return true;
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    // Prepare summarization prompt
    const summaryType = this.context.config.summary_type || 'brief';
    const maxLength = this.context.config.max_length || 500;
    const language = this.context.config.language || 'English';
    
    // Build system prompt for summarization
    let systemPrompt = this.buildSummaryPrompt(summaryType, maxLength, language);
    
    // Override system prompt
    const originalPrompt = this.context.config.system_prompt;
    this.context.config.system_prompt = this.context.config.system_prompt_template
      ? this.context.config.system_prompt_template
          .replace('{summary_type}', summaryType)
          .replace('{max_length}', maxLength.toString())
          .replace('{language}', language)
      : systemPrompt;
    
    // Execute base LLM
    const result = await super.execute(inputs);
    
    // Restore original prompt
    this.context.config.system_prompt = originalPrompt;
    
    // Add summary metadata
    if (result.outputs.response) {
      const content = result.outputs.response.content;
      
      result.outputs.response.metadata = {
        ...result.outputs.response.metadata,
        summary: {
          type: summaryType,
          max_length: maxLength,
          actual_length: content.length,
          language,
          word_count: content.split(/\s+/).length,
        },
      };
      
      // Format the summary if needed
      result.outputs.response.content = this.formatSummary(content, summaryType);
    }
    
    return result;
  }
  
  private buildSummaryPrompt(type: string, maxLength: number, language: string): string {
    const basePrompt = `You are a professional summarizer. Provide a ${type} summary in ${language}.`;
    
    switch (type) {
      case 'brief':
        return `${basePrompt} Keep it concise, under ${maxLength} characters. Focus on the main points only.`;
        
      case 'detailed':
        return `${basePrompt} Provide a comprehensive summary up to ${maxLength} characters, including important details and context.`;
        
      case 'bullet_points':
        return `${basePrompt} Format as bullet points (use • symbol). Each point should be concise. Maximum ${maxLength} characters total.`;
        
      case 'key_insights':
        return `${basePrompt} Extract and list the key insights and takeaways. Format as numbered list. Maximum ${maxLength} characters.`;
        
      case 'executive':
        return `${basePrompt} Create an executive summary suitable for business leaders. Focus on impact and actionable items. Maximum ${maxLength} characters.`;
        
      case 'technical':
        return `${basePrompt} Create a technical summary with important specifications, methods, and findings. Maximum ${maxLength} characters.`;
        
      default:
        return `${basePrompt} Maximum ${maxLength} characters.`;
    }
  }
  
  private formatSummary(content: string, type: string): string {
    // Clean up the summary
    let formatted = content.trim();
    
    // Ensure proper formatting for specific types
    switch (type) {
      case 'bullet_points':
        // Ensure each line starts with a bullet if not already
        if (!formatted.includes('•')) {
          formatted = formatted
            .split('\n')
            .filter(line => line.trim())
            .map(line => line.startsWith('-') ? line.replace('-', '•') : `• ${line}`)
            .join('\n');
        }
        break;
        
      case 'key_insights':
        // Ensure numbered list format
        if (!formatted.match(/^\d+\./m)) {
          const lines = formatted.split('\n').filter(line => line.trim());
          formatted = lines.map((line, i) => `${i + 1}. ${line.replace(/^[-•]\s*/, '')}`).join('\n');
        }
        break;
    }
    
    // Truncate if exceeds max length
    const maxLength = this.context.config.max_length || 500;
    if (formatted.length > maxLength) {
      formatted = formatted.substring(0, maxLength - 3) + '...';
    }
    
    return formatted;
  }
}
