import React from 'react';
import { TemplateContext } from '../../utils/TemplateEngine';
import { ActionRunner } from '../../services/ActionRunner';
import { renderNode } from './UIRenderer';

interface DataLoaderChildrenProps {
  childrenDef: any;
  context: TemplateContext;
  actionRunner: ActionRunner;
}

/**
 * Renders children with enhanced context from DataLoader
 */
export function DataLoaderChildren({ childrenDef, context, actionRunner }: DataLoaderChildrenProps) {
  console.log('🎁 DataLoaderChildren rendering with context:', Object.keys(context), context);
  return <>{renderNode(childrenDef, context, actionRunner)}</>;
}

