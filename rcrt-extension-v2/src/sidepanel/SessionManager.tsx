/**
 * Session Manager Component
 * Lists all chat sessions (agent.context.v1 breadcrumbs)
 * THE RCRT WAY: Sessions are context breadcrumbs, not local storage
 */

import { useState, useEffect } from 'react';
import { MessageSquare, Clock, Plus, Loader, RefreshCw, ChevronRight } from 'lucide-react';
import type { RCRTClient } from '../lib/rcrt-client';
import { loadAllSessions, type SessionInfo } from '../lib/session-manager';
import { formatDate } from '../lib/text-utils';

interface SessionManagerProps {
  client: RCRTClient;
  onSessionSelected: (sessionId: string) => void;
  onNewSession: () => void;
}

export function SessionManager({ client, onSessionSelected, onNewSession }: SessionManagerProps) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();

    // Subscribe to context breadcrumb updates (real-time session list)
    const unsubscribe = client.subscribeToSSE(
      {
        schema_name: 'agent.context.v1',
        any_tags: ['extension:chat']
      },
      (event) => {
        // Defensive check for SSE events
        if (!event || !event.breadcrumb) {
          return;
        }
        // Reload sessions when context breadcrumbs change
        loadSessions();
      }
    );

    return () => {
      unsubscribe.then(fn => fn());
    };
  }, [client]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedSessions = await loadAllSessions(client);
      setSessions(loadedSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
      console.error('[SessionManager] Load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading sessions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center max-w-md">
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={loadSessions}
              className="px-4 py-2 bg-red-900/30 text-red-300 rounded-lg hover:bg-red-900/50 transition-colors"
            >
              <RefreshCw className="w-4 h-4 inline mr-2" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-2xl font-bold text-white mb-2">Chat Sessions</h1>
        <p className="text-sm text-gray-400">
          Select a session or create a new one
        </p>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-4">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MessageSquare className="w-16 h-16 text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg mb-2">No chat sessions yet</p>
            <p className="text-gray-500 text-sm mb-6">
              Start your first conversation with RCRT agents
            </p>
            <button
              onClick={onNewSession}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Start First Chat</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(session => (
              <button
                key={session.sessionId}
                onClick={() => onSessionSelected(session.sessionId)}
                className={`w-full text-left p-4 rounded-lg border transition-all slide-in ${
                  session.isActive
                    ? 'bg-blue-900/30 border-blue-500 hover:bg-blue-900/40'
                    : 'bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-600'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-gray-400" />
                      <h3 className="font-semibold text-white">{session.title}</h3>
                      {session.isActive && (
                        <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(session.updated_at)}</span>
                      </div>
                      <span className="text-gray-600">•</span>
                      <span className="font-mono">{session.sessionId.substring(8, 21)}...</span>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New Session Button (if sessions exist) */}
      {sessions.length > 0 && (
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={onNewSession}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>New Chat Session</span>
          </button>
        </div>
      )}
    </div>
  );
}

