/**
 * Enhanced RCRT TypeScript SDK for Visual Builder
 * Extends the basic SDK with full feature support needed for agent builder
 */

// Re-export basic types from existing SDK
export * from './index';
import { RcrtClient as BasicClient, BreadcrumbCreate } from './index';

// EventSource for Node.js (polyfill)
import EventSource from 'eventsource';

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

export interface BreadcrumbFull extends Breadcrumb {
  owner_id: string;
  history?: BreadcrumbHistory[];
  subscribers?: Subscription[];
  policy?: any;
}

export interface BreadcrumbHistory {
  version: number;
  context: BreadcrumbContext;
  updated_at: string;
  updated_by: string;
  checksum: string;
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

export interface Subscription {
  id: string;
  owner_id: string;
  breadcrumb_id?: string;
  agent_id: string;
  channels: {
    bus?: boolean;
    webhook?: boolean;
    sse?: boolean;
  };
  created_at: string;
}

export interface BreadcrumbEvent {
  type: 'breadcrumb.created' | 'breadcrumb.updated' | 'breadcrumb.deleted' | 'ping';
  breadcrumb_id?: string;  // Optional for ping events
  version?: number;  // Optional for ping events
  tags?: string[];
  schema_name?: string;
  updated_at?: string;  // Optional for ping events
  context?: BreadcrumbContext;
}

export interface SearchParams {
  tag?: string;
  tags?: string[];
  schema_name?: string;
  owner_id?: string;
  updated_since?: string;
  q?: string;  // Text search
  nn?: number; // Nearest neighbors count
  query_embedding?: number[]; // Vector search
}

export interface VectorSearchParams {
  q?: string;  // Auto-embed query
  qvec?: number[]; // Direct vector
  nn?: number; // Number of results
  threshold?: number; // Similarity threshold
  filters?: SearchParams;
}

export interface ACLGrant {
  breadcrumb_id: string;
  grantee_agent_id?: string;
  grantee_owner_id?: string;
  actions: ('read_context' | 'read_full' | 'update' | 'delete' | 'subscribe')[];
}

export interface Agent {
  id: string;
  owner_id: string;
  agent_key?: string;
  roles: ('emitter' | 'subscriber' | 'curator')[];
  webhook_secret?: string;
  created_at: string;
}

export interface WebhookConfig {
  url: string;
  secret?: string;
  headers?: Record<string, string>;
  retry_policy?: {
    max_attempts?: number;
    backoff_ms?: number;
  };
}

export interface DLQItem {
  id: string;
  breadcrumb_id: string;
  webhook_url: string;
  attempt_count: number;
  last_error: string;
  created_at: string;
  next_retry_at?: string;
}

// Enhanced client with full feature support (using composition)
export class RcrtClientEnhanced {
  private basicClient: BasicClient;
  private eventSource?: EventSource;
  private subscriptions: Map<string, (event: BreadcrumbEvent) => void> = new Map();
  private baseUrl: string;
  private token?: string;
  
  constructor(baseUrl: string, token?: string) {
    this.basicClient = new BasicClient(baseUrl, token);
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }
  
  // Delegate basic methods to basicClient
  health() { return this.basicClient.health(); }
  createBreadcrumb(body: BreadcrumbCreate, idempotencyKey?: string) { 
    return this.basicClient.createBreadcrumb(body, idempotencyKey); 
  }
  getBreadcrumb(id: string) { return this.basicClient.getBreadcrumb(id); }
  getBreadcrumbFull(id: string) { return this.basicClient.getBreadcrumbFull(id); }
  listBreadcrumbs(params?: { tag?: string }) { return this.basicClient.listBreadcrumbs(params); }
  createSelector(any_tags?: string[], all_tags?: string[], schema_name?: string) {
    return this.basicClient.createSelector(any_tags, all_tags, schema_name);
  }
  registerWebhook(agentId: string, url: string) {
    return this.basicClient.registerWebhook(agentId, url);
  }
  sseStream(onEvent: (data: any) => void) {
    return this.basicClient.sseStream(onEvent);
  }
  
