/**
 * Component Renderer
 * Renders UI component breadcrumbs as React components
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UIComponentV1, UIInstanceV1 } from '@rcrt-builder/core';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { ComponentRegistry } from '../registry/ComponentRegistry';

interface ComponentRendererProps {
  breadcrumb: UIComponentV1 | UIInstanceV1;
  rcrtClient: RcrtClientEnhanced;
  workspace: string;
  onEvent?: (eventName: string, data: any) => void;
  className?: string;
  subscribeUpdates?: boolean;
  resolvePointer?: (tagString: string, preferredSchema?: string) => any;
}

export const ComponentRenderer: React.FC<ComponentRendererProps> = ({
  breadcrumb,
  rcrtClient,
  workspace,
  onEvent,
  className,
  subscribeUpdates = false,
  resolvePointer
}) => {
  const [componentState, setComponentState] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  
  // Determine if this is a component definition or instance (schema_name may be absent in full view)
  const hasTag = (t: string) => Array.isArray((breadcrumb as any).tags) && (breadcrumb as any).tags.includes(t);
  const isInstance = (breadcrumb as any).schema_name === 'ui.instance.v1' || hasTag('ui:instance');
  const componentType = isInstance 
    ? (breadcrumb as UIInstanceV1).context?.component_ref
    : (breadcrumb as UIComponentV1).context?.component_type;
  
  const rawProps = isInstance
    ? ((breadcrumb as UIInstanceV1).context?.props || {})
    : {};
  
  const bindings = isInstance
    ? ((breadcrumb as UIInstanceV1).context?.bindings || {})
    : {};
  
  // Get component from registry
  const Component = componentType ? ComponentRegistry.get(componentType) : undefined;
  
  if (!Component) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`Component type ${componentType} not found in registry`);
    }
    return <div>Unknown component: {componentType}</div>;
  }
  
  // Handle component events
  const handleEvent = useCallback(async (eventName: string, ...args: any[]) => {
    const binding = bindings[eventName];
    
    if (!binding) {
      // Call external event handler if provided
      onEvent?.(eventName, args[0]);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const toSerializableEventData = (value: any): any => {
        try {
          if (value === undefined) return undefined;
          const t = typeof value;
          if (t === 'string' || t === 'number' || t === 'boolean' || value === null) return value;
          // Common UI events carry a target/currentTarget with value
          const maybeVal = (value && (value.target?.value ?? value.currentTarget?.value));
          if (maybeVal !== undefined && (typeof maybeVal === 'string' || typeof maybeVal === 'number' || typeof maybeVal === 'boolean')) {
            return { value: maybeVal };
          }
          // If it's plain object/array and serializable, keep a shallow clone
          const shallow = Array.isArray(value) ? [...value] : { ...value };
          JSON.stringify(shallow);
          return shallow;
        } catch {
          // Fallback: omit non-serializable payloads (avoids circular structures)
          return undefined;
        }
      };
      switch (binding.action) {
        case 'emit_breadcrumb':
          // Create a breadcrumb based on the binding payload
          {
            const created = await rcrtClient.createBreadcrumb({
              ...binding.payload,
              tags: [...(binding.payload.tags || []), workspace],
              context: {
                ...binding.payload.context,
                triggered_by: (breadcrumb as any).id,
                event_name: eventName,
                event_data: toSerializableEventData(args[0]),
                timestamp: new Date().toISOString()
              }
            });
            if (process.env.NODE_ENV !== 'production') {
              console.log('[emit_breadcrumb] id:', created?.id, 'title:', binding?.payload?.title);
            }
          }
          break;
          
        case 'update_state':
          // Update component state
          setComponentState((prev: any) => ({
            ...prev,
            [binding.state_key]: args[0]
          }));
          break;
          
        case 'update_breadcrumb':
          // Update the breadcrumb itself
          const current = await rcrtClient.getBreadcrumb(breadcrumb.id);
          await rcrtClient.updateBreadcrumb(
            breadcrumb.id,
            current.version,
            {
              context: {
                ...current.context,
                props: {
                  ...current.context.props,
                  [binding.prop_key]: args[0]
                },
                last_updated: new Date().toISOString()
              }
            }
          );
          break;
          
        case 'call_api':
          // Call an external API
          const response = await fetch(binding.url, {
            method: binding.method || 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...binding.headers
            },
            body: JSON.stringify({
              ...binding.body,
              event_data: args[0]
            })
          });
          
          const result = await response.json();
          
          // Store result as breadcrumb
          await rcrtClient.createBreadcrumb({
            schema_name: 'api.response.v1',
            title: `API Response: ${binding.url}`,
            tags: ['api:response', workspace],
            context: {
              url: binding.url,
              status: response.status,
              data: result,
              triggered_by: breadcrumb.id
            }
          });
          break;
          
        case 'navigate':
          // Navigate to a different view/flow
          if (binding.flow_id) {
            onEvent?.('navigate', { flow_id: binding.flow_id });
          } else if (binding.url) {
            window.location.href = binding.url;
          }
          break;
          
        default:
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`Unknown binding action: ${binding.action}`);
          }
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`Error handling event ${eventName}:`, error);
      }
    } finally {
      setIsLoading(false);
    }
    
    // Call external handler
    onEvent?.(eventName, args[0]);
  }, [bindings, breadcrumb.id, rcrtClient, workspace, onEvent]);
  
  // Create event handlers for the component
  const eventHandlers = React.useMemo(() => {
    const handlers: Record<string, Function> = {};
    
    // Get event handlers from component schema
    const schema = isInstance
      ? null
      : (breadcrumb as UIComponentV1).context.event_handlers;
    
    const events = schema || Object.keys(bindings);
    
    events.forEach((event: string) => {
      handlers[event] = (...args: any[]) => handleEvent(event, ...args);
    });
    
    return handlers;
  }, [bindings, handleEvent, isInstance, breadcrumb]);
  
  // Subscribe to breadcrumb updates (disabled by default to avoid opening many SSE connections)
  useEffect(() => {
    if (!subscribeUpdates) return;
    const cleanup = rcrtClient.startEventStream(
      (event) => {
        if (event.breadcrumb_id === breadcrumb.id && (event.type === 'breadcrumb.created' || event.type === 'breadcrumb.updated')) {
          rcrtClient.getBreadcrumb(breadcrumb.id).then((updated) => {
            if (isInstance) {
              const newProps = (updated as UIInstanceV1).context.props;
              setComponentState({ ...componentState, ...newProps });
            }
          });
        }
      },
      {
        filters: { breadcrumb_id: breadcrumb.id }
      }
    );
    return cleanup;
  }, [breadcrumb.id, rcrtClient, isInstance, componentState, subscribeUpdates]);
  
  // Resolve pointers and merge props with state
  const resolvePointers = useCallback((inputProps: any): any => {
    const out: any = { ...inputProps };
    // Resolve ui.asset pointers (e.g., src_tag → src from asset)
    if (typeof out.src_tag === 'string' && typeof (resolvePointer as any) === 'function') {
      const asset = (resolvePointer as any)(out.src_tag, 'ui.asset.v1');
      if (asset && asset.context) {
        if (asset.context.url) out.src = asset.context.url;
        if (asset.context.alt && !out.alt) out.alt = asset.context.alt;
        if (typeof asset.context.width === 'number' && !out.width) out.width = asset.context.width;
        if (typeof asset.context.height === 'number' && !out.height) out.height = asset.context.height;
      }
    }
    // Resolve ui.state pointers (e.g., state_tag → value)
    if (typeof out.state_tag === 'string' && typeof (resolvePointer as any) === 'function') {
      const state = (resolvePointer as any)(out.state_tag, 'ui.state.v1');
      if (state && state.context && state.context.value !== undefined) {
        out.value = state.context.value;
        // Allow mapping key to prop
        if (typeof out.state_prop === 'string') {
          out[out.state_prop] = state.context.value;
        }
      }
    }
    return out;
  }, [resolvePointer]);

  const props = useMemo(() => resolvePointers(rawProps), [rawProps, resolvePointers]);

  const finalProps: any = useMemo(() => ({
    ...props,
    ...componentState,
    ...eventHandlers,
    className,
    'data-breadcrumb-id': (breadcrumb as any).id
  }), [props, componentState, eventHandlers, className, breadcrumb]);
  // Note: avoid passing internal flags like isLoading to UI components/dom
  // No default children fallbacks; render as-is to avoid hidden legacy behavior
  
  return <Component {...finalProps} />;
};
