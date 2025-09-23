/**
 * Context Transform Schemas
 * Defines how breadcrumbs can specify their LLM-optimized transformations
 */

export interface LLMHints {
  /**
   * Fields to include in the context view
   */
  include?: string[];
  
  /**
   * Fields to exclude from the context view
   */
  exclude?: string[];
  
  /**
   * Fields to summarize (arrays/objects become concise strings)
   */
  summarize?: string[];
  
  /**
   * Transform definitions for creating new fields
   */
  transform?: Record<string, TransformRule>;
  
  /**
   * How to apply transforms: 'merge' adds to original, 'replace' replaces context
   */
  mode?: 'merge' | 'replace';
}

export interface TransformRule {
  type: 'template' | 'extract' | 'literal' | 'jq' | 'jsonpath';
  
  // For template type
  template?: string;
  
  // For extract type
  value?: string;
  
  // For literal type
  literal?: any;
  
  // For jq type
  query?: string;
  
  // For jsonpath type
  path?: string;
}

export interface SchemaTransformV1 {
  schema_name: 'schema.transform.v1';
  title: string;
  tags: string[];
  context: {
    target_schema: string;
    description?: string;
    transform_rules: Array<{
      name: string;
      type: string;
      output?: Record<string, any>;
      template?: string;
      expression?: string;
    }>;
    default_rule?: string;
    selection_criteria?: Record<string, string>;
  };
}

export interface BreadcrumbWithHints {
  schema_name: string;
  title: string;
  tags: string[];
  context: any;
  
  /**
   * Optional hints for LLM-optimized context view
   */
  llm_hints?: LLMHints;
  
  /**
   * Optional inline transform for advanced use cases
   */
  context_transform?: {
    type: string;
    [key: string]: any;
  };
}

/**
 * Simple transform application (client-side example)
 */
export function applyLLMHints(context: any, hints: LLMHints): any {
  let result = hints.mode === 'replace' ? {} : { ...context };
  
  // Apply excludes
  if (hints.exclude) {
    hints.exclude.forEach(field => delete result[field]);
  }
  
  // Apply includes (if specified, only keep these)
  if (hints.include) {
    const included: any = {};
    hints.include.forEach(field => {
      if (field in context) {
        included[field] = context[field];
      }
    });
    result = hints.mode === 'replace' ? included : { ...result, ...included };
  }
  
  // Apply summarize
  if (hints.summarize) {
    hints.summarize.forEach(field => {
      if (field in result && Array.isArray(result[field])) {
        result[field] = `${result[field].length} items`;
      } else if (field in result && typeof result[field] === 'object') {
        result[field] = `[Complex object with ${Object.keys(result[field]).length} fields]`;
      }
    });
  }
  
  // Apply transforms
  if (hints.transform) {
    const transformed: any = {};
    
    for (const [key, rule] of Object.entries(hints.transform)) {
      switch (rule.type) {
        case 'literal':
          transformed[key] = rule.literal;
          break;
          
        case 'template':
          // Simple template replacement (real implementation would use handlebars)
          transformed[key] = rule.template?.replace(/\{\{(\w+)\}\}/g, (_, field) => 
            context[field] || ''
          );
          break;
          
        case 'extract':
          // Simple JSONPath (real implementation would use jsonpath library)
          if (rule.value?.startsWith('$.')) {
            const path = rule.value.substring(2).split('.');
            let value = context;
            for (const segment of path) {
              value = value?.[segment];
            }
            transformed[key] = value;
          }
          break;
      }
    }
    
    result = hints.mode === 'replace' ? transformed : { ...result, ...transformed };
  }
  
  return result;
}
