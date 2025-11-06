/**
 * RCRT Client Library
 * Complete client for interacting with RCRT server
 */

import type { 
  Breadcrumb, 
  BreadcrumbCreate, 
  SearchParams, 
  SSEEvent 
} from './types';

export interface RCRTClientConfig {
  baseUrl: string;
  ownerId?: string;
  agentId?: string;
}

export class RCRTClient {
  private baseUrl: string;
  private token: string | null = null;
  private ownerId: string;
  private agentId: string;
  private sseConnection: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(config: RCRTClientConfig) {
    this.baseUrl = config.baseUrl || 'http://localhost:8081';
    this.ownerId = config.ownerId || '00000000-0000-0000-0000-000000000001';
    this.agentId = config.agentId || '00000000-0000-0000-0000-000000000EEE';
  }

  /**
   * Authenticate and get JWT token
   */
  async authenticate(): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner_id: this.ownerId,
          agent_id: this.agentId,
          roles: ['curator', 'emitter', 'subscriber'],
          ttl_sec: 3600,
        }),
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status}`);
      }

      const data = await response.json();
      if (!data.token || typeof data.token !== 'string') {
        throw new Error('Invalid token received from server');
      }
      
      const token = data.token as string;
      this.token = token;
      
      // Store token in chrome storage for persistence
      await chrome.storage.local.set({ rcrtToken: token });
      
      return token;
    } catch (error) {
      console.error('[RCRTClient] Authentication error:', error);
      throw error;
    }
  }

  /**
   * Get stored token or authenticate
   */
  private async ensureToken(): Promise<string> {
    if (this.token) {
      return this.token;
    }

    // Try to get token from storage
    const stored = await chrome.storage.local.get('rcrtToken');
    if (stored.rcrtToken && typeof stored.rcrtToken === 'string') {
      this.token = stored.rcrtToken;
      return this.token;
    }

    // Authenticate if no token
    const token = await this.authenticate();
    return token;
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.ensureToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    };

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      // Handle 401 - token expired
      if (response.status === 401) {
        // Clear token and retry once
        this.token = null;
        await chrome.storage.local.remove('rcrtToken');
        const newToken = await this.authenticate();
        
        // Retry request with new token
        const retryHeaders: HeadersInit = {
          ...headers,
          Authorization: `Bearer ${newToken}`
        };
        const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers: retryHeaders,
        });

        if (!retryResponse.ok) {
          throw new Error(`Request failed: ${retryResponse.status}`);
        }

        return await retryResponse.json();
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Request failed: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[RCRTClient] Request error for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Create a new breadcrumb
   */
  async createBreadcrumb(data: BreadcrumbCreate): Promise<Breadcrumb> {
    return await this.request<Breadcrumb>('/breadcrumbs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get a single breadcrumb by ID
   */
  async getBreadcrumb(id: string, full = false): Promise<Breadcrumb> {
    const endpoint = full ? `/breadcrumbs/${id}/full` : `/breadcrumbs/${id}`;
    return await this.request<Breadcrumb>(endpoint);
  }

  /**
   * Update a breadcrumb
   */
  async updateBreadcrumb(
    id: string,
    version: number,
    updates: Partial<BreadcrumbCreate>
  ): Promise<Breadcrumb> {
    return await this.request<Breadcrumb>(`/breadcrumbs/${id}`, {
      method: 'PATCH',
      headers: {
        'If-Match': `"${version}"`,
      },
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete a breadcrumb
   */
  async deleteBreadcrumb(id: string): Promise<void> {
    await this.request<void>(`/breadcrumbs/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Search breadcrumbs
   */
  async searchBreadcrumbs(params: SearchParams): Promise<Breadcrumb[]> {
    const queryParams = new URLSearchParams();

    if (params.q) queryParams.append('q', params.q);
    if (params.schema_name) queryParams.append('schema_name', params.schema_name);
    if (params.tag) queryParams.append('tag', params.tag);
    if (params.nn) queryParams.append('nn', params.nn.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.sort) queryParams.append('sort', params.sort);

    // Handle array parameters
    if (params.any_tags) {
      params.any_tags.forEach(tag => queryParams.append('any_tags', tag));
    }
    if (params.all_tags) {
      params.all_tags.forEach(tag => queryParams.append('all_tags', tag));
    }

    const endpoint = params.q 
      ? `/breadcrumbs/search?${queryParams}`
      : `/breadcrumbs?${queryParams}`;

    return await this.request<Breadcrumb[]>(endpoint);
  }

  /**
   * List breadcrumbs with filters
   */
  async listBreadcrumbs(filters: {
    schema_name?: string;
    tag?: string;
    limit?: number;
  } = {}): Promise<Breadcrumb[]> {
    const queryParams = new URLSearchParams();
    
    if (filters.schema_name) queryParams.append('schema_name', filters.schema_name);
    if (filters.tag) queryParams.append('tag', filters.tag);
    if (filters.limit) queryParams.append('limit', filters.limit.toString());

    return await this.request<Breadcrumb[]>(`/breadcrumbs?${queryParams}`);
  }

  /**
   * Subscribe to SSE events
   */
  async subscribeToSSE(
    filters: {
      schema_name?: string;
      any_tags?: string[];
      all_tags?: string[];
    },
    onEvent: (event: SSEEvent) => void,
    onError?: (error: Error) => void
  ): Promise<() => void> {
    const token = await this.ensureToken();

    // Build query parameters
    const params = new URLSearchParams();
    if (filters.schema_name) params.append('schema_name', filters.schema_name);
    if (filters.any_tags) {
      filters.any_tags.forEach(tag => params.append('any_tags', tag));
    }
    if (filters.all_tags) {
      filters.all_tags.forEach(tag => params.append('all_tags', tag));
    }

    const url = `${this.baseUrl}/events/stream?${params}&token=${token}`;

    // Close existing connection if any
    if (this.sseConnection) {
      this.sseConnection.close();
    }

    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;
        onEvent(data);
        this.reconnectAttempts = 0; // Reset on successful message
      } catch (error) {
        console.error('[RCRTClient] Failed to parse SSE event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[RCRTClient] SSE error:', error);
      
      if (eventSource.readyState === EventSource.CLOSED) {
        // Connection closed, attempt reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
          
          console.log(`[RCRTClient] Reconnecting SSE in ${delay}ms (attempt ${this.reconnectAttempts})`);
          
          setTimeout(() => {
            this.subscribeToSSE(filters, onEvent, onError);
          }, delay);
        } else {
          if (onError) {
            onError(new Error('Max reconnection attempts reached'));
          }
        }
      }
    };

    eventSource.onopen = () => {
      console.log('[RCRTClient] SSE connection opened');
      this.reconnectAttempts = 0;
    };

    this.sseConnection = eventSource;

    // Return unsubscribe function
    return () => {
      eventSource.close();
      if (this.sseConnection === eventSource) {
        this.sseConnection = null;
      }
    };
  }

  /**
   * Close all connections
   */
  disconnect(): void {
    if (this.sseConnection) {
      this.sseConnection.close();
      this.sseConnection = null;
    }
  }

  /**
   * Test connection to RCRT server
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.error('[RCRTClient] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get breadcrumb history
   */
  async getBreadcrumbHistory(id: string): Promise<Breadcrumb[]> {
    return await this.request<Breadcrumb[]>(`/breadcrumbs/${id}/history`);
  }
}

/**
 * Create a singleton instance for the extension
 */
let clientInstance: RCRTClient | null = null;

export async function getRCRTClient(): Promise<RCRTClient> {
  if (!clientInstance) {
    const settings = await chrome.storage.local.get(['rcrtServerUrl', 'ownerId', 'agentId']);
    
    clientInstance = new RCRTClient({
      baseUrl: settings.rcrtServerUrl || 'http://localhost:8081',
      ownerId: settings.ownerId,
      agentId: settings.agentId,
    });

    // Authenticate immediately
    await clientInstance.authenticate();
  }

  return clientInstance;
}

/**
 * Reset the client instance (useful for settings changes)
 */
export function resetRCRTClient(): void {
  if (clientInstance) {
    clientInstance.disconnect();
    clientInstance = null;
  }
}

