/**
 * UI State Manager
 * THE RCRT WAY: UI state is a breadcrumb (collaborative!)
 */

import type { RCRTClient } from './rcrt-client';

export interface UIStateContext {
  active_tab: 'chat' | 'notes' | 'save' | 'settings';
  current_conversation_id?: string;
  selected_note_id?: string;
  last_active_at: string;
  notes_scroll_position?: number;
  chat_scroll_position?: number;
}

export class UIStateManager {
  private client: RCRTClient;
  private stateBreadcrumbId: string | null = null;
  private currentVersion: number = 1;

  constructor(client: RCRTClient) {
    this.client = client;
  }

  /**
   * Load UI state from breadcrumb
   */
  async loadState(): Promise<UIStateContext> {
    try {
      const results = await this.client.searchBreadcrumbs({
        schema_name: 'extension.ui-state.v1',
        any_tags: ['extension:rcrt-v2', 'ui:state'],
        limit: 1
      });

      if (results.length > 0) {
        const state = results[0];
        this.stateBreadcrumbId = state.id;
        this.currentVersion = state.version;
        return state.context as UIStateContext;
      }

      return await this.createDefaultState();
    } catch (error) {
      console.error('[UIStateManager] Failed to load state:', error);
      return this.getDefaultState();
    }
  }

  /**
   * Update UI state
   */
  async updateState(updates: Partial<UIStateContext>): Promise<void> {
    if (!this.stateBreadcrumbId) {
      await this.createDefaultState(updates);
      return;
    }

    try {
      const current = await this.client.getBreadcrumb(this.stateBreadcrumbId);
      const newContext = {
        ...current.context,
        ...updates,
        last_active_at: new Date().toISOString()
      };

      await this.client.updateBreadcrumb(
        this.stateBreadcrumbId,
        this.currentVersion,
        {
          context: newContext,
          // Short TTL - UI state is ephemeral
          ttl: new Date(Date.now() + 24 * 3600000).toISOString() // 24 hours
        }
      );

      this.currentVersion++;
    } catch (error: any) {
      if (error.message?.includes('412')) {
        const current = await this.client.getBreadcrumb(this.stateBreadcrumbId);
        this.currentVersion = current.version;
        await this.updateState(updates);
      }
    }
  }

  /**
   * Create default UI state
   */
  private async createDefaultState(
    overrides: Partial<UIStateContext> = {}
  ): Promise<UIStateContext> {
    const defaults = this.getDefaultState();
    const context = { ...defaults, ...overrides };

    const breadcrumb = await this.client.createBreadcrumb({
      schema_name: 'extension.ui-state.v1',
      title: 'Extension UI State',
      tags: ['extension:rcrt-v2', 'ui:state', 'extension:ui-state'],
      context,
      ttl: new Date(Date.now() + 24 * 3600000).toISOString() // 24 hours TTL
    });

    this.stateBreadcrumbId = breadcrumb.id;
    this.currentVersion = 1;

    return context;
  }

  private getDefaultState(): UIStateContext {
    return {
      active_tab: 'chat',
      last_active_at: new Date().toISOString()
    };
  }
}

