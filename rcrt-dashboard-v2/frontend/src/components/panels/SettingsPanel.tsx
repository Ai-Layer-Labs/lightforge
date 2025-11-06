import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Cog6ToothIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

export function SettingsPanel() {
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<{ success: boolean; message: string } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string } | null>(null);

  const handlePurge = async () => {
    setPurging(true);
    setPurgeResult(null);

    try {
      const response = await fetch('http://localhost:8081/hygiene/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        setPurgeResult({
          success: true,
          message: `Purged ${result.total_cleaned || 0} breadcrumbs. Reload page to see changes.`
        });
      } else {
        setPurgeResult({
          success: false,
          message: `Failed: ${response.statusText}`
        });
      }
    } catch (error) {
      setPurgeResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to purge'
      });
    } finally {
      setPurging(false);
    }
  };

  const handleFullReset = async () => {
    if (!confirm('⚠️ FULL DATABASE RESET\n\nThis will DELETE ALL DATA:\n- All breadcrumbs\n- All sessions\n- All notes\n- All agents\n- All tools\n\nThen rebootstrap the system.\n\nAre you sure?')) {
      return;
    }

    setResetting(true);
    setResetResult(null);

    try {
      // Get auth token
      const tokenResp = await fetch('http://localhost:8081/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: '00000000-0000-0000-0000-000000000001',
          agent_id: '00000000-0000-0000-0000-000000000AAA',
          roles: ['curator']
        })
      });
      const { token } = await tokenResp.json();

      // Get all breadcrumbs
      const listResp = await fetch('http://localhost:8081/breadcrumbs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const breadcrumbs = await listResp.json();

      // Delete all breadcrumbs
      let deleted = 0;
      for (const bc of breadcrumbs) {
        try {
          await fetch(`http://localhost:8081/breadcrumbs/${bc.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          deleted++;
        } catch (e) {
          console.error(`Failed to delete ${bc.id}:`, e);
        }
      }

      setResetResult({
        success: true,
        message: `Deleted ${deleted} breadcrumbs. Reloading in 3 seconds to rebootstrap...`
      });

      // Reload page after 3 seconds
      setTimeout(() => {
        window.location.reload();
      }, 3000);

    } catch (error) {
      setResetResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to reset'
      });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900/50">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Cog6ToothIcon className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Settings</h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Database Cleanup */}
        <motion.div
          className="bg-gray-800/50 border border-gray-700 rounded-lg p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <TrashIcon className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold text-white text-sm">Database Cleanup</h3>
          </div>

          <p className="text-xs text-gray-400 mb-3">
            Purge expired breadcrumbs (TTL-based). Browser contexts older than 5 minutes will be removed.
          </p>

          {purgeResult && (
            <div className={`mb-3 p-3 rounded-lg ${
              purgeResult.success 
                ? 'bg-green-900/20 border border-green-500/50 text-green-300'
                : 'bg-red-900/20 border border-red-500/50 text-red-300'
            }`}>
              <p className="text-xs">{purgeResult.message}</p>
            </div>
          )}

          <button
            onClick={handlePurge}
            disabled={purging}
            className={`w-full px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              purging
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {purging ? 'Purging...' : 'Purge Expired Breadcrumbs'}
          </button>
        </motion.div>

        {/* Full Reset */}
        <motion.div
          className="bg-gray-800/50 border border-red-700/50 rounded-lg p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />
            <h3 className="font-semibold text-red-400 text-sm">Full Database Reset</h3>
          </div>

          <p className="text-xs text-gray-400 mb-3">
            Deletes ALL breadcrumbs, agents, tools, sessions, and notes. Then reloads page to trigger rebootstrap.
          </p>

          {resetResult && (
            <div className={`mb-3 p-3 rounded-lg ${
              resetResult.success 
                ? 'bg-green-900/20 border border-green-500/50 text-green-300'
                : 'bg-red-900/20 border border-red-500/50 text-red-300'
            }`}>
              <p className="text-xs">{resetResult.message}</p>
            </div>
          )}

          <button
            onClick={handleFullReset}
            disabled={resetting}
            className={`w-full px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              resetting
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-red-900 text-red-300 hover:bg-red-800 border border-red-700'
            }`}
          >
            {resetting ? 'Resetting...' : '🔥 Full Reset & Rebootstrap'}
          </button>

          <p className="text-xs text-yellow-500 mt-2">
            ⚠️ This cannot be undone! All data will be lost.
          </p>
        </motion.div>

        {/* Docker Command */}
        <motion.div
          className="bg-gray-800/50 border border-gray-700 rounded-lg p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <ArrowPathIcon className="w-4 h-4 text-gray-400" />
            <h3 className="font-semibold text-white text-sm">Docker Reset (Dev)</h3>
          </div>

          <p className="text-xs text-gray-400 mb-2">
            For Docker Compose deployments:
          </p>

          <pre className="text-xs text-gray-300 bg-black/50 p-3 rounded overflow-x-auto">
./scripts/reset-database-docker.sh
          </pre>

          <p className="text-xs text-gray-500 mt-2">
            Or manually:
          </p>

          <pre className="text-xs text-gray-300 bg-black/50 p-3 rounded overflow-x-auto mt-1">
docker compose down -v
docker compose up -d
{/* Wait 30s */}
cd bootstrap-breadcrumbs
node bootstrap.js
          </pre>
        </motion.div>

        {/* Info */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Purge: Removes expired breadcrumbs only</p>
          <p>• Full Reset: Deletes everything, rebootstraps</p>
          <p>• Docker Reset: For development environments</p>
        </div>
      </div>
    </div>
  );
}

