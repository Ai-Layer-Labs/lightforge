import { useEffect, useRef, useState, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PaperAirplaneIcon, 
  SparklesIcon,
  UserIcon,
  CpuChipIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  WrenchIcon
} from '@heroicons/react/24/outline';
import { RCRTExtensionClient, type BreadcrumbContext, type EventStreamMessage } from '../lib/rcrt-client';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  breadcrumbId?: string;
  toolRequests?: any[];
  toolName?: string;
  isError?: boolean;
};

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function RCRTChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
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
      setConnectionStatus('connecting');
      rcrtClient.current = new RCRTExtensionClient();
      await rcrtClient.current.authenticate();
      
      // Start listening for agent responses
      await startEventStream();
      
      setConnectionStatus('connected');
      
      // Add welcome message
      const welcomeMessage: Message = {
        id: 'welcome',
        role: 'system',
        content: '👋 Welcome to RCRT Chat! I\'m your AI assistant powered by the Right Context Right Time system. I can help you with various tasks using my available tools. How can I assist you today?',
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
      
    } catch (error) {
      console.error('Failed to initialize RCRT:', error);
      setConnectionStatus('error');
      
      const errorMessage: Message = {
        id: 'error',
        role: 'system',
        content: '❌ Failed to connect to RCRT. Please ensure:\n• RCRT server is running on localhost:8081\n• Agent and tools runners are active\n• Bootstrap has been completed',
        timestamp: new Date(),
        isError: true
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
          
          // Listen for agent responses (matching our workspace)
          if ((data.type === 'breadcrumb_created' || data.type === 'breadcrumb_updated') && 
              data.schema_name === 'agent.response.v1' &&
              data.tags?.includes('workspace:agents')) {
            handleAgentResponse(data.breadcrumb_id!);
          }
          
          // Listen for tool responses
          if ((data.type === 'breadcrumb_created' || data.type === 'breadcrumb_updated') && 
              data.schema_name === 'tool.response.v1' &&
              data.tags?.includes('workspace:tools')) {
            handleToolResponse(data.breadcrumb_id!);
          }
          
        } catch (error) {
          console.warn('Failed to parse SSE event:', error);
        }
      };
      
      stream.onerror = (error) => {
        console.error('SSE error:', error);
        setConnectionStatus('disconnected');
      };
      
    } catch (error) {
      console.error('Failed to start event stream:', error);
      setConnectionStatus('error');
    }
  };

  const handleAgentResponse = async (breadcrumbId: string) => {
    if (!rcrtClient.current) return;
    
    try {
      const breadcrumb = await rcrtClient.current.getBreadcrumb(breadcrumbId);
      
      // Check if this response is for our session
      if (breadcrumb.context.session_id === sessionId || 
          breadcrumb.context.response_to_session === sessionId) {
        
        const assistantMessage: Message = {
          id: breadcrumbId,
          role: 'assistant',
          content: breadcrumb.context.message || breadcrumb.context.content || 'No response content',
          timestamp: new Date(breadcrumb.updated_at),
          breadcrumbId,
          toolRequests: breadcrumb.context.tool_requests
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to get agent response:', error);
      setIsLoading(false);
    }
  };

  const handleToolResponse = async (breadcrumbId: string) => {
    if (!rcrtClient.current) return;
    
    try {
      const breadcrumb = await rcrtClient.current.getBreadcrumb(breadcrumbId);
      
      // Tool responses might be shown as system messages
      const toolMessage: Message = {
        id: breadcrumbId,
        role: 'tool',
        content: `Tool "${breadcrumb.context.tool}" executed successfully`,
        timestamp: new Date(breadcrumb.updated_at),
        breadcrumbId,
        toolName: breadcrumb.context.tool
      };
      
      // Only show tool messages in debug mode or if they're important
      if (breadcrumb.context.error) {
        toolMessage.content = `Tool "${breadcrumb.context.tool}" error: ${breadcrumb.context.error}`;
        toolMessage.isError = true;
        setMessages(prev => [...prev, toolMessage]);
      }
      
    } catch (error) {
      console.error('Failed to get tool response:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !rcrtClient.current || connectionStatus !== 'connected') return;

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
      // Create chat message breadcrumb (using the correct schema)
      const breadcrumb = await rcrtClient.current.createBreadcrumb({
        schema_name: 'chat.message.v1',
        title: 'User Message',
        tags: ['chat:message', 'workspace:agents', 'user:input', 'extension:chat'],
        context: {
          user_id: 'extension-user',
          message: input.trim(),
          timestamp: new Date().toISOString(),
          session_id: sessionId,
          source: 'browser-extension'
        }
      });
      
      console.log('Created chat message breadcrumb:', breadcrumb.id);
      userMessage.breadcrumbId = breadcrumb.id;
      
    } catch (error) {
      console.error('Failed to send message:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: '❌ Failed to send message. Please check your connection and try again.',
        timestamp: new Date(),
        isError: true
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

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const retry = () => {
    setMessages([]);
    initializeRCRT();
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-400';
      case 'connecting': return 'bg-yellow-400 animate-pulse';
      case 'disconnected': return 'bg-red-400';
      case 'error': return 'bg-red-600';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected to RCRT';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Connection Error';
      default: return 'Unknown';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center space-x-2">
          <SparklesIcon className="w-5 h-5 text-teal-400" />
          <span className="font-medium">RCRT Chat</span>
          <span className="text-xs text-gray-400">({sessionId.slice(-8)})</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
          <span className="text-xs text-gray-400">
            {getStatusText()}
          </span>
          {connectionStatus !== 'connected' && (
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-900 to-gray-800">
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
                  ? message.isError ? 'bg-red-900/50 text-red-200 border border-red-700' : 'bg-gray-700 text-gray-200'
                  : message.role === 'tool'
                  ? 'bg-purple-900/30 text-purple-200 border border-purple-700'
                  : 'bg-gray-800 text-white'
              } rounded-lg px-4 py-3 shadow-lg`}>
                <div className="flex items-start space-x-2">
                  {message.role === 'user' ? (
                    <UserIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  ) : message.role === 'assistant' ? (
                    <CpuChipIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-teal-400" />
                  ) : message.role === 'tool' ? (
                    <WrenchIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-purple-400" />
                  ) : null}
                  <div className="flex-1">
                    <div className="whitespace-pre-wrap break-words text-sm">
                      {message.content}
                    </div>
                    {message.toolRequests && message.toolRequests.length > 0 && (
                      <div className="mt-2 text-xs text-gray-400">
                        🛠️ Invoking tools: {message.toolRequests.map(tr => tr.tool).join(', ')}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-xs opacity-60">
                        {message.timestamp.toLocaleTimeString()}
                        {message.breadcrumbId && (
                          <span className="ml-2 font-mono">#{message.breadcrumbId.slice(-8)}</span>
                        )}
                      </div>
                      {message.breadcrumbId && (
                        <button
                          onClick={() => copyToClipboard(message.breadcrumbId!, message.id)}
                          className="text-xs opacity-60 hover:opacity-100 transition-opacity"
                          title="Copy breadcrumb ID"
                        >
                          {copiedId === message.id ? (
                            <CheckIcon className="w-3 h-3 text-green-400" />
                          ) : (
                            <ClipboardDocumentIcon className="w-3 h-3" />
                          )}
                        </button>
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
            <div className="bg-gray-800 rounded-lg px-4 py-3 shadow-lg">
              <div className="flex items-center space-x-2">
                <CpuChipIcon className="w-4 h-4 text-teal-400 animate-pulse" />
                <div className="text-sm text-gray-300">
                  Processing your request...
                </div>
              </div>
            </div>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-700 p-4 bg-gray-800/50">
        <div className="flex items-end space-x-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={connectionStatus === 'connected' ? "Ask me anything..." : "Waiting for connection..."}
              disabled={connectionStatus !== 'connected'}
              className="w-full bg-gray-700 text-white placeholder-gray-400 rounded-lg px-4 py-2 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
              rows={1}
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500">
              Press Enter to send
            </div>
          </div>
          
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || connectionStatus !== 'connected'}
            className={`p-2 rounded-lg transition-all flex items-center justify-center ${
              !input.trim() || isLoading || connectionStatus !== 'connected'
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-teal-600 text-white hover:bg-teal-500 shadow-lg'
            }`}
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>Powered by RCRT</span>
          <span>Session: {sessionId.slice(-12)}</span>
        </div>
      </div>
    </div>
  );
}
