/**
 * StateManager - Manages UI state stored in breadcrumbs
 * Loads, updates, and creates ephemeral state breadcrumbs (ui.state.v1)
 */

import { setPath } from '../utils/TemplateEngine';

export interface UIState {
  id: string;
  version: number;
  context: Record<string, any>;
  tags: string[];
}

export class StateManager {
  private authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  private stateCache: Map<string, UIState> = new Map();

  constructor(authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>) {
    this.authenticatedFetch = authenticatedFetch;
  }

  /**
   * Load state breadcrumb by reference (tag or ID)
   */
  async loadState(stateRef: string): Promise<UIState | null> {
    console.log('📦 Loading state:', stateRef);

    try {
      // Check cache first
      if (this.stateCache.has(stateRef)) {
        console.log('✅ State loaded from cache');
        return this.stateCache.get(stateRef)!;
      }

      // If it looks like a UUID, load by ID
      if (stateRef.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const response = await this.authenticatedFetch(`/api/breadcrumbs/${stateRef}/full`);
        if (!response.ok) {
          throw new Error(`Failed to load state: ${response.status}`);
        }
        const breadcrumb = await response.json();
        const state: UIState = {
          id: breadcrumb.id,
          version: breadcrumb.version,
          context: breadcrumb.context,
          tags: breadcrumb.tags,
        };
        this.stateCache.set(stateRef, state);
        return state;
      }

      // Otherwise search by tag
      const searchParams = new URLSearchParams();
      searchParams.append('schema_name', 'ui.state.v1');
      searchParams.append('tag', stateRef);

      const response = await this.authenticatedFetch(`/api/breadcrumbs?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to search for state');
      }

      const states = await response.json();

      if (states.length === 0) {
        console.warn('⚠️ No state found for:', stateRef);
        return null;
      }

      // Load full state breadcrumb
      const stateId = states[0].id;
      const fullResponse = await this.authenticatedFetch(`/api/breadcrumbs/${stateId}/full`);
      if (!fullResponse.ok) {
        throw new Error('Failed to load state details');
      }

      const breadcrumb = await fullResponse.json();
      const state: UIState = {
        id: breadcrumb.id,
        version: breadcrumb.version,
        context: breadcrumb.context,
        tags: breadcrumb.tags,
      };

      this.stateCache.set(stateRef, state);
      console.log('✅ State loaded:', state.id);
      return state;
    } catch (error) {
      console.error('❌ Failed to load state:', error);
      return null;
    }
  }

  /**
   * Update state breadcrumb with new values
   */
  async updateState(
    stateRef: string,
    updates: Record<string, any>,
    merge: boolean = true
  ): Promise<UIState | null> {
    console.log('💾 Updating state:', stateRef, updates);

    try {
      // Load current state
      const currentState = await this.loadState(stateRef);
      if (!currentState) {
        throw new Error('State not found');
      }

      // Apply updates
      let newContext: Record<string, any>;
      
      if (merge) {
        // Merge updates using deep path setting
        newContext = { ...currentState.context };
        for (const [path, value] of Object.entries(updates)) {
          if (path.includes('.')) {
            // Use setPath for nested updates
            newContext = setPath(newContext, path, value);
          } else {
            // Direct property update
            newContext[path] = value;
          }
        }
      } else {
        // Replace entire context
        newContext = updates;
      }

      // Update breadcrumb
      const response = await this.authenticatedFetch(`/api/breadcrumbs/${currentState.id}`, {
        method: 'PATCH',
        headers: {
          'If-Match': String(currentState.version),
        },
        body: JSON.stringify({
          context: newContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update state: ${response.status}`);
      }

      // Update cache
      const updatedState: UIState = {
        id: currentState.id,
        version: currentState.version + 1,
        context: newContext,
        tags: currentState.tags,
      };

      this.stateCache.set(stateRef, updatedState);
      this.stateCache.set(currentState.id, updatedState);
      
      console.log('✅ State updated');
      return updatedState;
    } catch (error) {
      console.error('❌ Failed to update state:', error);
      return null;
    }
  }

  /**
   * Create a new state breadcrumb
   */
  async createState(
    stateRef: string,
    initialContext: Record<string, any>,
    ttlDuration: string = '2h'
  ): Promise<UIState | null> {
    console.log('➕ Creating state:', stateRef);

    try {
      const response = await this.authenticatedFetch('/api/breadcrumbs', {
        method: 'POST',
        body: JSON.stringify({
          title: `UI State: ${stateRef}`,
          schema_name: 'ui.state.v1',
          tags: ['state', stateRef, 'ephemeral'],
          context: initialContext,
          ttl_type: 'duration',
          ttl_config: { duration: ttlDuration },
          visibility: 'private',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create state');
      }

      const result = await response.json();
      
      // Load the created state
      return await this.loadState(result.id);
    } catch (error) {
      console.error('❌ Failed to create state:', error);
      return null;
    }
  }

  /**
   * Get or create state
   */
  async getOrCreateState(
    stateRef: string,
    initialContext: Record<string, any>,
    ttlDuration: string = '2h'
  ): Promise<UIState | null> {
    const existing = await this.loadState(stateRef);
    if (existing) {
      return existing;
    }
    return await this.createState(stateRef, initialContext, ttlDuration);
  }

  /**
   * Clear cache for a specific state
   */
  clearCache(stateRef: string) {
    this.stateCache.delete(stateRef);
  }

  /**
   * Clear all cached states
   */
  clearAllCache() {
    this.stateCache.clear();
  }
}

