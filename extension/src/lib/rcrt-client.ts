/**
 * RCRT Client for Chrome Extension
 */

export interface BreadcrumbContext {
  [key: string]: any;
}

export interface EventStreamMessage {
  id: string;
  content: string;
  metadata?: any;
}

export interface SSEFilter {
  tags?: string[];
  schema_names?: string[];
  response_to?: string[];
  custom?: (event: any) => boolean;
}

export class RCRTExtensionClient {
  private baseUrl: string = 'http://localhost:8081';
  private token: string | null = null;
  private authenticated: boolean = false;

  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: '00000000-0000-0000-0000-000000000001',
          agent_id: '00000000-0000-0000-0000-000000000002', // Use proper UUID format
          roles: ['emitter', 'subscriber']
        })
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status}`);
      }

      const data = await response.json();
      this.token = data.token;
      this.authenticated = true;
      return true;
      
    } catch (error) {
      console.error('RCRT authentication failed:', error);
      this.authenticated = false;
      return false;
    }
  }

  async createBreadcrumb(breadcrumb: any): Promise<{ id: string }> {
    if (!this.authenticated || !this.token) {
      throw new Error('Not authenticated with RCRT');
    }

    const response = await fetch(`${this.baseUrl}/breadcrumbs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(breadcrumb)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create breadcrumb: ${error}`);
    }

    return response.json();
  }

  async createChatBreadcrumb(message: any): Promise<{ id: string }> {
    return this.createBreadcrumb({
      schema_name: 'user.message.v1',
      title: 'Extension Chat Message',
      tags: ['user:message', 'extension:chat'],
      context: {
        content: message.content,
        conversation_id: message.sessionId,
        timestamp: new Date().toISOString(),
        source: 'browser-extension'
      }
    });
  }

  async getBreadcrumb(id: string): Promise<any> {
    if (!this.authenticated || !this.token) {
      throw new Error('Not authenticated with RCRT');
    }

    const response = await fetch(`${this.baseUrl}/breadcrumbs/${id}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get breadcrumb: ${response.status}`);
    }

    return response.json();
  }

  async connectToSSE(
    filters: SSEFilter,
    onEvent: (event: any) => void
  ): Promise<() => void> {
    if (!this.authenticated || !this.token) {
      throw new Error('Not authenticated with RCRT');
    }

    console.log('🔌 Connecting to RCRT SSE stream with filters:', filters);
    
    const eventSource = new EventSource(`${this.baseUrl}/events/stream`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    } as any);

    // Handle incoming events
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Skip ping events
        if (data.type === 'ping') return;
        
        // Apply filters
        let shouldProcess = false;
        
        // Tag filter
        if (filters.tags && data.tags) {
          shouldProcess = filters.tags.some(tag => data.tags.includes(tag));
        }
        
        // Schema name filter
        if (!shouldProcess && filters.schema_names && data.schema_name) {
          shouldProcess = filters.schema_names.includes(data.schema_name);
        }
        
        // Response_to filter (for tracking responses to specific breadcrumbs)
        if (!shouldProcess && filters.response_to && data.breadcrumb_id) {
          // We'll need to fetch the breadcrumb to check its context.response_to
          // For now, we'll use custom filter for this
        }
        
        // Custom filter function
        if (!shouldProcess && filters.custom) {
          shouldProcess = filters.custom(data);
        }
        
        // If no filters specified, process all events
        if (!filters.tags && !filters.schema_names && !filters.custom) {
          shouldProcess = true;
        }
        
        if (shouldProcess) {
          console.log('📡 SSE Event passed filters:', data);
          onEvent(data);
        }
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      eventSource.close();
    };

    // Return cleanup function
    return () => {
      console.log('🔌 Closing SSE connection');
      eventSource.close();
    };
  }

  async listenForAgentResponses(conversationId: string, onResponse: (content: string) => void): Promise<() => void> {
    // Create a map to track which messages we're waiting for responses to
    const waitingForResponses = new Set<string>();
    
    // Listen for agent responses with specific tags
    return this.connectToSSE(
      {
        tags: ['agent:response'],
        custom: (event) => {
          // Additional filtering can be done here based on conversation_id
          return event.type === 'breadcrumb.updated' && 
                 (event.tags?.includes('agent:response') || 
                  event.schema_name === 'agent.response.v1');
        }
      },
      async (event) => {
        // Fetch the full breadcrumb to get the response content
        if (event.breadcrumb_id) {
          try {
            const breadcrumb = await this.getBreadcrumb(event.breadcrumb_id);
            
            // Check if this response is for our conversation
            if (breadcrumb.context?.conversation_id === conversationId ||
                breadcrumb.tags?.includes('extension:chat')) {
              const content = breadcrumb.context?.content || 
                             breadcrumb.context?.response_text ||
                             breadcrumb.context?.message ||
                             'Agent responded but no content found';
              onResponse(content);
            }
          } catch (error) {
            console.error('Failed to fetch agent response breadcrumb:', error);
          }
        }
      }
    );
  }

  // Add method to track sent messages
  trackMessage(messageId: string): void {
    // This could be expanded to track message-response relationships
    console.log('📝 Tracking message:', messageId);
  }

  // Helper method to listen for any breadcrumb updates
  async listenToBreadcrumbs(
    filters: SSEFilter,
    onBreadcrumb: (breadcrumb: any) => void
  ): Promise<() => void> {
    return this.connectToSSE(filters, async (event) => {
      if (event.breadcrumb_id && event.type === 'breadcrumb.updated') {
        try {
          const breadcrumb = await this.getBreadcrumb(event.breadcrumb_id);
          onBreadcrumb(breadcrumb);
        } catch (error) {
          console.error('Failed to fetch breadcrumb:', error);
        }
      }
    });
  }

  // List agents for debugging
  async listAgents(): Promise<any[]> {
    if (!this.authenticated || !this.token) {
      throw new Error('Not authenticated with RCRT');
    }

    const response = await fetch(`${this.baseUrl}/agents`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to list agents: ${response.status}`);
    }

    return response.json();
  }

  // List breadcrumbs by tag
  async listBreadcrumbs(tag?: string): Promise<any[]> {
    if (!this.authenticated || !this.token) {
      throw new Error('Not authenticated with RCRT');
    }

    const url = tag ? `${this.baseUrl}/breadcrumbs?tag=${tag}` : `${this.baseUrl}/breadcrumbs`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to list breadcrumbs: ${response.status}`);
    }

    return response.json();
  }

  // Update breadcrumb
  async updateBreadcrumb(id: string, version: number, update: any): Promise<any> {
    if (!this.authenticated || !this.token) {
      throw new Error('Not authenticated with RCRT');
    }

    const response = await fetch(`${this.baseUrl}/breadcrumbs/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'If-Match': version.toString()
      },
      body: JSON.stringify(update)
    });

    if (!response.ok) {
      throw new Error(`Failed to update breadcrumb: ${response.status}`);
    }

    return response.json();
  }
}

export const rcrtClient = new RCRTExtensionClient();
