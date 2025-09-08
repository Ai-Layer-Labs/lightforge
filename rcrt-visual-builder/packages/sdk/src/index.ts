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

  async getBreadcrumb(id: string, view: 'context' | 'full' = 'context'): Promise<Breadcrumb> {
    const response = await fetch(`${this.baseUrl}/breadcrumbs/${id}?view=${view}`, {
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get breadcrumb: ${error}`);
    }

    return response.json();
  }

  async getBreadcrumbFull(id: string): Promise<Breadcrumb> {
    return this.getBreadcrumb(id, 'full');
  }

  async updateBreadcrumb(id: string, version: number, updates: BreadcrumbUpdate): Promise<Breadcrumb> {
    const response = await fetch(`${this.baseUrl}/breadcrumbs/${id}`, {
      method: 'PUT',
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

    return response.json();
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
    const queryParams = new URLSearchParams();
    
    if ('any_tags' in params || 'all_tags' in params) {
      // It's a Selector
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to search breadcrumbs: ${error}`);
      }

      return response.json();
    } else {
      // It's SearchParams
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, String(v)));
          } else {
            queryParams.append(key, String(value));
          }
        }
      });

      const response = await fetch(`${this.baseUrl}/breadcrumbs?${queryParams}`, {
        headers: this.defaultHeaders,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to search breadcrumbs: ${error}`);
      }

      return response.json();
    }
  }

  async vectorSearch(params: VectorSearchParams): Promise<Breadcrumb[]> {
    const response = await fetch(`${this.baseUrl}/search/vector`, {
      method: 'POST',
      headers: this.defaultHeaders,
      body: JSON.stringify(params),
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
      method: 'PUT',
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
    const response = await fetch(`${this.baseUrl}/acls`, {
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

  async createSecret(name: string, value: string, scope?: SecretScope): Promise<{ id: string }> {
    const response = await fetch(`${this.baseUrl}/secrets`, {
      method: 'POST',
      headers: this.defaultHeaders,
      body: JSON.stringify({ name, value, scope }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create secret: ${error}`);
    }

    return response.json();
  }

  async getSecret(secretId: string): Promise<{ value: string }> {
    const response = await fetch(`${this.baseUrl}/secrets/${secretId}`, {
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get secret: ${error}`);
    }

    return response.json();
  }

  async listSecrets(scope?: SecretScope): Promise<Secret[]> {
    const params = scope ? `?scope=${scope}` : '';
    const response = await fetch(`${this.baseUrl}/secrets${params}`, {
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

      // In browsers, native EventSource doesn't accept headers.
      const es: any = isBrowser
        ? new (window as any).EventSource(url.toString())
        : new (EventSource as any)(url.toString(), { headers: this.defaultHeaders });

      this.eventSource = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onEvent(data);
        } catch (error) {
          console.error('Failed to parse SSE event:', error);
        }
      };

      es.onerror = (error) => {
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

  async batchGet(ids: string[], view: 'context' | 'full' = 'context'): Promise<Breadcrumb[]> {
    const results = await Promise.all(
      ids.map(id => this.getBreadcrumb(id, view))
    );
    return results;
  }

  // ============ Helper Methods ============

  async getWorkspaceBreadcrumbs(workspaceTag: string): Promise<Breadcrumb[]> {
    return this.searchBreadcrumbs({ tag: workspaceTag });
  }

  async getAgentDefinitions(workspaceTag?: string): Promise<Breadcrumb[]> {
    const params: SearchParams = { schema_name: 'agent.def.v1' };
    if (workspaceTag) {
      params.tag = workspaceTag;
    }
    return this.searchBreadcrumbs(params);
  }

  async getFlowDefinitions(workspaceTag?: string): Promise<Breadcrumb[]> {
    const params: SearchParams = { schema_name: 'flow.definition.v1' };
    if (workspaceTag) {
      params.tag = workspaceTag;
    }
    return this.searchBreadcrumbs(params);
  }
}
