/**
 * RCRT Event Stream Integration for Chrome Extension
 * Listens for tool responses and updates UI in real-time
 */

export type EventStreamHandler = {
  onToolResponse: (response: {
    request_id: string;
    content: string;
    metadata?: any;
  }) => void;
  onConnection: (connected: boolean) => void;
  onError: (error: Error) => void;
};

class RCRTEventStream {
  private eventSource: EventSource | null = null;
  private handlers: EventStreamHandler[] = [];
  private isConnected = false;
  private pendingRequests = new Map<string, any>(); // Track requests waiting for responses

  constructor(private dashboardUrl: string = 'http://localhost:8082') {}

  // Add handler for events
  addHandler(handler: EventStreamHandler) {
    this.handlers.push(handler);
  }

  // Remove handler
  removeHandler(handler: EventStreamHandler) {
    const index = this.handlers.indexOf(handler);
    if (index >= 0) {
      this.handlers.splice(index, 1);
    }
  }

  // Start listening to RCRT events
  connect(): () => void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    const streamUrl = `${this.dashboardUrl}/api/events/stream`;
    console.log('📡 Connecting to RCRT event stream:', streamUrl);

    this.eventSource = new EventSource(streamUrl);

    this.eventSource.onopen = () => {
      console.log('✅ Connected to RCRT event stream');
      this.isConnected = true;
      this.handlers.forEach(h => h.onConnection(true));
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleEvent(data);
      } catch (error) {
        console.warn('Failed to parse RCRT event:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('RCRT SSE error:', error);
      this.isConnected = false;
      this.handlers.forEach(h => h.onConnection(false));
      
      // Auto-reconnect after delay
      setTimeout(() => {
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          console.log('🔄 Reconnecting to RCRT event stream...');
          this.connect();
        }
      }, 5000);
    };

    // Return cleanup function
    return () => {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      this.isConnected = false;
    };
  }

  private handleEvent(eventData: any) {
    // Log all events for debugging
    if (eventData.type !== 'ping') {
      console.log('📡 RCRT Event received:', eventData);
    }

    // Handle tool responses (OpenRouter, etc.)
    if ((eventData.type === 'breadcrumb.created' || eventData.type === 'breadcrumb.updated') && 
        eventData.schema_name === 'tool.response.v1') {
      
      this.handleToolResponse(eventData);
    }
  }

  private async handleToolResponse(eventData: any) {
    try {
      // Get full response details
      const response = await fetch(`${this.dashboardUrl}/api/breadcrumbs/${eventData.breadcrumb_id}/full`);
      if (!response.ok) return;

      const breadcrumb = await response.json();
      const context = breadcrumb.context;

      console.log('🤖 Tool response received:', {
        tool: context.tool,
        status: context.status,
        request_id: context.request_id,
        hasContent: !!context.output?.content
      });

      // Only handle successful responses with content
      if (context.status === 'success' && context.output?.content) {
        // Check if this is a response to one of our requests
        const requestId = context.request_id;
        
        if (this.pendingRequests.has(requestId)) {
          const requestInfo = this.pendingRequests.get(requestId);
          console.log('✅ Matching response found for request:', requestId);
        }

        // Notify all handlers about the tool response
        this.handlers.forEach(handler => {
          handler.onToolResponse({
            request_id: requestId,
            content: context.output.content,
            metadata: {
              tool: context.tool,
              model: context.output.model,
              usage: context.output.usage,
              cost: context.output.cost_estimate,
              execution_time: context.execution_time_ms,
            }
          });
        });
      }
    } catch (error) {
      console.error('Failed to handle tool response:', error);
    }
  }

  // Track a request so we can match responses
  trackRequest(requestId: string, info: any = {}) {
    this.pendingRequests.set(requestId, {
      ...info,
      timestamp: Date.now(),
    });
    
    // Clean up old requests after 5 minutes
    setTimeout(() => {
      this.pendingRequests.delete(requestId);
    }, 5 * 60 * 1000);
  }

  // Check connection status
  isConnectedToRCRT(): boolean {
    return this.isConnected;
  }

  // Get pending requests count
  getPendingCount(): number {
    return this.pendingRequests.size;
  }
}

// Global event stream instance
export const rcrtEventStream = new RCRTEventStream();
