/**
 * SSE Client Wrapper
 * Handles Server-Sent Events with auto-reconnect
 */
import EventSource from 'eventsource';
export class SSEClient {
    eventSource;
    options;
    reconnectAttempts = 0;
    reconnectTimer;
    isConnected = false;
    shouldReconnect = true;
    constructor(options) {
        this.options = options;
    }
    /**
     * Connect to SSE endpoint
     */
    connect() {
        if (this.isConnected) {
            console.warn('SSE client already connected');
            return;
        }
        const url = new URL(this.options.url);
        // Add query parameters
        if (this.options.agentId) {
            url.searchParams.append('agent_id', this.options.agentId);
        }
        if (this.options.filters) {
            url.searchParams.append('filters', JSON.stringify(this.options.filters));
        }
        // Create EventSource
        this.eventSource = new EventSource(url.toString(), {
            headers: this.options.headers,
        });
        // Handle connection open
        this.eventSource.onopen = () => {
            console.log('✅ SSE connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            if (this.options.onConnect) {
                this.options.onConnect();
            }
        };
        // Handle messages
        this.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (this.options.onEvent) {
                    this.options.onEvent(data);
                }
            }
            catch (error) {
                console.error('Failed to parse SSE event:', error);
                if (this.options.onError) {
                    this.options.onError(error);
                }
            }
        };
        // Handle errors
        this.eventSource.onerror = (error) => {
            console.error('SSE error:', error);
            this.isConnected = false;
            if (this.options.onError) {
                this.options.onError(error);
            }
            if (this.options.onDisconnect) {
                this.options.onDisconnect();
            }
            // Close the connection
            if (this.eventSource) {
                this.eventSource.close();
                this.eventSource = undefined;
            }
            // Attempt reconnection
            if (this.shouldReconnect) {
                this.scheduleReconnect();
            }
        };
        // Handle specific event types
        this.eventSource.addEventListener('ping', () => {
            // Handle ping to keep connection alive
            console.log('🏓 SSE ping received');
        });
        this.eventSource.addEventListener('breadcrumb.created', (event) => {
            this.handleBreadcrumbEvent('breadcrumb.created', event);
        });
        this.eventSource.addEventListener('breadcrumb.updated', (event) => {
            this.handleBreadcrumbEvent('breadcrumb.updated', event);
        });
        this.eventSource.addEventListener('breadcrumb.deleted', (event) => {
            this.handleBreadcrumbEvent('breadcrumb.deleted', event);
        });
    }
    /**
     * Disconnect from SSE endpoint
     */
    disconnect() {
        console.log('🔌 Disconnecting SSE');
        this.shouldReconnect = false;
        this.isConnected = false;
        // Clear reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        // Close EventSource
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = undefined;
        }
        if (this.options.onDisconnect) {
            this.options.onDisconnect();
        }
    }
    /**
     * Handle breadcrumb events
     */
    handleBreadcrumbEvent(type, event) {
        try {
            const data = JSON.parse(event.data);
            const breadcrumbEvent = {
                type: type,
                ...data,
            };
            if (this.options.onEvent) {
                this.options.onEvent(breadcrumbEvent);
            }
        }
        catch (error) {
            console.error(`Failed to parse ${type} event:`, error);
            if (this.options.onError) {
                this.options.onError(error);
            }
        }
    }
    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        const maxAttempts = this.options.maxReconnectAttempts || 10;
        const delay = this.options.reconnectDelay || 5000;
        if (this.reconnectAttempts >= maxAttempts) {
            console.error(`Max reconnection attempts (${maxAttempts}) reached`);
            return;
        }
        this.reconnectAttempts++;
        // Exponential backoff with jitter
        const backoffDelay = Math.min(delay * Math.pow(2, this.reconnectAttempts - 1), 30000 // Max 30 seconds
        );
        const jitter = Math.random() * 1000;
        const totalDelay = backoffDelay + jitter;
        console.log(`🔄 Reconnecting in ${Math.round(totalDelay / 1000)}s (attempt ${this.reconnectAttempts}/${maxAttempts})`);
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, totalDelay);
    }
    /**
     * Check if connected
     */
    isConnectedToSSE() {
        return this.isConnected;
    }
    /**
     * Get connection stats
     */
    getStats() {
        return {
            connected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            url: this.options.url,
        };
    }
}
//# sourceMappingURL=sse-client.js.map