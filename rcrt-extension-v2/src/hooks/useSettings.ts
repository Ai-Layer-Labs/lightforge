/**
 * React hook for extension settings
 * THE RCRT WAY: Settings are breadcrumbs, not Chrome storage
 */

import { useState, useEffect } from 'react';
import { useRCRTClient } from './useRCRTClient';
import { SettingsManager, type ExtensionSettingsContext } from '../lib/settings-manager';

const defaultSettings: ExtensionSettingsContext = {
  rcrt_server_url: 'http://localhost:8081',
  workspace: 'workspace:browser',
  multi_tab_tracking: true,
  theme: 'system',
  auto_save_pages: false,
  semantic_search_enabled: true,
  collaboration_enabled: true,
  dashboard_url: 'http://localhost:8082'
};

export function useSettings() {
  const { client } = useRCRTClient();
  const [settings, setSettings] = useState<ExtensionSettingsContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<SettingsManager | null>(null);

  useEffect(() => {
    if (!client) {
      // Set defaults immediately if no client
      setSettings(defaultSettings);
      setLoading(false);
      return;
    }

    const settingsManager = new SettingsManager(client);
    setManager(settingsManager);

    // Load settings from breadcrumb
    settingsManager.loadSettings()
      .then(loadedSettings => {
        setSettings(loadedSettings);
        setLoading(false);

        // Subscribe to settings changes (collaborative!)
        settingsManager.subscribeToSettings((updatedSettings) => {
          setSettings(updatedSettings);
        });
      })
      .catch(error => {
        console.error('[useSettings] Failed to load:', error);
        // Use defaults on error
        setSettings(defaultSettings);
        setLoading(false);
      });
  }, [client]);

  const updateSettings = async (updates: Partial<ExtensionSettingsContext>) => {
    if (!manager) {
      console.warn('[useSettings] Cannot update - manager not initialized');
      return;
    }

    try {
      const newSettings = await manager.updateSettings(updates);
      setSettings(newSettings);
      
      // Reinitialize background if server URL changed
      if (updates.rcrt_server_url) {
        chrome.runtime.sendMessage({ type: 'REINITIALIZE' });
      }
    } catch (error) {
      console.error('[useSettings] Update failed:', error);
    }
  };

  return { settings: settings || defaultSettings, loading, updateSettings };
}

