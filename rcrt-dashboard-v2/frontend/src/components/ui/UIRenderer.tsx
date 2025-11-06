/**
 * UIRenderer - Renders HeroUI components from JSON definitions
 * Walks component tree and creates React elements dynamically
 */

import React from 'react';
import * as HeroUI from '@heroui/react';
import { resolveTemplateObject, TemplateContext } from '../../utils/TemplateEngine';
import { Action, ActionRunner } from '../../services/ActionRunner';
import { ConditionalRender } from './ConditionalRender';
import { ForEach } from './ForEach';
import { DataLoader } from './DataLoader';
import { DataLoaderWrapper } from './DataLoaderWrapper';
import { FormField } from './FormField';
import { ActionButton } from './ActionButton';

export interface ComponentDefinition {
  [componentName: string]: {
    className?: string;
    style?: React.CSSProperties;
    children?: ComponentDefinition[] | string | ComponentDefinition;
    [key: string]: any;
  };
}

interface UIRendererProps {
  definition: ComponentDefinition;
  context: TemplateContext;
  actionRunner: ActionRunner;
}

/**
 * Special components that need custom handling
 */
import { ToolConfigLoader } from './ToolConfigLoader';

const SPECIAL_COMPONENTS: Record<string, React.ComponentType<any>> = {
  ConditionalRender,
  ForEach,
  DataLoader,
  FormField,
  ActionButton,
  ToolConfigLoader,
};

/**
 * HTML elements that can be rendered directly
 */
const HTML_ELEMENTS = new Set([
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'button', 'input', 'textarea', 'select', 'option',
  'ul', 'ol', 'li', 'a', 'img', 'section', 'article',
  'header', 'footer', 'nav', 'main', 'aside'
]);

/**
 * Render a component definition to React elements
 */
export function UIRenderer({ definition, context, actionRunner }: UIRendererProps) {
  return <>{renderNode(definition, context, actionRunner)}</>;
}

/**
 * Recursively render a node in the component tree
 * Exported so DataLoaderWrapper can use it
 */
export function renderNode(
  node: ComponentDefinition | string | any,
  context: TemplateContext,
  actionRunner: ActionRunner,
  key?: string | number
): React.ReactNode {
  // Handle null/undefined
  if (node === null || node === undefined) {
    return null;
  }

  // Handle string children
  if (typeof node === 'string') {
    return resolveTemplateObject(node, context);
  }

  // Handle arrays
  if (Array.isArray(node)) {
    return node.map((child, index) => renderNode(child, context, actionRunner, index));
  }

  // Handle objects (component definitions)
  if (typeof node === 'object') {
    // Check for special for_each structure
    if ('for_each' in node && 'render_item' in node) {
      return renderForEach(node, context, actionRunner, key);
    }

    // Should be a single-key object where key is component name
    const componentName = Object.keys(node)[0];
    const props = node[componentName];

    if (!componentName) {
      console.warn('Invalid component definition:', node);
      return null;
    }

    return renderComponent(componentName, props, context, actionRunner, key);
  }

  return null;
}

/**
 * Render for_each iteration
 */
function renderForEach(
  node: { for_each: string; render_item: ComponentDefinition },
  context: TemplateContext,
  actionRunner: ActionRunner,
  key?: string | number
): React.ReactNode {
  console.log('🔁 for_each template:', node.for_each);
  console.log('🔁 Context keys:', Object.keys(context));
  console.log('🔁 Context.modelCatalog:', context.modelCatalog);
  
  // Resolve source array
  const source = resolveTemplateObject(node.for_each, context);
  console.log('🔁 Resolved source:', source, 'Type:', typeof source, 'IsArray:', Array.isArray(source));
  
  const items = Array.isArray(source) ? source : [];

  console.log('🔁 Rendering for_each:', items.length, 'items');

  return items.map((item, index) => {
    // Create item context
    const itemContext: TemplateContext = {
      ...context,
      item,
      index,
    };

    return renderNode(node.render_item, itemContext, actionRunner, index);
  });
}

/**
 * Render a specific component
 */
