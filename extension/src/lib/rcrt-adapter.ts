/**
 * RCRT Integration Adapter
 * Pure RCRT implementation for Chrome extension
 */

import { rcrtClient } from './rcrt-client';
import { rcrtEventStream } from './event-stream';
import type { ExtMessage } from './api';

export type ChatSessionData = {
  id: string;
  title: string;
  messages: ExtMessage[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CrewConfig = {
  id: string;
  name: string;
  description: string;
  agents: string[];
};

class RCRTAdapter {
  private authenticated: boolean = false;
  private eventStreamCleanup: (() => void) | null = null;
  private messageHandlers = new Map<string, (content: string, metadata?: any) => void>();
  
  constructor() {
    // Initialize RCRT authentication and event stream
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.authenticated = await rcrtClient.authenticate();
      console.log(`🚀 RCRT Extension: ${this.authenticated ? 'READY' : 'OFFLINE'}`);
      
      if (this.authenticated) {
        // Start event stream for real-time responses
        this.startEventStream();
      }
    } catch (error) {
      console.warn('RCRT dashboard not available:', error);
      this.authenticated = false;
    }
  }

  private startEventStream() {
    // Add handler for tool responses
    rcrtEventStream.addHandler({
      onToolResponse: (response) => {
        console.log('📨 Tool response received:', response);
        
        // Find handler for this request
        const handler = this.messageHandlers.get(response.request_id);
        if (handler) {
          handler(response.content, response.metadata);
          // Clean up handler after use
          this.messageHandlers.delete(response.request_id);
        }
      },
      onConnection: (connected) => {
        console.log(`📡 RCRT Event Stream: ${connected ? 'CONNECTED' : 'DISCONNECTED'}`);
      },
      onError: (error) => {
        console.error('📡 RCRT Event Stream Error:', error);
      }
    });

    // Start the connection
    this.eventStreamCleanup = rcrtEventStream.connect();
  }

  // ============ Chat Session Management ============
  
  async createSession(title: string, metadata?: Record<string, unknown>): Promise<ChatSessionData> {
    // Create session as RCRT breadcrumb
    const result = await rcrtClient.createBreadcrumb({
      title: `Chat Session: ${title}`,
      context: {
        type: 'chat_session',
        title,
        metadata: metadata || {},
        messages: [],
        created_at: new Date().toISOString(),
      },
      tags: ['chat:session', 'chrome:extension'],
      schema_name: 'chat.session.v1',
      visibility: 'team',
    });

    return {
      id: result.id,
      title,
      messages: [],
      metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async getSession(sessionId: string): Promise<ChatSessionData | null> {
    try {
      const breadcrumb = await rcrtClient.getBreadcrumb(sessionId);
      return {
        id: breadcrumb.id,
        title: breadcrumb.context.title as string,
        messages: (breadcrumb.context.messages as ExtMessage[]) || [],
        metadata: breadcrumb.context.metadata as Record<string, unknown>,
        created_at: breadcrumb.context.created_at as string,
        updated_at: breadcrumb.updated_at,
      };
    } catch (error) {
      console.warn('Failed to get RCRT session:', error);
      return null;
    }
  }

  async listSessions(page = 1, perPage = 50): Promise<{ sessions: ChatSessionData[] }> {
    try {
      // Search for chat session breadcrumbs
      const breadcrumbs = await rcrtClient.listBreadcrumbs('chat:session');
      const sessions = breadcrumbs
        .filter(b => b.context?.type === 'chat_session')
        .map(b => ({
          id: b.id,
          title: b.context.title as string,
          messages: (b.context.messages as ExtMessage[]) || [],
          metadata: b.context.metadata as Record<string, unknown>,
          created_at: b.context.created_at as string,
          updated_at: b.updated_at,
        }))
        .slice((page - 1) * perPage, page * perPage);

      return { sessions };
    } catch (error) {
      console.warn('Failed to list RCRT sessions:', error);
      return { sessions: [] };
    }
  }

  // ============ Message Management ============

  async addMessageToSession(sessionId: string, message: ExtMessage): Promise<void> {
    try {
      // Get current session
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Add message and update session breadcrumb
      const updatedMessages = [...session.messages, message];
      const updateResult = await rcrtClient.updateBreadcrumb(sessionId, 1, {
        context: {
          ...session.metadata,
          type: 'chat_session',
          title: session.title,
          metadata: session.metadata,
          messages: updatedMessages,
          updated_at: new Date().toISOString(),
        },
      });

      // Also create individual message breadcrumb for better search/context
      const messageResult = await rcrtClient.createChatBreadcrumb({
        role: message.role,
        content: message.content,
        sessionId,
      });
      
      console.log('Message added to session:', updateResult, messageResult);
    } catch (error) {
      console.error('Failed to add message to RCRT session:', error);
      throw error;
    }
  }

  // ============ Chat Operations ============

  async chat(options: {
    session_id?: string;
    messages: ExtMessage[];
    crew_id?: string;
    supervisor_id?: string;
  }): Promise<any> {
    // Create tool request breadcrumb using OpenRouter (like dashboard LLM test)
    const result = await rcrtClient.createBreadcrumb({
      title: 'Chat Request from Extension',
      context: {
        tool: 'openrouter', // 🎯 Use existing OpenRouter tool
        input: {
          messages: options.messages,
          model: 'google/gemini-2.5-flash', // Same model as dashboard
          temperature: 0.7,
          max_tokens: 1000,
        },
        source: 'chrome_extension',
        session_id: options.session_id,
        crew_id: options.crew_id,
        supervisor_id: options.supervisor_id,
      },
      tags: ['workspace:tools', 'tool:request', 'chrome:extension'], // Use tools workspace
      schema_name: 'tool.request.v1',
      visibility: 'team',
    });

    // Track request and wait for response via SSE
    rcrtEventStream.trackRequest(result.id, { 
      session_id: options.session_id,
      timestamp: Date.now() 
    });

    // Return promise that resolves when SSE response arrives
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(result.id);
        resolve({
          answer: "Request sent to OpenRouter - response timeout after 30 seconds",
          session_id: options.session_id,
          request_id: result.id,
        });
      }, 30000); // 30 second timeout

      // Set up handler for this specific request
      this.messageHandlers.set(result.id, (content: string, metadata?: any) => {
        clearTimeout(timeout);
        resolve({
          answer: content,
          session_id: options.session_id,
          request_id: result.id,
          metadata: metadata,
        });
      });
    });
  }

  // Stream version for real-time responses
  chatStream(options: {
    session_id?: string;
    messages: ExtMessage[];
    crew_id?: string;
    supervisor_id?: string;
  }) {
    const controller = new AbortController();
    
    return {
      run: async (onChunk: (chunk: string) => void) => {
        // Create OpenRouter tool request (same as dashboard)
        const result = await rcrtClient.createBreadcrumb({
          title: 'Chat Stream from Extension',
          context: {
            tool: 'openrouter', // 🎯 Use existing OpenRouter tool
            input: {
              messages: options.messages,
              model: 'google/gemini-2.5-flash', // Same model as dashboard
              temperature: 0.7,
              max_tokens: 1000,
            },
            source: 'chrome_extension',
            session_id: options.session_id,
          },
          tags: ['workspace:tools', 'tool:request', 'chrome:extension'],
          schema_name: 'tool.request.v1',
          visibility: 'team',
        });
        
        // Track request for response matching
        rcrtEventStream.trackRequest(result.id, { 
          session_id: options.session_id,
          timestamp: Date.now() 
        });

        // Send initial status
        onChunk('data: OpenRouter request sent - waiting for response...\n');
        
        // Set up handler for real-time response
        const timeout = setTimeout(() => {
          this.messageHandlers.delete(result.id);
          onChunk('data: [FINAL]\n');
          onChunk(`data: {"answer": "Request timeout - check dashboard for response", "request_id": "${result.id}"}\n`);
        }, 30000);

        this.messageHandlers.set(result.id, (content: string, metadata?: any) => {
          clearTimeout(timeout);
          onChunk('data: [FINAL]\n');
          onChunk(`data: {"answer": "${content.replace(/"/g, '\\"')}", "request_id": "${result.id}", "metadata": ${JSON.stringify(metadata)}}\n`);
        });
      },
      cancel: () => controller.abort(),
    };
  }

  // ============ Agent & Crew Discovery ============

  async getCrews(): Promise<CrewConfig[]> {
    try {
      const agents = await rcrtClient.listAgents();
      
      // Group agents by roles/workspace to simulate "crews"
      const crewMap = new Map<string, string[]>();
      
      agents.forEach(agent => {
        agent.roles.forEach(role => {
          if (!crewMap.has(role)) {
            crewMap.set(role, []);
          }
          crewMap.get(role)!.push(agent.id);
        });
      });

      return Array.from(crewMap.entries()).map(([role, agentIds]) => ({
        id: role,
        name: role.charAt(0).toUpperCase() + role.slice(1),
        description: `Agents with ${role} role`,
        agents: agentIds,
      }));
    } catch (error) {
      console.warn('Failed to get crews from RCRT:', error);
      return [];
    }
  }

  async getSupervisors(): Promise<{ id: string; name: string }[]> {
    try {
      const agents = await rcrtClient.listAgents();
      // Filter agents with supervisor/curator roles
      return agents
        .filter(agent => agent.roles.some(role => 
          role.includes('supervisor') || 
          role.includes('curator') || 
          role.includes('manager')
        ))
        .map(agent => ({
          id: agent.id,
          name: agent.roles.find(role => 
            role.includes('supervisor') || 
            role.includes('curator') || 
            role.includes('manager')
          ) || agent.id,
        }));
    } catch (error) {
      console.warn('Failed to get supervisors from RCRT:', error);
      return [];
    }
  }

  // ============ Configuration ============

  isReady(): boolean {
    return this.authenticated;
  }

  async reconnect(): Promise<boolean> {
    try {
      this.authenticated = await rcrtClient.authenticate();
      
      if (this.authenticated && !this.eventStreamCleanup) {
        // Restart event stream if needed
        this.startEventStream();
      }
      
      console.log(`🔄 RCRT reconnection: ${this.authenticated ? 'SUCCESS' : 'FAILED'}`);
      return this.authenticated;
    } catch (error) {
      console.error('Failed to reconnect to RCRT:', error);
      this.authenticated = false;
      return false;
    }
  }

  // Cleanup when adapter is no longer needed
  disconnect() {
    if (this.eventStreamCleanup) {
      this.eventStreamCleanup();
      this.eventStreamCleanup = null;
    }
    this.messageHandlers.clear();
    this.authenticated = false;
    console.log('🔌 RCRT adapter disconnected');
  }
}

export const rcrtAdapter = new RCRTAdapter();
