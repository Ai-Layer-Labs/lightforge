/**
 * Unified Storage Client
 * TypeScript client for the Unified Storage API
 */

export interface StorageConfig {
  baseUrl: string;
  token?: string;
  maxRetries?: number;
  retryDelay?: number;
}

export interface StorageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class UnifiedStorageClient {
  private config: Required<StorageConfig>;

  constructor(config: StorageConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      token: config.token || '',
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
    };
  }

  /**
   * User data operations
   */
  public userData = {
    get: async (key: string): Promise<any> => {
      return this.request('GET', `/api/v1/user/data/${key}`);
    },
    
    set: async (key: string, value: any): Promise<void> => {
      await this.request('POST', `/api/v1/user/data/${key}`, value);
    },
    
    delete: async (key: string): Promise<void> => {
      await this.request('DELETE', `/api/v1/user/data/${key}`);
    },
    
    list: async (): Promise<string[]> => {
      return this.request('GET', '/api/v1/user/data');
    }
  };

  /**
   * Application settings
   */
  public settings = {
    get: async (key: string): Promise<any> => {
      return this.request('GET', `/api/v1/settings/${key}`);
    },
    
    set: async (key: string, value: any): Promise<void> => {
      await this.request('POST', `/api/v1/settings/${key}`, value);
    },
    
    getAll: async (): Promise<Record<string, any>> => {
      return this.request('GET', '/api/v1/settings');
    }
  };

  /**
   * Chat history
   */
  public chat = {
    getHistory: async (sessionId?: string): Promise<any[]> => {
      const path = sessionId 
        ? `/api/v1/chat/history?session_id=${sessionId}`
        : '/api/v1/chat/history';
      return this.request('GET', path);
    },
    
    addMessage: async (message: any): Promise<void> => {
      await this.request('POST', '/api/v1/chat/message', message);
    },
    
    clearHistory: async (sessionId?: string): Promise<void> => {
      const path = sessionId
        ? `/api/v1/chat/history?session_id=${sessionId}`
        : '/api/v1/chat/history';
      await this.request('DELETE', path);
    }
  };

  /**
   * Analytics
   */
  public analytics = {
    track: async (event: string, properties?: any): Promise<void> => {
      await this.request('POST', '/api/v1/analytics/track', {
        event,
        properties,
        timestamp: new Date().toISOString()
      });
    },
    
    getEvents: async (filters?: any): Promise<any[]> => {
      const query = new URLSearchParams(filters).toString();
      return this.request('GET', `/api/v1/analytics/events?${query}`);
    }
  };

  /**
   * Make HTTP request with retries
   */
  private async request(
    method: string,
    path: string,
    body?: any
  ): Promise<any> {
    const url = `${this.config.baseUrl}${path}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        if (this.config.token) {
          headers['Authorization'] = `Bearer ${this.config.token}`;
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return await response.json();
        }
        
        return null;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on 4xx errors
        if (lastError.message.includes('HTTP 4')) {
          throw lastError;
        }
        
        // Wait before retrying
        if (attempt < this.config.maxRetries - 1) {
          await new Promise(resolve => 
            setTimeout(resolve, this.config.retryDelay * (attempt + 1))
          );
        }
      }
    }

    throw lastError || new Error('Request failed');
  }
}

// Export factory function
export function createStorageClient(config: StorageConfig): UnifiedStorageClient {
  return new UnifiedStorageClient(config);
}
