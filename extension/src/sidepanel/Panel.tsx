import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PaperAirplaneIcon, 
  StopIcon,
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
import { ExtensionAPI, ExtensionSettingsAPI, ExtensionStorage, ExtMessage } from '../lib/api';



type CrewInfo = { id: string; name: string; description?: string; agents?: string[] };
type SupervisorInfo = { id: string; name: string };

type UiMessage = ExtMessage & { 
  id: string; 
  timestamp: Date; 
  streaming?: boolean;
  processingTime?: number;
  thoughtProcess?: string;
  metadata?: {
    tasks_output?: Array<{
      agent: string;
      summary?: string;
      description?: string;
    }>;
    token_usage?: {
      total_tokens: number;
      completion_tokens: number;
    };
  };
};

export default function Panel() {
  const [connected, setConnected] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [crews, setCrews] = useState<CrewInfo[]>([]);
  const [selectedCrew, setSelectedCrew] = useState('');
  const [supervisors, setSupervisors] = useState<SupervisorInfo[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessions, setSessions] = useState<{ session_id: string; title?: string; last_activity?: string }[]>([]);
  const [smokeStatus, setSmokeStatus] = useState<'idle'|'running'|'ok'|'failed'>('idle');
  const [smokeMessage, setSmokeMessage] = useState<string>('');
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingRef = useRef<{ cancel: () => void } | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const [sid, savedCrew, savedMsgs, savedSupervisor] = await Promise.all([
        ExtensionStorage.getSessionId(),
        ExtensionStorage.getSelectedCrew(),
        ExtensionStorage.getMessages(),
        ExtensionStorage.getSelectedSupervisor(),
      ]);
      if (sid) setSessionId(sid);
      if (savedCrew) setSelectedCrew(savedCrew);
      if (savedSupervisor) setSelectedSupervisor(savedSupervisor);
      if (savedMsgs?.length) {
        const uiMsgs: UiMessage[] = savedMsgs.map((m, i) => ({ id: String(i), role: m.role, content: m.content, timestamp: new Date() }));
        setMessages(uiMsgs);
      }
    } catch {}
    await loadCrews();
    await loadSupervisors();
  }

  async function loadCrews() {
    try {
      const list = await ExtensionAPI.getCrews();
      setCrews(list);
      if (!selectedCrew && list.length) setSelectedCrew((list.find(c => c.id === 'orchestrator') || list[0]).id);
    } catch (e) {
      setConnected(false);
    }
  }

  async function loadSupervisors() {
    try {
      const list = await ExtensionAPI.getSupervisors();
      setSupervisors(list);
      if (!selectedSupervisor && list.length) setSelectedSupervisor(list[0].id);
    } catch {}
  }


  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);
  useEffect(() => { ExtensionStorage.saveMessages(messages.map(({ role, content }) => ({ role, content }))); }, [messages]);
  useEffect(() => { if (selectedCrew) ExtensionStorage.saveSelectedCrew(selectedCrew); }, [selectedCrew]);
  useEffect(() => { if (selectedSupervisor) ExtensionStorage.saveSelectedSupervisor(selectedSupervisor); }, [selectedSupervisor]);


  const canSend = !!input.trim() && !isLoading && (!!selectedSupervisor || !!selectedCrew);

  // Display name for who we're chatting with: prefer supervisor, else crew, else generic
  const talkingToName = useMemo(() => {
    if (selectedSupervisor) {
      const s = supervisors.find(s => s.id === selectedSupervisor);
      return s?.name || selectedSupervisor;
    }
    const c = crews.find(c => c.id === selectedCrew);
    return c?.name || 'Think Agent';
  }, [selectedSupervisor, supervisors, selectedCrew, crews]);

  async function newChat() {
    try {
      const session = await ExtensionAPI.createSession('New chat');
      if (session.id) { setSessionId(session.id); await ExtensionStorage.saveSessionId(session.id); setMessages([]); }
    } catch { setMessages([]); }
  }

  async function openSessions() {
    setSessionsOpen(v => !v);
    if (!sessionsOpen) {
      try { const res = await ExtensionAPI.listSessions(1, 50); setSessions(res?.sessions || []); } catch { setSessions([]); }
    }
  }

  async function resumeSession(sid: string) {
    try {
      const session = await ExtensionAPI.getSession(sid);
      if (session) {
        const ui: UiMessage[] = session.messages.map((m, i) => ({ 
          id: `${sid}-${i}`, 
          role: m.role, 
          content: m.content, 
          timestamp: new Date() 
        }));
        setSessionId(sid); 
        await ExtensionStorage.saveSessionId(sid); 
        setMessages(ui); 
        setSessionsOpen(false);
      }
    } catch { 
      setSessionId(sid); 
      await ExtensionStorage.saveSessionId(sid); 
      setMessages([]); 
      setSessionsOpen(false); 
    }
  }

  async function runSmokeTest() {
    setSmokeStatus('running');
    setSmokeMessage('');
    try {
      // Prefer supervisor if present
      let options: any = {};
      try {
        const supervisors = await ExtensionAPI.getSupervisors();
        const first = supervisors[0];
        if (first?.id) options = { supervisor_id: first.id };
      } catch {}
      if (!options.supervisor_id) options = { crew_id: (selectedCrew || 'orchestrator') };

      // Create session
      const session = await ExtensionAPI.createSession('Smoke test');
      if (!session.id) throw new Error('No session_id');

      // Send a single message (non-stream)
      await ExtensionAPI.chat({ session_id: session.id, messages: [{ role: 'user', content: 'hi' }], options });

      setSmokeStatus('ok');
      setSmokeMessage(`OK: Session created successfully`);
      await resumeSession(session.id);
      // refresh sessions list
      try { const res = await ExtensionAPI.listSessions(1, 50); setSessions(res?.sessions || []); } catch {}
    } catch (e: any) {
      setSmokeStatus('failed');
      setSmokeMessage(e?.message || 'Smoke test failed');
    }
  }

  async function send() {
    if (!canSend) return;
    const user: UiMessage = { id: String(Date.now()), role: 'user', content: input.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, user]); setInput(''); setIsLoading(true); if (composerRef.current) composerRef.current.style.height = 'auto';
    try {
      if (streaming) {
        const placeholder: UiMessage = { id: `${Date.now()}-a`, role: 'assistant', content: '', timestamp: new Date(), streaming: true };
        setMessages(prev => [...prev, placeholder]);
        const options = selectedSupervisor ? { supervisor_id: selectedSupervisor } : { crew_id: selectedCrew };
        const runner = await ExtensionAPI.chatStream({ session_id: sessionId || undefined, messages: [...messages, user].map(m => ({ role: m.role, content: m.content })), options });
        streamingRef.current = runner; let acc = ''; let buffer = ''; let finalPhase = false;
        await runner.run((chunk) => { buffer += chunk; const lines = buffer.split('\n'); buffer = lines.pop() || ''; for (const line of lines) { if (!line.trim()) continue; if (!line.startsWith('data: ')) continue; const data = line.slice(6).trim(); if (data === '[FINAL]') { finalPhase = true; continue; } if (finalPhase) { try { const obj = JSON.parse(data); const answer = typeof obj.answer === 'string' ? obj.answer : (obj.answer?.raw ?? ''); setMessages(prev => prev.map(m => m.id === placeholder.id ? { ...m, content: answer, streaming: false } : m)); } catch { setMessages(prev => prev.map(m => m.id === placeholder.id ? { ...m, content: data, streaming: false } : m)); } finalPhase = false; } else { acc += data; setMessages(prev => prev.map(m => m.id === placeholder.id ? { ...m, content: acc } : m)); } } }); streamingRef.current = null;
      } else {
        const options = selectedSupervisor ? { supervisor_id: selectedSupervisor } : { crew_id: selectedCrew };
        const res = await ExtensionAPI.chat({ session_id: sessionId || undefined, messages: [...messages, user].map(m => ({ role: m.role, content: m.content })), options }) as any;
        const answer = typeof res.answer === 'string' ? res.answer : (res.answer?.raw ?? '');
        setMessages(prev => [...prev, { id: `${Date.now()}-b`, role: 'assistant', content: answer, timestamp: new Date() }]);
      }
    } catch { setMessages(prev => [...prev, { id: `${Date.now()}-e`, role: 'assistant', content: 'Error. Please try again.', timestamp: new Date() }]); }
    finally { setIsLoading(false); }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) { 
    setInput(e.target.value); 
    e.target.style.height = 'auto'; 
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; 
  }

  const toggleExpanded = (messageId: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedMessages(newExpanded);
  };

  // Helper function to check if message has metadata to display
  const hasMetadata = (message: UiMessage) => {
    return message.metadata?.tasks_output || message.metadata?.token_usage;
  };

  // Helper function to format numbers
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  return (
          <div className="popup-container sidepanel w-full h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3" style={{backgroundColor: '#0C0D17'}}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/icons/think-os-agent.png" alt="ThinkOS Agent" className="h-8 w-8" />

            <div 
              style={{
                fontSize: '12px',
                color: connected ? '#4ade80' : '#f87171'
              }}
            >
              {connected ? '●' : '○'}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* New Chat button */}
            <button
              onClick={newChat}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Start new chat session"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
            
            {/* Sessions button */}
            <button
              onClick={openSessions}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="View sessions"
            >
              <FolderIcon className="h-4 w-4" />
            </button>
            
            {/* Clear chat button */}
            <button
              onClick={() => setMessages([])}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Clear chat"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
            
            {/* Settings button */}
            <button
              onClick={() => window.open('http://localhost:5173/agents', '_blank')}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Open settings"
            >
              <Cog6ToothIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {sessionsOpen && (
        <div className="px-4 py-3 border-b border-gray-700" style={{backgroundColor: '#0C0D17'}}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium" style={{color: '#F8F8F8'}}>Sessions</div>
            <div className="flex items-center gap-2">
              <button 
                onClick={runSmokeTest} 
                disabled={smokeStatus==='running'} 
                className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                style={{
                  backgroundColor: smokeStatus==='running' ? '#374151' : '#58bed7',
                  color: smokeStatus==='running' ? '#ffffff' : '#000000'
                }}
              >
                {smokeStatus==='running' ? 'Testing…' : 'Run smoke test'}
              </button>
              <button 
                onClick={() => openSessions()} 
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{
                  backgroundColor: '#374151',
                  color: '#F8F8F8',
                  border: '1px solid #4b5563'
                }}
              >
                Close
              </button>
            </div>
          </div>
          {smokeStatus!=='idle' && (
            <div className={`text-xs mb-3 px-3 py-2 rounded-lg ${
                              smokeStatus==='ok' ? 'bg-[#8EE967]/20 text-[#8EE967]' : 
              smokeStatus==='failed' ? 'bg-red-500/20 text-red-400' : 
              'bg-gray-500/20 text-gray-400'
            }`}>
              {smokeMessage || (smokeStatus==='running' ? 'Running smoke test…' : '')}
            </div>
          )}
          <div className="flex flex-col space-y-3 max-h-72 overflow-auto custom-scrollbar sessions-list">
            {sessions.length === 0 ? (
              <div className="text-xs text-center py-4" style={{color: '#9ca3af'}}>No past sessions</div>
            ) : (
              sessions.map(s => (
                <div key={s.session_id} className="p-3 rounded-lg flex items-center justify-between transition-colors hover:bg-gray-800/50" style={{backgroundColor: '#232329', border: '1px solid #374151'}}>
                  <div className="text-xs">
                    <div className="font-medium line-clamp-1" style={{color: '#F8F8F8'}}>{s.title || s.session_id}</div>
                    <div style={{color: '#9ca3af'}}>{s.last_activity ? new Date(s.last_activity).toLocaleString() : ''}</div>
                  </div>
                  <button 
                    onClick={() => resumeSession(s.session_id)} 
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{
                      backgroundColor: '#58bed7',
                      color: '#000000'
                    }}
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
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full p-4">
            <div className="text-center">
              <img src="/think-crew.svg" alt="Think Crew" className="h-12 w-12 mx-auto mb-2" />
              <p className="text-sm" style={{color: '#F8F8F8'}}>
                Start a conversation with {talkingToName}
              </p>
            </div>
          </div>
        ) : (
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
                    marginBottom: index < messages.length - 1 && 
                      message.role !== messages[index + 1]?.role ? '2rem' : '0.5rem'
                  }}
                >
                  <div className={`flex flex-col max-w-[85%] ${
                    message.role === 'user' ? 'items-end' : 'items-start'
                  }`}>
                    {message.role === 'assistant' && (
                      <div className="flex items-end gap-2 mb-1.5">
                        <span className="font-medium" style={{
                          color: '#F8F8F8',
                          fontSize: '17px'
                        }}>
                          {talkingToName}
                        </span>
                        {message.processingTime ? (
                          <span className="text-xs" style={{color: '#9ca3af'}}>
                            {message.processingTime}ms
                          </span>
                        ) : (
                          <span className="text-xs" style={{color: '#9ca3af'}}>
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
                    </div>
                    {message.role === 'assistant' && message.thoughtProcess && (
                      <div className="mt-2">
                        <div className="text-xs" style={{color: '#9ca3af'}}>
                          <span className="font-medium">Thought Process:</span> {message.thoughtProcess}
                        </div>
                      </div>
                    )}
                    
                    {/* Expandable metadata section */}
                    {message.role === 'assistant' && hasMetadata(message) && !message.streaming && (
                      <div className="mt-3 pt-3 border-t border-gray-700/50">
                        <button
                          onClick={() => toggleExpanded(message.id)}
                          className="flex items-center gap-2 text-xs transition-colors hover:text-gray-300"
                          style={{color: '#9ca3af'}}
                        >
                          {expandedMessages.has(message.id) ? (
                            <ChevronDownIcon className="h-3 w-3" />
                          ) : (
                            <ChevronRightIcon className="h-3 w-3" />
                          )}
                          <span>View details</span>
                          {message.metadata?.token_usage && (
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
                    {message.role === 'user' && (
                      <div className="flex items-center gap-2 mt-1 px-1">
                        <span className="text-xs" style={{color: '#9ca3af'}}>
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
      {/* Enhanced Input Area */}
      <div className="w-full border-t border-gray-700/50" style={{backgroundColor: '#0C0D17', paddingBottom: '10px'}}>
        {/* First Line - Textarea */}
        <div className="w-full px-4 pb-3">
          <textarea 
            ref={composerRef} 
            value={input} 
            onChange={autoResize} 
            onKeyDown={(e) => { 
              if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                send(); 
              } 
            }} 
            placeholder="Ask anything..." 
            className="w-full px-4 py-3 text-sm text-white placeholder-gray-400 resize-none overflow-hidden transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50"
            style={{
              backgroundColor: '#232329',
              border: '1px solid #374151',
              borderRadius: '12px',
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
        <div className="px-4 pb-10" style={{paddingBottom: '10px'}} ></div>
        {/* Second Line - Controls Row */}
        <div className="flex items-center justify-between px-4 pb-10" style={{paddingBottom: '10px'}} >
          {/* Left Side - Supervisor Selection */}
          <div className="flex items-center gap-3">
            {supervisors.length > 0 && (
              <select
                value={selectedSupervisor}
                onChange={(e) => setSelectedSupervisor(e.target.value)}
                className="px-3 pr-10 py-2 text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/50 appearance-none"
                style={{ backgroundColor: '#232329', border: '1px solid #374151', color: '#F8F8F8' }}
              >
                {supervisors.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
          
          {/* Right Side - Send Button */}
          <button 
            onClick={send} 
            disabled={!canSend} 
            className="flex items-center justify-center p-2 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: canSend ? '#58bed7' : '#374151',
              color: canSend ? '#000000' : '#ffffff',
              width: '36px',
              height: '36px'
            }}
            onMouseEnter={(e) => {
              if (canSend) {
                e.currentTarget.style.backgroundColor = '#4292ad';
              }
            }}
            onMouseLeave={(e) => {
              if (canSend) {
                e.currentTarget.style.backgroundColor = '#58bed7';
              }
            }}
          >
            <PaperAirplaneIcon className="h-6 w-6" style={{transform: 'rotate(-45deg)'}} />
          </button>
        </div>
      </div>
    </div>
  );
}


