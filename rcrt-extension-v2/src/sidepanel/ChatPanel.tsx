/**
 * Chat Panel Component
 * AI chat interface with RCRT agents
 */

import { useState, useEffect, useRef } from 'react';
import { Send, Eraser, Plus, Loader, Monitor, Eye } from 'lucide-react';
import type { RCRTClient } from '../lib/rcrt-client';
import type { Message } from '../lib/types';
import { formatDate } from '../lib/text-utils';
import { loadSessionHistory, createNewSession, ensureSingleActiveContext } from '../lib/session-manager';
import { ContextViewer } from './ContextViewer';

interface ChatPanelProps {
  client: RCRTClient;
  sessionId: string | null;
  onSessionIdChange?: (sessionId: string) => void;
}

export function ChatPanel({ client, sessionId: initialSessionId, onSessionIdChange }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [showAllTabs, setShowAllTabs] = useState(false);
  const [allTabs, setAllTabs] = useState<any[]>([]);
  const [selectedContextBreadcrumb, setSelectedContextBreadcrumb] = useState<any | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync sessionId prop changes
  useEffect(() => {
    setSessionId(initialSessionId);
  }, [initialSessionId]);

  // Load conversation history when session changes
  useEffect(() => {
    if (sessionId) {
      loadHistory(sessionId);
    }
  }, [sessionId]);

  // Subscribe to agent responses
  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = client.subscribeToSSE(
      {
        any_tags: ['agent:response']
      },
      async (event) => {
        // THE EXISTING EXTENSION WAY: Fetch full breadcrumb from event
        if (!event || !event.breadcrumb_id || event.type !== 'breadcrumb.updated') {
          return;
        }

        try {
          // Fetch full breadcrumb
          const breadcrumb = await client.getBreadcrumb(event.breadcrumb_id, true);
          
          // Check if it's an agent response
          if (breadcrumb.tags?.includes('agent:response') || breadcrumb.schema_name === 'agent.response.v1') {
            console.log('🤖 Agent response received:', breadcrumb);
            
            // Check if this response is for our session (context.session_id, NOT tags!)
            const responseSessionId = breadcrumb.context?.session_id;
            
            if (sessionId && responseSessionId && responseSessionId !== sessionId) {
              console.log(`⏭️ Response for different session (${responseSessionId}), skipping`);
              return;
            }
            
            // Extract message from context
            const messageContent = breadcrumb.context?.message || 
                                  breadcrumb.context?.response_text ||
                                  breadcrumb.context?.content ||
                                  breadcrumb.context?.text;
            
            if (!messageContent) {
              console.log('⏭️ Response has no message (probably tool invocation), skipping');
              return;
            }
            
            console.log('✅ Message extracted:', messageContent);
            
            setMessages(prev => [...prev, {
              id: breadcrumb.id,
              role: 'assistant',
              content: messageContent,
              timestamp: new Date(breadcrumb.created_at).getTime()
            }]);
            setSending(false);
          }
        } catch (error) {
          console.error('[ChatPanel] Failed to fetch agent response:', error);
        }
      }
    );

    // Listen for messages from other parts of extension
    const handleMessage = (message: any) => {
      if (message.type === 'ADD_NOTE_TO_CHAT') {
        addNoteToContext(message.noteId, message.noteTitle);
      }
      if (message.type === 'ADD_SELECTION_TO_CHAT') {
        setInput(message.selection);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      unsubscribe.then(fn => fn());
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [client, sessionId]);

  // Ensure single active context on mount
  useEffect(() => {
    ensureSingleActiveContext(client);
  }, [client]);

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadAllTabs = async () => {
    try {
      const response: any = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_ALL_TABS' }, resolve);
      });

      if (response.success) {
        setAllTabs(response.tabs || []);
      }
    } catch (error) {
      console.error('[ChatPanel] Failed to load tabs:', error);
    }
  };

  const handleShowAllTabs = async () => {
    setShowAllTabs(!showAllTabs);
    if (!showAllTabs) {
      await loadAllTabs();
    }
  };

  const loadHistory = async (sid: string) => {
    try {
      const history = await loadSessionHistory(client, sid);
      
      // Convert breadcrumbs to messages
      const msgs: Message[] = history.map(bc => ({
        id: bc.id,
        role: bc.schema_name === 'user.message.v1' ? 'user' : 'assistant',
        content: bc.context.content || bc.context.text || '',
        timestamp: new Date(bc.created_at).getTime()
      }));
      
      setMessages(msgs);
      console.log(`✅ Loaded ${msgs.length} messages for session ${sid}`);
    } catch (error) {
      console.error('[ChatPanel] Failed to load history:', error);
    }
  };

  const addNoteToContext = async (noteId: string, noteTitle: string) => {
    try {
      const note = await client.getBreadcrumb(noteId, true); // Use /full
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'system',
        content: `Added note: "${noteTitle}"\n\n${note.context.content.substring(0, 500)}...`,
        timestamp: Date.now(),
        noteId,
        noteTitle
      }]);
    } catch (error) {
      console.error('[ChatPanel] Failed to add note to context:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    // THE RCRT WAY: Create session ID on first message if needed
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = await createNewSession(client);
      setSessionId(currentSessionId);
      if (onSessionIdChange) {
        onSessionIdChange(currentSessionId);
      }
      console.log(`🆕 Created new session: ${currentSessionId}`);
    }

    const userMessage: Message = {
      id: crypto.randomUUID(), // Just for UI display
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      // Create user.message.v1 breadcrumb tagged with session
      await client.createBreadcrumb({
        schema_name: 'user.message.v1',
        title: 'User Message',
        tags: ['user:message', 'extension:chat', `session:${currentSessionId}`],
        context: {
          content: input,
          session_id: currentSessionId,
          timestamp: new Date().toISOString(),
          source: 'rcrt-extension-v2'
        }
      });

      // Agent will automatically respond via SSE (subscribed to session tag)
    } catch (error) {
      console.error('[ChatPanel] Failed to send message:', error);
      setSending(false);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
        timestamp: Date.now()
      }]);
    }
  };

  const handleClearContext = async () => {
    if (confirm('Start a new session? (Current conversation will be saved)')) {
      // Create new session (deactivates current)
      const newSessionId = await createNewSession(client);
      setSessionId(newSessionId);
      setMessages([]);
      if (onSessionIdChange) {
        onSessionIdChange(newSessionId);
      }
      console.log(`🆕 Started new session: ${newSessionId}`);
    }
  };

  const handleAddCurrentPage = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'system',
        content: `Added current page context: ${tab.title}`,
          timestamp: Date.now()
        }]);
      }
    } catch (error) {
      console.error('[ChatPanel] Failed to add page context:', error);
    }
  };

  // View LLM context for a message
  const handleViewContext = async () => {
    if (!sessionId) return;
    
    try {
      setLoadingContext(true);
      
      console.log(`[ChatPanel] Looking for context for session: ${sessionId}`);
      
      // Strategy 1: Try to find agent.context.v1 with session tag
      let contextBreadcrumbs = await client.listBreadcrumbs({
        schema_name: 'agent.context.v1',
        tag: `session:${sessionId}`,
        limit: 50
      });
      
      console.log(`[ChatPanel] Found ${contextBreadcrumbs.length} agent.context.v1 breadcrumbs with session tag`);
      
      // Strategy 2: If none found with session tag, try consumer tag only
      if (contextBreadcrumbs.length === 0) {
        console.log('[ChatPanel] Trying without session tag, searching by consumer...');
        contextBreadcrumbs = await client.listBreadcrumbs({
          schema_name: 'agent.context.v1',
          tag: 'consumer:default-chat-assistant',
          limit: 50
        });
        console.log(`[ChatPanel] Found ${contextBreadcrumbs.length} contexts by consumer tag`);
      }
      
      if (contextBreadcrumbs.length > 0) {
        // Get the most recent one
        const sortedContexts = contextBreadcrumbs.sort((a: any, b: any) => 
          new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
        );
        
        // Get full breadcrumb data with formatted_context
        const fullContext = await client.getBreadcrumb(sortedContexts[0].id, true);
        setSelectedContextBreadcrumb(fullContext);
        console.log('[ChatPanel] Loaded context breadcrumb:', fullContext.id);
      } else {
        console.warn('[ChatPanel] No agent.context.v1 found at all');
        
        // Show helpful error message
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'system',
          content: `No context breadcrumb found for this session.\n\nThis could mean:\n• Context-builder hasn't run yet\n• Session tag mismatch (session:${sessionId})\n• Agent hasn't been triggered\n\nCheck: docker compose logs context-builder -f`,
          timestamp: Date.now()
        }]);
      }
    } catch (error) {
      console.error('[ChatPanel] Failed to load context:', error);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'system',
        content: `Error loading context: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      }]);
    } finally {
      setLoadingContext(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-2">Start a conversation</p>
            <p className="text-sm text-gray-600">
              Agents have access to your notes and browser context
            </p>
          </div>
        )}

        {messages.map(message => (
          <div
            key={message.id}
            className={`flex gap-3 slide-in ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.role === 'assistant'
                  ? 'bg-gray-800 text-gray-100'
                  : message.role === 'system'
                  ? 'bg-gray-700 text-gray-300'
                  : 'bg-purple-900/30 text-purple-300'
              }`}
            >
              <div className="text-xs opacity-70 mb-1">
                {message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Assistant' : message.role === 'tool' ? message.tool_name : 'System'}
              </div>
              <div className="whitespace-pre-wrap break-words">
                {message.content}
              </div>
              <div className="flex items-center justify-between mt-2 text-xs opacity-50">
                <span>{formatDate(message.timestamp)}</span>
                {/* Context viewer button for assistant messages */}
                {message.role === 'assistant' && (
                  <button
                    onClick={() => handleViewContext()}
                    disabled={loadingContext}
                    className="flex items-center gap-1 px-2 py-1 bg-gray-700/50 hover:bg-gray-600/50 rounded transition-colors disabled:opacity-50"
                    title="View LLM context"
                  >
                    <Eye className="w-3 h-3" />
                    <span className="text-[10px]">Context</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex gap-3 justify-start slide-in">
            <div className="bg-gray-800 text-gray-100 rounded-lg p-3">
              <Loader className="w-4 h-4 animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* All Tabs View */}
      {showAllTabs && (
        <div className="border-t border-gray-700 bg-gray-800 p-3 max-h-48 overflow-y-auto">
          <div className="text-xs font-semibold text-gray-400 mb-2">All Open Tabs</div>
          {allTabs.map((tab, i) => (
            <div key={i} className="text-xs text-gray-500 mb-1">
              • {tab.title || 'Untitled'} ({tab.context?.domain || 'unknown'})
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        {/* Action Buttons */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={handleAddCurrentPage}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Page</span>
          </button>

          <button
            onClick={handleShowAllTabs}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm"
          >
            <Monitor className="w-4 h-4" />
            <span>All Tabs</span>
          </button>

          <button
            onClick={handleClearContext}
            className="flex items-center justify-center px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* Input Field */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className={`px-4 py-2 rounded-lg transition-colors ${
              !input.trim() || sending
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Context Viewer Modal */}
      {selectedContextBreadcrumb && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedContextBreadcrumb(null)}
        >
          <div 
            className="bg-gray-900 rounded-lg w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">LLM Context Viewer</h2>
              <button
                onClick={() => setSelectedContextBreadcrumb(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ContextViewer breadcrumb={selectedContextBreadcrumb} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

