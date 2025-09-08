/**
 * SSE Client Wrapper
 * Handles Server-Sent Events with auto-reconnect
 */
import { BreadcrumbEvent, Selector } from '@rcrt-builder/core';
export interface SSEClientOptions {
    url: string;
    headers?: Record<string, string>;
    reconnectDelay?: number;
    maxReconnectAttempts?: number;
    filters?: Selector;
    agentId?: string;
    onEvent?: (event: BreadcrumbEvent) => void;
    onError?: (error: any) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
}
export declare class SSEClient {
    private eventSource?;
    private options;
    private reconnectAttempts;
    private reconnectTimer?;
    private isConnected;
    private shouldReconnect;
    constructor(options: SSEClientOptions);
    /**
     * Connect to SSE endpoint
     */
    connect(): void;
    /**
     * Disconnect from SSE endpoint
     */
    disconnect(): void;
    /**
     * Handle breadcrumb events
     */
    private handleBreadcrumbEvent;
    /**
     * Schedule reconnection attempt
     */
    private scheduleReconnect;
    /**
     * Check if connected
     */
    isConnectedToSSE(): boolean;
    /**
     * Get connection stats
     */
    getStats(): {
        connected: boolean;
        reconnectAttempts: number;
        url: string;
    };
}
//# sourceMappingURL=sse-client.d.ts.map