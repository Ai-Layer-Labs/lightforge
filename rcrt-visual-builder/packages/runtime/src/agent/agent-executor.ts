/**
 * Agent Executor - Tool-Based Architecture
 * Agents orchestrate tool usage, they don't directly call external APIs
 */

import { 
  AgentDefinitionV1,
  BreadcrumbEvent,
  AgentState,
  AgentMetricsV1,
  Selector
} from '@rcrt-builder/core';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { ToolPromptAdapter } from './tool-prompt-adapter';

export interface AgentExecutorOptions {
  agentDef: AgentDefinitionV1;
  rcrtClient: RcrtClientEnhanced;
  workspace: string;
  autoStart?: boolean;
  metricsInterval?: number;
}

export class AgentExecutor {
  private agentDef: AgentDefinitionV1;
  private rcrtClient: RcrtClientEnhanced;
  private workspace: string;
  private sseCleanup?: () => void;
  private state: AgentState;
  private metricsTimer?: NodeJS.Timer;
  
  // Track pending LLM requests
  private pendingLLMRequests = new Map<string, {
    context: any;
    timestamp: Date;
  }>();
  
  constructor(private options: AgentExecutorOptions) {
    this.agentDef = options.agentDef;
    this.rcrtClient = options.rcrtClient;
    this.workspace = options.workspace;
    
    // Initialize state
    this.state = {
      agent_id: this.agentDef.context.agent_id,
      status: 'idle',
      metrics: {
        events_processed: 0,
        errors: 0,
        last_activity: new Date(),
      },
    };
    
    // Auto-start if requested
    if (options.autoStart) {
      this.start().catch(console.error);
    }
  }
  
  async start(): Promise<void> {
    console.log(`🤖 Starting agent: ${this.agentDef.context.agent_id}`);
    
    // Start SSE subscription
    const cleanup = this.rcrtClient.startEventStream(
      (event) => this.processEvent(event)
    );
    
    this.sseCleanup = cleanup;
    this.state.status = 'active';
    
    // Start metrics reporting if interval specified
    if (this.options.metricsInterval) {
      this.metricsTimer = setInterval(() => {
        this.reportMetrics().catch(console.error);
      }, this.options.metricsInterval);
    }
  }
  
  async stop(): Promise<void> {
    console.log(`🛑 Stopping agent: ${this.agentDef.context.agent_id}`);
    
    if (this.sseCleanup) {
      this.sseCleanup();
    }
    
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    
    this.state.status = 'stopped';
  }
  
  async processEvent(event: BreadcrumbEvent): Promise<void> {
    // Skip ping events
    if (event.type === 'ping') return;
    
    console.log(`📨 Processing event: ${event.type} for ${event.breadcrumb_id}`);
    
    try {
      // Prevent self-triggering
      const triggeringBreadcrumb = await this.rcrtClient.getBreadcrumb(event.breadcrumb_id!);
      if (triggeringBreadcrumb.context?.creator?.type === 'agent' &&
          triggeringBreadcrumb.context.creator.agent_id === this.agentDef.context.agent_id) {
        console.log(`⏭️ [AgentExecutor ${this.agentDef.context.agent_id}] Skipping self-created event: ${event.breadcrumb_id}`);
        return;
      }
      
      // Handle different event types
      if (event.schema_name === 'tool.response.v1') {
        await this.handleToolResponse(event);
      } else if (event.schema_name === 'chat.message.v1' || event.schema_name === 'user.message.v1') {
        await this.handleChatMessage(event);
      } else if (event.schema_name === 'tool.catalog.v1') {
        console.log('📚 Tool catalog updated');
        // Just log it, no action needed
      } else {
        console.log(`🔍 Received event: ${event.schema_name}`);
      }
      
      this.state.metrics.events_processed++;
      this.state.metrics.last_activity = new Date();
    } catch (error) {
      console.error(`❌ Error processing event: ${error}`);
      this.state.metrics.errors++;
      await this.logError(error, event);
    }
  }
  
