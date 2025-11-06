/**
 * Type definitions for dynamic page layout system
 * Pages are defined as breadcrumbs with schema: page.layout.v1
 */

export interface PageLayout {
  schema_name: 'page.layout.v1';
  title: string;
  tags: string[];
  context: {
    layout: LayoutDefinition;
    theme?: {
      extends?: string;
      overrides?: Record<string, any>;
    };
    metadata?: {
      description?: string;
      author?: string;
      version?: string;
    };
  };
}

export interface LayoutDefinition {
  type: 'flex-column' | 'flex-row' | 'grid' | 'custom';
  sections: Section[];
  props?: {
    className?: string;
    style?: React.CSSProperties;
    gap?: number;
    padding?: number;
  };
}

export interface Section {
  id: string;
  type?: 'flex-column' | 'flex-row' | 'grid' | 'component';
  component?: string;
  props?: Record<string, any>;
  slots?: Slot[];
  columns?: number;
  className?: string;
  style?: React.CSSProperties;
}

export interface Slot {
  id?: string;
  breadcrumb_id?: string;
  breadcrumb_search?: BreadcrumbSearch;
  render_mode?: 'config_form' | 'display' | 'card' | 'custom';
  component?: string;
  props?: Record<string, any>;
  transform?: string; // JSONPath or function name to transform data
  className?: string;
}

export interface BreadcrumbSearch {
  schema_name?: string;
  tag?: string;
  any_tags?: string[];
  all_tags?: string[];
  limit?: number;
  sort?: 'created_at' | 'updated_at' | 'title';
  order?: 'asc' | 'desc';
}

export interface RenderedSection extends Section {
  content?: React.ReactNode;
}

export interface SlotData {
  breadcrumbs: any[];
  loading: boolean;
  error?: Error;
}

