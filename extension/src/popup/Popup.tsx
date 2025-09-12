import { Chat } from './Chat';
import { Sessions } from './Sessions';
import { useState } from 'react';

export function Popup() {
  const [showSessions, setShowSessions] = useState(false);
  const [activeSession, setActiveSession] = useState<string | undefined>(undefined);

  const resume = (sessionId: string) => {
    setActiveSession(sessionId);
    setShowSessions(false);
  };

  return (
    <div className="w-full h-full bg-gray-900 text-gray-100">
      <div className="flex gap-2 p-2 border-b border-gray-800">
        <button onClick={() => setShowSessions(false)} className={`text-xs px-2 py-1 rounded ${!showSessions ? 'bg-teal-600 text-black' : 'bg-gray-800'} border border-gray-700`}>Chat</button>
        <button onClick={() => setShowSessions(true)} className={`text-xs px-2 py-1 rounded ${showSessions ? 'bg-teal-600 text-black' : 'bg-gray-800'} border border-gray-700`}>Sessions</button>
      </div>
      {showSessions ? (
        <Sessions onResume={resume} />
      ) : (
        <Chat />
      )}
    </div>
  );
}