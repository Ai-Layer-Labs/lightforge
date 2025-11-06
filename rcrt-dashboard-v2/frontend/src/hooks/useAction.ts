/**
 * useAction - React hook for executing actions from UI breadcrumbs
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthentication } from './useAuthentication';
import { ActionRunner, Action, ActionContext } from '../services/ActionRunner';
import { StateManager } from '../services/StateManager';

/**
 * Hook to create an action runner for executing UI actions
 */
export function useAction(stateManager: StateManager, defaultStateRef?: string) {
  const { authenticatedFetch, authToken } = useAuthentication();
  const navigate = useNavigate();
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);

  // Recreate ActionRunner when auth token changes to get fresh authenticatedFetch
  const actionRunner = React.useMemo(
    () => new ActionRunner(authenticatedFetch, stateManager, navigate, defaultStateRef),
    [authToken, stateManager, navigate, defaultStateRef]
  );

  const execute = useCallback(
    async (action: Action, context: ActionContext = {}) => {
      setIsExecuting(true);
      setLastError(null);

      try {
        const result = await actionRunner.execute(action, context);
        return result;
      } catch (error) {
        setLastError(error as Error);
        throw error;
      } finally {
        setIsExecuting(false);
      }
    },
    [actionRunner]
  );

  return {
    execute,
    actionRunner,
    isExecuting,
    lastError,
  };
}

