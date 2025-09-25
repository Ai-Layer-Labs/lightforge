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
    
    // NOTE: SSE subscription is handled by the centralized dispatcher in AgentRegistry
    // We don't start our own SSE connection here to avoid duplicate events
    
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
    
    // SSE cleanup handled by centralized dispatcher
    
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
    const context = breadcrumb.context || {};
    // Handle both camelCase and snake_case for compatibility
    const requestId = context.requestId || context.request_id;
    const { output, error } = context;
    
    console.log(`🔨 Tool response received with request_id: ${requestId}`);
    
    // Check if this is a response to our LLM request
    const pendingRequest = this.pendingLLMRequests.get(requestId);
    if (!pendingRequest) {
      console.log(`⚠️ No pending request found for ${requestId}`);
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
    console.log(`🧠 Processing LLM response:`, JSON.stringify(output).substring(0, 200));
    
    try {
      const llmContent = output?.content || '';
      console.log(`📝 LLM content to parse:`, llmContent.substring(0, 200));
      
      const parsedResponse = JSON.parse(llmContent);
      console.log(`✅ Parsed LLM response successfully`);
      
      // Execute the LLM's decision
      await this.executeDecision(parsedResponse);
      
    } catch (parseError) {
      console.error(`❌ Failed to parse LLM response:`, parseError);
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
    
    // Add recent chat history - use enhanced search API to get context directly
    const userMessages = await this.rcrtClient.searchBreadcrumbsWithContext({
      schema_name: 'user.message.v1',
      limit: 10,
      include_context: true
    });
    
    const agentResponses = await this.rcrtClient.searchBreadcrumbsWithContext({
      schema_name: 'agent.response.v1',
      limit: 10,
      include_context: true
    });
    
    console.log(`📚 Building chat history - found ${userMessages.length} user messages and ${agentResponses.length} agent responses`);
    
    // Combine and sort by timestamp
    const allMessages = [...userMessages, ...agentResponses]
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
      .slice(-20); // Keep last 20 messages
    
    if (allMessages.length > 0) {
      const chatHistory = allMessages
        .map(msg => {
          if (msg.schema_name === 'user.message.v1') {
            return {
              role: 'user',
              content: msg.context?.message || msg.context?.content,
              timestamp: msg.updated_at
            };
          } else if (msg.schema_name === 'agent.response.v1') {
            return {
              role: 'assistant',
              content: msg.context?.message,
              timestamp: msg.updated_at
            };
          }
          return null;
        })
        .filter(Boolean);
      
      console.log(`💬 Chat history includes ${chatHistory.length} messages with full context (fetched in 2 requests!)`);
      
      if (chatHistory.length > 0) {
        context.push({
          type: 'chat_history',
          messages: chatHistory
        });
      }
    } else {
      console.log(`⚠️ No chat history found`);
    }
    
    return context;
  }
  
  private async executeDecision(decision: any): Promise<void> {
    console.log(`🎯 Executing decision:`, JSON.stringify(decision).substring(0, 500));
    
    const { action, breadcrumb } = decision;
    
    if (action === 'create' && breadcrumb) {
      console.log(`📝 Creating breadcrumb of type: ${breadcrumb.schema_name}`);
      
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
      
      console.log(`🚀 About to create breadcrumb:`, JSON.stringify(breadcrumbWithCreator).substring(0, 300));
      
      await this.rcrtClient.createBreadcrumb(breadcrumbWithCreator);
      console.log(`✅ Created breadcrumb: ${breadcrumb.schema_name}`);
      
      // If it's a tool request, track it
      if (breadcrumb.schema_name === 'tool.request.v1' && breadcrumb.context?.requestId) {
        this.pendingLLMRequests.set(breadcrumb.context.requestId, {
          context: { fromDecision: true },
          timestamp: new Date()
        });
      }
    } else {
      console.log(`⚠️ Unhandled decision action: ${action}`);
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
      ttl: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
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