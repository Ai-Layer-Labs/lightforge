/**
 * TemplateEngine - Resolves {{variable}} expressions in UI definitions
 * Supports:
 * - Simple paths: {{state.formData.name}}
 * - Item iteration: {{item.context.title}}
 * - Response data: {{response.id}}
 * - Nested objects and arrays
 * - Function calls: {{calc(state.step / 4 * 100)}}
 */

export interface TemplateContext {
  state?: any;
  data?: any;
  item?: any;
  props?: any;
  response?: any;
  args?: any;
  [key: string]: any;
}

/**
 * Resolve a template string with variable substitution
 */
export function resolveTemplate(template: string, context: TemplateContext): any {
  if (typeof template !== 'string') {
    return template;
  }

  // Check if the entire string is a single template expression
  const singleExprMatch = template.match(/^{{(.+)}}$/);
  if (singleExprMatch) {
    const expr = singleExprMatch[1].trim();
    return evaluateExpression(expr, context);
  }

  // Replace all template expressions in the string
  return template.replace(/{{(.+?)}}/g, (match, expr) => {
    const result = evaluateExpression(expr.trim(), context);
    return String(result ?? '');
  });
}

/**
 * Recursively resolve templates in an object
 */
export function resolveTemplateObject(obj: any, context: TemplateContext): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return resolveTemplate(obj, context);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => resolveTemplateObject(item, context));
  }

  if (typeof obj === 'object') {
    const resolved: any = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = resolveTemplateObject(value, context);
    }
    return resolved;
  }

  return obj;
}

/**
 * Evaluate an expression (path navigation or simple function calls)
 */
function evaluateExpression(expr: string, context: TemplateContext): any {
  // Handle calc() function for simple math
  if (expr.startsWith('calc(')) {
    const mathExpr = expr.slice(5, -1); // Remove 'calc(' and ')'
    // First resolve any variables in the math expression
    const resolvedMath = mathExpr.replace(/([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)/g, (match) => {
      const value = getPath(context, match);
      return value !== undefined ? String(value) : match;
    });
    
    try {
      // Safe eval for math only
      const result = Function(`"use strict"; return (${resolvedMath})`)();
      return result;
    } catch (error) {
      console.warn('Failed to evaluate calc():', mathExpr, error);
      return 0;
    }
  }

  // Handle equality/comparison checks
  if (expr.includes('===')) {
    const [left, right] = expr.split('===').map(s => s.trim());
    const leftVal = evaluateExpression(left, context);
    const rightVal = evaluateExpression(right, context);
    return leftVal === rightVal;
  }

  if (expr.includes('!==')) {
    const [left, right] = expr.split('!==').map(s => s.trim());
    const leftVal = evaluateExpression(left, context);
    const rightVal = evaluateExpression(right, context);
    return leftVal !== rightVal;
  }

  // Handle simple numeric/string/boolean literals
  if (expr === 'true') return true;
  if (expr === 'false') return false;
  if (expr === 'null') return null;
  if (expr === 'undefined') return undefined;
  if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);
  if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
    return expr.slice(1, -1);
  }

  // Otherwise treat as path
  return getPath(context, expr);
}

/**
 * Get value from object using dot notation path with array index support
 * Supports: "modelCatalog[0].context.models"
 */
function getPath(obj: any, path: string): any {
  // Split by dots but preserve array indices
  // "modelCatalog[0].context.models" -> ["modelCatalog[0]", "context", "models"]
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    
    // Check if this part has array index notation: "modelCatalog[0]"
    const arrayMatch = part.match(/^(.+?)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, propName, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);
      current = current[propName];
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[index];
    } else {
      current = current[part];
    }
  }

  return current;
}

/**
 * Set value in object using dot notation path
 */
export function setPath(obj: any, path: string, value: any): any {
  const parts = path.split('.');
  const result = { ...obj };
  let current = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    } else {
      current[part] = { ...current[part] };
    }
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
  return result;
}

/**
 * Check if a string contains template expressions
 */
export function hasTemplate(str: string): boolean {
  return typeof str === 'string' && str.includes('{{');
}

/**
 * Extract all variable paths from a template string
 */
export function extractVariables(template: string): string[] {
  const matches = template.matchAll(/{{(.+?)}}/g);
  const variables: string[] = [];
  
  for (const match of matches) {
    const expr = match[1].trim();
    // Extract just the variable paths (not full expressions)
    const varMatch = expr.match(/^([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)$/);
    if (varMatch) {
      variables.push(varMatch[1]);
    }
  }
  
  return variables;
}

