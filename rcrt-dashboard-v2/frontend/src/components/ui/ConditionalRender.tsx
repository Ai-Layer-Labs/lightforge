import React from 'react';
import { resolveTemplate, TemplateContext } from '../../utils/TemplateEngine';
import { ActionRunner } from '../../services/ActionRunner';

interface ConditionalRenderProps {
  condition: string; // Template expression like "{{state.currentStep === 1}}"
  render: any; // What to render if true
  else?: any; // Optional: what to render if false
  context: TemplateContext;
  actionRunner: ActionRunner;
  children?: React.ReactNode;
}

/**
 * ConditionalRender - Shows/hides content based on template condition
 * Note: This is a marker component. The actual rendering logic is in UIRenderer
 * to avoid circular dependencies.
 */
export function ConditionalRender({
  condition,
  render,
  else: elseRender,
  context,
  actionRunner,
  children,
}: ConditionalRenderProps) {
  // This component is just a placeholder
  // The real logic is handled in UIRenderer's renderComponent
  return <>{children}</>;
}

