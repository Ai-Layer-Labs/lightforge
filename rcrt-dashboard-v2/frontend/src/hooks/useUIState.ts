/**
 * useUIState - React hook for managing UI state breadcrumbs
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthentication } from './useAuthentication';
import { StateManager, UIState } from '../services/StateManager';

/**
 * Hook to load and manage UI state from breadcrumbs
 */
export function useUIState(stateRef: string, initialContext?: Record<string, any>) {
  const { authenticatedFetch, isAuthenticated, authToken } = useAuthentication();
  const [state, setState] = useState<UIState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Create StateManager fresh each time to get current authenticatedFetch
  const stateManager = React.useMemo(
    () => new StateManager(authenticatedFetch),
    [authToken] // Recreate when token changes
  );

  // Load state on mount (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated || !authToken) {
      setLoading(false);
      return;
    }

    const loadState = async () => {
      setLoading(true);
      setError(null);

      try {
        const loadedState = await stateManager.getOrCreateState(
          stateRef,
          initialContext || {}
        );
        setState(loadedState);
      } catch (err) {
        setError(err as Error);
        console.error('Failed to load state:', err);
      } finally {
        setLoading(false);
      }
    };

    loadState();
  }, [stateRef, isAuthenticated, authToken, stateManager]);

  // Update state
  const updateState = useCallback(
    async (updates: Record<string, any>, merge: boolean = true) => {
      if (!state) return;

      try {
        const updated = await stateManager.updateState(stateRef, updates, merge);
        if (updated) {
          setState(updated);
        }
        return updated;
      } catch (err) {
        console.error('Failed to update state:', err);
        throw err;
      }
    },
    [state, stateRef, stateManager]
  );

  // Refresh state from server
  const refreshState = useCallback(async () => {
    stateManager.clearCache(stateRef);
    
    try {
      const refreshed = await stateManager.loadState(stateRef);
      setState(refreshed);
      return refreshed;
    } catch (err) {
      console.error('Failed to refresh state:', err);
      throw err;
    }
  }, [stateRef, stateManager]);

  // Poll for state changes every 2 seconds when not loading
  useEffect(() => {
    if (!isAuthenticated || !authToken || loading || !state) return;

    const pollInterval = setInterval(async () => {
      try {
        stateManager.clearCache(stateRef);
        const refreshed = await stateManager.loadState(stateRef);
        if (refreshed && refreshed.version !== state.version) {
          console.log('🔄 State changed, updating UI (version', state.version, '→', refreshed.version, ')');
          setState(refreshed);
        }
      } catch (err) {
        // Silently fail - polling errors are not critical
      }
    }, 2000); // Poll every 2 seconds instead of 500ms

    return () => clearInterval(pollInterval);
  }, [isAuthenticated, authToken, loading, state?.version, stateRef, stateManager]);

  return {
    state: state?.context || null,
    stateId: state?.id,
    version: state?.version,
    loading,
    error,
    updateState,
    refreshState,
    stateManager,
  };
}

