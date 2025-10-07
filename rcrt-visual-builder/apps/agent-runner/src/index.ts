#!/usr/bin/env node
/**
 * RCRT Agent Runner - Modern Implementation
 * Uses AgentExecutor pattern with centralized SSE dispatcher
 * 
 * PHILOSOPHY: Agents are context + data, NOT executable code
 * Clean architecture inspired by tools-runner patterns
 */

import dotenv from 'dotenv';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { AgentExecutor, EventBridge } from '@rcrt-builder/runtime';
import { AgentDefinitionV1 } from '@rcrt-builder/core';
import { jsonrepair } from 'jsonrepair';

dotenv.config();

// ============ AGENT REGISTRY ============

export class ModernAgentRegistry {
  public executors = new Map<string, AgentExecutor>();
  private catalogBreadcrumbId?: string;
  private sseCleanup?: () => void;
  private eventBridge = new EventBridge();  // Shared event bridge for all agents
  
  // Track request/response correlation (borrowed from tools-runner)
  private pendingRequests = new Map<string, {
    agentId: string;
    timestamp: Date;
    resolve: (response: any) => void;
    reject: (error: any) => void;
  }>();

  constructor(
    private client: RcrtClientEnhanced,
    private workspace: string,
    private options: {
      baseUrl?: string;
      openRouterApiKey?: string;
      catalogUpdateInterval?: number;
      healthCheckInterval?: number;
    } = {}
  ) {}

  async start(): Promise<void> {
    console.log(`🤖 [AgentRegistry] Starting for workspace: ${this.workspace}`);
    
    // Load existing agent catalog or create new one
    await this.initializeCatalog();
    
    // Load and start all agent definitions
    await this.loadAgentDefinitions();
    
    // Set up periodic catalog updates
    if (this.options.catalogUpdateInterval) {
      setInterval(() => this.updateCatalog(), this.options.catalogUpdateInterval);
    }
    
    // Set up health checks
    if (this.options.healthCheckInterval) {
      setInterval(() => this.performHealthCheck(), this.options.healthCheckInterval);
    }
    
    console.log(`✅ [AgentRegistry] Started with ${this.executors.size} agents`);
  }

  async stop(): Promise<void> {
    console.log('🛑 [AgentRegistry] Stopping all agents...');
    
    // Stop SSE if running
    if (this.sseCleanup) {
      this.sseCleanup();
      this.sseCleanup = undefined;
    }
    
    // Clear all executors
    for (const [id, executor] of this.executors) {
      console.log(`✅ Cleared agent: ${id}`);
    }
    
    this.executors.clear();
    this.pendingRequests.clear();
  }