  private async handleChatMessage(event: BreadcrumbEvent): Promise<void> {
    const breadcrumb = await this.rcrtClient.getBreadcrumb(event.breadcrumb_id!);
    // Check for message in both 'message' and 'content' fields for compatibility
    const userMessage = breadcrumb.context?.message || breadcrumb.context?.content;
    
    console.log(`💬 Handling chat message: ${userMessage}`);
    
    // Build context for LLM
    const context = await this.buildContext();
    
    // Prepare messages for LLM
    const messages = [
      {
        role: 'system',
        content: this.agentDef.context.system_prompt
      },
      {
        role: 'user',
        content: `Context:\n${JSON.stringify(context, null, 2)}\n\nUser message: ${userMessage}`
      }
    ];
    
    // Create LLM tool request
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Track this request
    this.pendingLLMRequests.set(requestId, {
      context: { userMessage, eventId: event.breadcrumb_id },
      timestamp: new Date()
    });
    
    // Get LLM configuration
    const llmTool = this.agentDef.context.llm_tool || 'openrouter';
    const llmConfig = this.agentDef.context.llm_config || {
      model: 'google/gemini-2.0-flash-exp',
      temperature: 0.7,
      max_tokens: 2000
    };
    
    // Create tool request breadcrumb
    await this.rcrtClient.createBreadcrumb({
      schema_name: 'tool.request.v1',
      title: 'LLM Processing Request',
      tags: ['tool:request', 'workspace:tools', this.workspace],
      ttl: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour TTL
      context: {
        tool: llmTool,
        input: {
          messages,
          ...llmConfig
        },
        requestId,
        requestedBy: this.agentDef.context.agent_id,
        creator: {
          type: 'agent',
          agent_id: this.agentDef.context.agent_id
        }
      }
    });
    
    console.log(`🔧 Created LLM tool request: ${requestId} for tool: ${llmTool}`);
  }
  
  private async handleToolResponse(event: BreadcrumbEvent): Promise<void> {
    const breadcrumb = await this.rcrtClient.getBreadcrumb(event.breadcrumb_id!);
    const { requestId, output, error } = breadcrumb.context || {};
    
    // Check if this is a response to our LLM request
    const pendingRequest = this.pendingLLMRequests.get(requestId);
    if (!pendingRequest) {
      // Not our request, ignore
      return;
    }
    
    console.log(`🔨 Received tool response for request: ${requestId}`);
    
    // Remove from pending
    this.pendingLLMRequests.delete(requestId);
    
    if (error) {
      console.error(`❌ Tool error: ${error}`);
      await this.createErrorResponse(pendingRequest.context.userMessage, error);
      return;
    }
    
    // Parse LLM response
    try {
      const llmContent = output?.content || '';
      const parsedResponse = JSON.parse(llmContent);
      
      // Execute the LLM's decision
      await this.executeDecision(parsedResponse);
      
    } catch (parseError) {
      // If LLM didn't return valid JSON, create a simple text response
      const responseText = output?.content || 'I encountered an error processing your request.';
      await this.createSimpleResponse(responseText);
    }
  }
  
  private async buildContext(): Promise<any[]> {
    const context = [];
    
    // Add tool catalog if subscribed
    const hasToolCatalog = this.agentDef.context.subscriptions.selectors.some(
      (s: Selector) => s.schema_name === 'tool.catalog.v1'
    );
    
    if (hasToolCatalog) {
      const catalogs = await this.rcrtClient.searchBreadcrumbs({
        schema_name: 'tool.catalog.v1',
        tags: ['workspace:tools']
      });
      
      if (catalogs.length > 0) {
        const fullCatalog = await this.rcrtClient.getBreadcrumb(catalogs[0].id);
        if (fullCatalog.context?.tools) {
          const toolPrompt = ToolPromptAdapter.generateToolPrompt(fullCatalog as any);
          context.push({
            type: 'tool_catalog',
            content: toolPrompt
          });
        } else {
          console.log('⚠️ Tool catalog found but no tools in context');
        }
      }
    }
    
    // Add recent chat history
    const recentChats = await this.rcrtClient.searchBreadcrumbs({
      schema_name: 'chat.message.v1',
      tags: ['workspace:agents'],
      limit: 10
    });
    
    if (recentChats.length > 0) {
      context.push({
        type: 'chat_history',
        messages: recentChats.map(c => ({
          role: c.context?.role || 'user',
          content: c.context?.message,
          timestamp: c.updated_at
        })).reverse() // Oldest first
      });
    }
    
    return context;
  }
  
