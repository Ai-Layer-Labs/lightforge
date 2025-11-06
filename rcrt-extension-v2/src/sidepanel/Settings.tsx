/**
 * Settings Component
 * Configure RCRT connection and extension behavior
 */

import { useState, useEffect } from 'react';
import { Check, AlertCircle, Loader, RefreshCw } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { RCRTClient } from '../lib/rcrt-client';

export function Settings() {
  const { settings, loading, updateSettings } = useSettings();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    rcrtServerUrl: 'http://localhost:8081',
    workspace: 'workspace:browser',
    multiTabTracking: true,
  });

  useEffect(() => {
    if (!loading && settings) {
      setFormData({
        rcrtServerUrl: settings.rcrt_server_url || 'http://localhost:8081',
        workspace: settings.workspace || 'workspace:browser',
        multiTabTracking: settings.multi_tab_tracking !== false,
      });
    }
  }, [settings, loading]);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const client = new RCRTClient({
        baseUrl: formData.rcrtServerUrl
      });

      const connected = await client.testConnection();

      if (connected) {
        // Try to authenticate
        try {
          await client.authenticate();
          setTestResult({
            success: true,
            message: 'Successfully connected and authenticated with RCRT server'
          });
        } catch (authError) {
          setTestResult({
            success: false,
            message: `Connected but authentication failed: ${authError instanceof Error ? authError.message : 'Unknown error'}`
          });
        }
      } else {
        setTestResult({
          success: false,
          message: 'Could not connect to RCRT server. Is it running?'
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      // Convert form data to settings context format
      await updateSettings({
        rcrt_server_url: formData.rcrtServerUrl,
        workspace: formData.workspace,
        multi_tab_tracking: formData.multiTabTracking
      });
      setTestResult({
        success: true,
        message: 'Settings saved successfully. Extension will reinitialize.'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to save settings'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormData({
      rcrtServerUrl: 'http://localhost:8081',
      workspace: 'workspace:browser',
      multiTabTracking: true,
    });
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-6">
        <h2 className="text-xl font-bold text-white">Settings</h2>

        {/* RCRT Server */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            RCRT Server URL
          </label>
          <input
            type="text"
            value={formData.rcrtServerUrl}
            onChange={(e) => setFormData({ ...formData, rcrtServerUrl: e.target.value })}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            placeholder="http://localhost:8081"
          />
          <p className="text-xs text-gray-500 mt-1">
            Default: http://localhost:8081
          </p>
        </div>

        {/* Workspace */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Workspace
          </label>
          <input
            type="text"
            value={formData.workspace}
            onChange={(e) => setFormData({ ...formData, workspace: e.target.value })}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            placeholder="workspace:browser"
          />
          <p className="text-xs text-gray-500 mt-1">
            Workspace for organizing notes and context
          </p>
        </div>

        {/* Multi-Tab Tracking */}
        <div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={formData.multiTabTracking}
              onChange={(e) => setFormData({ ...formData, multiTabTracking: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-gray-900 border-gray-700 rounded focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-300">
                Multi-Tab Context Tracking
              </span>
              <p className="text-xs text-gray-500 mt-1">
                Track all open tabs (active tab tagged for agent subscriptions)
              </p>
            </div>
          </label>
        </div>

        {/* Test Connection */}
        <button
          onClick={handleTestConnection}
          disabled={testing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testing ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              <span>Testing...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              <span>Test Connection</span>
            </>
          )}
        </button>

        {/* Test Result */}
        {testResult && (
          <div className={`flex items-start gap-2 p-3 rounded-lg ${
            testResult.success
              ? 'bg-green-900/20 border border-green-500/50'
              : 'bg-red-900/20 border border-red-500/50'
          }`}>
            {testResult.success ? (
              <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            )}
            <p className={`text-sm ${testResult.success ? 'text-green-300' : 'text-red-300'}`}>
              {testResult.message}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>

          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Info Section */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-2">About RCRT Extension v2</h3>
          <div className="text-xs text-gray-400 space-y-1">
            <p>• Enterprise-grade note taking and AI assistant</p>
            <p>• Unlimited storage (PostgreSQL backend)</p>
            <p>• Semantic search with pgvector</p>
            <p>• Multi-agent processing (parallel)</p>
            <p>• Real-time collaboration via SSE</p>
            <p>• Multi-tab context awareness</p>
          </div>
        </div>

        {/* Version */}
        <div className="text-center text-xs text-gray-600">
          Version 2.0.0
        </div>
      </div>
    </div>
  );
}

