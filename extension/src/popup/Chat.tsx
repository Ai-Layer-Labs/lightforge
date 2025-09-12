import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PaperAirplaneIcon, 
  StopIcon,
  SparklesIcon,
  UserIcon,
  CpuChipIcon,
  ArrowPathIcon,
  TrashIcon,
  UserGroupIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  PlusIcon,
  FolderIcon
} from '@heroicons/react/24/outline';
import { ExtensionAPI, ExtensionSettingsAPI, ExtensionStorage } from '../lib/api';


type TaskOutput = {
  description: string;
  name?: string;
  expected_output: string;
  summary: string;
  raw: string;
  agent: string;
  output_format: string;
};

type TokenUsage = {
  total_tokens: number;
  prompt_tokens: number;
  cached_prompt_tokens?: number;
  completion_tokens: number;
  successful_requests: number;
};

type ChatResponse = {
  answer: string | {
    raw: string;
    tasks_output?: TaskOutput[];
    token_usage?: TokenUsage;
  };
};

type Message = { 
  id: string;
  role: 'user' | 'assistant' | 'system'; 
  content: string;
  timestamp: Date;
  streaming?: boolean;
  crew?: string;
  metadata?: {
    tasks_output?: TaskOutput[];
    token_usage?: TokenUsage;
  };
};

