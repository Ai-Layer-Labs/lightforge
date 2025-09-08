/**
 * Context Injector Node
 * Fetches and injects breadcrumb context into messages
 */

import { BaseNode, RegisterNode, NodeExecutionResult } from '@rcrt-builder/node-sdk';
import { Selector, LLMMessage } from '@rcrt-builder/core';

@RegisterNode({
  schema_name: "node.template.v1",
  title: "Context Injector Node",
  tags: ["node:template", "utility", "context"],
  context: {
    node_type: "ContextInjectorNode",
    category: "utility",
    icon: "📎",
    color: "#52525b",
    description: "Inject breadcrumb context into LLM messages"
  }
})
export class ContextInjectorNode extends BaseNode {
  getMetadata() {
    return {
      type: 'ContextInjectorNode',
      category: 'utility',
      icon: '📎',
      inputs: [
        { id: 'messages', type: 'messages', schema: 'llm.messages.v1' },
        { id: 'selectors', type: 'data', schema: 'selectors.array.v1' },
        { id: 'max_context', type: 'data', optional: true }
      ],
      outputs: [
        { id: 'enriched_messages', type: 'messages', schema: 'llm.messages.v1' },
        { id: 'context_metadata', type: 'data' }
      ]
    };
  }
  
  validateConfig(config: any): boolean {
    return true;
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const { messages, selectors, max_context } = inputs;
    
    if (!messages || !Array.isArray(messages)) {
      return {
        outputs: {
          enriched_messages: [],
          context_metadata: { error: 'Invalid messages input' }
        }
      };
    }
    
    // Fetch breadcrumbs based on selectors
    const contextBreadcrumbs = [];
    const selectorsArray = selectors || this.context.config.default_selectors || [];
    
    for (const selector of selectorsArray) {
      try {
        const breadcrumbs = await this.searchWorkspace(selector);
        contextBreadcrumbs.push(...breadcrumbs);
      } catch (error) {
        console.error('Failed to fetch context:', error);
      }
    }
    
    // Limit context size
    const maxContextSize = max_context || this.context.config.max_context_size || 10;
    const limitedContext = contextBreadcrumbs.slice(0, maxContextSize);
    
    // Format context for injection
    const contextString = this.formatContext(limitedContext);
    
    // Build enriched messages
    const enrichedMessages: LLMMessage[] = [];
    
    // Add context as system message if not already present
    const hasSystemMessage = messages.some((m: LLMMessage) => m.role === 'system');
    
    if (contextString) {
      if (hasSystemMessage) {
        // Prepend to existing system message
        enrichedMessages.push({
          role: 'system',
          content: `Context from breadcrumbs:\n${contextString}\n\n${messages[0].content}`
        });
        enrichedMessages.push(...messages.slice(1));
      } else {
        // Add new system message with context
        enrichedMessages.push({
          role: 'system',
          content: `Context from breadcrumbs:\n${contextString}`
        });
        enrichedMessages.push(...messages);
      }
    } else {
      enrichedMessages.push(...messages);
    }
    
    return {
      outputs: {
        enriched_messages: enrichedMessages,
        context_metadata: {
          breadcrumbs_fetched: contextBreadcrumbs.length,
          breadcrumbs_used: limitedContext.length,
          context_size_bytes: new TextEncoder().encode(contextString).length,
          selectors_used: selectorsArray.length,
          timestamp: new Date().toISOString()
        }
      }
    };
  }
  
  private formatContext(breadcrumbs: any[]): string {
    if (breadcrumbs.length === 0) return '';
    
    const formatting = this.context.config.formatting || 'json';
    
    switch (formatting) {
      case 'json':
        return JSON.stringify(breadcrumbs.map(b => ({
          id: b.id,
          title: b.title,
          schema: b.schema_name,
          context: b.context
        })), null, 2);
        
      case 'markdown':
        return breadcrumbs.map(b => 
          `### ${b.title}\n- ID: ${b.id}\n- Schema: ${b.schema_name}\n- Context: ${JSON.stringify(b.context, null, 2)}`
        ).join('\n\n');
        
      case 'summary':
        return breadcrumbs.map(b => 
          `- ${b.title} (${b.schema_name}): ${this.summarizeContext(b.context)}`
        ).join('\n');
        
      default:
        return JSON.stringify(breadcrumbs);
    }
  }
  
  private summarizeContext(context: any): string {
    // Create a brief summary of the context
    const keys = Object.keys(context);
    if (keys.length === 0) return 'empty';
    if (keys.length <= 3) return keys.join(', ');
    return `${keys.slice(0, 3).join(', ')}... (${keys.length} fields)`;
  }
}
