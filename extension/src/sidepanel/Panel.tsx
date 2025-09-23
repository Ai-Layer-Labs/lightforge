import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PaperAirplaneIcon, 
  TrashIcon,
  Cog6ToothIcon,
  PlusIcon,
  ChatBubbleLeftIcon,
  CpuChipIcon,
  FunnelIcon,
  TagIcon
} from '@heroicons/react/24/outline';
import { rcrtClient, type SSEFilter } from '../lib/rcrt-client';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  breadcrumbId?: string;
};

export default function Panel() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId] = useState<string>(`ext-conv-${Date.now()}`);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<SSEFilter>({
    tags: ['agent:response']
  });
  const [customTag, setCustomTag] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const sseCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    initializeRCRT();
    return () => {
      // Cleanup SSE connection
      if (sseCleanupRef.current) {
        sseCleanupRef.current();
      }
    };
  }, []);

  // Re-initialize SSE when filters change
  useEffect(() => {
    if (connected && sseCleanupRef.current) {
      // Clean up old connection
      sseCleanupRef.current();
      
      // Start new connection with updated filters
      setupSSEConnection();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters, connected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function initializeRCRT() {
    try {
      console.log('🚀 Initializing RCRT connection...');
      
      // Authenticate with RCRT
      const success = await rcrtClient.authenticate();
      if (success) {
        setConnected(true);
        console.log('✅ Connected to RCRT system');
        
        // Setup SSE connection with initial filters
        await setupSSEConnection();
      } else {
        setConnected(false);
        console.error('❌ Failed to connect to RCRT');
      }
    } catch (error) {
      console.error('❌ RCRT initialization error:', error);
      setConnected(false);
    }
  }

  async function setupSSEConnection() {
    try {
      // Start listening with current filters
      const cleanup = await rcrtClient.connectToSSE(
        activeFilters,
        async (event) => {
          console.log('📡 SSE Event received:', event);
          
          // Handle different event types
          if (event.breadcrumb_id && event.type === 'breadcrumb.updated') {
            try {
              const breadcrumb = await rcrtClient.getBreadcrumb(event.breadcrumb_id);
              
              // Check if it's an agent response for our conversation
              if (breadcrumb.tags?.includes('agent:response') && 
                  (breadcrumb.context?.conversation_id === conversationId ||
                   breadcrumb.tags?.includes('extension:chat'))) {
                
                const content = breadcrumb.context?.content || 
                               breadcrumb.context?.response_text ||
                               breadcrumb.context?.message ||
                               'Agent responded but no content found';
                
                const assistantMessage: ChatMessage = {
                  id: `agent-${Date.now()}`,
                  role: 'assistant',
                  content: content,
                  timestamp: new Date(),
                  breadcrumbId: breadcrumb.id
                };
                
                setMessages(prev => [...prev, assistantMessage]);
                setIsLoading(false);
              }
              
              // You can handle other types of breadcrumbs here
              // For example, tool responses, errors, etc.
              if (breadcrumb.tags?.includes('tool:response')) {
                console.log('🛠️ Tool response:', breadcrumb);
              }
              
              if (breadcrumb.tags?.includes('agent:error')) {
                console.error('❌ Agent error:', breadcrumb);
              }
            } catch (error) {
              console.error('Failed to fetch breadcrumb:', error);
            }
          }
        }
      );
      
      sseCleanupRef.current = cleanup;
      console.log('✅ SSE connection established with filters:', activeFilters);
    } catch (error) {
      console.error('❌ Failed to setup SSE connection:', error);
    }
  }

  async function sendMessage() {
    if (!input.trim() || isLoading || !connected) return;
    
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      console.log('📤 Sending chat message to RCRT...');
      
      // Create chat message breadcrumb that triggers the chat agent
      const result = await rcrtClient.createChatBreadcrumb({
        role: 'user',
        content: userMessage.content,
        sessionId: conversationId,
      });
      
      console.log('✅ Chat breadcrumb created:', result.id);
      
      // Track the message ID for response matching
      rcrtClient.trackMessage(result.id);
      
      // Update user message with breadcrumb ID
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id 
          ? { ...msg, breadcrumbId: result.id }
          : msg
      ));
      
      // Set timeout in case agent doesn't respond
      setTimeout(() => {
        if (isLoading) {
          setIsLoading(false);
          setMessages(prev => [...prev, {
            id: `timeout-${Date.now()}`,
            role: 'assistant',
            content: 'Request timeout - check Dashboard v2 for response',
            timestamp: new Date(),
          }]);
        }
      }, 10000);
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setIsLoading(false);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error.message}`,
        timestamp: new Date(),
      }]);
    }
  }

  function clearChat() {
    setMessages([]);
    setIsLoading(false);
  }

  function openDashboard() {
    window.open('http://localhost:5173', '_blank');
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) { 
    setInput(e.target.value); 
    e.target.style.height = 'auto'; 
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; 
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/icons/think-os-agent.png" alt="RCRT Agent" className="h-8 w-8" />
            <div>
              <h1 className="text-sm font-semibold">RCRT Chat</h1>
              <div className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-gray-400">
                  {connected ? 'Connected to Dashboard v2' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={clearChat}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700"
              title="Clear chat"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
            
            <button
              onClick={openDashboard}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700"
              title="Open Dashboard v2"
            >
              <Cog6ToothIcon className="h-4 w-4" />
            </button>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 transition-colors rounded-lg ${
                showFilters 
                  ? 'text-blue-400 bg-blue-500/20 hover:bg-blue-500/30' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
              title="Configure SSE filters"
            >
              <FunnelIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 bg-gray-850 border-b border-gray-700">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">SSE Event Filters</h3>
              
              <div className="space-y-2">
                {/* Preset tag filters */}
                <div className="flex flex-wrap gap-2">
                  {['agent:response', 'tool:response', 'user:message', 'agent:error'].map(tag => (
                    <button
                      key={tag}
                      onClick={() => {
                        const currentTags = activeFilters.tags || [];
                        const newTags = currentTags.includes(tag)
                          ? currentTags.filter(t => t !== tag)
                          : [...currentTags, tag];
                        setActiveFilters({ ...activeFilters, tags: newTags });
                      }}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        activeFilters.tags?.includes(tag)
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-400/50'
                          : 'bg-gray-700 text-gray-400 hover:text-gray-200 border border-gray-600'
                      }`}
                    >
                      <TagIcon className="h-3 w-3 inline mr-1" />
                      {tag}
                    </button>
                  ))}
                </div>
                
                {/* Custom tag input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customTag.trim()) {
                        const currentTags = activeFilters.tags || [];
                        if (!currentTags.includes(customTag.trim())) {
                          setActiveFilters({ 
                            ...activeFilters, 
                            tags: [...currentTags, customTag.trim()] 
                          });
                        }
                        setCustomTag('');
                      }
                    }}
                    placeholder="Add custom tag filter..."
                    className="flex-1 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  />
                  <button
                    onClick={() => {
                      if (customTag.trim()) {
                        const currentTags = activeFilters.tags || [];
                        if (!currentTags.includes(customTag.trim())) {
                          setActiveFilters({ 
                            ...activeFilters, 
                            tags: [...currentTags, customTag.trim()] 
                          });
                        }
                        setCustomTag('');
                      }
                    }}
                    className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 rounded text-white"
                  >
                    Add
                  </button>
                </div>
                
                {/* Active filters display */}
                {activeFilters.tags && activeFilters.tags.length > 0 && (
                  <div className="text-xs text-gray-400">
                    Active: {activeFilters.tags.join(', ')}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {!connected && (
          <div className="text-center py-8">
            <CpuChipIcon className="h-12 w-12 mx-auto mb-4 text-red-400" />
            <p className="text-red-400 mb-2">Not connected to RCRT</p>
            <p className="text-gray-400 text-sm">Make sure Dashboard v2 is running</p>
            <button
              onClick={initializeRCRT}
              className="mt-4 px-4 py-2 bg-blue-500/20 border border-blue-400/50 rounded-lg text-blue-300 hover:bg-blue-500/30 transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}
        
        {connected && messages.length === 0 && (
          <div className="text-center py-8">
            <ChatBubbleLeftIcon className="h-12 w-12 mx-auto mb-4 text-blue-400" />
            <p className="text-gray-300 mb-2">Start a conversation</p>
            <p className="text-gray-500 text-sm">Messages will trigger your Dashboard v2 chat agents</p>
          </div>
        )}

        {connected && (
          <div className="space-y-4">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-700 text-gray-100'
                  }`}>
                    <div className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                    <div className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                    }`}>
                      {message.timestamp.toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-gray-700 rounded-lg px-4 py-2">
                  <div className="flex items-center gap-2 text-gray-300">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                    <span className="text-sm">Agent is thinking...</span>
                  </div>
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex gap-2">
          <textarea 
            ref={composerRef} 
            value={input} 
            onChange={autoResize} 
            onKeyDown={(e) => { 
              if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                sendMessage(); 
              } 
            }} 
            placeholder={connected ? "Message your RCRT agents..." : "Connect to RCRT first"}
            className="flex-1 px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
            style={{ minHeight: '40px', maxHeight: '120px' }}
            rows={1} 
            disabled={isLoading || !connected} 
          />
          
          <button 
            onClick={sendMessage} 
            disabled={!input.trim() || isLoading || !connected} 
            className="p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            title="Send message"
          >
            <PaperAirplaneIcon className="h-5 w-5 text-white" style={{transform: 'rotate(-45deg)'}} />
          </button>
        </div>
        
        <div className="mt-2 text-xs text-gray-400 text-center">
          Conversation ID: {conversationId}
        </div>
      </div>
    </div>
  );
}