  // Start centralized SSE dispatcher (inspired by tools-runner)
  async startCentralizedSSE(jwtToken: string): Promise<void> {
    try {
      console.log('📡 [AgentRegistry] Starting centralized SSE dispatcher...');
      
      const baseUrl = this.options.baseUrl || 'http://localhost:8081';
      const response = await fetch(`${baseUrl}/events/stream`, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status}`);
      }
      
      console.log('✅ [AgentRegistry] SSE dispatcher connected');
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No SSE stream reader available');
      }
      
      // Process events
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              // Use jsonrepair to handle malformed JSON
              const repairedData = jsonrepair(line.slice(6));
              const eventData = JSON.parse(repairedData);
              
              // Feed ALL events to EventBridge (for waitForEvent)
              if (eventData.type === 'breadcrumb.updated' && eventData.breadcrumb_id) {
                try {
                  const breadcrumb = await this.client.getBreadcrumb(eventData.breadcrumb_id);
                  this.eventBridge.handleEvent(eventData, breadcrumb);
                } catch (e) {
                  // Ignore fetch errors
                }
              }
              
              if (eventData.type !== 'ping') {
                await this.routeEventToAgent(eventData);
              }
            } catch (error) {
              console.warn('Failed to parse SSE event:', line, error);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ [AgentRegistry] SSE dispatcher error:', error);
      // Retry connection after delay
      setTimeout(() => this.startCentralizedSSE(jwtToken), 5000);
    }
  }

  // Route events to appropriate agents
  private async routeEventToAgent(event: any): Promise<void> {
    // Check if this is a new agent definition being created
    if (event.schema_name === 'agent.def.v1' && event.tags?.includes(this.workspace)) {
      console.log(`🆕 New agent definition detected: ${event.id}`);
      try {
        const fullBreadcrumb = await this.client.getBreadcrumb(event.id);
        await this.registerAgent(fullBreadcrumb as AgentDefinitionV1);
        await this.updateCatalog();
      } catch (error) {
        console.error(`Failed to register new agent ${event.id}:`, error);
      }
    }
    
    // Check if this is a tool response we're waiting for
    if (event.schema_name === 'tool.response.v1' && event.context?.requestId) {
      const pending = this.pendingRequests.get(event.context.requestId);
      if (pending) {
        pending.resolve(event);
        this.pendingRequests.delete(event.context.requestId);
        return;
      }
    }
    
    // Route to agents based on their subscriptions
    for (const [agentId, executor] of this.executors) {
      const agentDef = executor.getDefinition();
      
      // Check if agent is interested in this event
      if (this.matchesAgentSubscriptions(event, agentDef)) {
        console.log(`📨 Routing event to agent ${agentId}`);
        
        // Let AgentExecutor handle the event
        executor.processSSEEvent(event).catch((error: any) => {
          console.error(`❌ Agent ${agentId} error:`, error);
        });
      }
    }
  }

  // Check if event matches agent subscriptions
  private matchesAgentSubscriptions(event: any, agentDef: AgentDefinitionV1): boolean {
    const selectors = agentDef.context.subscriptions?.selectors || [];
    
    for (const selector of selectors) {
      // Tag matching
      if (selector.any_tags) {
        const hasAnyTag = selector.any_tags.some((tag: string) => 
          event.tags?.includes(tag)
        );
        if (hasAnyTag) return true;
      }
      
      if (selector.all_tags) {
        const hasAllTags = selector.all_tags.every((tag: string) => 
          event.tags?.includes(tag)
        );
        if (hasAllTags) return true;
      }
      
      // Schema matching
      if (selector.schema_name && event.schema_name === selector.schema_name) {
        return true;
      }
    }
    
    return false;
  }

  // Load agent definitions from breadcrumbs
  private async loadAgentDefinitions(): Promise<void> {
    try {
      console.log('🔍 [AgentRegistry] Loading agent definitions...');
      
      const agentDefs = await this.client.searchBreadcrumbs({
        schema_name: 'agent.def.v1',
        tag: this.workspace
      });
      
      console.log(`📋 Found ${agentDefs.length} agent definitions`);
      
      for (const breadcrumb of agentDefs) {
        try {
          // Search results don't include full context, so fetch the complete breadcrumb
          const fullBreadcrumb = await this.client.getBreadcrumb(breadcrumb.id);
          await this.registerAgent(fullBreadcrumb as AgentDefinitionV1);
        } catch (error) {
          console.error(`Failed to register agent ${breadcrumb.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to load agent definitions:', error);
    }
  }

  // Register a new agent
  async registerAgent(agentDef: AgentDefinitionV1): Promise<void> {
    const agentId = agentDef.context.agent_id;
    
    if (this.executors.has(agentId)) {
      console.log(`⏭️ Agent ${agentId} already registered`);
      return;
    }
    
    console.log(`📝 Registering agent: ${agentId}`);
    
    const executor = new AgentExecutor({
      agentDef,
      rcrtClient: this.client,
      workspace: this.workspace
    }, this.eventBridge);  // Pass shared EventBridge
    
    this.executors.set(agentId, executor);
    
    console.log(`✅ Agent registered: ${agentId}`);
  }

  // Initialize or load existing catalog
  private async initializeCatalog(): Promise<void> {
    try {
      const existingCatalogs = await this.client.searchBreadcrumbs({
        schema_name: 'agent.catalog.v1',
        tag: this.workspace
      });
      
      if (existingCatalogs.length > 0) {
        // Use most recent catalog
        const latest = existingCatalogs.sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )[0];
        
        this.catalogBreadcrumbId = latest.id;
        console.log(`📚 Using existing agent catalog: ${this.catalogBreadcrumbId}`);
      } else {
        // Create new catalog
        await this.createCatalogBreadcrumb();
      }
    } catch (error) {
      console.error('Failed to initialize catalog:', error);
      await this.createCatalogBreadcrumb();
    }
  }

  private async createCatalogBreadcrumb(): Promise<void> {
    const catalog = await this.client.createBreadcrumb({
      schema_name: 'agent.catalog.v1',
      title: `${this.workspace} Agent Catalog`,
      tags: [this.workspace, 'agent:catalog'],
      context: {
        workspace: this.workspace,
        agents: [],
        totalAgents: 0,
        activeAgents: 0,
        lastUpdated: new Date().toISOString()
      }
    });
    
    this.catalogBreadcrumbId = catalog.id;
    console.log(`📚 Created new agent catalog: ${this.catalogBreadcrumbId}`);
  }