  private async executeDecision(decision: any): Promise<void> {
    const { action, breadcrumb } = decision;
    
    if (action === 'create' && breadcrumb) {
      // Add creator metadata
      const breadcrumbWithCreator = {
        ...breadcrumb,
        tags: [...(breadcrumb.tags || []), this.workspace],
        ttl: breadcrumb.schema_name === 'agent.response.v1' 
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
          : breadcrumb.schema_name === 'tool.request.v1'
          ? new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
          : undefined,
        context: {
          ...breadcrumb.context,
          creator: {
            type: 'agent',
            agent_id: this.agentDef.context.agent_id
          }
        }
      };
      
      await this.rcrtClient.createBreadcrumb(breadcrumbWithCreator);
      console.log(`✅ Created breadcrumb: ${breadcrumb.schema_name}`);
      
      // If it's a tool request, track it
      if (breadcrumb.schema_name === 'tool.request.v1' && breadcrumb.context?.requestId) {
        this.pendingLLMRequests.set(breadcrumb.context.requestId, {
          context: { fromDecision: true },
          timestamp: new Date()
        });
      }
    }
  }
  
  private async createSimpleResponse(message: string): Promise<void> {
    await this.rcrtClient.createBreadcrumb({
      schema_name: 'agent.response.v1',
      title: 'Agent Response',
      tags: ['agent:response', 'chat', this.workspace],
      ttl: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      context: {
        message,
        agent_id: this.agentDef.context.agent_id,
        creator: {
          type: 'agent',
          agent_id: this.agentDef.context.agent_id
        }
      }
    });
  }
  
  private async createErrorResponse(originalMessage: string, error: string): Promise<void> {
    await this.createSimpleResponse(
      `I encountered an error while processing your message "${originalMessage}". Error: ${error}`
    );
  }
  
  private async logError(error: any, event?: BreadcrumbEvent): Promise<void> {
    await this.rcrtClient.createBreadcrumb({
      schema_name: 'agent.error.v1',
      title: `Error: ${this.agentDef.context.agent_id}`,
      tags: [`agent:${this.agentDef.context.agent_id}`, 'agent:error', this.workspace],
      ttl: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
      context: {
        agent_id: this.agentDef.context.agent_id,
        error: String(error),
        stack: error.stack,
        event,
        timestamp: new Date().toISOString(),
        creator: {
          type: 'agent',
          agent_id: this.agentDef.context.agent_id
        }
      },
    });
  }
  
  private async reportMetrics(): Promise<void> {
    const metrics: AgentMetricsV1 = {
      schema_name: 'agent.metrics.v1',
      title: `Metrics: ${this.agentDef.context.agent_id}`,
      tags: [`agent:${this.agentDef.context.agent_id}`, 'agent:metrics', this.workspace],
      ttl: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      context: {
        agent_id: this.agentDef.context.agent_id,
        status: this.state.status,
        metrics: {
          events_processed: this.state.metrics.events_processed,
          errors: this.state.metrics.errors,
          last_activity: this.state.metrics.last_activity.toISOString(),
          uptime_seconds: Math.floor((Date.now() - this.state.metrics.last_activity.getTime()) / 1000),
        },
        timestamp: new Date().toISOString(),
        creator: {
          type: 'agent',
          agent_id: this.agentDef.context.agent_id
        }
      },
    };
    
    await this.rcrtClient.createBreadcrumb(metrics);
  }
  
  // Clean up pending requests older than 5 minutes
  private cleanupPendingRequests(): void {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    
    for (const [requestId, request] of this.pendingLLMRequests.entries()) {
      if (request.timestamp.getTime() < fiveMinutesAgo) {
        this.pendingLLMRequests.delete(requestId);
        console.log(`🧹 Cleaned up expired request: ${requestId}`);
      }
    }
  }
  
  // Update token method for JWT refresh
  updateToken(token: string): void {
    this.rcrtClient.setToken(token);
  }
  
  // Get current state
  getState(): AgentState {
    return { ...this.state };
  }
  
  // Get agent definition
  getDefinition(): AgentDefinitionV1 {
    return this.agentDef;
  }
}