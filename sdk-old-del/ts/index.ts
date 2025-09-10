export type BreadcrumbCreate = {
  title: string;
  context: any;
  tags: string[];
  schema_name?: string;
  visibility?: 'public'|'team'|'private';
  sensitivity?: 'low'|'pii'|'secret';
  ttl?: string;
};

export class RcrtClient {
  private baseUrl: string;
  private token?: string;

  constructor(baseUrl: string, token?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  private headers(extra?: Record<string,string>) {
    return {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(extra || {}),
    } as Record<string,string>;
  }

  async health(): Promise<string> {
    const r = await fetch(`${this.baseUrl}/health`);
    return r.text();
  }

  async createBreadcrumb(body: BreadcrumbCreate, idempotencyKey?: string): Promise<{id: string}> {
    const r = await fetch(`${this.baseUrl}/breadcrumbs`, {
      method: 'POST',
      headers: this.headers(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined),
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`create failed: ${r.status}`);
    return r.json();
  }

  async getBreadcrumb(id: string): Promise<any> {
    const r = await fetch(`${this.baseUrl}/breadcrumbs/${id}`, { headers: this.headers() });
    if (!r.ok) throw new Error(`get failed: ${r.status}`);
    return r.json();
  }

  async getBreadcrumbFull(id: string): Promise<any> {
    const r = await fetch(`${this.baseUrl}/breadcrumbs/${id}/full`, { headers: this.headers() });
    if (!r.ok) throw new Error(`get full failed: ${r.status}`);
    return r.json();
  }

  async listBreadcrumbs(params?: { tag?: string }): Promise<any[]> {
    const q = new URLSearchParams();
    if (params?.tag) q.set('tag', params.tag);
    const r = await fetch(`${this.baseUrl}/breadcrumbs?${q.toString()}`, { headers: this.headers() });
    if (!r.ok) throw new Error(`list failed: ${r.status}`);
    return r.json();
  }

  async createSelector(any_tags?: string[], all_tags?: string[], schema_name?: string): Promise<any> {
    const r = await fetch(`${this.baseUrl}/subscriptions/selectors`, {
      method: 'POST', headers: this.headers(),
      body: JSON.stringify({ any_tags, all_tags, schema_name }),
    });
    if (!r.ok) throw new Error(`selector failed: ${r.status}`);
    return r.json();
  }

  async registerWebhook(agentId: string, url: string): Promise<any> {
    const r = await fetch(`${this.baseUrl}/agents/${agentId}/webhooks`, {
      method: 'POST', headers: this.headers(), body: JSON.stringify({ url })
    });
    if (!r.ok) throw new Error(`webhook failed: ${r.status}`);
    return r.json();
  }

  sseStream(onEvent: (data: any) => void): EventSource {
    const es = new EventSource(`${this.baseUrl}/events/stream`);
    es.onmessage = (ev) => {
      try { onEvent(JSON.parse(ev.data)); } catch { onEvent(ev.data); }
    };
    return es;
  }
}


