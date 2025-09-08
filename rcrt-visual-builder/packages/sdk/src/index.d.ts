/**
 * RCRT SDK for Visual Builder
 * Full-featured SDK with all CRUD operations and SSE support
 */
import { BreadcrumbEvent } from '@rcrt-builder/core';
export interface BreadcrumbContext {
    [key: string]: any;
}
export interface Breadcrumb {
    id: string;
    title: string;
    context: BreadcrumbContext;
    tags: string[];
    schema_name?: string;
    visibility?: 'public' | 'team' | 'private';
    sensitivity?: 'low' | 'pii' | 'secret';
    version: number;
    created_at: string;
    updated_at: string;
    created_by?: string;
    updated_by?: string;
    checksum?: string;
    ttl?: string;
    size_bytes?: number;
}
export interface BreadcrumbCreate {
    title: string;
    context: BreadcrumbContext;
    tags: string[];
    schema_name?: string;
    visibility?: 'public' | 'team' | 'private';
    sensitivity?: 'low' | 'pii' | 'secret';
    ttl?: string;
}
export interface BreadcrumbUpdate {
    context?: Partial<BreadcrumbContext>;
    tags?: string[];
    title?: string;
    visibility?: 'public' | 'team' | 'private';
    sensitivity?: 'low' | 'pii' | 'secret';
    ttl?: string;
}
export interface Selector {
    any_tags?: string[];
    all_tags?: string[];
    schema_name?: string;
    owner_id?: string;
    sensitivity_in?: string[];
    visibility_in?: string[];
    context_match?: ContextMatch[];
}
export interface ContextMatch {
    path: string;
    op: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'contains_any';
    value: any;
}
export interface SearchParams {
    tag?: string;
    tags?: string[];
    schema_name?: string;
    owner_id?: string;
    updated_since?: string;
    q?: string;
    nn?: number;
    query_embedding?: number[];
}
export interface VectorSearchParams {
    q?: string;
    qvec?: number[];
    nn?: number;
    threshold?: number;
    filters?: SearchParams;
}
export interface Agent {
    id: string;
    roles: ('emitter' | 'subscriber' | 'curator')[];
    created_at: string;
}
export interface Tenant {
    id: string;
    name: string;
    created_at: string;
}
export interface ACL {
    id: string;
    breadcrumb_id: string;
    grantee_agent_id: string | null;
    actions: string[];
    created_at: string;
}
export interface DLQItem {
    id: string;
    agent_id: string;
    url: string;
    payload: any;
    last_error: string;
    created_at: string;
}
export interface Secret {
    id: string;
    name: string;
    value?: string;
    created_at: string;
}
export declare enum SecretScope {
    WORKSPACE = "workspace",
    TENANT = "tenant",
    GLOBAL = "global"
}
/**
 * Enhanced RCRT Client with full feature support
 */
export declare class RcrtClientEnhanced {
    private baseUrl;
    private defaultHeaders;
    private eventSource?;
    constructor(baseUrl?: string, authMode?: 'disabled' | 'jwt' | 'key', authToken?: string);
    createBreadcrumb(body: BreadcrumbCreate, idempotencyKey?: string): Promise<{
        id: string;
    }>;
    getBreadcrumb(id: string, view?: 'context' | 'full'): Promise<Breadcrumb>;
    getBreadcrumbFull(id: string): Promise<Breadcrumb>;
    updateBreadcrumb(id: string, version: number, updates: BreadcrumbUpdate): Promise<Breadcrumb>;
    deleteBreadcrumb(id: string, version?: number): Promise<void>;
    getBreadcrumbHistory(id: string): Promise<any[]>;
    searchBreadcrumbs(params: SearchParams | Selector): Promise<Breadcrumb[]>;
    vectorSearch(params: VectorSearchParams): Promise<Breadcrumb[]>;
    listAgents(): Promise<Agent[]>;
    getAgent(agentId: string): Promise<Agent>;
    createOrUpdateAgent(agentId: string, roles: string[]): Promise<{
        ok: boolean;
    }>;
    deleteAgent(agentId: string): Promise<{
        ok: boolean;
    }>;
    listTenants(): Promise<Tenant[]>;
    getTenant(tenantId: string): Promise<Tenant>;
    createOrUpdateTenant(tenantId: string, name: string): Promise<{
        ok: boolean;
    }>;
    deleteTenant(tenantId: string): Promise<{
        ok: boolean;
    }>;
    listAcls(): Promise<ACL[]>;
    listDlq(): Promise<DLQItem[]>;
    deleteDlqItem(dlqId: string): Promise<{
        ok: boolean;
    }>;
    retryDlqItem(dlqId: string): Promise<{
        requeued: boolean;
    }>;
    createSecret(name: string, value: string, scope?: SecretScope): Promise<{
        id: string;
    }>;
    getSecret(secretId: string): Promise<{
        value: string;
    }>;
    listSecrets(scope?: SecretScope): Promise<Secret[]>;
    updateSecret(secretId: string, value: string): Promise<{
        ok: boolean;
    }>;
    deleteSecret(secretId: string): Promise<{
        ok: boolean;
    }>;
    getSecretsFromVault(vaultIdOrTag: string, reason: string): Promise<Record<string, string>>;
    startEventStream(onEvent: (event: BreadcrumbEvent) => void, options?: {
        reconnectDelay?: number;
        filters?: Selector;
        agentId?: string;
    }): () => void;
    batchCreate(breadcrumbs: BreadcrumbCreate[]): Promise<{
        id: string;
    }[]>;
    batchGet(ids: string[], view?: 'context' | 'full'): Promise<Breadcrumb[]>;
    getWorkspaceBreadcrumbs(workspaceTag: string): Promise<Breadcrumb[]>;
    getAgentDefinitions(workspaceTag?: string): Promise<Breadcrumb[]>;
    getFlowDefinitions(workspaceTag?: string): Promise<Breadcrumb[]>;
}
//# sourceMappingURL=index.d.ts.map