  // Helper method for headers
  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(extra || {}),
    };
  }

  // Enhanced breadcrumb operations
  async updateBreadcrumb(
    id: string, 
    version: number, 
    updates: BreadcrumbUpdate
  ): Promise<Breadcrumb> {
    const r = await fetch(`${this.baseUrl}/breadcrumbs/${id}`, {
      method: 'PATCH',
      headers: this.headers({ 'If-Match': `"${version}"` }),
      body: JSON.stringify(updates),
    });
    if (!r.ok) {
      const error = await r.text();
      throw new Error(`Update failed (${r.status}): ${error}`);
    }
    await r.json(); // Consume the {ok: true} response
    // Fetch the updated breadcrumb to return full data
    return this.getBreadcrumb(id);
  }

  async deleteBreadcrumb(id: string): Promise<void> {
    const r = await fetch(`${this.baseUrl}/breadcrumbs/${id}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!r.ok) throw new Error(`Delete failed: ${r.status}`);
  }

  async getBreadcrumbHistory(id: string): Promise<BreadcrumbHistory[]> {
    const r = await fetch(`${this.baseUrl}/breadcrumbs/${id}/history`, {
      headers: this.headers(),
    });
    if (!r.ok) throw new Error(`Get history failed: ${r.status}`);
    return r.json();
  }

  // Enhanced search
  async searchBreadcrumbs(params: SearchParams): Promise<Breadcrumb[]> {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => q.append(key, String(v)));
        } else {
          q.set(key, String(value));
        }
      }
    });
    
    const r = await fetch(`${this.baseUrl}/breadcrumbs?${q.toString()}`, {
      headers: this.headers(),
    });
    if (!r.ok) throw new Error(`Search failed: ${r.status}`);
    return r.json();
  }

  async vectorSearch(params: VectorSearchParams): Promise<Breadcrumb[]> {
    const q = new URLSearchParams();
    if (params.q) q.set('q', params.q);
    if (params.qvec) q.set('qvec', params.qvec.join(','));
    if (params.nn) q.set('nn', String(params.nn));
    if (params.threshold) q.set('threshold', String(params.threshold));
    
    const r = await fetch(`${this.baseUrl}/breadcrumbs/search?${q.toString()}`, {
      headers: this.headers(),
    });
    if (!r.ok) throw new Error(`Vector search failed: ${r.status}`);
    return r.json();
  }

  // Subscription management
  async createSelectorSubscription(selector: Selector): Promise<Subscription> {
    const r = await fetch(`${this.baseUrl}/subscriptions/selectors`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(selector),
    });
    if (!r.ok) throw new Error(`Create selector failed: ${r.status}`);
    return r.json();
  }

  async subscribeToBreadcrumb(breadcrumbId: string): Promise<Subscription> {
    const r = await fetch(`${this.baseUrl}/breadcrumbs/${breadcrumbId}/subscribe`, {
      method: 'POST',
      headers: this.headers(),
    });
    if (!r.ok) throw new Error(`Subscribe failed: ${r.status}`);
    return r.json();
  }

  async unsubscribeFromBreadcrumb(breadcrumbId: string): Promise<void> {
    const r = await fetch(`${this.baseUrl}/breadcrumbs/${breadcrumbId}/unsubscribe`, {
      method: 'POST',
      headers: this.headers(),
    });
    if (!r.ok) throw new Error(`Unsubscribe failed: ${r.status}`);
  }

  async listSubscriptions(): Promise<Subscription[]> {
    const r = await fetch(`${this.baseUrl}/subscriptions`, {
      headers: this.headers(),
    });
    if (!r.ok) throw new Error(`List subscriptions failed: ${r.status}`);
    return r.json();
  }

  // Agent management
  async createAgent(agent: Partial<Agent>): Promise<Agent> {
    const r = await fetch(`${this.baseUrl}/agents`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(agent),
    });
    if (!r.ok) throw new Error(`Create agent failed: ${r.status}`);
    return r.json();
  }

  async getAgentInfo(): Promise<Agent> {
    const r = await fetch(`${this.baseUrl}/agents/me`, {
      headers: this.headers(),
    });
    if (!r.ok) throw new Error(`Get agent info failed: ${r.status}`);
    return r.json();
  }

  async registerWebhookEnhanced(agentId: string, config: WebhookConfig): Promise<any> {
    const r = await fetch(`${this.baseUrl}/agents/${agentId}/webhooks`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(config),
    });
    if (!r.ok) throw new Error(`Register webhook failed: ${r.status}`);
    return r.json();
  }

  async setWebhookSecret(agentId: string, secret: string): Promise<void> {
    const r = await fetch(`${this.baseUrl}/agents/${agentId}/secret`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ secret }),
    });
    if (!r.ok) throw new Error(`Set webhook secret failed: ${r.status}`);
  }

  // ACL management
  async grantAccess(grant: ACLGrant): Promise<any> {
    const r = await fetch(`${this.baseUrl}/acl/grant`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(grant),
    });
    if (!r.ok) throw new Error(`Grant access failed: ${r.status}`);
    return r.json();
  }

  async revokeAccess(grant: ACLGrant): Promise<void> {
    const r = await fetch(`${this.baseUrl}/acl/revoke`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(grant),
    });
    if (!r.ok) throw new Error(`Revoke access failed: ${r.status}`);
  }

  // DLQ management
  async listDLQ(): Promise<DLQItem[]> {
    const r = await fetch(`${this.baseUrl}/dlq`, {
      headers: this.headers(),
    });
    if (!r.ok) throw new Error(`List DLQ failed: ${r.status}`);
    return r.json();
  }

  async retryDLQItem(id: string): Promise<void> {
    const r = await fetch(`${this.baseUrl}/dlq/${id}/retry`, {
      method: 'POST',
      headers: this.headers(),
    });
    if (!r.ok) throw new Error(`Retry DLQ item failed: ${r.status}`);
  }

  // Admin operations
  async purgeExpired(): Promise<{ purged_count: number }> {
    const r = await fetch(`${this.baseUrl}/admin/purge`, {
      method: 'POST',
      headers: this.headers(),
    });
    if (!r.ok) throw new Error(`Purge failed: ${r.status}`);
    return r.json();
  }

  // Enhanced SSE with reconnection and typed events
  startEventStream(
    onEvent: (event: BreadcrumbEvent) => void,
    options?: {
      reconnectDelay?: number;
      maxReconnectAttempts?: number;
      filters?: Selector;
    }
  ): () => void {
    let reconnectAttempts = 0;
    const maxAttempts = options?.maxReconnectAttempts ?? Infinity;
    const reconnectDelay = options?.reconnectDelay ?? 5000;

    const connect = () => {
      this.eventSource = new EventSource(`${this.baseUrl}/events/stream`, {
        withCredentials: !!this.token,
      } as any);

      this.eventSource.onopen = () => {
        console.log('RCRT SSE connected');
        reconnectAttempts = 0;
      };

      this.eventSource.onmessage = (ev) => {
        try {
          const event = JSON.parse(ev.data) as BreadcrumbEvent;
          
          // Apply client-side filtering if specified
          if (options?.filters) {
            if (!this.matchesSelector(event, options.filters)) {
              return;
            }
          }
          
          onEvent(event);
        } catch (e) {
          console.error('Failed to parse SSE event:', e);
        }
      };

      this.eventSource.onerror = (e) => {
        console.error('SSE error:', e);
        this.eventSource?.close();
        
        if (reconnectAttempts < maxAttempts) {
          reconnectAttempts++;
          console.log(`Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttempts})`);
          setTimeout(connect, reconnectDelay);
        }
      };
    };

    connect();

    // Return cleanup function
    return () => {
      this.eventSource?.close();
      this.eventSource = undefined;
    };
  }

  // Helper to match events against selectors
  private matchesSelector(event: BreadcrumbEvent, selector: Selector): boolean {
    const tags = event.tags || [];
    
    if (selector.any_tags?.length) {
      const hasAnyTag = selector.any_tags.some(tag => tags.includes(tag));
      if (!hasAnyTag) return false;
    }
    
    if (selector.all_tags?.length) {
      const hasAllTags = selector.all_tags.every(tag => tags.includes(tag));
      if (!hasAllTags) return false;
    }
    
    if (selector.schema_name && event.schema_name !== selector.schema_name) {
      return false;
    }
    
    // Context matching would require the full breadcrumb context
    // This is a simplified version
    
    return true;
  }

  // Batch operations for efficiency
  async batchCreate(breadcrumbs: BreadcrumbCreate[]): Promise<{id: string}[]> {
    const results = await Promise.all(
      breadcrumbs.map((bc, i) => 
        this.createBreadcrumb(bc, `batch-${Date.now()}-${i}`)
      )
    );
    return results;
  }

  async batchGet(ids: string[], view: 'context' | 'full' = 'context'): Promise<Breadcrumb[]> {
    const getter = view === 'full' ? this.getBreadcrumbFull : this.getBreadcrumb;
    const results = await Promise.all(
      ids.map(id => getter.call(this, id))
    );
    return results;
  }

  // Workspace helpers
  async getWorkspaceBreadcrumbs(workspaceTag: string): Promise<Breadcrumb[]> {
    return this.searchBreadcrumbs({ tag: workspaceTag });
  }

  // Agent CRUD operations
  async listAgents(): Promise<Array<{id: string, roles: string[], created_at: string}>> {
    const response = await fetch(`${this.baseUrl}/agents`, {
      headers: this.headers(),
    });
    if (!response.ok) throw new Error(`List agents failed: ${response.status}`);
    return response.json();
  }

  async getAgent(agentId: string): Promise<{id: string, roles: string[], created_at: string}> {
    const response = await fetch(`${this.baseUrl}/agents/${agentId}`, {
      headers: this.headers(),
    });
    if (!response.ok) throw new Error(`Get agent failed: ${response.status}`);
    return response.json();
  }

  async createOrUpdateAgent(agentId: string, roles: string[]): Promise<{ok: boolean}> {
    const response = await fetch(`${this.baseUrl}/agents/${agentId}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ roles }),
    });
    if (!response.ok) throw new Error(`Create/update agent failed: ${response.status}`);
    return response.json();
  }

  async deleteAgent(agentId: string): Promise<{ok: boolean}> {
    const response = await fetch(`${this.baseUrl}/agents/${agentId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!response.ok) throw new Error(`Delete agent failed: ${response.status}`);
    return response.json();
  }

  // Tenant CRUD operations
  async listTenants(): Promise<Array<{id: string, name: string, created_at: string}>> {
    const response = await fetch(`${this.baseUrl}/tenants`, {
      headers: this.headers(),
    });
    if (!response.ok) throw new Error(`List tenants failed: ${response.status}`);
    return response.json();
  }

  async getTenant(tenantId: string): Promise<{id: string, name: string, created_at: string}> {
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}`, {
      headers: this.headers(),
    });
    if (!response.ok) throw new Error(`Get tenant failed: ${response.status}`);
    return response.json();
  }

  async createOrUpdateTenant(tenantId: string, name: string): Promise<{ok: boolean}> {
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error(`Create/update tenant failed: ${response.status}`);
    return response.json();
  }

  async updateTenant(tenantId: string, name: string): Promise<{ok: boolean}> {
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error(`Update tenant failed: ${response.status}`);
    return response.json();
  }

  async deleteTenant(tenantId: string): Promise<{ok: boolean}> {
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!response.ok) throw new Error(`Delete tenant failed: ${response.status}`);
    return response.json();
  }

  // ACL operations
  async listAcls(): Promise<Array<{
    id: string,
    breadcrumb_id: string,
    grantee_agent_id: string | null,
    actions: string[],
    created_at: string
  }>> {
    const response = await fetch(`${this.baseUrl}/acl`, {
      headers: this.headers(),
    });
    if (!response.ok) throw new Error(`List ACLs failed: ${response.status}`);
    return response.json();
  }

  // Selector operations (in addition to existing create/list)
  async updateSelector(selectorId: string, selector: Selector): Promise<{ok: boolean}> {
    const response = await fetch(`${this.baseUrl}/subscriptions/selectors/${selectorId}`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify(selector),
    });
    if (!response.ok) throw new Error(`Update selector failed: ${response.status}`);
    return response.json();
  }

  async deleteSelector(selectorId: string): Promise<{ok: boolean}> {
    const response = await fetch(`${this.baseUrl}/subscriptions/selectors/${selectorId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!response.ok) throw new Error(`Delete selector failed: ${response.status}`);
    return response.json();
  }

  // DLQ operations
  async listDlq(): Promise<Array<{
    id: string,
    agent_id: string,
    url: string,
    payload: any,
    last_error: string,
    created_at: string
  }>> {
    const response = await fetch(`${this.baseUrl}/dlq`, {
      headers: this.headers(),
    });
    if (!response.ok) throw new Error(`List DLQ failed: ${response.status}`);
    return response.json();
  }

  async deleteDlqItem(dlqId: string): Promise<{ok: boolean}> {
    const response = await fetch(`${this.baseUrl}/dlq/${dlqId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!response.ok) throw new Error(`Delete DLQ item failed: ${response.status}`);
    return response.json();
  }

  async retryDlqItem(dlqId: string): Promise<{requeued: boolean}> {
    const response = await fetch(`${this.baseUrl}/dlq/${dlqId}/retry`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({}),
    });
    if (!response.ok) throw new Error(`Retry DLQ item failed: ${response.status}`);
    return response.json();
  }

  async getAgentDefinitions(workspaceTag?: string): Promise<Breadcrumb[]> {
    const params: SearchParams = { schema_name: 'agent.def.v1' };
    if (workspaceTag) params.tag = workspaceTag;
    const agents = await this.searchBreadcrumbs(params);
    // searchBreadcrumbs returns minimal view, but we need full context for agents
    // Fetch full details for each agent
    const fullAgents = await Promise.all(
      agents.map(a => this.getBreadcrumb(a.id))
    );
    return fullAgents;
  }

  async getFlowDefinitions(workspaceTag?: string): Promise<Breadcrumb[]> {
    const params: SearchParams = { schema_name: 'flow.definition.v1' };
    if (workspaceTag) params.tag = workspaceTag;
    return this.searchBreadcrumbs(params);
  }

  // Secret management using RCRT's native secrets service
  async createSecret(
    name: string,
    value: string,
    scopeType: 'agent' | 'owner' | 'global' = 'agent',
    scopeId?: string
  ): Promise<{ id: string; name: string; scope_type: string; scope_id?: string }> {
    const r = await fetch(`${this.baseUrl}/secrets`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        name,
        value,
        scope_type: scopeType,
        scope_id: scopeId
      }),
    });
    if (!r.ok) {
      const error = await r.text();
      throw new Error(`Create secret failed (${r.status}): ${error}`);
    }
    return r.json();
  }

  async getSecret(secretId: string, reason?: string): Promise<string> {
    const r = await fetch(`${this.baseUrl}/secrets/${secretId}/decrypt`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        reason: reason || 'API access'
      }),
    });
    if (!r.ok) {
      const error = await r.text();
      throw new Error(`Decrypt secret failed (${r.status}): ${error}`);
    }
    const result = await r.json();
    return result.value;
  }

  async listSecrets(
    scopeType?: 'agent' | 'owner' | 'global',
    scopeId?: string
  ): Promise<Array<{ id: string; name: string; scope_type: string; scope_id?: string; created_at: string }>> {
    const params = new URLSearchParams();
    if (scopeType) params.set('scope_type', scopeType);
    if (scopeId) params.set('scope_id', scopeId);
    
    const r = await fetch(`${this.baseUrl}/secrets?${params.toString()}`, {
      headers: this.headers(),
    });
    if (!r.ok) {
      const error = await r.text();
      throw new Error(`List secrets failed (${r.status}): ${error}`);
    }
    return r.json();
  }

  async updateSecret(secretId: string, value: string): Promise<void> {
    const r = await fetch(`${this.baseUrl}/secrets/${secretId}`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({ value }),
    });
    if (!r.ok) {
      const error = await r.text();
      throw new Error(`Update secret failed (${r.status}): ${error}`);
    }
  }

  async deleteSecret(secretId: string): Promise<void> {
    const r = await fetch(`${this.baseUrl}/secrets/${secretId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!r.ok) {
      const error = await r.text();
      throw new Error(`Delete secret failed (${r.status}): ${error}`);
    }
  }

  // Higher-level secret vault management (combining secrets service with breadcrumbs for metadata)
  async createSecretVault(
    workspaceTag: string, 
    secrets: Record<string, string>,
    metadata?: {
      rotation_schedule?: string;
      description?: string;
    }
  ): Promise<{ vaultId: string; secretIds: Record<string, string> }> {
    // Create individual secrets in RCRT's secrets service
    const secretIds: Record<string, string> = {};
    const agentInfo = await this.getAgentInfo().catch(() => null);
    
    for (const [name, value] of Object.entries(secrets)) {
      const secret = await this.createSecret(
        `${workspaceTag}:${name}`,
        value,
        'agent',
        agentInfo?.id
      );
      secretIds[name] = secret.id;
    }
    
    // Create a breadcrumb to track the vault metadata and secret references
    const vault = await this.createBreadcrumb({
      schema_name: 'secrets.vault.v1',
      title: 'Project Secrets Vault',
      tags: ['secrets:vault', workspaceTag],
      context: {
        secret_ids: secretIds,
        metadata: {
          created_at: new Date().toISOString(),
          rotation_schedule: metadata?.rotation_schedule || '90d',
          description: metadata?.description || 'Project secrets vault'
        }
      },
      sensitivity: 'pii',
      visibility: 'private'
    });
    
    return { vaultId: vault.id, secretIds };
  }

  async getSecretsFromVault(
    vaultIdOrTag: string,
    reason?: string
  ): Promise<Record<string, string>> {
    // Find vault breadcrumb
    let vault: Breadcrumb;
    if (vaultIdOrTag.includes(':')) {
      // It's a tag
      const vaults = await this.searchBreadcrumbs({
        tag: vaultIdOrTag,
        schema_name: 'secrets.vault.v1'
      });
      if (vaults.length === 0) {
        throw new Error('No secrets vault found');
      }
      vault = await this.getBreadcrumb(vaults[0].id);
    } else {
      // It's an ID
      vault = await this.getBreadcrumb(vaultIdOrTag);
    }
    
    // Decrypt all secrets
    const secrets: Record<string, string> = {};
    const secretIds = vault.context.secret_ids as Record<string, string>;
    
    for (const [name, secretId] of Object.entries(secretIds)) {
      try {
        secrets[name] = await this.getSecret(secretId, reason);
      } catch (e) {
        console.error(`Failed to decrypt secret ${name}:`, e);
      }
    }
    
    // Log access
    await this.logSecretAccess(
      'sdk',
      Object.keys(secretIds),
      Object.keys(secrets),
      vaultIdOrTag
    );
    
    return secrets;
  }

  async rotateSecretInVault(
    vaultId: string,
    secretName: string,
    newValue: string
  ): Promise<void> {
    const vault = await this.getBreadcrumb(vaultId);
    const secretIds = vault.context.secret_ids as Record<string, string>;
    
    if (!secretIds[secretName]) {
      throw new Error(`Secret ${secretName} not found in vault`);
    }
    
    // Update the secret in RCRT's secrets service
    await this.updateSecret(secretIds[secretName], newValue);
    
    // Log rotation
    await this.createBreadcrumb({
      schema_name: 'secrets.rotation.v1',
      title: `Secret Rotated: ${secretName}`,
      tags: ['security:rotation', 'secrets:audit'],
      context: {
        secret_name: secretName,
        vault_id: vaultId,
        rotated_at: new Date().toISOString()
      },
      sensitivity: 'low'
    });
  }

  async logSecretAccess(
    requestingNode: string,
    requestedKeys: string[],
    providedKeys: string[],
    workspaceTag?: string
  ): Promise<{id: string}> {
    return this.createBreadcrumb({
      schema_name: 'secrets.access.v1',
      title: 'Secrets Accessed',
      tags: ['security:audit', 'secrets:access', ...(workspaceTag ? [workspaceTag] : [])],
      context: {
        requested_keys: requestedKeys,
        provided_keys: providedKeys,
        requesting_node: requestingNode,
        timestamp: new Date().toISOString()
      },
      sensitivity: 'low',
      visibility: 'private'
    });
  }

  // Optimistic updates with rollback
  async optimisticUpdate<T>(
    id: string,
    version: number,
    updates: BreadcrumbUpdate,
    optimisticCallback: () => T,
    rollbackCallback: (error: Error) => void
  ): Promise<T> {
    const optimisticResult = optimisticCallback();
    
    try {
      await this.updateBreadcrumb(id, version, updates);
      return optimisticResult;
    } catch (error) {
      rollbackCallback(error as Error);
      throw error;
    }
  }
}

// Export a singleton instance for convenience
export const rcrtClient = new RcrtClientEnhanced(
  process.env.RCRT_URL || 'http://localhost:8081',
  process.env.RCRT_TOKEN
);

// Re-export the basic client for backwards compatibility
export { BasicClient as RcrtClient };
