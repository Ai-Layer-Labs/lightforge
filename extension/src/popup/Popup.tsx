import { Chat } from './Chat';
import { SimpleBreadcrumbChat } from './SimpleBreadcrumbChat';
import { Sessions } from './Sessions';
import { useState } from 'react';

export function Popup() {
  const [currentView, setCurrentView] = useState<'rcrt-chat' | 'old-chat' | 'sessions'>('rcrt-chat');
  const [activeSession, setActiveSession] = useState<string | undefined>(undefined);

  const resume = (sessionId: string) => {
    setActiveSession(sessionId);
    setCurrentView('old-chat');
  };

  return (
    <div className="w-full h-full bg-gray-900 text-gray-100">
      <div className="flex gap-2 p-2 border-b border-gray-800">
        <button 
          onClick={() => setCurrentView('rcrt-chat')} 
          className={`text-xs px-2 py-1 rounded ${currentView === 'rcrt-chat' ? 'bg-teal-600 text-black' : 'bg-gray-800'} border border-gray-700`}
        >
          RCRT Chat
        </button>
        <button 
          onClick={() => setCurrentView('old-chat')} 
          className={`text-xs px-2 py-1 rounded ${currentView === 'old-chat' ? 'bg-teal-600 text-black' : 'bg-gray-800'} border border-gray-700`}
        >
          Old Chat
        </button>
        <button 
          onClick={() => setCurrentView('sessions')} 
          className={`text-xs px-2 py-1 rounded ${currentView === 'sessions' ? 'bg-teal-600 text-black' : 'bg-gray-800'} border border-gray-700`}
        >
          Sessions
        </button>
      </div>
      {currentView === 'rcrt-chat' ? (
        <SimpleBreadcrumbChat />
      ) : currentView === 'sessions' ? (
        <Sessions onResume={resume} />
      ) : (
        <Chat />
      )}
    </div>
  );
}