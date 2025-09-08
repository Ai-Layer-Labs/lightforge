/**
 * RCRT SDK for Visual Builder
 * Full-featured SDK with all CRUD operations and SSE support
 */

import EventSource from 'eventsource';
import { BreadcrumbEvent } from '@rcrt-builder/core';

// Enhanced type definitions
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

export enum SecretScope {
  WORKSPACE = 'workspace',
  TENANT = 'tenant',
  GLOBAL = 'global',
}

/**
 * Enhanced RCRT Client with full feature support
 */
export class RcrtClientEnhanced {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private eventSource?: EventSource;

  constructor(
    baseUrl: string = 'http://localhost:8081',
    authMode: 'disabled' | 'jwt' | 'key' = 'disabled',
    authToken?: string
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };

    if (authMode === 'jwt' && authToken) {
      this.defaultHeaders['Authorization'] = `Bearer ${authToken}`;
    } else if (authMode === 'key' && authToken) {
      this.defaultHeaders['X-API-Key'] = authToken;
    }
  }

  // Simple token setter for JWT/key after construction
  setToken(token: string | null | undefined, mode: 'jwt' | 'key' = 'jwt'): void {
    if (!token) {
      delete this.defaultHeaders['Authorization'];
      delete this.defaultHeaders['authorization' as any];
      delete this.defaultHeaders['X-API-Key'];
      return;
    }
    if (mode === 'jwt') {
      this.defaultHeaders['Authorization'] = `Bearer ${token}`;
    } else {
      this.defaultHeaders['X-API-Key'] = token;
    }
  }

  // ============ Breadcrumb Operations ============

  async createBreadcrumb(body: BreadcrumbCreate, idempotencyKey?: string): Promise<{ id: string }> {
    const headers = { ...this.defaultHeaders };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const response = await fetch(`${this.baseUrl}/breadcrumbs`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create breadcrumb: ${error}`);
    }

    return response.json();
  }

  async getBreadcrumb(id: string): Promise<Breadcrumb> {
    const response = await fetch(`${this.baseUrl}/breadcrumbs/${id}`, {
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get breadcrumb: ${error}`);
    }

    return response.json();
  }

  async getBreadcrumbFull(id: string): Promise<Breadcrumb> {
    const response = await fetch(`${this.baseUrl}/breadcrumbs/${id}/full`, {
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get full breadcrumb: ${error}`);
    }

    return response.json();
  }

  async updateBreadcrumb(id: string, version: number, updates: BreadcrumbUpdate): Promise<Breadcrumb> {
    const response = await fetch(`${this.baseUrl}/breadcrumbs/${id}`, {
      method: 'PATCH',
      headers: {
        ...this.defaultHeaders,
        'If-Match': version.toString(),
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update breadcrumb: ${error}`);
    }

    // Fetch fresh context view to avoid requiring read_full ACL
    return this.getBreadcrumb(id);
  }

  async deleteBreadcrumb(id: string, version?: number): Promise<void> {
    const headers = { ...this.defaultHeaders };
    if (version !== undefined) {
      headers['If-Match'] = version.toString();
    }

    const response = await fetch(`${this.baseUrl}/breadcrumbs/${id}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete breadcrumb: ${error}`);
    }
  }

  async getBreadcrumbHistory(id: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/breadcrumbs/${id}/history`, {
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get breadcrumb history: ${error}`);
    }

    return response.json();
  }

  // ============ Search Operations ============

  async searchBreadcrumbs(params: SearchParams | Selector): Promise<Breadcrumb[]> {
    // Map selector → simple tag filter only (API supports only 'tag')
    const queryParams = new URLSearchParams();
    const isSelector = (p: any): p is Selector => 'any_tags' in p || 'all_tags' in p;

    if (isSelector(params)) {
      const tagFromAny = params.any_tags?.find(t => typeof t === 'string');
      const tagFromAll = params.all_tags?.find(t => typeof t === 'string');
      const tag = tagFromAny || tagFromAll;
      if (tag) queryParams.set('tag', tag);
    } else {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, String(v)));
          } else {
            queryParams.append(key, String(value));
          }
        }
      });
    }

    const response = await fetch(`${this.baseUrl}/breadcrumbs?${queryParams}`, {
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to search breadcrumbs: ${error}`);
    }

    return response.json();
  }

  async vectorSearch(params: VectorSearchParams): Promise<Breadcrumb[]> {
    const qp = new URLSearchParams();
    if (params.q) qp.set('q', params.q);
    if (params.qvec) qp.set('qvec', JSON.stringify(params.qvec));
    if (typeof params.nn === 'number') qp.set('nn', String(params.nn));
    if (params.filters?.tag) qp.set('tag', params.filters.tag);

    const response = await fetch(`${this.baseUrl}/breadcrumbs/search?${qp.toString()}`, {
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to perform vector search: ${error}`);
    }

    return response.json();
  }

  // ============ Agent CRUD Operations ============

  async listAgents(): Promise<Agent[]> {
    const response = await fetch(`${this.baseUrl}/agents`, {
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list agents: ${error}`);
    }

    return response.json();
  }

  async getAgent(agentId: string): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/agents/${agentId}`, {
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get agent: ${error}`);
    }

    return response.json();
  }

  async createOrUpdateAgent(agentId: string, roles: string[]): Promise<{ ok: boolean }> {
    const response = await fetch(`${this.baseUrl}/agents/${agentId}`, {
      method: 'POST',
      headers: this.defaultHeaders,
      body: JSON.stringify({ roles }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create/update agent: ${error}`);
    }

    return { ok: true };
  }

  async deleteAgent(agentId: string): Promise<{ ok: boolean }> {
    const response = await fetch(`${this.baseUrl}/agents/${agentId}`, {
      method: 'DELETE',
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete agent: ${error}`);
    }

    return { ok: true };
  }

  // ============ Tenant CRUD Operations ============

  async listTenants(): Promise<Tenant[]> {
    const response = await fetch(`${this.baseUrl}/tenants`, {
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list tenants: ${error}`);
    }

    return response.json();
  }

  async getTenant(tenantId: string): Promise<Tenant> {
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}`, {
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get tenant: ${error}`);
    }

    return response.json();
  }

  async createOrUpdateTenant(tenantId: string, name: string): Promise<{ ok: boolean }> {
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}`, {
      method: 'PUT',
      headers: this.defaultHeaders,
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create/update tenant: ${error}`);
    }

    return { ok: true };
  }

  async deleteTenant(tenantId: string): Promise<{ ok: boolean }> {
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}`, {
      method: 'DELETE',
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete tenant: ${error}`);
    }

    return { ok: true };
  }

  // ============ ACL Operations ============

  async listAcls(): Promise<ACL[]> {
    const response = await fetch(`${this.baseUrl}/acl`, {
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list ACLs: ${error}`);
    }

    return response.json();
  }

  // ============ DLQ Operations ============

  async listDlq(): Promise<DLQItem[]> {
    const response = await fetch(`${this.baseUrl}/dlq`, {
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list DLQ: ${error}`);
    }

    return response.json();
  }

  async deleteDlqItem(dlqId: string): Promise<{ ok: boolean }> {
    const response = await fetch(`${this.baseUrl}/dlq/${dlqId}`, {
      method: 'DELETE',
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete DLQ item: ${error}`);
    }

    return { ok: true };
  }

  async retryDlqItem(dlqId: string): Promise<{ requeued: boolean }> {
    const response = await fetch(`${this.baseUrl}/dlq/${dlqId}/retry`, {
      method: 'POST',
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to retry DLQ item: ${error}`);
    }

    return response.json();
  }

  // ============ Secrets Operations ============

  async createSecret(name: string, value: string, scope_type?: string, scope_id?: string): Promise<{ id: string }> {
    const response = await fetch(`${this.baseUrl}/secrets`, {
      method: 'POST',
      headers: this.defaultHeaders,
      body: JSON.stringify({ name, value, scope_type, scope_id }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create secret: ${error}`);
    }

    return response.json();
  }

  async getSecret(secretId: string, reason: string = 'SDK:getSecret'): Promise<{ value: string }> {
    const response = await fetch(`${this.baseUrl}/secrets/${secretId}/decrypt`, {
      method: 'POST',
      headers: this.defaultHeaders,
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to decrypt secret: ${error}`);
    }

    return response.json();
  }

  async listSecrets(scope_type?: string, scope_id?: string): Promise<Secret[]> {
    const qp = new URLSearchParams();
    if (scope_type) qp.set('scope_type', scope_type);
    if (scope_id) qp.set('scope_id', scope_id);
    const response = await fetch(`${this.baseUrl}/secrets${qp.toString() ? `?${qp.toString()}` : ''}`, {
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list secrets: ${error}`);
    }

    return response.json();
  }

  async updateSecret(secretId: string, value: string): Promise<{ ok: boolean }> {
    const response = await fetch(`${this.baseUrl}/secrets/${secretId}`, {
      method: 'PUT',
      headers: this.defaultHeaders,
      body: JSON.stringify({ value }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update secret: ${error}`);
    }

    return { ok: true };
  }

  async deleteSecret(secretId: string): Promise<{ ok: boolean }> {
    const response = await fetch(`${this.baseUrl}/secrets/${secretId}`, {
      method: 'DELETE',
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete secret: ${error}`);
    }

    return { ok: true };
  }

  async getSecretsFromVault(vaultIdOrTag: string, reason: string): Promise<Record<string, string>> {
    const response = await fetch(`${this.baseUrl}/secrets/vault/${vaultIdOrTag}`, {
      headers: {
        ...this.defaultHeaders,
        'X-Access-Reason': reason,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get secrets from vault: ${error}`);
    }

    return response.json();
  }

  // ============ SSE Subscriptions ============

  startEventStream(
    onEvent: (event: BreadcrumbEvent) => void,
    options?: {
      reconnectDelay?: number;
      filters?: Selector;
      agentId?: string;
      token?: string;
    }
  ): () => void {
    const reconnectDelay = options?.reconnectDelay || 5000;
    let shouldReconnect = true;

    const connect = () => {
      if (!shouldReconnect) return;
      // Build absolute URL and correct SSE path
      const isBrowser = typeof window !== 'undefined';
      const makeAbsolute = (base: string): string => {
        const trimmed = base.trim();
        if (/^https?:\/\//i.test(trimmed)) {
          return trimmed.replace(/\/$/, '');
        }
        if (!isBrowser) {
          // In SSR/Node, base must already be absolute
          return trimmed.replace(/\/$/, '');
        }
        const origin = window.location.origin;
        if (trimmed.startsWith('/')) {
          return `${origin}${trimmed}`.replace(/\/$/, '');
        }
        return `${origin}/${trimmed}`.replace(/\/$/, '');
      };
      const baseInput = (this.baseUrl && String(this.baseUrl).trim()) || '';
      const normalizedBase = makeAbsolute(baseInput || (isBrowser ? '/api/rcrt' : 'http://localhost:8081'));
      const url = new URL(`${normalizedBase}/events/stream`);
      if (options?.agentId) {
        url.searchParams.append('agent_id', options.agentId);
      }
      if (options?.filters) {
        url.searchParams.append('filters', JSON.stringify(options.filters));
      }
      // Pass token via query for browsers where headers can't be set on EventSource
      const explicitToken = options?.token;
      const authHeader = (this.defaultHeaders['Authorization'] || (this.defaultHeaders as any)['authorization']) as string | undefined;
      const tokenVal = explicitToken || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined);
      if (tokenVal) {
        url.searchParams.append('access_token', tokenVal);
      }

      // In browsers, native EventSource doesn't accept headers.
      const es: any = isBrowser
        ? new (window as any).EventSource(url.toString())
        : new (EventSource as any)(url.toString(), { headers: this.defaultHeaders });

      this.eventSource = es;

      es.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          onEvent(data);
        } catch (error) {
          console.error('Failed to parse SSE event:', error);
        }
      };

      es.onerror = (error: any) => {
        console.error('SSE connection error:', error);
        es.close();
        if (shouldReconnect) {
          setTimeout(connect, reconnectDelay);
        }
      };

      es.addEventListener('ping', () => {
        // Handle ping events to keep connection alive
      });
    };

    connect();

    // Return cleanup function
    return () => {
      shouldReconnect = false;
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = undefined;
      }
    };
  }

  // ============ Batch Operations ============

  async batchCreate(breadcrumbs: BreadcrumbCreate[]): Promise<{ id: string }[]> {
    const results = await Promise.all(
      breadcrumbs.map((b, i) => 
        this.createBreadcrumb(b, `batch-${Date.now()}-${i}`)
      )
    );
    return results;
  }

  async batchGet(
    ids: string[],
    view: 'context' | 'full' = 'context',
    concurrency: number = 16
  ): Promise<Breadcrumb[]> {
    const total = ids.length;
    const results: Breadcrumb[] = new Array(total) as any;
    let cursor = 0;
    const worker = async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= total) return;
        const id = ids[idx];
        const item = view === 'full' ? await this.getBreadcrumbFull(id) : await this.getBreadcrumb(id);
        results[idx] = item;
      }
    };
    const workers = Array.from({ length: Math.min(Math.max(1, concurrency), total) }, () => worker());
    await Promise.all(workers);
    return results;
  }

  // ============ Helper Methods ============

  async getWorkspaceBreadcrumbs(workspaceTag: string): Promise<Breadcrumb[]> {
    return this.searchBreadcrumbs({ tag: workspaceTag });
  }

  async getAgentDefinitions(workspaceTag?: string): Promise<Breadcrumb[]> {
    const params: SearchParams = { schema_name: 'agent.def.v1' };
    if (workspaceTag) {
      (params as any).tag = workspaceTag;
    }
    return this.searchBreadcrumbs(params);
  }

  async getFlowDefinitions(workspaceTag?: string): Promise<Breadcrumb[]> {
    const params: SearchParams = { schema_name: 'flow.definition.v1' };
    if (workspaceTag) {
      (params as any).tag = workspaceTag;
    }
    return this.searchBreadcrumbs(params);
  }

  // Apply a UI plan directly to the backend (assumes proxy/baseUrl handles auth)
  async applyPlan(plan: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/forge/apply`, {
      method: 'POST',
      headers: this.defaultHeaders,
      body: JSON.stringify(plan),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to apply plan: ${error}`);
    }
    return response.json();
  }
}

// Lightweight helper to create a client and optionally fetch a token from a tokenEndpoint
export async function createClient(options?: {
  baseUrl?: string;
  tokenEndpoint?: string; // e.g. '/api/auth/token'
  authMode?: 'disabled' | 'jwt' | 'key';
}): Promise<RcrtClientEnhanced> {
  const baseUrl = options?.baseUrl ?? '/api/rcrt';
  const mode = options?.authMode ?? 'jwt';
  let token: string | undefined;
  if (options?.tokenEndpoint) {
    try {
      const resp = await fetch(options.tokenEndpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
      const json = await resp.json().catch(() => ({}));
      if (json?.token) token = String(json.token);
    } catch {
      // ignore
    }
  }
  const client = new RcrtClientEnhanced(baseUrl, token ? mode : 'disabled', token);
  return client;
}
