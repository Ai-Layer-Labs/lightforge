/**
 * Selector matching utilities for dynamic connection discovery
 * Implements the same logic as RCRT core for matching breadcrumbs to selectors
 */

import { Breadcrumb, SelectorSubscription } from '../types/rcrt';

export interface Selector {
  any_tags?: string[];
  all_tags?: string[];
  schema_name?: string;
  context_match?: Array<{
    path: string;
    op: 'eq' | 'contains_any' | 'gt' | 'lt';
    value: any;
  }>;
}

/**
 * Check if a breadcrumb matches a selector
 */
export function matchesSelector(breadcrumb: Breadcrumb, selector: Selector): boolean {
  // Schema name matching
  if (selector.schema_name && breadcrumb.schema_name !== selector.schema_name) {
    return false;
  }
  
  // Any tags matching (breadcrumb must have at least one of these tags)
  if (selector.any_tags && selector.any_tags.length > 0) {
    const hasAnyTag = selector.any_tags.some(tag => 
      breadcrumb.tags?.includes(tag)
    );
    if (!hasAnyTag) {
      return false;
    }
  }
  
  // All tags matching (breadcrumb must have all of these tags)
  if (selector.all_tags && selector.all_tags.length > 0) {
    const hasAllTags = selector.all_tags.every(tag => 
      breadcrumb.tags?.includes(tag)
    );
    if (!hasAllTags) {
      return false;
    }
  }
  
  // Context matching
  if (selector.context_match && selector.context_match.length > 0) {
    const contextMatches = selector.context_match.every(match => 
      matchesContextRule(breadcrumb.context, match)
    );
    if (!contextMatches) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if a context matches a specific context rule
 */
function matchesContextRule(
  context: Record<string, any>, 
  rule: { path: string; op: string; value: any }
): boolean {
  const contextValue = getValueByPath(context, rule.path);
  
  switch (rule.op) {
    case 'eq':
      return contextValue === rule.value;
      
    case 'contains_any':
      if (Array.isArray(contextValue) && Array.isArray(rule.value)) {
        return rule.value.some(val => contextValue.includes(val));
      }
      return false;
      
    case 'gt':
      return typeof contextValue === 'number' && 
             typeof rule.value === 'number' && 
             contextValue > rule.value;
             
    case 'lt':
      return typeof contextValue === 'number' && 
             typeof rule.value === 'number' && 
             contextValue < rule.value;
             
    default:
      console.warn(`Unknown context match operator: ${rule.op}`);
      return false;
  }
}

/**
 * Get value from object by JSONPath-like string
 * Simplified version - supports basic dot notation and array access
 */
function getValueByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  
  // Handle JSONPath prefix
  if (path.startsWith('$.')) {
    path = path.substring(2);
  }
  
  // Split path and traverse
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current == null) return undefined;
    
    // Handle array access like "items[*]" or "items[0]"
    if (part.includes('[')) {
      const [arrayName, indexPart] = part.split('[');
      const index = indexPart.replace(']', '');
      
      current = current[arrayName];
      if (!Array.isArray(current)) return undefined;
      
      // Handle wildcard [*] - return array for contains_any matching
      if (index === '*') {
        return current;
      }
      
      // Handle specific index
      const indexNum = parseInt(index, 10);
      if (isNaN(indexNum)) return undefined;
      
      current = current[indexNum];
    } else {
      current = current[part];
    }
  }
  
  return current;
}

/**
 * Find all breadcrumbs that match a selector
 */
export function findMatchingBreadcrumbs(
  breadcrumbs: Breadcrumb[], 
  selector: Selector
): Breadcrumb[] {
  return breadcrumbs.filter(breadcrumb => matchesSelector(breadcrumb, selector));
}

/**
 * Check if a breadcrumb would be emitted by an agent based on emission rules
 */
export function matchesEmissionRules(
  breadcrumb: Breadcrumb,
  emits: { tags?: string[]; schemas?: string[] },
  agentId: string
): boolean {
  // Must be created by this agent
  if (breadcrumb.created_by !== agentId) {
    return false;
  }
  
  // Check schema matching
  if (emits.schemas && emits.schemas.length > 0) {
    if (breadcrumb.schema_name && emits.schemas.includes(breadcrumb.schema_name)) {
      return true;
    }
  }
  
  // Check tag matching
  if (emits.tags && emits.tags.length > 0) {
    const hasEmittedTag = emits.tags.some(tag => 
      breadcrumb.tags?.includes(tag)
    );
    if (hasEmittedTag) {
      return true;
    }
  }
  
  return false;
}
