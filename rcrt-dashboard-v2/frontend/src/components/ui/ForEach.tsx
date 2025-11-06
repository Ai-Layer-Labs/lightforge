import React from 'react';
import { resolveTemplate, TemplateContext } from '../../utils/TemplateEngine';
import { ActionRunner } from '../../services/ActionRunner';
import { ComponentDefinition } from './UIRenderer';

interface ForEachProps {
  source: string | any[]; // Template like "{{data.providers}}" or actual array
  render: ComponentDefinition; // Component definition to render for each item
  context: TemplateContext;
  actionRunner: ActionRunner;
  children?: React.ReactNode;
}

/**
 * ForEach - Iterate over array and render component for each item
 * Usage in breadcrumb:
 * {
 *   "ForEach": {
 *     "source": "{{data.providers}}",
 *     "render": {
 *       "Card": {
 *         "children": "{{item.name}}"
 *       }
 *     }
 *   }
 * }
 */
export function ForEach({
  source,
  render,
  context,
  actionRunner,
  children,
}: ForEachProps) {
  // Resolve source to get actual array
  let items: any[];
  
  if (typeof source === 'string') {
    const resolved = resolveTemplate(source, context);
    items = Array.isArray(resolved) ? resolved : [];
  } else if (Array.isArray(source)) {
    items = source;
  } else {
    items = [];
  }

  console.log('🔁 ForEach: rendering', items.length, 'items');

  if (items.length === 0) {
    return null;
  }

  // Render children with item context
  // Children should be pre-rendered with item context
  return <>{children}</>;
}

