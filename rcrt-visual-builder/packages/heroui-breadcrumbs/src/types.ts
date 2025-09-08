/**
 * Type definitions for HeroUI breadcrumb components
 */

export interface UIComponentBreadcrumb {
  schema_name: 'ui.component.v1' | 'ui.instance.v1';
  title: string;
  tags: string[];
  context: {
    component_type: string;
    props: ComponentProps;
    bindings?: Record<string, ComponentBinding>;
    position?: { x: number; y: number };
    parent_flow?: string;
  };
}

export interface ComponentProps {
  [key: string]: any;
}

export interface ComponentBinding {
  action: 'emit_breadcrumb' | 'update_state' | 'call_function';
  payload?: any;
  target?: string;
}

export interface ComponentEvent {
  type: string;
  breadcrumb_id: string;
  component_id: string;
  event_name: string;
  payload?: any;
}
