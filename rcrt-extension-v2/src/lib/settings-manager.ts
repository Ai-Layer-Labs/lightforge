/**
 * Settings Manager
 * THE RCRT WAY: Settings are breadcrumbs, not Chrome storage
 */

import type { RCRTClient } from './rcrt-client';

export interface ExtensionSettingsContext {
  rcrt_server_url: string;
  workspace: string;
  multi_tab_tracking: boolean;
  theme: 'light' | 'dark' | 'system';
  auto_save_pages: boolean;
  semantic_search_enabled: boolean;
  collaboration_enabled: boolean;
  dashboard_url: string;
}

export class SettingsManager {
  private client: RCRTClient;
  private settingsBreadcrumbId: string | null = null;
  private currentVersion: number = 1;

  constructor(client: RCRTClient) {
    this.client = client;
  }

  /**
   * Load settings from breadcrumb
   */
  async loadSettings(): Promise<ExtensionSettingsContext> {
    try {
      // Search for existing settings breadcrumb
      const results = await this.client.searchBreadcrumbs({
        schema_name: 'extension.settings.v1',
        any_tags: ['extension:rcrt-v2', 'settings'],
        limit: 1
      });

      if (results && results.length > 0 && results[0]) {
        const settings = results[0];
        if (settings.id && settings.version && settings.context) {
          this.settingsBreadcrumbId = settings.id;
          this.currentVersion = settings.version;
          return settings.context as ExtensionSettingsContext;
        }
      }

      // Create default settings if none exist
      console.log('[SettingsManager] No settings found, creating defaults');
      return await this.createDefaultSettings();
    } catch (error) {
      console.error('[SettingsManager] Failed to load settings:', error);
      // Return defaults on error
      return this.getDefaultSettings();
    }
  }

  /**
   * Update settings
   */
  async updateSettings(updates: Partial<ExtensionSettingsContext>): Promise<ExtensionSettingsContext> {
    if (!this.settingsBreadcrumbId) {
      // Create settings if they don't exist
      return await this.createDefaultSettings(updates);
    }

    try {
      // Get current settings
      const current = await this.client.getBreadcrumb(this.settingsBreadcrumbId);
      const newContext = { ...current.context, ...updates };

      // Update breadcrumb
      await this.client.updateBreadcrumb(
        this.settingsBreadcrumbId,
        this.currentVersion,
        {
          context: newContext
        }
      );

      this.currentVersion++;

      // Cache URL in Chrome storage for quick access before RCRT connection
      if (updates.rcrt_server_url) {
        await chrome.storage.local.set({ _cachedServerUrl: updates.rcrt_server_url });
      }

      return newContext as ExtensionSettingsContext;
    } catch (error: any) {
      // Handle version conflicts
      if (error.message?.includes('412') || error.message?.includes('version_mismatch')) {
        const current = await this.client.getBreadcrumb(this.settingsBreadcrumbId);
        this.currentVersion = current.version;
        return await this.updateSettings(updates);
      }
      throw error;
    }
  }

  /**
   * Create default settings breadcrumb
   */
  private async createDefaultSettings(
    overrides: Partial<ExtensionSettingsContext> = {}
  ): Promise<ExtensionSettingsContext> {
    const defaults = this.getDefaultSettings();
    const context = { ...defaults, ...overrides };

    const breadcrumb = await this.client.createBreadcrumb({
      schema_name: 'extension.settings.v1',
      title: 'RCRT Extension Settings',
      tags: ['extension:rcrt-v2', 'settings', 'extension:settings'],
      context
    });

    this.settingsBreadcrumbId = breadcrumb.id;
    this.currentVersion = 1;

    return context;
  }

  /**
   * Get default settings
   */
  private getDefaultSettings(): ExtensionSettingsContext {
    return {
      rcrt_server_url: 'http://localhost:8081',
      workspace: 'workspace:browser',
      multi_tab_tracking: true,
      theme: 'system',
      auto_save_pages: false,
      semantic_search_enabled: true,
      collaboration_enabled: true,
      dashboard_url: 'http://localhost:8082'
    };
  }

  /**
   * Subscribe to settings changes (collaborative)
   */
  async subscribeToSettings(
    onChange: (settings: ExtensionSettingsContext) => void
  ): Promise<() => void> {
    if (!this.settingsBreadcrumbId) {
      await this.loadSettings();
    }

    return await this.client.subscribeToSSE(
      {
        schema_name: 'extension.settings.v1',
        any_tags: ['extension:rcrt-v2']
      },
      (event) => {
        // Defensive checks for SSE event
        if (!event || !event.breadcrumb) {
          console.warn('[SettingsManager] Invalid SSE event:', event);
          return;
        }
        
        if (event.breadcrumb.id === this.settingsBreadcrumbId) {
          this.currentVersion = event.breadcrumb.version;
          if (event.breadcrumb.context) {
            onChange(event.breadcrumb.context as ExtensionSettingsContext);
          }
        }
      }
    );
  }
}

