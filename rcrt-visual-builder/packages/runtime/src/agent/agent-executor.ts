/**
 * Agent Executor
 * Manages agent runtime lifecycle and SSE event processing
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

// Simple OpenRouter client interface (same as in LLM node)
interface OpenRouterClient {
  complete(params: any): Promise<any>;
}

class SimpleOpenRouterClient implements OpenRouterClient {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';
  
  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
  }
  
  async complete(params: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://rcrt-builder.local',
        'X-Title': 'RCRT Agent Executor',
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature || 0.7,
        max_tokens: params.max_tokens || 4096,
        tools: params.tools,
        stream: false,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      content: data.choices[0].message.content,
      model: data.model,
      usage: data.usage,
      tool_calls: data.choices[0].message.tool_calls,
    };
  }
}

export interface AgentExecutorOptions {
  agentDef: AgentDefinitionV1;
  rcrtClient: RcrtClientEnhanced;
  workspace: string;
  openRouterApiKey?: string;
  autoStart?: boolean;
  metricsInterval?: number;
}

export class AgentExecutor {
  private agentDef: AgentDefinitionV1;
  private rcrtClient: RcrtClientEnhanced;
  private llmClient: OpenRouterClient;
  private workspace: string;
  private sseCleanup?: () => void;
  private state: AgentState;
  private memory = new Map<string, any>();
  private metricsTimer?: NodeJS.Timer;
  private options: AgentExecutorOptions;
  
  constructor(options: AgentExecutorOptions) {
    this.options = options;
    this.agentDef = options.agentDef;
    this.rcrtClient = options.rcrtClient;
    this.workspace = options.workspace;
    this.llmClient = new SimpleOpenRouterClient(options.openRouterApiKey);
    
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
    
    if (options.autoStart) {
      this.start().catch(error => {
        console.error('Failed to auto-start agent:', error);
      });
    }
  }
  
  /**
   * Start the agent
   */
  async start(): Promise<void> {
    console.log(`🤖 Starting agent: ${this.agentDef.context.agent_id}`);
    
    // Update state
    this.state.status = 'idle';
    
    // Load memory if configured
    if (this.agentDef.context.memory?.type === 'breadcrumb') {
      await this.loadMemory();
    }
    
    // Start SSE subscriptions
    await this.startSubscriptions();
    
    // Start metrics reporting
    if (this.options.metricsInterval) {
      this.startMetricsReporting();
    }
    
    console.log(`✅ Agent started: ${this.agentDef.context.agent_id}`);
  }
  
  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    console.log(`🛑 Stopping agent: ${this.agentDef.context.agent_id}`);
    
    // Update state
    this.state.status = 'stopped';
    
    // Stop SSE subscriptions
    if (this.sseCleanup) {
      this.sseCleanup();
      this.sseCleanup = undefined;
    }
    
    // Stop metrics reporting
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = undefined;
    }
    
    // Save memory if configured
    if (this.agentDef.context.memory?.type === 'breadcrumb') {
      await this.saveMemory();
    }
    
    // Report final metrics
    await this.reportMetrics();
    
    console.log(`✅ Agent stopped: ${this.agentDef.context.agent_id}`);
  }
  
  /**
   * Process a breadcrumb event
   */
  async processEvent(event: BreadcrumbEvent): Promise<void> {
    // Skip ping events
    if (event.type === 'ping' || !event.breadcrumb_id) {
      return;
    }
    
    console.log(`📨 Processing event: ${event.type} for ${event.breadcrumb_id}`);
    
    // Update state
    this.state.status = 'processing';
    this.state.current_event = event;
    this.state.metrics.last_activity = new Date();
    
    try {
      // Fetch the triggering breadcrumb
      const breadcrumb = await this.rcrtClient.getBreadcrumb(event.breadcrumb_id);
      
      // Skip if this breadcrumb was created by this agent (prevent infinite loops)
      if (breadcrumb.context?.creator?.agent_id === this.agentDef.context.agent_id) {
        console.log(`⏭️ Skipping self-created breadcrumb`);
        return;
      }
      
      // Build context
      const context = await this.buildContext(breadcrumb);
      
      // Build messages for LLM
      const messages = this.buildMessages(breadcrumb, context);
      
      // Call LLM for decision
      const decision = await this.makeDecision(messages, context);
      
      // Execute decision
      await this.executeDecision(decision);
      
      // Update metrics
      this.state.metrics.events_processed++;
      
      console.log(`✅ Processed event: ${event.type}`);
    } catch (error) {
      console.error(`❌ Error processing event: ${error}`);
      this.state.metrics.errors++;
      
      // Log error as breadcrumb
      await this.logError(error, event);
    } finally {
      this.state.status = 'idle';
      this.state.current_event = undefined;
    }
  }
  
  /**
   * Start SSE subscriptions
   */
  private async startSubscriptions(): Promise<void> {
    const selectors = this.agentDef.context.subscriptions?.selectors || [];
    
    if (selectors.length === 0) {
      console.warn('No subscriptions configured for agent');
      return;
    }
    
    // Subscribe to events with auto-reconnect
    for (const selector of selectors) {
      this.sseCleanup = this.rcrtClient.startEventStream(
        (event: BreadcrumbEvent) => {
          // Process event asynchronously
          this.processEvent(event).catch(error => {
            console.error('Event processing error:', error);
          });
        },
        {
          reconnectDelay: 5000,
          filters: selector,
          agentId: this.agentDef.context.agent_id,
        }
      );
    }
  }
  
  /**
   * Build context for decision making
   */
  private async buildContext(trigger: any): Promise<any[]> {
    const context: any[] = [];
    
    // Add trigger
    context.push({
      type: 'trigger',
      data: trigger,
    });
    
    // Add memory
    if (this.memory.size > 0) {
      context.push({
        type: 'memory',
        data: Array.from(this.memory.entries()),
      });
    }
    
    // Fetch additional context based on subscriptions
    const selectors = this.agentDef.context.subscriptions?.selectors || [];
    for (const selector of selectors) {
      const breadcrumbs = await this.rcrtClient.searchBreadcrumbs(selector);
      
      // Special handling for tool catalog until server implements context transforms
      if (selector.schema_name === 'tool.catalog.v1' && breadcrumbs.length > 0) {
        // searchBreadcrumbs returns summary without full context, so fetch the complete breadcrumb
        const fullToolCatalog = await this.rcrtClient.getBreadcrumb(breadcrumbs[0].id);
        context.push({
          type: 'tool_catalog',
          data: fullToolCatalog,
          // Generate LLM-friendly prompt from raw catalog
          prompt: ToolPromptAdapter.generateToolPrompt(fullToolCatalog as any),
          tools: ToolPromptAdapter.generateToolSchemas(fullToolCatalog.context?.tools || [])
        });
      } else {
        context.push({
          type: 'subscription',
          selector,
          data: breadcrumbs.slice(0, 10), // Limit to recent 10
        });
      }
    }
    
    return context;
  }
  
  /**
   * Build messages for LLM
   */
  private buildMessages(trigger: any, context: any[]): any[] {
    const messages: any[] = [];
    
    // System prompt
    messages.push({
      role: 'system',
      content: this.agentDef.context.system_prompt,
    });
    
    // Add tool catalog prompt if available
    const toolContext = context.find(c => c.type === 'tool_catalog');
    if (toolContext?.prompt) {
      messages.push({
        role: 'system',
        content: `\n${toolContext.prompt}`,
      });
    }
    
    // Add other context (excluding tool catalog which is already added as prompt)
    const otherContext = context.filter(c => c.type !== 'tool_catalog');
    if (otherContext.length > 0) {
      messages.push({
        role: 'system',
        content: `Context (${otherContext.length} items):\n${JSON.stringify(otherContext, null, 2)}`,
      });
    }
    
    // Add trigger as user message
    messages.push({
      role: 'user',
      content: `Process this trigger:\n${JSON.stringify(trigger, null, 2)}`,
    });
    
    // Add capabilities reminder
    const capabilities = this.agentDef.context.capabilities;
    messages.push({
      role: 'system',
      content: `Your capabilities: ${JSON.stringify(capabilities)}. Return your decision as JSON with an "action" field.`,
    });
    
    return messages;
  }
  
  /**
   * Make decision using LLM
   */
  private async makeDecision(messages: any[], context: any[]): Promise<any> {
    // Check if we have tool schemas for function calling
    const toolContext = context.find(c => c.type === 'tool_catalog');
    const tools = toolContext?.tools;
    
    const response = await this.llmClient.complete({
      model: this.agentDef.context.model,
      messages,
      temperature: this.agentDef.context.temperature || 0.7,
      max_tokens: this.agentDef.context.max_tokens || 4096,
      tools: tools || this.agentDef.context.tools, // Use discovered tools or fallback
    });
    
    // Handle tool calls if present
    if (response.tool_calls && response.tool_calls.length > 0) {
      // Convert tool calls to our format
      const toolRequests = response.tool_calls.map((tc: any) => ({
        schema_name: 'tool.request.v1',
        tool: tc.function.name,
        input: JSON.parse(tc.function.arguments),
        requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }));
      
      return {
        action: 'create',
        breadcrumb: {
          schema_name: 'agent.response.v1',
          title: 'Tool Invocation',
          tags: ['agent:response', this.workspace],
          context: {
            message: 'Invoking tools to help with your request',
            tool_requests: toolRequests
          }
        }
      };
    }
    
    // Parse decision from content
    try {
      return JSON.parse(response.content);
    } catch {
      // Fallback parsing
      const content = response.content.toLowerCase();
      
      if (content.includes('create')) {
        return { action: 'create', details: response.content };
      } else if (content.includes('update')) {
        return { action: 'update', details: response.content };
      } else if (content.includes('delete')) {
        return { action: 'delete', details: response.content };
      } else {
        return { action: 'none', details: response.content };
      }
    }
  }
  
  /**
   * Execute decision
   */
  private async executeDecision(decision: any): Promise<void> {
    console.log(`⚡ Executing decision: ${decision.action}`);
    
    const capabilities = this.agentDef.context.capabilities;
    
    switch (decision.action) {
      case 'create':
        if (capabilities.can_create_breadcrumbs && decision.breadcrumb) {
          // Add creator metadata to prevent self-triggering
          const breadcrumbWithCreator = {
            ...decision.breadcrumb,
            tags: [...(decision.breadcrumb.tags || []), this.workspace],
            // Add appropriate TTL based on schema type (as ISO 8601 datetime)
            ttl: decision.breadcrumb.schema_name === 'agent.response.v1' 
                 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
                 : decision.breadcrumb.schema_name === 'tool.request.v1' 
                 ? new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
                 : undefined,  // No TTL for other types unless specified
            context: {
              ...decision.breadcrumb.context,
              creator: {
                type: 'agent',
                agent_id: this.agentDef.context.agent_id
              }
            }
          };
          await this.rcrtClient.createBreadcrumb(breadcrumbWithCreator);
        }
        break;
        
      case 'update':
        if (capabilities.can_update_own && decision.id && decision.version) {
          await this.rcrtClient.updateBreadcrumb(
            decision.id,
            decision.version,
            decision.updates
          );
        }
        break;
        
      case 'delete':
        if (capabilities.can_delete_own && decision.id) {
          await this.rcrtClient.deleteBreadcrumb(decision.id, decision.version);
        }
        break;
        
      case 'spawn':
        if (capabilities.can_spawn_agents && decision.agent_def) {
          await this.rcrtClient.createBreadcrumb({
            ...decision.agent_def,
            schema_name: 'agent.def.v1',
            tags: [...(decision.agent_def.tags || []), this.workspace],
          });
        }
        break;
        
      case 'none':
        // No action needed
        break;
        
      default:
        console.warn(`Unknown action: ${decision.action}`);
    }
    
    // Update memory if needed
    if (decision.remember) {
      this.memory.set(`decision-${Date.now()}`, decision);
    }
  }
  
  /**
   * Load memory from breadcrumbs
   */
  private async loadMemory(): Promise<void> {
    const memoryBreadcrumbs = await this.rcrtClient.searchBreadcrumbs({
      schema_name: 'agent.memory.v1',
      any_tags: [`agent:${this.agentDef.context.agent_id}`],
    });
    
    for (const breadcrumb of memoryBreadcrumbs) {
      this.memory.set(breadcrumb.id, breadcrumb.context.content);
    }
    
    console.log(`📚 Loaded ${memoryBreadcrumbs.length} memory items`);
  }
  
  /**
   * Save memory to breadcrumbs
   */
  private async saveMemory(): Promise<void> {
    // Check if agent config specifies memory TTL
    const memoryTtlHours = this.agentDef.context.memory?.ttl_hours || 48; // Default 48 hours
    const memoryTtl = new Date(Date.now() + memoryTtlHours * 60 * 60 * 1000).toISOString();
      
    for (const [key, value] of this.memory) {
      await this.rcrtClient.createBreadcrumb({
        schema_name: 'agent.memory.v1',
        title: `Memory: ${key}`,
        tags: [`agent:${this.agentDef.context.agent_id}`, 'agent:memory', this.workspace],
        ttl: memoryTtl,
        context: {
          agent_id: this.agentDef.context.agent_id,
          memory_type: 'working',
          content: value,
          created_at: new Date().toISOString(),
          creator: {
            type: 'agent',
            agent_id: this.agentDef.context.agent_id
          }
        },
      });
    }
    
    console.log(`💾 Saved ${this.memory.size} memory items`);
  }
  
  /**
   * Start metrics reporting
   */
  private startMetricsReporting(): void {
    const interval = this.options.metricsInterval || 60000; // Default 1 minute
    
    this.metricsTimer = setInterval(() => {
      this.reportMetrics().catch(error => {
        console.error('Failed to report metrics:', error);
      });
    }, interval);
  }
  
  /**
   * Report agent metrics
   */
  private async reportMetrics(): Promise<void> {
    await this.rcrtClient.createBreadcrumb({
      schema_name: 'agent.metrics.v1',
      title: `Metrics: ${this.agentDef.context.agent_id}`,
      tags: [`agent:${this.agentDef.context.agent_id}`, 'agent:metrics', this.workspace],
      ttl: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),  // Keep metrics for 24 hours
      context: {
        agent_id: this.agentDef.context.agent_id,
        timestamp: new Date().toISOString(),
        metrics: {
          total_events_processed: this.state.metrics.events_processed,
          breadcrumbs_created: 0, // Would need to track this
          breadcrumbs_updated: 0, // Would need to track this
          breadcrumbs_deleted: 0, // Would need to track this
          llm_calls: this.state.metrics.events_processed, // Approximation
          tool_calls: 0, // Would need to track this
          avg_processing_time_ms: 0, // Would need to track this
          error_count: this.state.metrics.errors,
          success_rate: this.state.metrics.events_processed > 0
            ? (this.state.metrics.events_processed - this.state.metrics.errors) / this.state.metrics.events_processed
            : 1,
        },
        period: 'minute',
        creator: {
          type: 'agent',
          agent_id: this.agentDef.context.agent_id
        }
      }
    });
  }
  
  /**
   * Log error as breadcrumb
   */
  private async logError(error: any, event?: BreadcrumbEvent): Promise<void> {
    await this.rcrtClient.createBreadcrumb({
      schema_name: 'agent.error.v1',
      title: `Error: ${this.agentDef.context.agent_id}`,
      tags: [`agent:${this.agentDef.context.agent_id}`, 'agent:error', this.workspace],
      ttl: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),  // Expire after 2 hours
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
  
  /**
   * Get agent state
   */
  getState(): AgentState {
    return { ...this.state };
  }
  
  /**
   * Update JWT token for the client
   */
  updateToken(token: string): void {
    this.rcrtClient.setToken(token);
  }
  
  /**
   * Get agent definition
   */
  getDefinition(): AgentDefinitionV1 {
    return this.agentDef;
  }
}
