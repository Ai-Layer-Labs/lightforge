import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PaperAirplaneIcon, 
  TrashIcon,
  Cog6ToothIcon,
  ChatBubbleLeftIcon,
  CpuChipIcon,
  FunnelIcon,
  TagIcon,
  PlusIcon
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
  
  // Context-based conversation tracking (RCRT way!)
  const [contextId, setContextId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Array<{id: string, title: string, lastActivity: Date}>>([]);
  
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
              
              // Check for context-builder response (get context_id!)
              if (breadcrumb.schema_name === 'tool.response.v1' && breadcrumb.context?.tool === 'context-builder') {
                const newContextId = breadcrumb.context?.output?.results?.[0]?.context_id;
                if (newContextId && !contextId) {
                  console.log(`🆔 Received context_id from context-builder: ${newContextId}`);
                  setContextId(newContextId);
                  
                  // Add to conversations list
                  setConversations(prev => [
                    ...prev,
                    { id: newContextId, title: `Chat ${new Date().toLocaleTimeString()}`, lastActivity: new Date() }
                  ]);
                }
              }
              
              // Check if it's an agent response with actual message content
              if (breadcrumb.tags?.includes('agent:response') || breadcrumb.schema_name === 'agent.response.v1') {
                console.log('🤖 Agent response received:', breadcrumb);
                
                // Check if this response is for our current context
                const responseContextId = breadcrumb.context?.context_id || 
                                         breadcrumb.tags?.find((t: string) => t.startsWith('context:'))?.replace('context:', '');
                
                if (contextId && responseContextId && responseContextId !== contextId) {
                  console.log(`⏭️  Response for different context (${responseContextId}), skipping`);
                  return;
                }
                
                // Only show if there's an actual message (skip tool_requests-only responses)
                const messageContent = breadcrumb.context?.message || 
                                      breadcrumb.context?.response_text ||
                                      breadcrumb.context?.content ||
                                      breadcrumb.context?.text;
                
                if (!messageContent) {
                  console.log('⏭️  Response has no message (probably tool invocation), skipping');
                  return;
                }
                
                console.log('✅ Message extracted:', messageContent);
                
                const assistantMessage: ChatMessage = {
                  id: `agent-${Date.now()}`,
                  role: 'assistant',
                  content: messageContent,
                  timestamp: new Date(),
                  breadcrumbId: breadcrumb.id
                };
                
                setMessages(prev => [...prev, assistantMessage]);
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

  // Create new conversation
  const startNewConversation = () => {
    setContextId(null);  // Will be set when context-builder responds
    setMessages([]);
    console.log('🆕 Started new conversation (context will be created on first message)');
  };

  // Switch to existing conversation
  const switchConversation = async (ctxId: string) => {
    try {
      setContextId(ctxId);
      setMessages([]);
      console.log(`🔄 Switching to conversation: ${ctxId}`);
      
      // Load messages from this context
      // TODO: Fetch messages tagged with context:${ctxId}
      
    } catch (error) {
      console.error('Failed to switch conversation:', error);
    }
  };

  async function sendMessage() {
    if (!input.trim() || !connected) return;
    
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    
    try {
      console.log('📤 Sending chat message to RCRT...');
      
      // Tag with context_id if we have one
      const tags = ['user:message', 'extension:chat'];
      if (contextId) {
        tags.push(`context:${contextId}`);
        console.log(`🏷️  Tagging message with context:${contextId}`);
      }
      
      // Create message breadcrumb
      const result = await rcrtClient.createBreadcrumb({
        schema_name: 'user.message.v1',
        title: 'User Message',
        tags: tags,
        context: {
          content: userMessage.content,
          context_id: contextId,  // Also in context for clarity
          source: 'browser-extension',
          timestamp: new Date().toISOString()
        }
      });
      
      console.log('✅ Chat breadcrumb created:', result.id);
      
      // Update user message with breadcrumb ID
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id 
          ? { ...msg, breadcrumbId: result.id }
          : msg
      ));
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      }]);
    }
  }

  function clearChat() {
    setMessages([]);
  }

  function openDashboard() {
    window.open('http://localhost:8082', '_blank');
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) { 
    setInput(e.target.value); 
    e.target.style.height = 'auto'; 
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; 
  }

  return (
    <div className="main-container">
      {/* Header */}
      <div className="header">
        <div className="header-content">
          <div className="header-flex">
            <div className="header-left">
              <img src="../../icons/think-os-agent.png" alt="RCRT Agent" className="logo" />
              <div>
                <h1 className="app-title">RCRT Chat</h1>
                <div className="connection-status">
                  <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
                  <span className="status-text">
                    {connected ? 'Connected' : 'Disconnected'}
                  </span>
                  {contextId && (
                    <span className="context-badge" title={`Context: ${contextId}`}>
                      💬 {contextId.substring(0, 8)}...
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="header-actions">
              <button
                onClick={startNewConversation}
                className="icon-button"
                title="New conversation"
              >
                <PlusIcon />
              </button>
              
              <button
                onClick={clearChat}
                className="icon-button"
                title="Clear chat"
              >
                <TrashIcon />
              </button>
              
              <button
                onClick={openDashboard}
                className="icon-button"
                title="Open Dashboard v2"
              >
                <Cog6ToothIcon />
              </button>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`icon-button ${showFilters ? 'active' : ''}`}
                title="Configure SSE filters"
              >
                <FunnelIcon />
              </button>
            </div>
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
            style={{ overflow: 'hidden' }}
          >
            <div className="filter-panel">
              <h3 className="filter-title">SSE Event Filters</h3>
              
              <div>
                {/* Preset tag filters */}
                <div className="filter-tags">
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
                      className={`tag-button ${activeFilters.tags?.includes(tag) ? 'active' : ''}`}
                    >
                      <TagIcon className="tag-icon" />
                      {tag}
                    </button>
                  ))}
                </div>
                
                {/* Custom tag input */}
                <div className="custom-tag-input">
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
                  >
                    Add
                  </button>
                </div>
                
                {/* Active filters display */}
                {activeFilters.tags && activeFilters.tags.length > 0 && (
                  <div className="active-filters">
                    Active: {activeFilters.tags.join(', ')}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="messages-container">
        {!connected && (
          <div className="empty-state">
            <CpuChipIcon className="empty-icon error" />
            <p className="empty-title">Not connected to RCRT</p>
            <p className="empty-subtitle">Make sure Dashboard v2 is running</p>
            <button
              onClick={initializeRCRT}
              className="retry-button"
            >
              Retry Connection
            </button>
          </div>
        )}
        
        {connected && messages.length === 0 && (
          <div className="empty-state">
            <ChatBubbleLeftIcon className="empty-icon chat" />
            <p className="empty-title">Start a conversation</p>
            <p className="empty-subtitle">Messages will trigger your Dashboard v2 chat agents</p>
          </div>
        )}

        {connected && messages.length > 0 && (
          <div className="messages-list">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`message ${message.role}`}
                >
                  <div className="message-bubble">
                    <div className="message-content">
                      {message.content}
                    </div>
                    <div className="message-time">
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
            
            {/* Removed loading indicator - RCRT is fully async! Responses arrive via SSE. */}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="input-area">
        <div className="input-flex">
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
            className="input-textarea"
            style={{ minHeight: '40px', maxHeight: '120px' }}
            rows={1} 
            disabled={!connected}  // ← Only disable if disconnected! 
          />
          
          <button 
            onClick={sendMessage} 
            disabled={!input.trim() || !connected}  // ← Removed isLoading!
            className={`send-button ${(!input.trim() || !connected) ? 'disabled' : 'enabled'}`}
            title="Send message"
          >
            <PaperAirplaneIcon style={{transform: 'rotate(-45deg)'}} />
          </button>
        </div>
        
        <div className="conversation-id">
          ID: {conversationId.slice(-8)}
        </div>
      </div>
    </div>
  );
}