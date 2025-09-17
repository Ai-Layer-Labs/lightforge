/**
 * RCRT Client for Chrome Extension
 * Connects to RCRT services via dashboard proxy (like the right sidebar)
 */

const RCRT_BUILDER_PROXY = 'http://localhost:3000'; // Builder with RCRT proxy
const RCRT_DASHBOARD_V2 = 'http://localhost:5173'; // Dashboard v2 (Vite dev server)
const RCRT_SERVER_DIRECT = 'http://localhost:8081'; // RCRT server direct

export type BreadcrumbContext = {
  id: string;
  title: string;
  context: Record<string, unknown>;
  tags: string[];
  version: number;
  updated_at: string;
};

export type BreadcrumbCreate = {
  title: string;
  context: Record<string, unknown>;
  tags: string[];
  schema_name?: string;
  visibility?: 'public' | 'team' | 'private';
  sensitivity?: 'low' | 'pii' | 'secret';
  ttl?: string;
};

export type Agent = {
  id: string;
  roles: string[];
  created_at: string;
};

export type EventStreamMessage = {
  type: 'breadcrumb_created' | 'breadcrumb_updated' | 'ping';
  breadcrumb_id?: string;
  schema_name?: string;
  tags?: string[];
  timestamp: string;
};

export class RCRTExtensionClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = RCRT_SERVER_DIRECT) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  // Get JWT token directly from RCRT server (like background script)
  async authenticate(): Promise<boolean> {
    try {
      console.log('🔑 Fetching JWT token directly from RCRT server...');
      const response = await fetch(`${this.baseUrl}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: '00000000-0000-0000-0000-000000000001',
          agent_id: '00000000-0000-0000-0000-000000000EEE', // Extension agent ID (valid UUID)
          roles: ['curator', 'emitter', 'subscriber']
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        this.token = data.token;
        console.log('✅ Got JWT token for RCRT connection');
        return true;
      } else {
        console.error('❌ Failed to get JWT token:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Error getting JWT token:', error);
      return false;
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.token) {
      const success = await this.authenticate();
      if (!success) {
        throw new Error('Authentication failed');
      }
    }

    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`${response.status} ${response.statusText}: ${text}`);
    }

    return response.json();
  }

  // ============ Breadcrumb Operations ============
  
  async createBreadcrumb(breadcrumb: BreadcrumbCreate): Promise<{ id: string }> {
    return this.request('/breadcrumbs', {
      method: 'POST',
      body: JSON.stringify(breadcrumb),
    });
  }

  async getBreadcrumb(id: string): Promise<BreadcrumbContext> {
    return this.request(`/breadcrumbs/${id}`);
  }

  async listBreadcrumbs(tag?: string): Promise<BreadcrumbContext[]> {
    const query = tag ? `?tag=${encodeURIComponent(tag)}` : '';
    return this.request(`/breadcrumbs${query}`);
  }

  async updateBreadcrumb(id: string, version: number, updates: Partial<BreadcrumbCreate>): Promise<{ ok: boolean }> {
    return this.request(`/breadcrumbs/${id}`, {
      method: 'PATCH',
      headers: {
        'If-Match': version.toString(),
      },
      body: JSON.stringify(updates),
    });
  }

  async deleteBreadcrumb(id: string): Promise<{ ok: boolean }> {
    return this.request(`/breadcrumbs/${id}`, {
      method: 'DELETE',
    });
  }

  async vectorSearch(query: string, nn: number = 10, tag?: string): Promise<BreadcrumbContext[]> {
    const params = new URLSearchParams({ q: query, nn: nn.toString() });
    if (tag) params.append('tag', tag);
    return this.request(`/breadcrumbs/search?${params}`);
  }

  // ============ Agent Operations ============
  
  async listAgents(): Promise<Agent[]> {
    return this.request('/agents');
  }

  async getAgent(id: string): Promise<Agent> {
    return this.request(`/agents/${id}`);
  }

  async registerAgent(id: string, roles: string[]): Promise<{ ok: boolean }> {
    return this.request(`/agents/${id}`, {
      method: 'POST',
      body: JSON.stringify({ roles }),
    });
  }

  // ============ Event Stream ============
  
  connectEventStream(
    onEvent: (event: EventStreamMessage) => void,
    onError?: (error: Error) => void
  ): () => void {
    let eventSource: EventSource | null = null;
    let shouldReconnect = true;

    const connect = () => {
      if (!shouldReconnect) return;

       // Connect to RCRT SSE stream directly with auth token as query param
       const streamUrl = `${this.baseUrl}/events/stream?token=${encodeURIComponent(this.token || '')}`;
       console.log('🔐 Connecting to RCRT event stream with token...');
      
      // EventSource doesn't support custom headers, so pass token as query parameter
      eventSource = new EventSource(streamUrl, {
        withCredentials: false
      });
      
      eventSource.onopen = () => {
        console.log('✅ Connected to RCRT event stream');
        onEvent({
          type: 'ping',
          timestamp: new Date().toISOString(),
        });
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onEvent(data);
        } catch (error) {
          console.warn('Failed to parse SSE event:', event.data, error);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        eventSource?.close();
        eventSource = null;
        
        if (onError) {
          onError(new Error('SSE connection failed'));
        }
        
        if (shouldReconnect) {
          console.log('🔄 Reconnecting to SSE in 5 seconds...');
          setTimeout(connect, 5000);
        }
      };
    };

    connect();

    // Return cleanup function
    return () => {
      shouldReconnect = false;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }

  // ============ Browser Integration Helpers ============
  
  // Convert browser state to breadcrumb context
  async createBrowserStateBreadcrumb(pageData: {
    url: string;
    title: string;
    viewport: { width: number; height: number };
    snapshot?: unknown;
  }): Promise<{ id: string }> {
    return this.createBreadcrumb({
      title: `Browser: ${pageData.title}`,
      context: {
        url: pageData.url,
        title: pageData.title,
        viewport: pageData.viewport,
        snapshot: pageData.snapshot,
        source: 'chrome_extension',
        timestamp: new Date().toISOString(),
      },
      tags: ['browser:state', 'chrome:extension', `url:${new URL(pageData.url).hostname}`],
      schema_name: 'browser.state.v1',
      visibility: 'team',
      sensitivity: 'low',
    });
  }

  // Convert chat message to breadcrumb that triggers Dashboard v2 chat agent
  async createChatBreadcrumb(message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    sessionId?: string;
  }): Promise<{ id: string }> {
    if (message.role === 'user') {
      // Create user message that triggers chat agent
      return this.createBreadcrumb({
        title: `User: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`,
        context: {
          role: message.role,
          content: message.content,
          conversation_id: message.sessionId || `ext-conv-${Date.now()}`,
          source: 'chrome_extension',
          timestamp: new Date().toISOString(),
        },
        tags: ['chat:message', 'user:input', 'chrome:extension', 'workspace:agents'],
        schema_name: 'chat.message.v1',
        visibility: 'team',
        sensitivity: 'low',
      });
    } else {
      // Create assistant/system message
      return this.createBreadcrumb({
        title: `${message.role}: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`,
        context: {
          role: message.role,
          content: message.content,
          conversation_id: message.sessionId || `ext-conv-${Date.now()}`,
          source: 'chrome_extension',
          timestamp: new Date().toISOString(),
        },
        tags: ['chat:message', `chat:${message.role}`, 'chrome:extension'],
        schema_name: 'chat.message.v1',
        visibility: 'team',
        sensitivity: 'low',
      });
    }
  }

  // Listen for agent responses to display in chat
  async listenForAgentResponses(conversationId: string, onResponse: (response: string) => void): Promise<() => void> {
    return this.connectEventStream((event) => {
      if (event.type === 'breadcrumb.created' && 
          event.schema_name === 'agent.response.v1' &&
          event.tags?.includes('chat:response')) {
        
        // Get the full response breadcrumb
        this.getBreadcrumb(event.breadcrumb_id!).then(breadcrumb => {
          if (breadcrumb.context.conversation_id === conversationId) {
            onResponse(breadcrumb.context.content as string);
          }
        }).catch(console.error);
      }
    });
  }
}

export const rcrtClient = new RCRTExtensionClient();