  private async updateCatalog(): Promise<void> {
    if (!this.catalogBreadcrumbId) return;
    
    try {
      const agents = Array.from(this.executors.entries()).map(([id, executor]) => {
        const def = executor.getDefinition();
        const state = executor.getState();
        
        return {
          agent_id: id,
          name: def.title || id,
          description: def.title,
          status: state.status,
          metrics: state.metrics,
          lastActivity: state.metrics.last_activity
        };
      });
      
      const current = await this.client.getBreadcrumb(this.catalogBreadcrumbId);
      
      await this.client.updateBreadcrumb(
        this.catalogBreadcrumbId,
        current.version,
        {
          context: {
            workspace: this.workspace,
            agents,
            totalAgents: agents.length,
            activeAgents: agents.filter(a => a.status === 'idle' || a.status === 'processing').length,
            lastUpdated: new Date().toISOString()
          }
        }
      );
      
      console.log(`📊 Updated agent catalog with ${agents.length} agents`);
    } catch (error) {
      console.error('Failed to update catalog:', error);
    }
  }

  private async performHealthCheck(): Promise<void> {
    console.log('💓 [AgentRegistry] Performing health check...');
    
    for (const [id, executor] of this.executors) {
      const state = executor.getState();
      console.log(`  Agent ${id}: ${state.status}, processed: ${state.metrics.events_processed}, errors: ${state.metrics.errors}`);
    }
  }

  // Helper to create correlated tool requests
  async createToolRequest(tool: string, input: any, agentId: string): Promise<any> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create promise for response
    const responsePromise = new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        agentId,
        timestamp: new Date(),
        resolve,
        reject
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Tool request timeout'));
        }
      }, 30000);
    });
    
    // Create tool request breadcrumb
    await this.client.createBreadcrumb({
      schema_name: 'tool.request.v1',
      title: `Tool Request: ${tool}`,
      tags: ['tool:request', this.workspace],
      context: {
        tool,
        input,
        requestId,
        requestedBy: agentId
      }
    });
    
    return responsePromise;
  }
}

// ============ MAIN ============

const config = {
  rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
  workspace: process.env.WORKSPACE || 'workspace:agents',
  deploymentMode: process.env.DEPLOYMENT_MODE || 'local'
};

async function main() {
  console.log('🤖 RCRT Agent Runner (Modern) starting...');
  console.log('Configuration:', config);
  
  if (config.deploymentMode === 'docker') {
    console.log('⏳ Waiting for services to be ready...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  try {
    // Get JWT token
    const tokenRequest = {
      owner_id: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
      agent_id: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000AAA',
      roles: ['curator', 'emitter', 'subscriber']
    };
    
    const getToken = async () => {
      const resp = await fetch(`${config.rcrtBaseUrl}/auth/token`, { 
        method: 'POST', 
        headers: { 'content-type': 'application/json' }, 
        body: JSON.stringify(tokenRequest)
      });
      
      if (!resp.ok) {
        throw new Error(`Token request failed: ${resp.status}`);
      }
      
      const json = await resp.json();
      return json?.token;
    };
    
    const jwtToken = await getToken();
    
    if (!jwtToken) {
      throw new Error('No token in response');
    }
    
    console.log('🔐 Obtained JWT token');
    
    // Create RCRT client with token refresh support
    const client = new RcrtClientEnhanced(config.rcrtBaseUrl, 'jwt', jwtToken, {
      tokenEndpoint: `${config.rcrtBaseUrl}/auth/token`,
      autoRefresh: true,
      tokenRequestBody: tokenRequest
    });

    console.log('✅ Connected to RCRT');

    // Create and start agent registry
    const registry = new ModernAgentRegistry(client, config.workspace, {
      baseUrl: config.rcrtBaseUrl,
      catalogUpdateInterval: 60000,  // Update catalog every minute
      healthCheckInterval: 300000    // Health check every 5 minutes
    });
    
    await registry.start();
    
    // Start centralized SSE dispatcher
    await registry.startCentralizedSSE(jwtToken);
    
    // Manually refresh token every 30 minutes (before 1 hour expiry)
    const tokenRefreshInterval = setInterval(async () => {
      try {
        const newToken = await getToken();
        if (newToken) {
          client.setToken(newToken);
          console.log('🔐 Refreshed JWT token');
          
          // Token updated in client, executors will use it automatically
        }
      } catch (error) {
        console.error('❌ Failed to refresh token:', error);
      }
    }, 30 * 60 * 1000); // 30 minutes

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Shutting down agent runner...');
      clearInterval(tokenRefreshInterval);
      await registry.stop();
      process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    console.log('🚀 Agent runner ready and listening');
    console.log(`📍 Workspace: ${config.workspace}`);
    console.log(`🤖 Modern architecture with AgentExecutor pattern`);
    
    // Keep the process alive
    console.log('💚 Agent runner is running. Press Ctrl+C to stop.');
    
    // Prevent the process from exiting
    process.stdin.resume();
    
  } catch (error) {
    console.error('❌ Failed to start agent runner:', error);
    process.exit(1);
  }
}

// Error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}