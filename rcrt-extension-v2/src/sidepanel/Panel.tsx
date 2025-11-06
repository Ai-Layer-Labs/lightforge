/**
 * Main Side Panel Component
 * Tab navigation: Chat, Notes, Save Page, Settings
 */

import { useState, useEffect } from 'react';
import { MessageSquare, BookOpen, Save, Settings as SettingsIcon, Activity, List } from 'lucide-react';
import { ChatPanel } from './ChatPanel';
import { NotesList } from './NotesList';
import { SavePage } from './SavePage';
import { Settings } from './Settings';
import { SessionManager } from './SessionManager';
import { useRCRTClient } from '../hooks/useRCRTClient';
import { createNewSession, switchToSession, getActiveSession } from '../lib/session-manager';

type Tab = 'chat' | 'notes' | 'save' | 'settings';
type View = 'sessions' | 'app';

export function Panel() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [view, setView] = useState<View>('sessions'); // Start with session list
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const { client, loading, error } = useRCRTClient();

  // Load active session on mount
  useEffect(() => {
    if (client) {
      getActiveSession(client).then(activeSession => {
        if (activeSession) {
          setSessionId(activeSession.sessionId);
          setView('app'); // Go directly to app if active session exists
          console.log(`✅ Restored active session: ${activeSession.sessionId}`);
        }
      });
    }
  }, [client]);

  useEffect(() => {
    if (client) {
      // Test connection
      client.testConnection().then(setConnected);
    }

    // Listen for tab switch messages
    const handleMessage = (message: any) => {
      if (message.type === 'SWITCH_TO_NOTES_TAB') {
        setActiveTab('notes');
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [client]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Connecting to RCRT...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 p-4">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">
            <Activity className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connection Error</h2>
          <p className="text-gray-400 mb-4">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Initializing client...</p>
        </div>
      </div>
    );
  }

  const handleNewSession = async () => {
    const newSessionId = await createNewSession(client);
    setSessionId(newSessionId);
    setView('app');
    setActiveTab('chat');
    console.log(`🆕 Started new session: ${newSessionId}`);
  };

  const handleSessionSelected = async (selectedSessionId: string) => {
    const currentSessionId = sessionId;
    
    // Switch to selected session
    await switchToSession(client, selectedSessionId, currentSessionId);
    
    setSessionId(selectedSessionId);
    setView('app');
    setActiveTab('chat');
    console.log(`✅ Switched to session: ${selectedSessionId}`);
  };

  const handleBackToSessions = () => {
    setView('sessions');
  };

  // Show session manager if no active session
  if (view === 'sessions') {
    return (
      <SessionManager
        client={client}
        onSessionSelected={handleSessionSelected}
        onNewSession={handleNewSession}
      />
    );
  }

  // Show main app with tabs
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={handleBackToSessions}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            title="Back to sessions"
          >
            <List className="w-4 h-4 text-gray-400 hover:text-white" />
          </button>
          <h1 className="text-lg font-bold">RCRT Assistant</h1>
          <span
            className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
            title={connected ? 'Connected' : 'Disconnected'}
          ></span>
        </div>
        {sessionId && (
          <span className="text-xs text-gray-500 font-mono">
            {sessionId.substring(8, 21)}...
          </span>
        )}
      </header>

      {/* Tab Navigation */}
      <nav className="flex border-b border-gray-700 bg-gray-800">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors ${
            activeTab === 'chat'
              ? 'bg-gray-900 text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Chat</span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors ${
            activeTab === 'notes'
              ? 'bg-gray-900 text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Notes</span>
        </button>

        <button
          onClick={() => setActiveTab('save')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors ${
            activeTab === 'save'
              ? 'bg-gray-900 text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
          }`}
        >
          <Save className="w-4 h-4" />
          <span>Save</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors ${
            activeTab === 'settings'
              ? 'bg-gray-900 text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </nav>

      {/* Tab Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'chat' && (
          <ChatPanel 
            client={client} 
            sessionId={sessionId}
            onSessionIdChange={(newSessionId) => setSessionId(newSessionId)}
          />
        )}
        {activeTab === 'notes' && <NotesList client={client} />}
        {activeTab === 'save' && <SavePage client={client} />}
        {activeTab === 'settings' && <Settings />}
      </main>
    </div>
  );
}