type CrewInfo = {
  id: string;
  name: string;
  description: string;
  agentCount: number;
};

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState('');
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [crews, setCrews] = useState<CrewInfo[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [supervisors, setSupervisors] = useState<{ id: string; name: string; description?: string }[]>([]);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(true);

  const streamingRef = useRef<{ cancel: () => void } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadCrews();
    loadSupervisors();
    loadSavedMessages();
    loadSavedCrew();
    loadSession();
  }, []);
  const loadSession = async () => {
    const sid = await ExtensionStorage.getSessionId();
    setSessionId(sid);
  };


  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Save messages to storage whenever they change
    ExtensionStorage.saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    // Save selected crew whenever it changes
    if (selectedCrew) {
      ExtensionStorage.saveSelectedCrew(selectedCrew);
    }
  }, [selectedCrew]);

  useEffect(() => {
    if (selectedSupervisor) {
      ExtensionStorage.saveSelectedSupervisor(selectedSupervisor);
    }
  }, [selectedSupervisor]);

  const loadSavedMessages = async () => {
    const savedMessages = await ExtensionStorage.getMessages();
    const parsedMessages: Message[] = (savedMessages as unknown as Array<any>).map((msg) => ({
      id: msg.id || String(Date.now()),
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
      streaming: msg.streaming,
      crew: msg.crew,
      metadata: msg.metadata,
    }));
    setMessages(parsedMessages);
  };

  const loadSavedCrew = async () => {
    const savedCrew = await ExtensionStorage.getSelectedCrew();
    if (savedCrew) {
      setSelectedCrew(savedCrew);
    }
  };

  const loadCrews = async () => {
    try {
      const crewList = await ExtensionAPI.getCrews();
      setCrews(crewList.map(crew => ({
        ...crew,
        agentCount: crew.agents?.length || 0
      })));
      
      // Select default crew if available and no saved crew
      if (crewList.length > 0 && !selectedCrew) {
        const defaultCrew = crewList.find(c => c.id === 'orchestrator') || crewList[0];
        setSelectedCrew(defaultCrew.id);
      }
    } catch (error) {
      console.error('Failed to load crews:', error);
      setIsConnected(false);
    }
  };

  const loadSupervisors = async () => {
    try {
      const list = await ExtensionAPI.getSupervisors();
      setSupervisors(list);
      if (list.length > 0 && !selectedSupervisor) {
        setSelectedSupervisor(list[0].id);
        // Prefer supervisor selection when available
        if (selectedCrew) setSelectedCrew('');
      }
    } catch (error) {
      console.error('Failed to load supervisors:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleExpanded = (messageId: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedMessages(newExpanded);
  };

  const parseResponse = (response: ChatResponse): { content: string; metadata?: any } => {
    if (typeof response.answer === 'string') {
      return { content: response.answer };
    } else if (response.answer?.raw) {
      return {
        content: response.answer.raw,
        metadata: {
          tasks_output: response.answer.tasks_output,
          token_usage: response.answer.token_usage
        }
      };
    }
    return { content: JSON.stringify(response) };
  };

  const resumeSession = async (sid: string) => {
    try {
      const session = await ExtensionAPI.getSession(sid);
      if (session) {
        const restored: Message[] = session.messages.map((m, i) => ({
          id: `${sid}-${i}`,
          role: m.role,
          content: m.content,
          timestamp: new Date(),
          metadata: {},
        }));
        setSessionId(sid);
        await ExtensionStorage.saveSessionId(sid);
        setMessages(restored);
      }
    } catch (e) {
      console.error('Failed to load session messages', e);
      setSessionId(sid);
      await ExtensionStorage.saveSessionId(sid);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!selectedCrew && !selectedSupervisor) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: 'Please select a supervisor or a swarm to handle your request.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

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
      // Ensure we have a session; auto-create if missing
      let sid = sessionId;
      if (!sid) {
        try {
          const session = await ExtensionAPI.createSession('New chat');
          sid = session.id;
          if (sid) {
            setSessionId(sid);
            await ExtensionStorage.saveSessionId(sid);
          }
        } catch (e) {
          // proceed without session if creation fails
        }
      }
      if (streaming) {
        const streamingMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          streaming: true,
          crew: selectedCrew
        };
        setMessages(prev => [...prev, streamingMessage]);

        const runner = await ExtensionAPI.chatStream({ 
          session_id: sid || undefined,
          messages: [...messages, userMessage].map(m => ({ 
            role: m.role, 
            content: m.content 
          })),
          options: selectedSupervisor ? { supervisor_id: selectedSupervisor } : { crew_id: selectedCrew }
        });
        
        streamingRef.current = runner;
        let accumulatedContent = '';
        
        let buffer = '';
        let isFinalSection = false;
        
        await runner.run((chunk) => {
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim() === '') continue;
            
            if (line.startsWith('data: ')) {
              const data = line.substring(6).trim();
              
              if (data === '[FINAL]') {
                isFinalSection = true;
                continue;
              }
              
              if (isFinalSection) {
                try {
                  const parsed = JSON.parse(data);
                  // Persist session id if server returns it
                  const returnedSid = (parsed && (parsed.session_id || parsed.sessionId || parsed.id)) || null;
                  if (returnedSid && returnedSid !== sessionId) {
                    setSessionId(returnedSid);
                    // fire-and-forget persistence
                    ExtensionStorage.saveSessionId(returnedSid).catch(() => {});
                  }
                  const { content, metadata } = parseResponse(parsed);
                  setMessages(prev => prev.map(m => 
                    m.id === streamingMessage.id 
                      ? { ...m, content, streaming: false, metadata }
                      : m
                  ));
                  isFinalSection = false;
                } catch (e) {
                  console.error('Failed to parse final response:', e);
                  setMessages(prev => prev.map(m => 
                    m.id === streamingMessage.id 
                      ? { ...m, content: data, streaming: false }
                      : m
                  ));
                }
              } else {
                accumulatedContent += data;
                setMessages(prev => prev.map(m => 
                  m.id === streamingMessage.id 
                    ? { ...m, content: accumulatedContent }
                    : m
                ));
              }
            }
          }
        });
        
        streamingRef.current = null;
      } else {
        const res = await ExtensionAPI.chat({ 
          session_id: sid || undefined,
          messages: [...messages, userMessage].map(m => ({ 
            role: m.role, 
            content: m.content 
          })),
          options: selectedSupervisor ? { supervisor_id: selectedSupervisor } : { crew_id: selectedCrew }
        }) as ChatResponse;
        
        // Persist session id if server returns it in non-streaming response
        const anyRes = res as any;
        const returnedSid = (anyRes && (anyRes.session_id || anyRes.sessionId || anyRes.id)) || null;
        if (returnedSid && returnedSid !== sessionId) {
          setSessionId(returnedSid);
          // fire-and-forget persistence
          ExtensionStorage.saveSessionId(returnedSid).catch(() => {});
        }

        const { content, metadata } = parseResponse(res);
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content,
          timestamp: new Date(),
          crew: selectedCrew,
          metadata
        };
        
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    streamingRef.current?.cancel();
    setIsLoading(false);
  };

  const handleClearChat = async () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
      setMessages([]);
      await ExtensionStorage.clearMessages();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const openSettings = () => {
    // Open the main app in a new tab
    chrome.tabs.create({ url: 'http://localhost:5173/agents' });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const renderMessageContent = (message: Message) => {
    const isExpanded = expandedMessages.has(message.id);
    const hasMetadata = message.metadata && (message.metadata.tasks_output || message.metadata.token_usage);
    
    return (
      <>
        <div className="whitespace-pre-wrap break-words" style={{color: '#F8F8F8'}}>
          {message.content || (
            <span className="flex items-center gap-2">
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
              <span style={{color: '#F8F8F8'}}>Thinking...</span>
            </span>
          )}
        </div>
        {message.streaming && message.content && (
          <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
        )}
        
        {/* Expandable metadata section */}
        {hasMetadata && !message.streaming && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <button
              onClick={() => toggleExpanded(message.id)}
              className="flex items-center gap-2 text-xs transition-colors"
              style={{color: '#F8F8F8'}}
            >
              {isExpanded ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
              <span>View details</span>
              {message.metadata?.token_usage && (
                <span className="ml-2 opacity-70">
                  {formatNumber(message.metadata.token_usage.total_tokens)} tokens
                </span>
              )}
            </button>
            
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3 space-y-3 overflow-hidden"
              >
                {/* Task outputs */}
                {message.metadata?.tasks_output && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                      <DocumentTextIcon className="h-3 w-3" />
                      <span>NFI Reasoning</span>
                    </div>
                    {message.metadata.tasks_output.map((task, idx) => (
                      <div key={idx} className="bg-gray-900/50 rounded-lg p-3 text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <UserIcon className="h-3 w-3 text-gray-500" />
                          <span className="font-medium" style={{color: '#F8F8F8'}}>{task.agent}</span>
                        </div>
                        <p className="text-gray-400 line-clamp-3">{task.summary || task.description}</p>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Token usage */}
                {message.metadata?.token_usage && (
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-400 font-medium mb-2">
                      <ChartBarIcon className="h-3 w-3" />
                      <span>Token Usage</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total:</span>
                        <span style={{color: '#F8F8F8'}}>{formatNumber(message.metadata.token_usage.total_tokens)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Completion:</span>
                        <span style={{color: '#F8F8F8'}}>{formatNumber(message.metadata.token_usage.completion_tokens)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="popup-container w-full h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3" style={{backgroundColor: '#0C0D17'}}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/icons/think-os-agent.png" alt="ThinkOS Agent" className="h-8 w-8" />

            <div className={`text-xs px-2 py-0.5 rounded-full ${isConnected ? 'bg-[#8EE967]/20 text-[#8EE967]' : 'bg-red-500/20 text-red-400'}`}>
              {isConnected ? '● Connected' : '○ Disconnected'}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* New Chat button */}
            <button
              onClick={() => {
                (async () => {
                  try {
                    const session = await ExtensionAPI.createSession('New chat');
                    if (session.id) {
                      setSessionId(session.id);
                      await ExtensionStorage.saveSessionId(session.id);
                      setMessages([]);
                    }
                  } catch (e) {
                    setMessages([]);
                  }
                })();
              }}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Start new chat session"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
            
            {/* Sessions button */}
            <button
              onClick={() => {
                // TODO: Implement sessions view
                console.log('Sessions clicked');
              }}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="View sessions"
            >
              <FolderIcon className="h-4 w-4" />
            </button>
            
            {/* Clear chat button */}
            <button
              onClick={handleClearChat}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Clear chat"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
            
            {/* Settings button */}
            <button
              onClick={openSettings}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Open settings"
            >
              <Cog6ToothIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Swarm / Supervisor selector */}
        <div className="mt-2 flex items-center gap-2">
          {crews.length > 0 && (
            <>
              <UserGroupIcon className="h-4 w-4 text-gray-400" />
              <select
                value={selectedCrew}
                onChange={(e) => setSelectedCrew(e.target.value)}
                className="flex-1 px-2 py-1 bg-gray-750 border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{color: '#F8F8F8'}}
              >
                {crews.map(crew => (
                  <option key={crew.id} value={crew.id}>
                    {crew.name} ({crew.agentCount} NFI)
                  </option>
                ))}
              </select>
            </>
          )}
          {supervisors.length > 0 && (
            <select
              value={selectedSupervisor}
              onChange={(e) => setSelectedSupervisor(e.target.value)}
              className="flex-1 px-2 py-1 bg-gray-750 border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                              style={{color: '#F8F8F8'}}
            >
              {supervisors.map(s => (
                <option key={s.id} value={s.id}>
                  Supervisor: {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
        
        {/* Streaming toggle */}
        <div className="mt-2 flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={streaming}
              onChange={(e) => setStreaming(e.target.checked)}
              className="rounded bg-gray-700 border-gray-600 focus:ring-2 focus:border-transparent"
              style={{accentColor: '#22D0FB'}}
            />
            <span style={{color: '#F8F8F8'}}>Stream responses</span>
          </label>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {crews.length === 0 && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full p-4">
            <div className="text-center">
              <InformationCircleIcon className="h-12 w-12 text-orange-400 mx-auto mb-2" />
              <p className="text-sm" style={{color: '#F8F8F8'}}>No swarms configured</p>
              <button
                onClick={openSettings}
                className="mt-2 text-xs hover:text-teal-300"
                style={{color: '#22D0FB'}}
              >
                Configure swarms →
              </button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <SparklesIcon className="h-8 w-8 text-teal-500 mb-2" />
            <p className="text-sm text-center" style={{color: '#F8F8F8'}}>
              Start a conversation with your {crews.find(c => c.id === selectedCrew)?.name || 'AI'} swarm
            </p>
          </div>
        ) : (
          <div className="py-4 px-4">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`mb-4 flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >

                  
                  <div className={`flex flex-col max-w-[85%] ${
                    message.role === 'user' ? 'items-end' : 'items-start'
                  }`}>
                    {message.role === 'assistant' && (
                      <div className="text-xs text-gray-400 mb-1">
                        Think Agent
                      </div>
                    )}
                    <div className={`rounded-xl py-2 text-sm ${
                      message.role === 'user'
                        ? 'px-3 text-white'
                        : message.role === 'system'
                        ? 'px-3 bg-orange-600/20 text-orange-400 border border-orange-600/30'
                        : ''
                    }`} style={{
                      backgroundColor: message.role === 'user' ? '#232329' : undefined
                    }}>
                      {renderMessageContent(message)}
                    </div>
                    <div className="flex items-center gap-2 mt-1 px-1">
                      <span className="text-xs" style={{color: '#F8F8F8'}}>
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                  </div>
                  

                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-700 p-3" style={{backgroundColor: '#0C0D17'}}>
        <div className="flex items-center">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-1 px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent resize-none overflow-hidden"
            style={{
              color: '#F8F8F8', 
              backgroundColor: '#16172B', 
              height: '40px',
              minHeight: '40px'
            }}
            rows={1}
            disabled={isLoading}
          />
          
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`px-4 py-2 transition-all flex items-center justify-center ${
              !input.trim() || isLoading
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-teal-400 hover:text-teal-300'
            }`}
            style={{
              color: !input.trim() || isLoading
                ? undefined 
                : '#22D0FB',
              backgroundColor: '#16172B',
              height: '40px',
              minHeight: '40px'
            }}
            title="Send message"
          >
            <PaperAirplaneIcon className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