function renderComponent(
  componentName: string,
  props: any,
  context: TemplateContext,
  actionRunner: ActionRunner,
  key?: string | number
): React.ReactElement | null {
  // Removed verbose logging for performance
  
  // Separate event handlers and children from other props
  // DON'T resolve children as templates - they might contain for_each structures
  const { children, onPress, onClick, onChange, onValueChange, onSubmit, onFocus, onBlur, ...otherProps } = props;
  const eventHandlers = { onPress, onClick, onChange, onValueChange, onSubmit, onFocus, onBlur };
  
  // Resolve templates in non-event, non-children props only
  const resolvedProps = resolveTemplateObject(otherProps, context);

  // Process event handlers separately (don't resolve them as templates!)
  const processedHandlers = processEventHandlers(eventHandlers, context, actionRunner);
  
  // Merge everything together
  const processedProps = { ...resolvedProps, ...processedHandlers };

  // Handle ConditionalRender specially to avoid circular dependency
  if (componentName === 'ConditionalRender') {
    const conditionResult = resolveTemplateObject(props.condition, context);
    const shouldRender = Boolean(conditionResult);
    
    console.log('🔀 ConditionalRender:', props.condition, '→', shouldRender);
    
    if (shouldRender && props.render) {
      return renderNode(props.render, context, actionRunner, key);
    }
    
    if (!shouldRender && props.else) {
      return renderNode(props.else, context, actionRunner, key);
    }
    
    return null;
  }

  // Handle DataLoader specially to load data and pass to children
  if (componentName === 'DataLoader') {
    // Don't process children yet - pass them raw to DataLoaderWrapper
    return (
      <DataLoaderWrapper
        key={key}
        breadcrumb_search={props.breadcrumb_search}
        breadcrumb_id={props.breadcrumb_id}
        as={props.as || 'data'}
        context={context}
        actionRunner={actionRunner}
        childrenDef={children}
      />
    );
  }

  // Handle ToolConfigLoader specially (needs tool_id resolved)
  if (componentName === 'ToolConfigLoader') {
    console.log('🔧 ToolConfigLoader props:', props);
    console.log('🔧 Context.state:', context.state);
    console.log('🔧 Context.state.selectedProvider:', context.state?.selectedProvider);
    
    // Resolve tool_id template before passing to component
    const toolId = resolveTemplateObject(props.tool_id, context);
    console.log('🔧 Resolved tool_id:', props.tool_id, '→', toolId);
    console.log('🔧 Is still a template?', typeof toolId === 'string' && toolId.includes('{{'));
    
    const onSave = props.on_save;
    const onCancel = props.on_cancel;
    
    return (
      <ToolConfigLoader
        key={key}
        tool_id={toolId}
        initial_config={props.initial_config}
        on_save={onSave}
        on_cancel={onCancel}
        context={context}
        actionRunner={actionRunner}
      />
    );
  }

  // Check for other special components
  if (SPECIAL_COMPONENTS[componentName]) {
    const Component = SPECIAL_COMPONENTS[componentName];
    return (
      <Component
        key={key}
        {...processedProps}
        context={context}
        actionRunner={actionRunner}
      >
        {children && renderNode(children, context, actionRunner)}
      </Component>
    );
  }

  // Check for HeroUI components FIRST (before HTML elements!)
  const HeroUIComponent = (HeroUI as any)[componentName];
  
  if (HeroUIComponent) {
    return (
      <HeroUIComponent key={key} {...processedProps}>
        {children && renderNode(children, context, actionRunner)}
      </HeroUIComponent>
    );
  }

  // Check for HTML elements (lowercase only to avoid conflicts)
  if (HTML_ELEMENTS.has(componentName.toLowerCase()) && componentName === componentName.toLowerCase()) {
    const element = componentName.toLowerCase();
    return React.createElement(
      element,
      { key, ...processedProps },
      children && renderNode(children, context, actionRunner)
    );
  }

  // Unknown component
  console.warn('❌ Unknown component:', componentName, 'Available HeroUI:', Object.keys(HeroUI).slice(0, 10));
  return (
    <div key={key} className="text-red-400 text-xs p-2 border border-red-500/20 rounded">
      Unknown component: {componentName}
    </div>
  );
}

/**
 * Process event handlers in props
 * Converts action definitions to actual event handler functions
 */
function processEventHandlers(
  handlers: any,
  context: TemplateContext,
  actionRunner: ActionRunner
): any {
  const processed: any = {};

  for (const [handlerName, handlerDef] of Object.entries(handlers)) {
    if (!handlerDef) continue; // Skip undefined handlers
    
    // Skip if already a function (shouldn't happen but be safe)
    if (typeof handlerDef === 'function') {
      processed[handlerName] = handlerDef;
      continue;
    }
    
    // Resolve args templates NOW (with current render context including item)
      const resolvedArgs = typeof handlerDef === 'object' && (handlerDef as any).args
        ? resolveTemplateObject((handlerDef as any).args, context)
        : {};
      
      // Create event handler function
      processed[handlerName] = async (valueOrEvent?: any) => {
        // Removed verbose logging for performance
        
        // HeroUI components pass value directly for onValueChange/onChange
        // Regular events have preventDefault
        const isValueHandler = handlerName === 'onValueChange' || handlerName === 'onChange';
        const event = isValueHandler ? null : valueOrEvent;
        const value = isValueHandler ? valueOrEvent : null;
        
        // Prevent default form submission if applicable
        if (event?.preventDefault && (handlerName === 'onSubmit' || handlerName === 'onPress')) {
          event.preventDefault();
        }

        // Create execution context with pre-resolved args + runtime value
        const execContext: TemplateContext = {
          ...context,
          event,
          args: {
            ...resolvedArgs, // Args resolved at render time with item context
            value, // Runtime value from HeroUI
          },
        };

        try {
          // Can be either:
          // 1. String - named action reference: "selectProvider"
          // 2. Object - action definition: { action: "setState", ... }
          await actionRunner.execute(handlerDef as any, execContext);
        } catch (error) {
          console.error(`Error executing ${handlerName}:`, error);
        }
      };
  }

  return processed;
}

/**
 * Hook to use UIRenderer with automatic context management
 */
export function useUIRenderer(actionRunner: ActionRunner, state?: any, data?: any) {
  const render = React.useCallback(
    (definition: ComponentDefinition) => {
      const context: TemplateContext = {
        state,
        data,
      };
      return <UIRenderer definition={definition} context={context} actionRunner={actionRunner} />;
    },
    [actionRunner, state, data]
  );

  return render;
}

