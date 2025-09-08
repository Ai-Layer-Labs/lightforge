/**
 * useRCRT Hook
 * React hook for accessing RCRT client and operations
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { BreadcrumbCreate, Breadcrumb, SearchParams } from '@rcrt-builder/core';

interface UseRCRTOptions {
  url?: string;
  workspace?: string;
  autoConnect?: boolean;
}

interface UseRCRTReturn {
  client: RcrtClientEnhanced;
  isConnected: boolean;
  error: Error | null;
  
  // Breadcrumb operations
  createBreadcrumb: (data: BreadcrumbCreate, idempotencyKey?: string) => Promise<{ id: string }>;
  updateBreadcrumb: (id: string, version: number, updates: any) => Promise<Breadcrumb>;
  deleteBreadcrumb: (id: string, version: number) => Promise<void>;
  getBreadcrumb: (id: string) => Promise<Breadcrumb>;
  searchBreadcrumbs: (params: SearchParams) => Promise<Breadcrumb[]>;
  
  // Agent operations
  listAgents: () => Promise<any[]>;
  createAgent: (agentId: string, roles: string[]) => Promise<any>;
  deleteAgent: (agentId: string) => Promise<any>;
  
  // DLQ operations
  listDlq: () => Promise<any[]>;
  retryDlqItem: (dlqId: string) => Promise<any>;
  
  // Utility
  reconnect: () => void;
  disconnect: () => void;
}

export function useRCRT(options: UseRCRTOptions = {}): UseRCRTReturn {
  const {
    url = (typeof window !== 'undefined' ? '/api/rcrt' : (process.env.NEXT_PUBLIC_RCRT_URL || 'http://localhost:8081')),
    workspace = 'workspace:default',
    autoConnect = true
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Create client instance
  const client = useMemo(() => {
    return new RcrtClientEnhanced(url);
  }, [url]);

  // Test connection
  useEffect(() => {
    if (autoConnect) {
      testConnection();
    }
  }, [autoConnect]);

  const testConnection = async () => {
    try {
      // Try to list agents as a connection test
      await client.listAgents();
      setIsConnected(true);
      setError(null);
    } catch (err: any) {
      setIsConnected(false);
      setError(err);
    }
  };

  // Wrapped operations with error handling
  const createBreadcrumb = useCallback(async (
    data: BreadcrumbCreate, 
    idempotencyKey?: string
  ) => {
    try {
      const result = await client.createBreadcrumb({
        ...data,
        tags: [...(data.tags || []), workspace]
      }, idempotencyKey);
      return result;
    } catch (err: any) {
      setError(err);
      throw err;
    }
  }, [client, workspace]);

  const updateBreadcrumb = useCallback(async (
    id: string,
    version: number,
    updates: any
  ) => {
    try {
      const result = await client.updateBreadcrumb(id, version, updates);
      return result;
    } catch (err: any) {
      setError(err);
      throw err;
    }
  }, [client]);

  const deleteBreadcrumb = useCallback(async (
    id: string,
    version: number
  ) => {
    try {
      await client.deleteBreadcrumb(id, version);
    } catch (err: any) {
      setError(err);
      throw err;
    }
  }, [client]);

  const getBreadcrumb = useCallback(async (id: string) => {
    try {
      const result = await client.getBreadcrumbFull(id);
      return result;
    } catch (err: any) {
      setError(err);
      throw err;
    }
  }, [client]);

  const searchBreadcrumbs = useCallback(async (params: SearchParams) => {
    try {
      const result = await client.searchBreadcrumbs({
        ...params,
        tag: workspace
      });
      return result;
    } catch (err: any) {
      setError(err);
      throw err;
    }
  }, [client, workspace]);

  const listAgents = useCallback(async () => {
    try {
      const result = await client.listAgents();
      return result;
    } catch (err: any) {
      setError(err);
      throw err;
    }
  }, [client]);

  const createAgent = useCallback(async (agentId: string, roles: string[]) => {
    try {
      const result = await client.createOrUpdateAgent(agentId, roles);
      return result;
    } catch (err: any) {
      setError(err);
      throw err;
    }
  }, [client]);

  const deleteAgent = useCallback(async (agentId: string) => {
    try {
      const result = await client.deleteAgent(agentId);
      return result;
    } catch (err: any) {
      setError(err);
      throw err;
    }
  }, [client]);

  const listDlq = useCallback(async () => {
    try {
      const result = await client.listDlq();
      return result;
    } catch (err: any) {
      setError(err);
      throw err;
    }
  }, [client]);

  const retryDlqItem = useCallback(async (dlqId: string) => {
    try {
      const result = await client.retryDlqItem(dlqId);
      return result;
    } catch (err: any) {
      setError(err);
      throw err;
    }
  }, [client]);

  const reconnect = useCallback(() => {
    testConnection();
  }, []);

  const disconnect = useCallback(() => {
    setIsConnected(false);
  }, []);

  return {
    client,
    isConnected,
    error,
    createBreadcrumb,
    updateBreadcrumb,
    deleteBreadcrumb,
    getBreadcrumb,
    searchBreadcrumbs,
    listAgents,
    createAgent,
    deleteAgent,
    listDlq,
    retryDlqItem,
    reconnect,
    disconnect
  };
}
