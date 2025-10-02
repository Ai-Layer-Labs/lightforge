/**
 * Tool Prompt Adapter
 * Transforms tool catalog breadcrumbs into LLM-friendly prompts
 */

export interface ToolInfo {
  name: string;
  description: string;
  category?: string;
  inputSchema?: any;
  outputSchema?: any;
  capabilities?: {
    async?: boolean;
    timeout?: number;
    retries?: number;
  };
}

export interface ToolCatalogBreadcrumb {
  schema_name: 'tool.catalog.v1';
  context: {
    tools: ToolInfo[];
    activeTools?: number;
    totalTools?: number;
    lastUpdated?: string;
    workspace?: string;
  };
}

export class ToolPromptAdapter {
  /**
   * Generate a concise tool prompt for the LLM
   */
  static generateToolPrompt(toolCatalog: ToolCatalogBreadcrumb): string {
    const tools = toolCatalog.context.tools || [];
    
    if (tools.length === 0) {
      return 'No tools are currently available.';
    }
    
    // Group tools by category
    const toolsByCategory = tools.reduce((acc, tool) => {
      const category = tool.category || 'general';
      if (!acc[category]) acc[category] = [];
      acc[category].push(tool);
      return acc;
    }, {} as Record<string, ToolInfo[]>);
    
    // Generate tool descriptions WITH EXAMPLES
    let prompt = `You have access to ${tools.length} tools:\n\n`;
    
    for (const [category, categoryTools] of Object.entries(toolsByCategory)) {
      prompt += `**${category.charAt(0).toUpperCase() + category.slice(1)} Tools:**\n\n`;
      
      for (const tool of categoryTools) {
        prompt += `• **${tool.name}**: ${tool.description}\n`;
        
        // Include output schema fields
        if (tool.outputSchema?.properties) {
          const outputFields = Object.keys(tool.outputSchema.properties);
          prompt += `  Output fields: ${outputFields.join(', ')}\n`;
        }
        
        // Include EXAMPLES (CRITICAL!)
        if ((tool as any).examples && Array.isArray((tool as any).examples)) {
          const examples = (tool as any).examples;
          if (examples.length > 0) {
            const firstExample = examples[0];
            prompt += `  Example:\n`;
            prompt += `    Input: ${JSON.stringify(firstExample.input)}\n`;
            prompt += `    Output: ${JSON.stringify(firstExample.output)}\n`;
            if (firstExample.explanation) {
              prompt += `    → ${firstExample.explanation}\n`;
            }
          }
        }
        
        prompt += '\n';
      }
    }
    
    // Add usage instructions
    prompt += `To use a tool, include tool_requests in your response:
{
  "tool_requests": [
    {
      "schema_name": "tool.request.v1",
      "tool": "tool-name",
      "input": { /* tool-specific parameters */ },
      "requestId": "unique-request-id"
    }
  ]
}

IMPORTANT: Study the examples above! They show you the exact output structure and how to access fields.`;
    
    return prompt;
  }
  
  /**
   * Generate OpenAI function calling format for tools
   */
  static generateToolSchemas(tools: ToolInfo[]): any[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema || {
          type: 'object',
          properties: {},
          required: []
        }
      }
    }));
  }
  
  /**
   * Extract only essential tool info for token efficiency
   */
  static generateMinimalToolList(tools: ToolInfo[]): string {
    return tools.map(t => `${t.name} (${t.category || 'general'})`).join(', ');
  }
  
  /**
   * Generate detailed documentation for a specific tool
   */
  static generateToolDocumentation(tool: ToolInfo): string {
    let doc = `Tool: ${tool.name}\n`;
    doc += `Category: ${tool.category || 'general'}\n`;
    doc += `Description: ${tool.description}\n`;
    
    if (tool.inputSchema) {
      doc += `\nInput Parameters:\n`;
      doc += this.schemaToReadableFormat(tool.inputSchema);
    }
    
    if (tool.outputSchema) {
      doc += `\nOutput Format:\n`;
      doc += this.schemaToReadableFormat(tool.outputSchema);
    }
    
    if (tool.capabilities) {
      doc += `\nCapabilities:\n`;
      if (tool.capabilities.async) doc += `- Asynchronous execution\n`;
      if (tool.capabilities.timeout) doc += `- Timeout: ${tool.capabilities.timeout}ms\n`;
      if (tool.capabilities.retries) doc += `- Retries: ${tool.capabilities.retries}\n`;
    }
    
    return doc;
  }
  
  /**
   * Convert JSON Schema to readable format
   */
  private static schemaToReadableFormat(schema: any, indent = ''): string {
    if (!schema || typeof schema !== 'object') return '';
    
    let result = '';
    
    if (schema.type === 'object' && schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties as any)) {
        const required = schema.required?.includes(key) ? ' (required)' : '';
        const description = prop.description ? ` - ${prop.description}` : '';
        result += `${indent}- ${key}: ${prop.type}${required}${description}\n`;
        
        if (prop.type === 'object' && prop.properties) {
          result += this.schemaToReadableFormat(prop, indent + '  ');
        } else if (prop.type === 'array' && prop.items) {
          result += `${indent}  Items: ${prop.items.type}\n`;
        } else if (prop.enum) {
          result += `${indent}  Options: ${prop.enum.join(', ')}\n`;
        }
      }
    }
    
    return result;
  }
  
  /**
   * Filter tools based on context or user intent
   */
  static filterRelevantTools(
    tools: ToolInfo[], 
    context: { message?: string; tags?: string[] }
  ): ToolInfo[] {
    // This could be enhanced with more sophisticated filtering
    const keywords = context.message?.toLowerCase() || '';
    
    if (keywords.includes('file') || keywords.includes('store') || keywords.includes('save')) {
      return tools.filter(t => t.category === 'storage' || t.name.includes('file'));
    }
    
    if (keywords.includes('calculate') || keywords.includes('math')) {
      return tools.filter(t => t.category === 'math' || t.name.includes('calc'));
    }
    
    if (keywords.includes('search') || keywords.includes('web')) {
      return tools.filter(t => t.category === 'web' || t.name.includes('search'));
    }
    
    // Return all tools if no specific filtering applies
    return tools;
  }
}
