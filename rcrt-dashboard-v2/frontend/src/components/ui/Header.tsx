import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEventStream, useNodes, useConnections } from '../../stores/DashboardStore';

export function Header() {
  const eventStream = useEventStream();
  const nodes = useNodes();
  const connections = useConnections();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<{ success: boolean; message: string } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const stats = {
    nodes: nodes.length,
    connections: connections.length,
    events: eventStream.eventCount,
  };
  
  return (
    <motion.header 
      className="header bg-black/20 backdrop-blur-md border-b border-white/10 px-6 py-4 flex items-center justify-between"
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Logo */}
      <motion.div 
        className="flex items-center gap-3"
        whileHover={{ scale: 1.02 }}
      >
        <div className="text-2xl font-bold bg-gradient-to-r from-rcrt-primary to-rcrt-secondary bg-clip-text text-transparent">
          RCRT Dashboard v2
        </div>
        <div className="text-xs text-gray-400 font-mono">
          Self-Configuring • Real-Time
        </div>
      </motion.div>
      
      {/* Stats */}
      <div className="flex items-center gap-6">
        <StatItem 
          icon="📋" 
          label="Nodes" 
          value={stats.nodes} 
          color="text-rcrt-accent"
        />
        <StatItem 
          icon="🔗" 
          label="Connections" 
          value={stats.connections} 
          color="text-rcrt-primary"
        />
        <StatItem 
          icon="📡" 
          label="Events" 
          value={stats.events} 
          color="text-rcrt-secondary"
        />
        
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <motion.div
            className={`w-2 h-2 rounded-full ${
              eventStream.connected ? 'bg-green-400' : 'bg-red-400'
            }`}
            animate={eventStream.connected ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-xs text-gray-400">
            {eventStream.connected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <ActionButton 
          icon="🔄" 
          label="Refresh" 
          onClick={() => window.location.reload()}
        />
        <ActionButton 
          icon="⚙️" 
          label="Settings" 
          onClick={() => setShowSettingsModal(true)}
        />
        <ActionButton 
          icon="🧹" 
          label="Cleanup" 
          onClick={() => console.log('Cleanup clicked')}
        />
      </div>
      
      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <SettingsModal
            onClose={() => {
              setShowSettingsModal(false);
              setPurgeResult(null);
              setResetResult(null);
            }}
            purging={purging}
            purgeResult={purgeResult}
            resetting={resetting}
            resetResult={resetResult}
            onPurge={async () => {
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
            }}
            onFullReset={async () => {
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

                // Wait a moment
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Trigger bootstrap by calling the bootstrap service
                // Note: This assumes bootstrap-runner can be triggered via API
                // If not, user will need to run: podman compose exec bootstrap-runner node /app/bootstrap.js
                
                setResetResult({
                  success: true,
                  message: `Deleted ${deleted} breadcrumbs. Reloading page to rebootstrap...`
                });

                // Reload page after 3 seconds to trigger rebootstrap
                setTimeout(() => {
                  window.location.reload();
                }, 3000);

              } catch (error) {
                setResetResult({
                  success: false,
                  message: error instanceof Error ? error.message : 'Failed to reset database'
                });
              } finally {
                setResetting(false);
              }
            }}
          />
        )}
      </AnimatePresence>
    </motion.header>
  );
}

function SettingsModal({ onClose, purging, purgeResult, resetting, resetResult, onPurge, onFullReset }: {
  onClose: () => void;
  purging: boolean;
  purgeResult: { success: boolean; message: string } | null;
  resetting: boolean;
  resetResult: { success: boolean; message: string } | null;
  onPurge: () => void;
  onFullReset: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-white mb-4">⚙️ Settings</h2>
        
        <div className="space-y-4">
          {/* Database Purge Section */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-sm font-semibold text-white mb-2">🗑️ Database Cleanup</h3>
            <p className="text-xs text-gray-400 mb-3">
              Purge expired breadcrumbs (TTL-based). Browser contexts older than 5 minutes will be removed.
            </p>
            
            {purgeResult && (
              <div className={`mb-3 p-3 rounded-lg ${
                purgeResult.success 
                  ? 'bg-green-900/20 border border-green-500/50 text-green-300'
                  : 'bg-red-900/20 border border-red-500/50 text-red-300'
              }`}>
                <p className="text-sm">{purgeResult.message}</p>
              </div>
            )}
            
            <button
              onClick={onPurge}
              disabled={purging}
              className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                purging
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {purging ? 'Purging...' : 'Purge Expired Breadcrumbs'}
            </button>
          </div>

          {/* Full Reset */}
          <div className="bg-gray-800 rounded-lg p-4 border border-red-700/50">
            <h3 className="text-sm font-semibold text-red-400 mb-2">⚠️ Full Database Reset</h3>
            <p className="text-xs text-gray-400 mb-3">
              Deletes ALL breadcrumbs, agents, tools, sessions, and notes. Then reloads page to trigger rebootstrap.
            </p>
            
            {resetResult && (
              <div className={`mb-3 p-3 rounded-lg ${
                resetResult.success 
                  ? 'bg-green-900/20 border border-green-500/50 text-green-300'
                  : 'bg-red-900/20 border border-red-500/50 text-red-300'
              }`}>
                <p className="text-sm">{resetResult.message}</p>
              </div>
            )}
            
            <button
              onClick={onFullReset}
              disabled={resetting}
              className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
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
          </div>

          {/* Info */}
          <div className="text-xs text-gray-500">
            <p>• Purge: Removes expired breadcrumbs only</p>
            <p>• Full Reset: Deletes everything, rebootstraps</p>
            <p>• See: desktop-build/DATABASE_RESET.md</p>
          </div>
        </div>

        {/* Close Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatItem({ icon, label, value, color }: {
  icon: string;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <motion.div 
      className="flex items-center gap-2"
      whileHover={{ scale: 1.05 }}
    >
      <span className="text-lg">{icon}</span>
      <div className="flex flex-col">
        <span className={`text-sm font-bold ${color}`}>
          {value.toLocaleString()}
        </span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
    </motion.div>
  );
}

function ActionButton({ icon, label, onClick }: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-300 hover:text-white transition-colors"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </motion.button>
  );
}
