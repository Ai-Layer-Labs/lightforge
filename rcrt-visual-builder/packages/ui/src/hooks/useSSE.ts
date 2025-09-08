/**
 * useSSE Hook
 * React hook for Server-Sent Events with auto-reconnect
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { BreadcrumbEvent, Selector } from '@rcrt-builder/core';

interface UseSSEOptions {
  workspace: string;
  onEvent?: (event: BreadcrumbEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  filters?: Selector;
}

interface UseSSEReturn {
  isConnected: boolean;
  events: BreadcrumbEvent[];
  error: Error | null;
  reconnectAttempts: number;
  connect: () => void;
  disconnect: () => void;
  clearEvents: () => void;
}

export function useSSE(options: UseSSEOptions): UseSSEReturn {
  const {
    workspace,
    onEvent,
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    reconnectDelay = 5000,
    maxReconnectAttempts = 10,
    filters
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<BreadcrumbEvent[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Build SSE URL with filters
  const buildUrl = useCallback(() => {
    const isBrowser = typeof window !== 'undefined';
    const path = '/events/stream';
    // Build URL and send filters JSON (compatible with SDK backend)
    const mergedFilters = {
      ...(filters || {}),
      any_tags: [...(filters?.any_tags || []), workspace]
    };

    if (isBrowser) {
      const url = new URL(`/api/rcrt${path}`, window.location.origin);
      url.searchParams.append('filters', JSON.stringify(mergedFilters));
      return url.toString();
    }
    // Server-side: absolute URL
    const baseUrl = process.env.NEXT_PUBLIC_RCRT_URL || 'http://localhost:8081';
    const url = new URL(`${baseUrl}${path}`);
    url.searchParams.append('filters', JSON.stringify(mergedFilters));
    
    // Add workspace filter
    url.searchParams.append('tag', workspace);
    
    // Add additional filters
    if (filters) {
      if (filters.any_tags) {
        filters.any_tags.forEach(tag => url.searchParams.append('tag', tag));
      }
      if (filters.schema_name) {
        url.searchParams.append('schema', filters.schema_name);
      }
      if (filters.context_path) {
        url.searchParams.append('context_path', filters.context_path);
      }
    }
    
    return url.toString();
  }, [workspace, filters]);

  // Connect to SSE
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = buildUrl();
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (!mountedRef.current) return;
      
      setIsConnected(true);
      setError(null);
      setReconnectAttempts(0);
      onConnect?.();
      
      console.log(`SSE connected to ${url}`);
    };

    eventSource.onmessage = (event) => {
      if (!mountedRef.current) return;
      
      try {
        const data = JSON.parse(event.data);
        
        // Handle ping events
        if (data.type === 'ping') {
          return; // Ignore ping events
        }
        
        // Process breadcrumb event
        const breadcrumbEvent: BreadcrumbEvent = {
          type: data.type || 'breadcrumb.created',
          breadcrumb_id: data.breadcrumb_id,
          timestamp: data.timestamp || new Date().toISOString(),
          data: data
        };
        
        setEvents(prev => [...prev, breadcrumbEvent]);
        onEvent?.(breadcrumbEvent);
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = (err) => {
      if (!mountedRef.current) return;
      
      console.error('SSE error:', err);
      setIsConnected(false);
      
      const error = new Error('SSE connection error');
      setError(error);
      onError?.(error);
      onDisconnect?.();
      
      eventSource.close();
      eventSourceRef.current = null;
      
      // Auto-reconnect logic
      if (autoReconnect && reconnectAttempts < maxReconnectAttempts) {
        const delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttempts), 30000);
        console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }
        }, delay);
      }
    };

    // Add custom event listeners for specific event types
    eventSource.addEventListener('breadcrumb.created', (event: any) => {
      if (!mountedRef.current) return;
      handleTypedEvent('breadcrumb.created', event);
    });

    eventSource.addEventListener('breadcrumb.updated', (event: any) => {
      if (!mountedRef.current) return;
      handleTypedEvent('breadcrumb.updated', event);
    });

    eventSource.addEventListener('breadcrumb.deleted', (event: any) => {
      if (!mountedRef.current) return;
      handleTypedEvent('breadcrumb.deleted', event);
    });

    eventSource.addEventListener('flow.update', (event: any) => {
      if (!mountedRef.current) return;
      handleTypedEvent('flow.update', event);
    });

    eventSource.addEventListener('agent.status', (event: any) => {
      if (!mountedRef.current) return;
      handleTypedEvent('agent.status', event);
    });
  }, [buildUrl, onConnect, onDisconnect, onError, onEvent, autoReconnect, reconnectAttempts, maxReconnectAttempts, reconnectDelay]);

  // Handle typed events
  const handleTypedEvent = (type: string, event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      const breadcrumbEvent: BreadcrumbEvent = {
        type,
        breadcrumb_id: data.breadcrumb_id,
        timestamp: data.timestamp || new Date().toISOString(),
        data
      };
      
      setEvents(prev => [...prev, breadcrumbEvent]);
      onEvent?.(breadcrumbEvent);
    } catch (err) {
      console.error(`Failed to parse ${type} event:`, err);
    }
  };

  // Disconnect from SSE
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
    onDisconnect?.();
  }, [onDisconnect]);

  // Clear events
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, []); // Empty deps intentional - only run on mount/unmount

  // Reconnect when workspace or filters change
  useEffect(() => {
    if (isConnected) {
      disconnect();
      connect();
    }
  }, [workspace, filters]);

  return {
    isConnected,
    events,
    error,
    reconnectAttempts,
    connect,
    disconnect,
    clearEvents
  };
}
