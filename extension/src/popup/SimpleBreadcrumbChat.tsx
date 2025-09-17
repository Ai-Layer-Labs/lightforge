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
          
          // Listen for agent responses
          if (data.type === 'breadcrumb_created' && 
              data.schema_name === 'agent.response.v1' &&
              data.tags?.includes('extension:chat')) {
            handleAgentResponse(data.breadcrumb_id!);
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

  const handleAgentResponse = async (breadcrumbId: string) => {
    if (!rcrtClient.current) return;
    
    try {
      const breadcrumb = await rcrtClient.current.getBreadcrumb(breadcrumbId);
      
      // Check if this response is for our conversation
      if (breadcrumb.context.conversation_id === conversationId) {
        const assistantMessage: Message = {
          id: breadcrumbId,
          role: 'assistant',
          content: breadcrumb.context.content as string,
          timestamp: new Date(breadcrumb.updated_at),
          breadcrumbId
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to get agent response:', error);
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !rcrtClient.current) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
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
          content: input.trim(),
          conversation_id: conversationId,
          timestamp: new Date().toISOString(),
          source: 'browser-extension'
        }
      });
      
      console.log('Created user message breadcrumb:', breadcrumb.id);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: '❌ Failed to send message. Please try again.',
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
