export interface BreadcrumbEvent {
    type: 'created' | 'updated' | 'deleted' | 'ping';
    breadcrumb_id?: string;
    version?: number;
    timestamp: string;
    data?: any;
}
export interface NodeContext {
    breadcrumb_id: string;
    config: Record<string, any>;
    rcrtClient: any;
    workspace: string;
}
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
export interface FlowExecutionContext {
    flow_id: string;
    execution_id: string;
    trigger: BreadcrumbEvent;
    state: Record<string, any>;
    node_outputs: Map<string, any>;
}
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
export interface ACLPermissions {
    breadcrumb_id: string;
    grantee_agent_id?: string;
    actions: ('read' | 'write' | 'delete' | 'grant')[];
    created_at: string;
}
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
export declare enum SecretScope {
    WORKSPACE = "workspace",
    TENANT = "tenant",
    GLOBAL = "global"
}
export declare enum NodeCategory {
    LLM = "llm",
    AGENT = "agent",
    BREADCRUMB = "breadcrumb",
    UTILITY = "utility",
    SEARCH = "search",
    DATABASE = "database",
    SECURITY = "security",
    OBSERVABILITY = "observability"
}
export interface ConnectionTransform {
    type: string;
    params?: Record<string, any>;
}
export interface ViewportState {
    x: number;
    y: number;
    zoom: number;
}
export interface CanvasNode {
    id: string;
    type: string;
    position: {
        x: number;
        y: number;
    };
    data: {
        label: string;
        config: Record<string, any>;
        ports: {
            inputs: Array<{
                id: string;
                label: string;
                type: string;
            }>;
            outputs: Array<{
                id: string;
                label: string;
                type: string;
            }>;
        };
    };
    selected?: boolean;
    dragging?: boolean;
}
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
//# sourceMappingURL=index.d.ts.map