import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PaperAirplaneIcon, 
  TrashIcon,
  Cog6ToothIcon,
  PlusIcon,
  ChatBubbleLeftIcon,
  CpuChipIcon,
  ChevronUpIcon,
  ClockIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { rcrtClient } from '../lib/rcrt-client';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  breadcrumbId?: string;
  streaming?: boolean;
  processingTime?: number;
  agent_id?: string;
  agent_name?: string;
  metadata?: {
    token_usage?: {
      total_tokens: number;
      completion_tokens: number;
    };
    tasks_output?: Array<{
      agent: string;
      summary?: string;
      description?: string;
    }>;
  };
};

type Session = {
  session_id: string;
  title: string;
  last_activity?: string;
  first_message?: string | null;
};

type RCRTAgent = {
  id: string;
  name: string;
  description?: string;
  roles?: string[];
};

type TestStatus = 'idle' | 'running' | 'ok' | 'failed';


export default function Panel() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>(`ext-session-${Date.now()}`);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [agents, setAgents] = useState<RCRTAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Set<string>>(new Set(['']));
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const sseCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    initializeRCRT();
    loadAgents();
    loadSessions();
    return () => {
      if (sseCleanupRef.current) {
        sseCleanupRef.current();
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    // Save messages to storage
    if (messages.length > 0) {
      localStorage.setItem(`rcrt-messages-${currentSessionId}`, JSON.stringify(messages));
    }
  }, [messages, currentSessionId]);

  useEffect(() => {
    // Save selected agent
    const selectedAgentValue = Array.from(selectedAgent)[0];
    if (selectedAgentValue) {
      localStorage.setItem('rcrt-selected-agent', selectedAgentValue);
    }
  }, [selectedAgent]);


  async function initializeRCRT() {
    try {
      console.log('🚀 Initializing RCRT connection...');
      
      const success = await rcrtClient.authenticate();
      if (success) {
        setConnected(true);
        console.log('✅ Connected to RCRT system');
        
        const cleanup = await rcrtClient.listenForAgentResponses(currentSessionId, (response) => {
          console.log('🤖 Received agent response:', response);
          
          const assistantMessage: ChatMessage = {
            id: `agent-${Date.now()}`,
            role: 'assistant',
            content: response,
            timestamp: new Date(),
            agent_id: selectedAgentValue,
            agent_name: agents.find(a => a.id === selectedAgentValue)?.name || 'Unknown Agent',
          };
          
          setMessages(prev => [...prev, assistantMessage]);
          setIsLoading(false);
        });
        
        sseCleanupRef.current = cleanup;
      } else {
        setConnected(false);
        console.error('❌ Failed to connect to RCRT');
      }
    } catch (error) {
      console.error('❌ RCRT initialization error:', error);
      setConnected(false);
    }
  }

  async function loadAgents() {
    try {
      // Load actual RCRT agents
      const { rcrtClient } = await import('../lib/rcrt-client');
      const rcrtAgents = await rcrtClient.listAgents();
      
      if (rcrtAgents && rcrtAgents.length > 0) {
        const agents: RCRTAgent[] = rcrtAgents.map((agent: any) => ({
          id: agent.id,
          name: agent.name || agent.id,
          description: agent.description || `RCRT Agent: ${agent.id}`,
          roles: agent.roles || []
        }));
        setAgents(agents);
        console.log('✅ Loaded RCRT agents:', agents);
      } else {
        // Fallback to mock agents if RCRT doesn't have any
        console.warn('⚠️ No agents found in RCRT, using fallback');
        const mockAgents: RCRTAgent[] = [
          { id: 'orchestrator', name: 'Orchestrator', description: 'Main coordination agent', roles: ['orchestrator'] },
          { id: 'research', name: 'Research Agent', description: 'Research and analysis', roles: ['researcher'] },
          { id: 'code', name: 'Code Agent', description: 'Code generation and review', roles: ['coder'] }
        ];
        setAgents(mockAgents);
      }
      
      const savedAgent = localStorage.getItem('rcrt-selected-agent');
      const availableAgents = rcrtAgents && rcrtAgents.length > 0 ? 
        rcrtAgents.map((agent: any) => ({
          id: agent.id,
          name: agent.name || agent.id,
          description: agent.description || `RCRT Agent: ${agent.id}`,
          roles: agent.roles || []
        })) : [
          { id: 'orchestrator', name: 'Orchestrator', description: 'Main coordination agent', roles: ['orchestrator'] },
          { id: 'research', name: 'Research Agent', description: 'Research and analysis', roles: ['researcher'] },
          { id: 'code', name: 'Code Agent', description: 'Code generation and review', roles: ['coder'] }
        ];
      
      if (savedAgent && availableAgents.find(a => a.id === savedAgent)) {
        setSelectedAgent(new Set([savedAgent]));
      } else if (availableAgents.length > 0) {
        setSelectedAgent(new Set([availableAgents[0].id]));
      }
    } catch (error) {
      console.error('❌ Error loading agents from RCRT:', error);
      
      // Fallback to mock agents on error
      const mockAgents: RCRTAgent[] = [
        { id: 'orchestrator', name: 'Orchestrator', description: 'Main coordination agent', roles: ['orchestrator'] },
        { id: 'research', name: 'Research Agent', description: 'Research and analysis', roles: ['researcher'] },
        { id: 'code', name: 'Code Agent', description: 'Code generation and review', roles: ['coder'] }
      ];
      setAgents(mockAgents);
      setSelectedAgent(new Set([mockAgents[0].id]));
    }
  }

  async function loadSessions() {
    try {
      // Load session data from localStorage
      let sessionData: Record<string, any> = {};
      try {
        sessionData = JSON.parse(localStorage.getItem('rcrt_session_data') || '{}');
      } catch (error) {
        console.warn('Failed to load session data from localStorage:', error);
      }
      
      // Load actual sessions from RCRT
      const { rcrtAdapter } = await import('../lib/rcrt-adapter');
      const rcrtSessions = await rcrtAdapter.listSessions(1, 50);
      
      if (rcrtSessions && rcrtSessions.sessions) {
        const sessions: Session[] = rcrtSessions.sessions.map((session: any) => {
          const sessionId = session.session_id || session.id;
          const localData = sessionData[sessionId];
          
          return {
            session_id: sessionId,
            title: session.title || `Session ${sessionId?.slice(-8) || 'Unknown'}`,
            last_activity: session.last_activity || session.created_at || new Date().toISOString(),
            first_message: localData?.first_message || null
          };
        });
        setSessions(sessions);
        console.log('✅ Loaded sessions from RCRT with localStorage data:', sessions);
      } else {
        // Fallback to current session only
        const fallbackSessions: Session[] = [
          { session_id: currentSessionId, title: 'Current Session', last_activity: new Date().toISOString(), first_message: null }
        ];
        setSessions(fallbackSessions);
        console.warn('⚠️ No sessions found in RCRT, using current session only');
      }
    } catch (error) {
      console.error('❌ Error loading sessions from RCRT:', error);
      
      // Fallback to current session only
      const fallbackSessions: Session[] = [
        { session_id: currentSessionId, title: 'Current Session', last_activity: new Date().toISOString(), first_message: null }
      ];
      setSessions(fallbackSessions);
    }
  }

  async function createNewSession() {
    try {
      // Create session via RCRT
      const { rcrtAdapter } = await import('../lib/rcrt-adapter');
      const newSession = await rcrtAdapter.createSession('New Chat Session');
      
      const sessionId = (newSession as any).session_id || (newSession as any).id || `ext-session-${Date.now()}`;
      setCurrentSessionId(sessionId);
      setMessages([]);
      setShowSessions(false);
      
      // Add to sessions list
      const session: Session = {
        session_id: sessionId,
        title: newSession.title || 'New Session',
        last_activity: new Date().toISOString()
      };
      setSessions(prev => [session, ...prev]);
      
      console.log('✅ Created new session via RCRT:', sessionId);
    } catch (error) {
      console.error('❌ Error creating session via RCRT:', error);
      
      // Fallback to local session creation
      const newSessionId = `ext-session-${Date.now()}`;
      setCurrentSessionId(newSessionId);
      setMessages([]);
      setShowSessions(false);
      
      const newSession: Session = {
        session_id: newSessionId,
        title: 'New Session',
        last_activity: new Date().toISOString()
      };
      setSessions(prev => [newSession, ...prev]);
    }
  }

  async function loadSession(sessionId: string) {
    try {
      setCurrentSessionId(sessionId);
      setShowSessions(false);
      
      // Load messages for this session
      const savedMessages = localStorage.getItem(`rcrt-messages-${sessionId}`);
      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(parsedMessages);
      } else {
        setMessages([]);
      }
      
      console.log('✅ Loaded session:', sessionId);
    } catch (error) {
      console.error('❌ Error loading session:', error);
    }
  }

  async function runSmokeTest() {
    setTestStatus('running');
    setTestMessage('');
    
    try {
      // Test RCRT connection and basic functionality
      const testMessage: ChatMessage = {
        id: `test-${Date.now()}`,
        role: 'user',
        content: 'hi',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, testMessage]);
      
      // Simulate agent response
      setTimeout(() => {
        const response: ChatMessage = {
          id: `test-response-${Date.now()}`,
          role: 'assistant',
          content: 'Hello! RCRT system is working correctly.',
          timestamp: new Date(),
          agent_id: selectedAgentValue,
          agent_name: agents.find(a => a.id === selectedAgentValue)?.name || 'Unknown Agent',
        };
        
        setMessages(prev => [...prev, response]);
        setTestStatus('ok');
        setTestMessage('OK: System is responding correctly');
      }, 2000);
      
    } catch (error) {
      setTestStatus('failed');
      setTestMessage((error as Error).message || 'Smoke test failed');
    }
  }

  async function sendMessage() {
    if (!input.trim() || isLoading || !connected) return;
    
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      agent_id: selectedAgentValue,
      agent_name: agents.find(a => a.id === selectedAgentValue)?.name || 'Unknown Agent',
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Update session with first message if this is the first message
    if (messages.length === 0) {
      const firstMessageContent = userMessage.content;
      
      // Store in localStorage for persistence
      const sessionData = {
        session_id: currentSessionId,
        first_message: firstMessageContent,
        timestamp: new Date().toISOString()
      };
      
      try {
        const existingData = JSON.parse(localStorage.getItem('rcrt_session_data') || '{}');
        existingData[currentSessionId] = sessionData;
        localStorage.setItem('rcrt_session_data', JSON.stringify(existingData));
      } catch (error) {
        console.warn('Failed to save session data to localStorage:', error);
      }
      
      setSessions(prev => prev.map(session => 
        session.session_id === currentSessionId 
          ? { ...session, first_message: firstMessageContent }
          : session
      ));
    }
    
    setInput('');
    setIsLoading(true);
    
    // Auto-resize textarea
    if (composerRef.current) {
      composerRef.current.style.height = 'auto';
    }
    
    try {
      console.log('📤 Sending chat message to RCRT...');
      
      const result = await rcrtClient.createChatBreadcrumb({
        role: 'user',
        content: userMessage.content,
        sessionId: currentSessionId,
      });
      
      console.log('✅ Chat breadcrumb created:', result.id);
      
      // Set timeout in case agent doesn't respond
      setTimeout(() => {
        if (isLoading) {
          setIsLoading(false);
          setMessages(prev => [...prev, {
            id: `timeout-${Date.now()}`,
            role: 'assistant',
            content: 'Request timeout - check Dashboard v2 for response',
            timestamp: new Date(),
            agent_id: selectedAgentValue,
            agent_name: agents.find(a => a.id === selectedAgentValue)?.name || 'Unknown Agent',
          }]);
        }
      }, 10000);
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setIsLoading(false);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${(error as Error).message}`,
        timestamp: new Date(),
        agent_id: selectedAgentValue,
        agent_name: agents.find(a => a.id === selectedAgentValue)?.name || 'Unknown Agent',
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

  function toggleMessageDetails(messageId: string) {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedMessages(newExpanded);
  }

  function formatNumber(num: number) {
    return new Intl.NumberFormat().format(num);
  }

  const selectedAgentValue = Array.from(selectedAgent)[0];
  const canSend = input.trim() && !isLoading && connected && selectedAgentValue;

  const selectedValue = React.useMemo(
    () => {
      const agent = agents.find(a => a.id === selectedAgentValue);
      if (!agent) return 'Select Agent';
      
      const name = agent.name;
      if (name.length <= 12) return name;
      
      return `${name.substring(0, 6)}...${name.substring(name.length - 6)}`;
    },
    [selectedAgentValue, agents],
  );

  const truncateAgentName = (name: string) => {
    if (name.length <= 12) return name;
    return `${name.substring(0, 6)}...${name.substring(name.length - 6)}`;
  };


  return (
    <div className="w-screen h-screen flex flex-col text-white pb-10" style={{ 
      width: '100vw', 
      height: '100vh', 
      paddingBottom: '40px',
      background: 'linear-gradient(to bottom, #0D0D0D 0%, #0a0d21 100%)'
    }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
            <img src="/icons/think-os-agent.png" alt="RCRT Agent" className="h-8 w-8" />
              <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
            </div>
            <div>
              <h1 className="text-sm font-semibold">THINK Agent</h1>
              <div className="flex items-center gap-2 text-xs">
                <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
                <span className={connected ? 'text-green-400' : 'text-red-400'}>
                  {connected ? 'Connected to RCRT' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={createNewSession}
              className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg"
              title="Start new chat session"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
            
            <button
              onClick={() => setShowSessions(!showSessions)}
              className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg"
              title="View sessions"
            >
              <ChatBubbleLeftIcon className="h-4 w-4" />
            </button>
            
            <button
              onClick={clearChat}
              className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg"
              title="Clear chat"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
            
            <button
              onClick={openDashboard}
              className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg"
              title="Open settings"
            >
              <Cog6ToothIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sessions Panel */}
      {showSessions && (
        <div className="px-4 py-3 border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-gray-200">Sessions</div>
            <div className="flex items-center gap-2">
              <button
                onClick={runSmokeTest}
                disabled={testStatus === 'running'}
                className={`text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors ${
                  testStatus === 'running' 
                    ? 'bg-gray-600 text-gray-100' 
                    : 'bg-teal-600 text-gray-100 hover:bg-teal-500'
                }`}
              >
                {testStatus === 'running' ? 'Testing…' : 'Run smoke test'}
              </button>
              <button
                onClick={() => setShowSessions(false)}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors bg-gray-700 text-gray-100 border border-gray-600 hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
          
          {testStatus !== 'idle' && (
            <div className={`text-xs mb-3 px-3 py-2 rounded-lg ${
              testStatus === 'ok' 
                ? 'bg-green-500/20 text-green-400' 
                : testStatus === 'failed' 
                ? 'bg-red-500/20 text-red-400' 
                : 'bg-gray-500/20 text-gray-400'
            }`}>
              {testMessage || (testStatus === 'running' ? 'Running smoke test…' : '')}
            </div>
          )}
          
          <div className="flex flex-col space-y-3 max-h-72 overflow-auto custom-scrollbar">
            {sessions.length === 0 ? (
              <div className="text-xs text-center py-4 text-gray-400">
                No past sessions
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.session_id}
                  className="p-3 rounded-lg flex items-center justify-between transition-colors hover:bg-gray-800/50 bg-gray-800/30 border border-gray-700/50"
                >
                  <div className="text-xs">
                    <div className="font-medium line-clamp-1 text-gray-200">
                      {session.first_message 
                        ? session.first_message.length > 30 
                          ? `${session.first_message.substring(0, 30)}...`
                          : session.first_message
                        : session.title || session.session_id
                      }
                    </div>
                    <div className="text-gray-400">
                      {session.last_activity ? new Date(session.last_activity).toLocaleString() : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => loadSession(session.session_id)}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors bg-teal-600 text-gray-100 hover:bg-teal-500"
                  >
                    Open
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {!connected && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="relative mb-6">
              <CpuChipIcon className="h-12 w-12 mx-auto text-red-400" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 rounded-full animate-pulse" />
            </div>
            <p className="text-red-400 mb-2 font-semibold text-lg">Not connected to RCRT</p>
            <p className="text-gray-400 text-sm mb-6">Make sure the RCRT backend is running</p>
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              <span className="text-xs text-red-400">Connection Status: Disconnected</span>
            </div>
            <button
              onClick={initializeRCRT}
              className="px-4 py-2 bg-red-500/20 border border-red-400/50 rounded-lg text-red-300 hover:bg-red-500/30 transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}
        
        {connected && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <img 
              src="/think-crew.svg" 
              alt="THINK Agent" 
              className="mx-auto mb-4" 
              style={{ width: '80px', height: '80px' }}
            />
            <p className="text-gray-300 text-base">Start a conversation with your THINK agent</p>
          </div>
        )}

        {connected && messages.length > 0 && (
          <div className="space-y-6">
            <AnimatePresence>
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                  style={{
                    marginBottom: index < messages.length - 1 && message.role !== messages[index + 1]?.role ? '2rem' : '0.5rem'
                  }}
                >
                  <div className={`flex flex-col max-w-[85%] ${
                    message.role === 'user' ? 'items-end' : 'items-start'
                  }`}>
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-medium text-gray-200 text-base">
                          {truncateAgentName(message.agent_name || agents.find(a => a.id === selectedAgentValue)?.name || 'THINK Agent')}
                        </span>
                        {message.processingTime ? (
                          <span className="text-xs text-gray-400">
                            {message.processingTime}ms
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {message.timestamp.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className={`py-2 text-sm ${
                      message.role === 'user'
                        ? 'text-white rounded-xl px-3'
                        : message.role === 'system'
                        ? 'text-orange-400 px-3'
                        : 'text-gray-100'
                    }`} style={{
                      backgroundColor: message.role === 'user' ? '#232329' : 'transparent'
                    }}>
                      <div className="whitespace-pre-wrap break-words text-gray-200">
                        {message.content || (
                          <span className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                            <span className="text-gray-200">Thinking...</span>
                          </span>
                        )}
                      </div>
                      {message.streaming && message.content && (
                        <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
                      )}
                    </div>
                    
                    {message.role === 'assistant' && message.metadata && !message.streaming && (
                      <div className="mt-3 pt-3 border-t border-gray-700/50">
                        <button
                          onClick={() => toggleMessageDetails(message.id)}
                          className="flex items-center gap-2 text-xs transition-colors hover:text-gray-300 text-gray-400"
                        >
                          {expandedMessages.has(message.id) ? (
                            <ChevronUpIcon className="h-3 w-3" />
                          ) : (
                            <ChevronUpIcon className="h-3 w-3 rotate-180" />
                          )}
                          <span>View details</span>
                          {message.metadata.token_usage && (
                            <span className="ml-2 opacity-70">
                              {formatNumber(message.metadata.token_usage.total_tokens)} tokens
                            </span>
                          )}
                        </button>
                        
                        {expandedMessages.has(message.id) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-3 space-y-3 overflow-hidden"
                          >
                            {message.metadata.tasks_output && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                                  <CheckCircleIcon className="h-3 w-3" />
                                  <span>Task Output</span>
                                </div>
                                {message.metadata.tasks_output.map((task, taskIndex) => (
                                  <div key={taskIndex} className="bg-gray-900/50 rounded-lg p-3 text-xs">
                                    <div className="flex items-center gap-2 mb-1">
                                      <CpuChipIcon className="h-3 w-3 text-gray-500" />
                                      <span className="font-medium text-gray-200">{task.agent}</span>
                                    </div>
                                    <p className="text-gray-400 line-clamp-3">
                                      {task.summary || task.description}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {message.metadata.token_usage && (
                              <div className="bg-gray-900/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 text-xs text-gray-400 font-medium mb-2">
                                  <ClockIcon className="h-3 w-3" />
                                  <span>Token Usage</span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Total:</span>
                                    <span className="text-gray-200">
                                      {formatNumber(message.metadata.token_usage.total_tokens)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Completion:</span>
                                    <span className="text-gray-200">
                                      {formatNumber(message.metadata.token_usage.completion_tokens)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </div>
                    )}
                    
                    {message.role === 'user' && (
                      <div className="flex items-center gap-2 mt-1 px-1">
                        <span className="text-xs text-gray-400">
                      {message.timestamp.toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                        </span>
                    </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="w-full border-t border-gray-700/50 pb-2">
        <div className="w-full px-4 pb-3">
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
            placeholder="Ask anything..."
            className="w-full px-4 py-3 text-sm text-white placeholder-gray-400 resize-none overflow-hidden transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 bg-gray-800/80 border border-gray-700/50 rounded-xl"
            style={{
              minHeight: '44px',
              maxHeight: '120px',
              width: '100%',
              boxSizing: 'border-box',
              margin: '0',
              padding: '10px 16px 8px 10px'
            }}
            rows={1} 
            disabled={isLoading}
          />
        </div>
        
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="relative">
              <div className="relative">
                <button
                  onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                  className="px-4 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors capitalize truncate max-w-[200px] flex items-center justify-between gap-2"
                >
                  <span className="truncate">{selectedValue}</span>
                  <ChevronUpIcon className={`h-4 w-4 transition-transform flex-shrink-0 ${showAgentDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showAgentDropdown && (
                  <>
                    {/* Backdrop - darkens and blurs the sidepanel */}
                    <div 
                      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                      onClick={() => setShowAgentDropdown(false)}
                    />
                    {/* Dropdown items floating above button */}
                    <div className="fixed z-50" style={{
                      bottom: '80px',
                      left: '16px',
                      right: '16px',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      {agents.slice().reverse().map((agent, index) => (
                        <div key={agent.id} className="mb-1 last:mb-0">
                          <button
                            onClick={() => {
                              setSelectedAgent(new Set([agent.id]));
                              setShowAgentDropdown(false);
                            }}
                            className={`w-full px-4 py-3 text-left text-white transition-all duration-200 flex items-center justify-between rounded-lg ${
                              selectedAgentValue === agent.id 
                                ? 'bg-gray-700 shadow-lg' 
                                : 'bg-gray-800 hover:bg-gray-700 hover:shadow-md hover:scale-[1.02]'
                            }`}
                            style={{
                              animationDelay: `${index * 50}ms`,
                              animation: 'slideUp 0.2s ease-out forwards'
                            }}
                          >
                            <div className="truncate">
                              {agent.name.length <= 12 ? agent.name : `${agent.name.substring(0, 6)}...${agent.name.substring(agent.name.length - 6)}`}
                            </div>
                            {selectedAgentValue === agent.id && (
                              <CheckCircleIcon className="h-4 w-4 text-white flex-shrink-0" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <button
              onClick={() => {
                console.log('Button clicked!', { canSend, input: input.trim(), isLoading, connected, selectedAgentValue });
                sendMessage();
              }}
              disabled={!canSend}
              className="flex items-center justify-center p-2 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-none"
              style={{
                color: canSend ? '#ffffff' : '#6b7280',
                width: '36px',
                height: '36px'
              }}
            >
              <PaperAirplaneIcon className="h-6 w-6" style={{ transform: 'rotate(-45deg)' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}