/**
 * Agent Executor - Tool-Based Architecture
 * Agents orchestrate tool usage, they don't directly call external APIs
 */

import { 
  AgentDefinitionV1,
  BreadcrumbEvent,
  AgentState,
  Selector
} from '@rcrt-builder/core';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { extractAndParseJSON } from '../utils/json-repair';

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
  private state: AgentState;
  private metricsTimer?: NodeJS.Timeout;
  
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
    
    this.state.status = 'processing';
    
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
      
      // Handle different event types based on breadcrumb schema
      const schemaName = triggeringBreadcrumb.schema_name;
      if (schemaName === 'tool.response.v1') {
        await this.handleToolResponse(event, triggeringBreadcrumb);
      } else if (schemaName === 'chat.message.v1' || schemaName === 'user.message.v1') {
        await this.handleChatMessage(event, triggeringBreadcrumb);
      } else if (schemaName === 'system.message.v1') {
        await this.handleSystemMessage(event, triggeringBreadcrumb);
      } else if (schemaName === 'tool.catalog.v1') {
        console.log('📚 Tool catalog updated');
        // Just log it, no action needed
      } else {
        console.log(`🔍 Received event: ${schemaName}`);
      }
      
      this.state.metrics.events_processed++;
      this.state.metrics.last_activity = new Date();
    } catch (error) {
      console.error(`❌ Error processing event: ${error}`);
      this.state.metrics.errors++;
      await this.logError(error, event);
    }
  }
  
  private async handleChatMessage(event: BreadcrumbEvent, breadcrumb: any): Promise<void> {
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
    
    // Get LLM configuration from agent definition
    const llmTool = 'openrouter'; // Default to openrouter
    const llmConfig = {
      model: this.agentDef.context.model || 'google/gemini-2.5-flash',
      temperature: this.agentDef.context.temperature ?? 0.7,
      max_tokens: this.agentDef.context.max_tokens ?? 2000
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
  
  private async handleSystemMessage(event: BreadcrumbEvent, breadcrumb: any): Promise<void> {
    const guidance = breadcrumb.context?.guidance;
    const errorInfo = breadcrumb.context?.error;
    
    console.log(`📚 Received system guidance:`, {
      type: breadcrumb.context?.type,
      step: errorInfo?.step,
      tool: errorInfo?.tool
    });
    
    // Log the guidance for agent's context
    if (guidance) {
      console.log(`💡 System Guidance:\n${guidance}`);
      
      // Create a simple response acknowledging the learning
      await this.createSimpleResponse(
        `I received guidance about workflow errors. I'll remember that ` +
        `the "${errorInfo?.tool}" tool's output structure is different than I expected. ` +
        `${breadcrumb.context?.correctedExample ? `The correct syntax is: ${breadcrumb.context.correctedExample}` : ''}`
      );
    }
  }
  
  private async handleToolResponse(_event: BreadcrumbEvent, breadcrumb: any): Promise<void> {
    const context = breadcrumb.context || {};
    // Handle both camelCase and snake_case for compatibility
    const requestId = context.requestId || context.request_id;
    const { output, error, tool } = context;
    
    console.log(`🔨 Tool response received with request_id: ${requestId}`);
    
    // Check if this is a response to our request
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
      await this.createErrorResponse(pendingRequest.context.userMessage || '', error);
      return;
    }
    
    // Check if this is a response from a tool request the agent made (not LLM)
    if (pendingRequest.context.fromToolRequest && pendingRequest.context.tool !== 'openrouter') {
      console.log(`🔧 Handling non-LLM tool response from ${pendingRequest.context.tool}`);
      
      // Generic tool response handling - let the tool's output speak for itself
      let responseMessage = '';
      
      // Priority order for extracting a human-readable message:
      // 1. If output has a 'message' field, use it
      // 2. If output has a 'result' field, format it
      // 3. If output is a string, use it directly
      // 4. If output is an object with a single key, use that
      // 5. Otherwise, format the entire output
      
      if (output && typeof output === 'object') {
        if (output.message) {
          responseMessage = output.message;
        } else if (output.result !== undefined) {
          responseMessage = `Result: ${typeof output.result === 'object' ? JSON.stringify(output.result, null, 2) : output.result}`;
        } else if (output.error) {
          responseMessage = `Error: ${output.error}`;
        } else {
          // Check if it's a simple object with one main value
          const keys = Object.keys(output);
          if (keys.length === 1) {
            const key = keys[0];
            const value = output[key];
            responseMessage = `${key}: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`;
          } else if (keys.length === 2 && output.status) {
            // Common pattern: {status: "success", data: ...}
            const dataKey = keys.find(k => k !== 'status');
            if (dataKey) {
              responseMessage = `${output[dataKey]}`;
            }
          } else {
            // Format the whole output nicely
            responseMessage = JSON.stringify(output, null, 2);
          }
        }
      } else if (typeof output === 'string') {
        responseMessage = output;
      } else if (output === null || output === undefined) {
        responseMessage = `${tool} completed successfully`;
      } else {
        responseMessage = String(output);
      }
      
      // Create a response with the tool result
      await this.createSimpleResponse(responseMessage);
      return;
    }
    
    // Otherwise, it's an LLM response - parse it
    console.log(`🧠 Processing LLM response:`, JSON.stringify(output).substring(0, 200));
    
    try {
      // Use safe JSON parsing with automatic repair
      const parsedResponse = extractAndParseJSON(output?.content || '', {
        allowFailure: false,
        onError: (error, input) => {
          console.error(`❌ Failed to parse LLM response:`, error);
          console.log(`📝 LLM content that failed to parse:`, input.substring(0, 200));
        }
      });
      
      if (parsedResponse) {
        console.log(`✅ Parsed LLM response successfully`);
        // Execute the LLM's decision
        await this.executeDecision(parsedResponse);
      } else {
        // If LLM didn't return valid JSON, create a simple text response
        const responseText = output?.content || 'I encountered an error processing your request.';
        await this.createSimpleResponse(responseText);
      }
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
        // RCRT-Native: Let the backend apply llm_hints transformations
        const fullCatalog = await this.rcrtClient.getBreadcrumb(catalogs[0].id);
        
        // The RCRT backend has already applied llm_hints transformations
        // Just use the transformed context directly!
        if (fullCatalog.context?.tool_list) {
          // Backend transformed it via llm_hints
          context.push({
            type: 'tool_catalog',
            content: fullCatalog.context.tool_list
          });
        } else if (fullCatalog.context?.tool_summary) {
          // Fallback to old key name
          context.push({
            type: 'tool_catalog',
            content: fullCatalog.context.tool_summary
          });
        } else {
          console.log('⚠️ Tool catalog found but no transformed context (llm_hints may not be applied)');
        }
      }
    }
    
    // Add recent chat history - use enhanced search API to get context directly
    const userMessages = await this.rcrtClient.searchBreadcrumbsWithContext({
      schema_name: 'user.message.v1',
      include_context: true
    });
    
    const agentResponses = await this.rcrtClient.searchBreadcrumbsWithContext({
      schema_name: 'agent.response.v1',
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
      
      // NEW: Process tool_requests array if present in agent response
      if (breadcrumb.schema_name === 'agent.response.v1' && 
          breadcrumb.context?.tool_requests && 
          Array.isArray(breadcrumb.context.tool_requests) &&
          breadcrumb.context.tool_requests.length > 0) {
        
        console.log(`🔧 Processing ${breadcrumb.context.tool_requests.length} tool requests from agent response`);
        
        for (const toolRequest of breadcrumb.context.tool_requests) {
          if (!toolRequest.tool || !toolRequest.input) {
            console.warn(`⚠️ Skipping invalid tool request:`, toolRequest);
            continue;
          }
          
          const toolRequestBreadcrumb = {
            schema_name: 'tool.request.v1',
            title: `Tool Request: ${toolRequest.tool}`,
            tags: ['tool:request', 'workspace:tools', this.workspace],
            ttl: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour TTL
            context: {
              tool: toolRequest.tool,
              input: toolRequest.input,
              requestId: toolRequest.requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              requestedBy: this.agentDef.context.agent_id,
              creator: {
                type: 'agent',
                agent_id: this.agentDef.context.agent_id
              }
            }
          };
          
          console.log(`🔨 Creating tool request for ${toolRequest.tool} with requestId: ${toolRequestBreadcrumb.context.requestId}`);
          await this.rcrtClient.createBreadcrumb(toolRequestBreadcrumb);
          
          // Track this request so we can correlate the response
          if (toolRequestBreadcrumb.context.requestId) {
            this.pendingLLMRequests.set(toolRequestBreadcrumb.context.requestId, {
              context: { 
                fromToolRequest: true,
                tool: toolRequest.tool,
                parentResponseId: breadcrumbWithCreator.id
              },
              timestamp: new Date()
            });
          }
        }
        
        console.log(`✅ Created ${breadcrumb.context.tool_requests.length} tool request breadcrumbs`);
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
    const metrics = {
      schema_name: 'agent.metrics.v1' as const,
      title: `Metrics: ${this.agentDef.context.agent_id}`,
      tags: [`agent:${this.agentDef.context.agent_id}`, 'agent:metrics', this.workspace],
      ttl: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
      context: {
        agent_id: this.agentDef.context.agent_id,
        timestamp: new Date().toISOString(),
        metrics: {
          total_events_processed: this.state.metrics.events_processed,
          breadcrumbs_created: 0, // TODO: Track these metrics
          breadcrumbs_updated: 0,
          breadcrumbs_deleted: 0,
          llm_calls: 0,
          tool_calls: 0,
          avg_processing_time_ms: 0,
          error_count: this.state.metrics.errors,
          success_rate: this.state.metrics.errors > 0 ? 
            (this.state.metrics.events_processed - this.state.metrics.errors) / this.state.metrics.events_processed : 1
        },
        period: 'hour' as const
      },
    };
    
    await this.rcrtClient.createBreadcrumb(metrics);
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