/**
 * RCRT Client - Platform Agnostic
 * Works in Node.js, Deno, and browsers
 */

import type { RcrtClientOptions, BreadcrumbCreate, BreadcrumbUpdate, SearchParams, VectorSearchParams } from './types';

export class RcrtClient {
  private baseUrl: string;
  private token?: string;
  private fetch: typeof globalThis.fetch;

  constructor(options: RcrtClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
    this.fetch = options.fetch || globalThis.fetch;
  }

  /**
   * Make authenticated request to RCRT API
   */
  protected async request(path: string, init?: RequestInit): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> || {})
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await this.fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error ${response.status}: ${error}`);
    }

    return response.json();
  }

  // ============ Breadcrumb Operations ============

  async getBreadcrumb(id: string): Promise<any> {
    return this.request(`/breadcrumbs/${id}/full`);
  }

  async createBreadcrumb(data: BreadcrumbCreate, idempotencyKey?: string): Promise<{ id: string }> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    return this.request('/breadcrumbs', {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
  }

  async updateBreadcrumb(id: string, version: number, updates: BreadcrumbUpdate): Promise<any> {
    return this.request(`/breadcrumbs/${id}`, {
      method: 'PATCH',
      headers: { 'If-Match': version.toString() },
      body: JSON.stringify(updates)
    });
  }

  async deleteBreadcrumb(id: string, version?: number): Promise<void> {
    const headers: Record<string, string> = {};
    if (version !== undefined) {
      headers['If-Match'] = version.toString();
    }

    await this.request(`/breadcrumbs/${id}`, {
      method: 'DELETE',
      headers
    });
  }

  async searchBreadcrumbs(params: SearchParams): Promise<any[]> {
    const queryParams = new URLSearchParams();
    
    if (params.schema_name) queryParams.set('schema_name', params.schema_name);
    if (params.tag) queryParams.set('tag', params.tag);
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());
    if (params.include_context) queryParams.set('include_context', 'true');
    
    return this.request(`/breadcrumbs?${queryParams}`);
  }

  async vectorSearch(params: VectorSearchParams): Promise<any[]> {
    const queryParams = new URLSearchParams();
    
    if (params.q) queryParams.set('q', params.q);
    if (params.qvec) queryParams.set('qvec', JSON.stringify(params.qvec));
    if (params.nn) queryParams.set('nn', params.nn.toString());
    if (params.tag) queryParams.set('tag', params.tag);
    if (params.schema_name) queryParams.set('schema_name', params.schema_name);
    queryParams.set('include_context', 'true');
    
    return this.request(`/breadcrumbs/search?${queryParams}`);
  }

  // ============ LLM-Friendly Operations (v2.3.0) ============

  async addTags(id: string, tags: string[]): Promise<{ ok: boolean }> {
    return this.request(`/breadcrumbs/${id}/tags/add`, {
      method: 'POST',
      body: JSON.stringify({ tags })
    });
  }

  async removeTags(id: string, tags: string[]): Promise<{ ok: boolean }> {
    return this.request(`/breadcrumbs/${id}/tags/remove`, {
      method: 'POST',
      body: JSON.stringify({ tags })
    });
  }

  async mergeContext(id: string, context: any): Promise<{ ok: boolean }> {
    return this.request(`/breadcrumbs/${id}/context/merge`, {
      method: 'POST',
      body: JSON.stringify({ context })
    });
  }

  async approveBreadcrumb(id: string, reason?: string): Promise<{ ok: boolean }> {
    return this.request(`/breadcrumbs/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async rejectBreadcrumb(id: string, reason?: string): Promise<{ ok: boolean }> {
    return this.request(`/breadcrumbs/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  // ============ Secrets ============

  async getSecret(secretId: string, reason: string): Promise<{ value: string }> {
    return this.request(`/secrets/${secretId}/decrypt`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Tool execution' })
    });
  }

  async listSecrets(scopeType?: string, scopeId?: string): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (scopeType) queryParams.set('scope_type', scopeType);
    if (scopeId) queryParams.set('scope_id', scopeId);
    
    const query = queryParams.toString();
    return this.request(`/secrets${query ? `?${query}` : ''}`);
  }
}

