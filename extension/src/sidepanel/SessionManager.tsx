import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  PlusIcon,
  ChatBubbleLeftIcon,
  ClockIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

interface Session {
  id: string;
  title: string;
  tags: string[];
  version: number;
  created_at: string;
  updated_at: string;
  isActive: boolean;
}

interface SessionManagerProps {
  onSessionSelected: (sessionId: string) => void;
  onNewSession: () => void;
}

export function SessionManager({ onSessionSelected, onNewSession }: SessionManagerProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const RCRT_BASE_URL = 'http://localhost:8081';

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get token
      const tokenResponse = await fetch(`${RCRT_BASE_URL}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: '00000000-0000-0000-0000-000000000001',
          agent_id: '00000000-0000-0000-0000-000000000EEE',
          roles: ['curator', 'emitter', 'subscriber']
        })
      });
      
      const { token } = await tokenResponse.json();

      // Search for all agent.context.v1 breadcrumbs for this agent
      const response = await fetch(
        `${RCRT_BASE_URL}/breadcrumbs?schema_name=agent.context.v1`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load sessions');
      }

      const breadcrumbs = await response.json();
      
      // Fetch full details for each
      const fullSessions = await Promise.all(
        breadcrumbs.map(async (bc: any) => {
          const detailResponse = await fetch(
            `${RCRT_BASE_URL}/breadcrumbs/${bc.id}`,
            {
              headers: { 'Authorization': `Bearer ${token}` }
            }
          );
          return detailResponse.json();
        })
      );

      // Parse sessions
      const parsedSessions = fullSessions.map(bc => ({
        id: bc.id,
        title: bc.title || `Session ${new Date(bc.created_at).toLocaleString()}`,
        tags: bc.tags || [],
        version: bc.version,
        created_at: bc.created_at,
        updated_at: bc.updated_at,
        isActive: bc.tags?.includes('consumer:default-chat-assistant')
      }));

      // Sort by updated_at (most recent first)
      parsedSessions.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      setSessions(parsedSessions);

    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading sessions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={loadSessions}
            className="mt-4 px-4 py-2 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-2">Chat Sessions</h1>
        <p className="text-gray-400 text-sm">Select a session or create a new one</p>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-4">
        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <ChatBubbleLeftIcon className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400 mb-4">No chat sessions yet</p>
            <button
              onClick={onNewSession}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 flex items-center gap-2 mx-auto"
            >
              <PlusIcon className="w-5 h-5" />
              Start Your First Chat
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(session => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`
                  bg-gray-800 border rounded-lg p-4 cursor-pointer
                  hover:border-blue-500 transition-all
                  ${session.isActive ? 'border-green-500 bg-green-500/5' : 'border-gray-700'}
                `}
                onClick={() => onSessionSelected(session.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <ChatBubbleLeftIcon className="w-5 h-5 text-blue-400" />
                      <h3 className="font-semibold text-white">{session.title}</h3>
                      {session.isActive && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded text-xs">
                          Active
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" />
                        {new Date(session.updated_at).toLocaleString()}
                      </div>
                      <div className="font-mono text-gray-500">
                        {session.id.substring(0, 8)}...
                      </div>
                    </div>
                  </div>
                  
                  <ArrowRightIcon className="w-5 h-5 text-gray-500" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* New Session Button */}
      {sessions.length > 0 && (
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={onNewSession}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 flex items-center justify-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            New Chat Session
          </button>
        </div>
      )}
    </div>
  );
}
