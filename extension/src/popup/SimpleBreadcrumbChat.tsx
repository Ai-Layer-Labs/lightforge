import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PaperAirplaneIcon, 
  SparklesIcon,
  UserIcon,
  CpuChipIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { RCRTExtensionClient, type BreadcrumbContext, type EventStreamMessage } from '../lib/rcrt-client';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  breadcrumbId?: string;
};

export function SimpleBreadcrumbChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [conversationId] = useState(() => `chat-${Date.now()}`);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const rcrtClient = useRef<RCRTExtensionClient>();
  const eventSource = useRef<EventSource | null>(null);

  // Initialize RCRT client and event stream
  useEffect(() => {
    initializeRCRT();
    return () => {
      if (eventSource.current) {
        eventSource.current.close();
      }
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializeRCRT = async () => {
    try {
      rcrtClient.current = new RCRTExtensionClient();
      await rcrtClient.current.authenticate();
      
      // Start listening for agent responses
      await startEventStream();
      
      setIsConnected(true);
      
      // Add welcome message
      const welcomeMessage: Message = {
        id: 'welcome',
        role: 'system',
        content: '🤖 Connected to RCRT! I\'m your AI assistant. How can I help you today?',
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
      
    } catch (error) {
      console.error('Failed to initialize RCRT:', error);
      const errorMessage: Message = {
        id: 'error',
        role: 'system',
        content: '❌ Failed to connect to RCRT. Please make sure the RCRT server is running.',
        timestamp: new Date()
      };
      setMessages([errorMessage]);
    }
  };

  const startEventStream = async () => {
    if (!rcrtClient.current) return;
    
    try {
      const stream = await rcrtClient.current.subscribeToEvents();
      eventSource.current = stream;
      
      stream.onmessage = (event) => {
        try {
          const data: EventStreamMessage = JSON.parse(event.data);
          
          // Listen for ANY tool response breadcrumb
          if (data.tags?.includes('tool:response')) {
            console.log('🎯 Tool response received:', data);
            
            // The SSE event includes the full breadcrumb data
            if (data.breadcrumb) {
              const breadcrumb = data.breadcrumb;
              
              // Check if it's a successful OpenRouter response
              if (breadcrumb.context?.tool === 'openrouter' && 
                  breadcrumb.context?.status === 'success' &&
                  breadcrumb.context?.output?.content) {
                
                const assistantMessage: Message = {
                  id: breadcrumb.id || `response-${Date.now()}`,
                  role: 'assistant',
                  content: breadcrumb.context.output.content,
                  timestamp: new Date(breadcrumb.updated_at || Date.now()),
                  breadcrumbId: breadcrumb.id
                };
                
                console.log('✅ Adding response:', assistantMessage);
                setMessages(prev => [...prev, assistantMessage]);
                setIsLoading(false);
              }
            } else if (data.breadcrumb_id) {
              // Fallback: fetch the breadcrumb if not included
              handleToolResponse(data.breadcrumb_id);
            }
          }
        } catch (error) {
          console.warn('Failed to parse SSE event:', error);
        }
      };
      
      stream.onerror = (error) => {
        console.error('SSE error:', error);
        setIsConnected(false);
      };
      
    } catch (error) {
      console.error('Failed to start event stream:', error);
    }
  };

  const handleToolResponse = async (breadcrumbId: string) => {
    if (!rcrtClient.current) return;
    
    console.log('📥 Handling tool response for breadcrumb:', breadcrumbId);
    
    try {
      const breadcrumb = await rcrtClient.current.getBreadcrumb(breadcrumbId);
      console.log('📄 Retrieved breadcrumb:', breadcrumb);
      
      // Tool responses contain the LLM output in context.output.content
      if (breadcrumb.context?.tool === 'openrouter' && breadcrumb.context?.status === 'success') {
        const content = breadcrumb.context.output?.content;
        console.log('💬 Tool response content:', content);
        
        if (content) {
          // Extract the message from the JSON response if it's wrapped
          let messageContent = content;
          try {
            // Try to parse if it's JSON formatted
            if (content.includes('agent.response.v1')) {
              const parsed = JSON.parse(content.replace(/```json\n?|```/g, ''));
              messageContent = parsed.breadcrumb?.context?.message || content;
            }
          } catch (e) {
            // If parsing fails, use the content as-is
            console.log('📝 Using raw content (no JSON parsing needed)');
          }
          
          const assistantMessage: Message = {
            id: breadcrumbId,
            role: 'assistant',
            content: messageContent,
            timestamp: new Date(breadcrumb.updated_at),
            breadcrumbId
          };
          
          console.log('✅ Adding assistant message:', assistantMessage);
          setMessages(prev => [...prev, assistantMessage]);
          setIsLoading(false);
        } else {
          console.warn('⚠️ No content in tool response');
        }
      } else {
        console.warn('⚠️ Not a successful OpenRouter response:', breadcrumb.context);
      }
    } catch (error) {
      console.error('❌ Failed to get tool response:', error);
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !rcrtClient.current) return;

    const userContent = input.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    try {
      // Create breadcrumb that will trigger the chat agent
      const breadcrumb = await rcrtClient.current.createBreadcrumb({
        schema_name: 'user.message.v1',
        title: 'Extension Chat Message',
        tags: ['extension:chat', 'user:message'],
        context: {
          content: userContent,
          conversation_id: conversationId,
          timestamp: new Date().toISOString(),
          source: 'browser-extension'
        }
      });
      
      console.log('Created user message breadcrumb:', breadcrumb.id);
      
    } catch (error: any) {
      console.error('Failed to send message:', error);
      
      // Provide more detailed error information
      let errorDetail = 'Failed to send message.';
      if (error.message?.includes('Failed to fetch')) {
        errorDetail = 'Connection error. Please ensure RCRT is running on localhost:8081';
      } else if (error.message?.includes('Not authenticated')) {
        errorDetail = 'Authentication failed. Refreshing...';
        // Try to re-authenticate
        setTimeout(() => initializeRCRT(), 1000);
      } else {
        errorDetail = `Error: ${error.message || error}`;
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: `❌ ${errorDetail}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    // Auto-resize textarea
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  };

  const retry = () => {
    initializeRCRT();
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <SparklesIcon className="w-5 h-5 text-teal-400" />
          <span className="font-medium">RCRT Chat</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-xs text-gray-400">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          {!isConnected && (
            <button
              onClick={retry}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              title="Retry connection"
            >
              <ArrowPathIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] ${
                message.role === 'user' 
                  ? 'bg-teal-600 text-white' 
                  : message.role === 'system'
                  ? 'bg-gray-700 text-gray-200'
                  : 'bg-gray-800 text-white'
              } rounded-lg px-4 py-2 shadow-lg`}>
                <div className="flex items-start space-x-2">
                  {message.role === 'user' ? (
                    <UserIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  ) : message.role === 'assistant' ? (
                    <CpuChipIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-teal-400" />
                  ) : null}
                  <div className="flex-1">
                    <div className="whitespace-pre-wrap break-words text-sm">
                      {message.content}
                    </div>
                    <div className="text-xs opacity-60 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                      {message.breadcrumbId && (
                        <span className="ml-2 font-mono">#{message.breadcrumbId.slice(-8)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-gray-800 rounded-lg px-4 py-2 shadow-lg">
              <div className="flex items-center space-x-2">
                <CpuChipIcon className="w-4 h-4 text-teal-400" />
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-700 p-4">
        <div className="flex items-end space-x-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={isConnected ? "Type your message..." : "Connecting to RCRT..."}
              disabled={!isConnected}
              className="w-full bg-gray-800 text-white placeholder-gray-400 rounded-lg px-4 py-2 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-50"
              rows={1}
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
          </div>
          
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !isConnected}
            className={`px-4 py-2 transition-all flex items-center justify-center ${
              !input.trim() || isLoading || !isConnected
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-teal-400 hover:text-teal-300'
            }`}
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
        
        <div className="text-xs text-gray-500 mt-2 text-center">
          Conversation ID: {conversationId}
        </div>
      </div>
    </div>
  );
}
