// Core types for RCRT Visual Builder

// RCRT Event types (from SSE)
export interface BreadcrumbEvent {
  type: 'created' | 'updated' | 'deleted' | 'ping';
  breadcrumb_id?: string;
  version?: number;
  timestamp: string;
  data?: any;
}

// Node execution context
export interface NodeContext {
  breadcrumb_id: string;
  config: Record<string, any>;
  rcrtClient: any; // Will be RcrtClientEnhanced
  workspace: string;
}

// Node execution result
export interface NodeExecutionResult {
  outputs: Record<string, any>;
  breadcrumbs?: Array<{
    schema: string;
    title: string;
    context: any;
    tags?: string[];
  }>;
  metadata?: Record<string, any>;
}

// Agent runtime state
export interface AgentState {
  agent_id: string;
  status: 'idle' | 'processing' | 'error' | 'stopped';
  current_event?: BreadcrumbEvent;
  memory?: Record<string, any>;
  metrics: {
    events_processed: number;
    errors: number;
    last_activity: Date;
  };
}

// Flow execution context
export interface FlowExecutionContext {
  flow_id: string;
  execution_id: string;
  trigger: BreadcrumbEvent;
  state: Record<string, any>;
  node_outputs: Map<string, any>;
}

// Tenant configuration
export interface TenantConfig {
  id: string;
  name: string;
  quotas?: {
    max_breadcrumbs?: number;
    max_agents?: number;
    max_flows?: number;
    max_storage_gb?: number;
  };
  settings?: {
    default_model?: string;
    timezone?: string;
    features?: string[];
  };
}

// ACL permission set
export interface ACLPermissions {
  breadcrumb_id: string;
  grantee_agent_id?: string;
  actions: ('read' | 'write' | 'delete' | 'grant')[];
  created_at: string;
}

// DLQ item
export interface DLQItem {
  id: string;
  agent_id: string;
  url: string;
  payload: any;
  last_error: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

// Secret scope
export enum SecretScope {
  WORKSPACE = 'workspace',
  TENANT = 'tenant',
  GLOBAL = 'global',
}

// Node category
export enum NodeCategory {
  LLM = 'llm',
  AGENT = 'agent',
  BREADCRUMB = 'breadcrumb',
  UTILITY = 'utility',
  SEARCH = 'search',
  DATABASE = 'database',
  SECURITY = 'security',
  OBSERVABILITY = 'observability',
}

// Connection transform types
export interface ConnectionTransform {
  type: string;
  params?: Record<string, any>;
}

// Viewport state
export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

// Canvas node (UI representation)
export interface CanvasNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    config: Record<string, any>;
    ports: {
      inputs: Array<{ id: string; label: string; type: string }>;
      outputs: Array<{ id: string; label: string; type: string }>;
    };
  };
  selected?: boolean;
  dragging?: boolean;
}

// Canvas edge (connection)
export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  type?: string;
  animated?: boolean;
  data?: any;
}
