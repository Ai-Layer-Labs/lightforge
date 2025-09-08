/**
 * Transformer Node
 * Transform data between different formats
 */

import { BaseNode, RegisterNode, NodeExecutionResult } from '@rcrt-builder/node-sdk';

@RegisterNode({
  schema_name: "node.template.v1",
  title: "Data Transformer Node",
  tags: ["node:template", "utility", "transformer"],
  context: {
    node_type: "TransformerNode",
    category: "utility",
    icon: "🔄",
    color: "#52525b",
    description: "Transform data between formats"
  }
})
export class TransformerNode extends BaseNode {
  getMetadata() {
    return {
      type: 'TransformerNode',
      category: 'utility',
      icon: '🔄',
      inputs: [
        { id: 'input', type: 'data', description: 'Data to transform' },
        { id: 'transform_type', type: 'data', optional: true },
        { id: 'options', type: 'data', optional: true }
      ],
      outputs: [
        { id: 'output', type: 'data', description: 'Transformed data' },
        { id: 'metadata', type: 'data' }
      ]
    };
  }
  
  validateConfig(config: any): boolean {
    const validTransforms = [
      'json_to_text', 'text_to_json', 'breadcrumb_to_messages',
      'messages_to_breadcrumb', 'filter', 'map', 'reduce',
      'flatten', 'group_by', 'sort', 'extract_field'
    ];
    return !config.transform_type || validTransforms.includes(config.transform_type);
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const { input, transform_type, options } = inputs;
    
    const transformType = transform_type || this.context.config.transform_type || 'json_to_text';
    const transformOptions = { ...this.context.config.options, ...options };
    
    try {
      let output: any;
      let metadata: any = {
        transform_type: transformType,
        input_type: typeof input,
        timestamp: new Date().toISOString()
      };
      
      switch (transformType) {
        case 'json_to_text':
          output = JSON.stringify(input, null, transformOptions.indent || 2);
          metadata.output_type = 'string';
          break;
          
        case 'text_to_json':
          output = JSON.parse(input);
          metadata.output_type = 'object';
          break;
          
        case 'breadcrumb_to_messages':
          output = this.breadcrumbToMessages(input, transformOptions);
          metadata.output_type = 'array';
          break;
          
        case 'messages_to_breadcrumb':
          output = this.messagesToBreadcrumb(input, transformOptions);
          metadata.output_type = 'object';
          break;
          
        case 'filter':
          output = this.filterData(input, transformOptions);
          metadata.filtered_count = Array.isArray(input) ? input.length - output.length : 0;
          break;
          
        case 'map':
          output = this.mapData(input, transformOptions);
          metadata.mapped_count = Array.isArray(output) ? output.length : 0;
          break;
          
        case 'reduce':
          output = this.reduceData(input, transformOptions);
          metadata.reduced_from = Array.isArray(input) ? input.length : 0;
          break;
          
        case 'flatten':
          output = this.flattenData(input, transformOptions);
          metadata.depth = transformOptions.depth || 'all';
          break;
          
        case 'group_by':
          output = this.groupByField(input, transformOptions);
          metadata.groups = Object.keys(output).length;
          break;
          
        case 'sort':
          output = this.sortData(input, transformOptions);
          metadata.sort_field = transformOptions.field;
          metadata.sort_order = transformOptions.order || 'asc';
          break;
          
        case 'extract_field':
          output = this.extractField(input, transformOptions);
          metadata.extracted_field = transformOptions.field;
          break;
          
        default:
          throw new Error(`Unknown transform type: ${transformType}`);
      }
      
      return {
        outputs: {
          output,
          metadata
        }
      };
    } catch (error: any) {
      return {
        outputs: {
          output: null,
          metadata: {
            error: error.message,
            transform_type: transformType,
            timestamp: new Date().toISOString()
          }
        }
      };
    }
  }
  
  private breadcrumbToMessages(breadcrumb: any, options: any): any[] {
    const messages = [];
    
    if (options.include_system) {
      messages.push({
        role: 'system',
        content: `Processing breadcrumb: ${breadcrumb.title} (${breadcrumb.schema_name})`
      });
    }
    
    messages.push({
      role: 'user',
      content: JSON.stringify(breadcrumb.context, null, 2)
    });
    
    return messages;
  }
  
  private messagesToBreadcrumb(messages: any[], options: any): any {
    return {
      schema_name: options.schema_name || 'conversation.v1',
      title: options.title || 'Conversation',
      tags: options.tags || ['conversation'],
      context: {
        messages,
        message_count: messages.length,
        created_at: new Date().toISOString()
      }
    };
  }
  
  private filterData(data: any, options: any): any {
    if (!Array.isArray(data)) return data;
    
    if (options.condition) {
      // Use Function constructor for safe evaluation
      const conditionFn = new Function('item', `return ${options.condition}`);
      return data.filter(conditionFn);
    }
    
    if (options.field && options.value !== undefined) {
      return data.filter(item => item[options.field] === options.value);
    }
    
    return data;
  }
  
  private mapData(data: any, options: any): any {
    if (!Array.isArray(data)) return data;
    
    if (options.expression) {
      const mapFn = new Function('item', `return ${options.expression}`);
      return data.map(mapFn);
    }
    
    if (options.field) {
      return data.map(item => item[options.field]);
    }
    
    return data;
  }
  
  private reduceData(data: any, options: any): any {
    if (!Array.isArray(data)) return data;
    
    if (options.operation === 'sum' && options.field) {
      return data.reduce((sum, item) => sum + (item[options.field] || 0), 0);
    }
    
    if (options.operation === 'count') {
      return data.length;
    }
    
    if (options.operation === 'concat' && options.field) {
      return data.map(item => item[options.field]).join(options.separator || ', ');
    }
    
    return data;
  }
  
  private flattenData(data: any, options: any): any {
    const depth = options.depth || 1;
    
    if (Array.isArray(data)) {
      return depth === 'all' 
        ? data.flat(Infinity)
        : data.flat(depth);
    }
    
    // Flatten object
    const flattened: any = {};
    const flatten = (obj: any, prefix = '') => {
      for (const key in obj) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          if (depth === 'all' || depth > 1) {
            flatten(obj[key], newKey);
          } else {
            flattened[newKey] = obj[key];
          }
        } else {
          flattened[newKey] = obj[key];
        }
      }
    };
    flatten(data);
    return flattened;
  }
  
  private groupByField(data: any, options: any): any {
    if (!Array.isArray(data) || !options.field) return data;
    
    return data.reduce((groups, item) => {
      const key = item[options.field];
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {});
  }
  
  private sortData(data: any, options: any): any {
    if (!Array.isArray(data)) return data;
    
    const field = options.field;
    const order = options.order || 'asc';
    
    return [...data].sort((a, b) => {
      const aVal = field ? a[field] : a;
      const bVal = field ? b[field] : b;
      
      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }
  
  private extractField(data: any, options: any): any {
    if (!options.field) return data;
    
    const fields = options.field.split('.');
    let result = data;
    
    for (const field of fields) {
      if (result === null || result === undefined) break;
      result = result[field];
    }
    
    return result;
  }
}
