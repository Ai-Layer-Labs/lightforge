/**
 * Agent Executor - Universal Pattern
 * Extends UniversalExecutor with LLM execution
 */

import { UniversalExecutor, type Subscription } from '../executor/universal-executor';
import { EventBridge } from '../executor/event-bridge';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { extractAndParseJSON } from '../utils/json-repair';

export interface AgentDefinition {
  agent_id: string;
  model: string;
  system_prompt: string;
  temperature?: number;
  subscriptions: {
    selectors: Subscription[];
  };
  capabilities?: any;
}

export interface AgentExecutorOptions {
  agentDef: { context: AgentDefinition };
  rcrtClient: RcrtClientEnhanced;
  workspace: string;
}

export class AgentExecutorUniversal extends UniversalExecutor {
  private agentDef: AgentDefinition;
  private eventBridge: EventBridge;
  
  constructor(options: AgentExecutorOptions, eventBridge?: EventBridge) {
    super({
      rcrtClient: options.rcrtClient,
      workspace: options.workspace,
      subscriptions: options.agentDef.context.subscriptions.selectors,
      id: options.agentDef.context.agent_id
    });
    
    this.agentDef = options.agentDef.context;
    this.eventBridge = eventBridge || new EventBridge();
    
    console.log(`🤖 [AgentExecutor] Initialized: ${this.agentDef.agent_id}`);
    console.log(`📡 Subscriptions: ${this.subscriptions.length}`);
    this.subscriptions.forEach(sub => {
      console.log(`  - ${sub.schema_name} (role: ${sub.role}, key: ${sub.key || sub.schema_name})`);
    });
  }
  
  /**
   * Execute: Handle triggers based on type
   * - user.message.v1: Create LLM request (fire-and-forget)
   * - agent.context.v1: Create LLM request (fire-and-forget)
   * - tool.response.v1: Create agent response (continuation)
   */
  protected async execute(trigger: any, context: Record<string, any>): Promise<any> {
    const triggerSchema = trigger.schema_name;
    
    if (triggerSchema === 'user.message.v1' || triggerSchema === 'agent.context.v1') {
      // Fire-and-forget: Create LLM request, return immediately
      await this.createLLMRequest(trigger, context);
      return { action: 'llm_request_created', async: true };
    }
    
    if (triggerSchema === 'tool.response.v1') {
      // Tool response arrived - could be LLM or regular tool
      const toolName = trigger.context?.tool;
      const llmOutput = trigger.context?.output;
      
      console.log(`🔧 [${this.agentDef.agent_id}] Tool response from: ${toolName}`);
      
      // Check if this is an LLM response (openrouter, ollama, etc.)
      const isLLMTool = toolName === 'openrouter' || toolName === 'ollama_local' || toolName === 'anthropic';
      
      if (isLLMTool) {
        // LLM response - parse and execute instructions
        console.log(`🧠 [${this.agentDef.agent_id}] Processing LLM response...`);
        
        // Extract LLM content
        const llmContent = llmOutput?.content ||
                          llmOutput?.choices?.[0]?.message?.content || 
                          JSON.stringify(llmOutput);
        
        console.log(`📝 LLM content (first 500 chars):`, llmContent.substring(0, 500));
        
        // Parse the agent's response
        const parsed = this.parseAgentResponse(llmContent);
        
        if (!parsed) {
          console.error(`❌ Failed to parse agent response`);
          return { action: 'parse_failed' };
        }
        
        console.log(`✅ Parsed action:`, parsed.action);
      
      // Execute the parsed action
      if (parsed.action === 'create' && parsed.breadcrumb) {
        const breadcrumbDef = parsed.breadcrumb;
        
        // Check if agent wants to invoke tools
        if (breadcrumbDef.context?.tool_requests && breadcrumbDef.context.tool_requests.length > 0) {
          console.log(`🔧 [${this.agentDef.agent_id}] Agent requesting ${breadcrumbDef.context.tool_requests.length} tool(s)...`);
          
          // Create tool request breadcrumbs
          for (const toolReq of breadcrumbDef.context.tool_requests) {
            try {
              await this.rcrtClient.createBreadcrumb({
                schema_name: 'tool.request.v1',
                title: `Tool Request: ${toolReq.tool}`,
                tags: ['tool:request', 'workspace:tools'],
                context: {
                  tool: toolReq.tool,
                  input: toolReq.input,
                  requestId: toolReq.requestId,
                  requestedBy: this.agentDef.agent_id
                }
              });
              console.log(`✅ Tool request created: ${toolReq.tool}`);
            } catch (error) {
              console.error(`❌ Failed to create tool request for ${toolReq.tool}:`, error);
            }
          }
          
          // Return async=true to prevent respond() from creating duplicate
          return { action: 'tools_requested', count: breadcrumbDef.context.tool_requests.length, async: true };
        }
        
        // Otherwise, return breadcrumb definition for respond() to handle
        // This ensures SINGLE creation point and consistent session tag handling
        console.log(`📤 Returning breadcrumb for response creation...`);
        return { action: 'create', breadcrumb: breadcrumbDef };
      }
        
        return parsed;
      } else {
        // Regular tool response - check if it should go back to LLM
        const requestId = trigger.context?.request_id;
        
        // Check if the original tool request specified return_to_llm
        // Also load tool definition to get default return_to_llm
        let shouldReturnToLLM = false;
        
        try {
          // Try to find the original tool request to see if LLM requested return
          if (requestId) {
            const requests = await this.rcrtClient.searchBreadcrumbs({
              schema_name: 'tool.request.v1',
              tag: `request:${requestId}`
            });
            
            if (requests.length > 0) {
              const reqBreadcrumb = await this.rcrtClient.getBreadcrumb(requests[0].id);
              const explicitReturn = reqBreadcrumb.context?.return_to_llm;
              
              if (explicitReturn !== undefined) {
                shouldReturnToLLM = explicitReturn;
                console.log(`📋 Tool request explicitly set return_to_llm: ${shouldReturnToLLM}`);
              }
            }
          }
          
          // If not explicitly set, check tool definition default
          if (shouldReturnToLLM === undefined) {
            const toolDefs = await this.rcrtClient.searchBreadcrumbs({
              schema_name: 'tool.v1',
              tag: `tool:${toolName}`
            });
            
            if (toolDefs.length > 0) {
              const toolDef = await this.rcrtClient.getBreadcrumb(toolDefs[0].id);
              shouldReturnToLLM = toolDef.context?.response_handling?.return_to_llm ?? true;  // Default true if not specified
              console.log(`🔧 Tool ${toolName} default return_to_llm: ${shouldReturnToLLM}`);
            }
          }
        } catch (e) {
          console.warn(`⚠️  Failed to determine return_to_llm, defaulting to true`);
          shouldReturnToLLM = true;
        }
        
        if (!shouldReturnToLLM) {
          // Send result directly to user - return breadcrumb for respond() to handle
          console.log(`📤 [${this.agentDef.agent_id}] Tool result will be sent directly to user (no LLM)`);
          
          // Format simple response with tool result
          const resultText = typeof llmOutput === 'object' 
            ? JSON.stringify(llmOutput, null, 2)
            : String(llmOutput);
          
          const message = `✅ ${toolName}: ${resultText}`;
          
          // Return breadcrumb definition for respond() to create
          return {
            action: 'create',
            breadcrumb: {
              schema_name: 'agent.response.v1',
              title: 'Tool Result',
              tags: ['agent:response', 'chat:output'],
              context: {
                message: message,
                tool_result: {
                  tool: toolName,
                  output: llmOutput
                }
              }
            }
          };
        } else {
          // Send back to LLM for reasoning
          console.log(`🔄 [${this.agentDef.agent_id}] Sending tool result back to LLM for reasoning`);
          
          const toolResult = JSON.stringify(llmOutput, null, 2);
          const userPrompt = `The ${toolName} tool returned:\n\n\`\`\`json\n${toolResult}\n\`\`\`\n\nPlease formulate a response to the user incorporating this result.`;
          
          const requestId = `llm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const configId = this.getLLMConfigId();
          
          if (!configId) {
            console.error(`❌ No LLM config`);
            return { action: 'no_llm_config' };
          }
          
          let llmToolName = 'openrouter';
          try {
            const configBreadcrumb = await this.rcrtClient.getBreadcrumb(configId);
            llmToolName = configBreadcrumb.context.toolName || 'openrouter';
          } catch (e) {
            console.warn(`Failed to load config`);
          }
          
          await this.rcrtClient.createBreadcrumb({
            schema_name: 'tool.request.v1',
            title: 'LLM Request (with tool result)',
            tags: ['tool:request', 'workspace:tools', `agent:${this.agentDef.agent_id}`],
            context: {
              tool: llmToolName,
              config_id: configId,
              input: {
                messages: [
                  {
                    role: 'system',
                    content: this.agentDef.system_prompt
                  },
                  {
                    role: 'user',
                    content: userPrompt
                  }
                ]
              },
              requestId: requestId,
              requestedBy: this.agentDef.agent_id
            }
          });
          
          console.log(`✅ Tool result sent to LLM for reasoning`);
          return { action: 'tool_result_forwarded', tool: toolName };
        }
      }
    }
    
    return { action: 'unknown_trigger', schema: triggerSchema };
  }
  
  /**
   * Format assembled context for LLM
   * THE RCRT WAY: Clear, concise, human-readable
   * 
   * Context now comes from context-builder with lightweight breadcrumbs
   * that have already been transformed by llm_hints on the server side.
   */
  private formatContextForLLM(context: Record<string, any>): string {
    let formatted = '';
    
    // NEW FORMAT: Context contains pre-transformed breadcrumbs
    // Each breadcrumb has: id, schema_name, created_at, content (already transformed)
    if (context.breadcrumbs && Array.isArray(context.breadcrumbs)) {
      // Group breadcrumbs by schema type for better organization
      const messageBreads: any[] = [];
      const responseBreads: any[] = [];
      const toolBreads: any[] = [];
      const browserBreads: any[] = [];
      const catalogBreads: any[] = [];
      const otherBreads: any[] = [];
      
      for (const bc of context.breadcrumbs) {
        if (bc.schema_name?.includes('user.message')) {
          messageBreads.push(bc);
        } else if (bc.schema_name?.includes('agent.response')) {
          responseBreads.push(bc);
        } else if (bc.schema_name?.includes('tool.')) {
          toolBreads.push(bc);
        } else if (bc.schema_name?.includes('browser.')) {
          browserBreads.push(bc);
        } else if (bc.schema_name?.includes('tool.catalog')) {
          catalogBreads.push(bc);
        } else {
          otherBreads.push(bc);
        }
      }
      
      // 1. Conversation (user messages and agent responses interleaved)
      const conversationItems = [...messageBreads, ...responseBreads]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      if (conversationItems.length > 0) {
        formatted += `## Conversation\n\n`;
        conversationItems.forEach((bc) => {
          const content = this.extractContent(bc.content);
          if (content) {
            formatted += `${content}\n`;
          }
        });
        formatted += '\n';
      }
      
      // 2. Tool Information
      if (catalogBreads.length > 0) {
        formatted += `## Available Tools\n\n`;
        catalogBreads.forEach((bc) => {
          const content = this.extractContent(bc.content);
          if (content) {
            formatted += `${content}\n`;
          }
        });
        formatted += '\n';
      }
      
      // 3. Tool Results
      if (toolBreads.length > 0) {
        formatted += `## Tool Results\n\n`;
        toolBreads.forEach((bc) => {
          const content = this.extractContent(bc.content);
          if (content) {
            formatted += `${content}\n`;
          }
        });
        formatted += '\n';
      }
      
      // 4. Browser Context
      if (browserBreads.length > 0) {
        formatted += `## Browser Context\n\n`;
        browserBreads.forEach((bc) => {
          const content = this.extractContent(bc.content);
          if (content) {
            formatted += `${content}\n`;
          }
        });
        formatted += '\n';
      }
      
      // 5. Other breadcrumbs
      if (otherBreads.length > 0) {
        formatted += `## Additional Context\n\n`;
        otherBreads.forEach((bc) => {
          const content = this.extractContent(bc.content);
          if (content) {
            formatted += `${content}\n`;
          }
        });
        formatted += '\n';
      }
    }
    
    // Token estimate for transparency
    if (context.token_estimate) {
      formatted += `\n---\nContext size: ~${context.token_estimate} tokens\n`;
    }
    
    return formatted;
  }
  
  /**
   * Extract content from transformed breadcrumb
   * Content can be a string (from format transform) or object (from other transforms)
   */
  private extractContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }
    
    if (typeof content === 'object' && content !== null) {
      // If it's an object with a single "formatted" key, use that
      if (content.formatted && typeof content.formatted === 'string') {
        return content.formatted;
      }
      
      // Otherwise, try to format it nicely
      const keys = Object.keys(content);
      if (keys.length === 0) {
        return '';
      }
      
      // Single key-value: inline format
      if (keys.length === 1) {
        const key = keys[0];
        const val = content[key];
        if (typeof val === 'string') {
          return val;
        }
        return `${key}: ${JSON.stringify(val)}`;
      }
      
      // Multiple keys: structured format
      return Object.entries(content)
        .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join('\n');
    }
    
    return String(content);
  }
  
  /**
   * Get LLM config breadcrumb ID from agent definition
   */
  private getLLMConfigId(): string | null {
    return (this.agentDef as any).llm_config_id || null;
  }
  
  /**
   * Create LLM request (fire-and-forget!)
   * SINGLE SOURCE OF TRUTH: Config breadcrumb specifies BOTH tool AND config
   */
  private async createLLMRequest(trigger: any, context: Record<string, any>): Promise<void> {
    // Extract user message from trigger
    // If trigger is agent.context.v1, extract the actual user message from breadcrumbs
    let userMessage = trigger.context?.message || trigger.context?.content;
    
    if (!userMessage && trigger.schema_name === 'agent.context.v1') {
      // Find the trigger_event_id breadcrumb (the actual user message that triggered this)
      const triggerEventId = trigger.context?.trigger_event_id;
      if (triggerEventId && context.breadcrumbs) {
        const userMsgBreadcrumb = context.breadcrumbs.find((bc: any) => bc.id === triggerEventId);
        if (userMsgBreadcrumb) {
          // Try to extract formatted content first, then raw content
          userMessage = userMsgBreadcrumb.content?.formatted || 
                       userMsgBreadcrumb.content?.content ||
                       userMsgBreadcrumb.content?.message ||
                       JSON.stringify(userMsgBreadcrumb.content);
        }
      }
    }
    
    // Final fallback if we still don't have a message
    if (!userMessage) {
      userMessage = JSON.stringify(trigger.context);
    }
    
    // Format context for LLM
    const contextFormatted = this.formatContextForLLM(context);
    
    // Get LLM config breadcrumb ID
    const configId = this.getLLMConfigId();
    
    if (!configId) {
      console.error(`❌ Agent ${this.agentDef.agent_id} has no llm_config_id set!`);
      console.error(`   Set via Dashboard UI: Agents → Edit Agent → Select LLM Configuration`);
      throw new Error('Agent has no LLM configuration set. Configure via Dashboard.');
    }
    
    // Load config to get the tool name (config specifies which tool to use!)
    let toolName = 'openrouter';  // Default fallback
    try {
      const configBreadcrumb = await this.rcrtClient.getBreadcrumb(configId);
      toolName = configBreadcrumb.context.toolName || 'openrouter';
      console.log(`✅ Config specifies tool: ${toolName}`);
    } catch (error) {
      console.warn(`⚠️  Failed to load config to get tool name, using default: openrouter`);
    }
    
    // Build messages for LLM
    const messages = [
      {
        role: 'system',
        content: this.agentDef.system_prompt
      },
      {
        role: 'user',
        content: `# Available Context\n\n${contextFormatted}\n\n# User Message\n${userMessage}`
      }
    ];
    
    console.log(`📤 [${this.agentDef.agent_id}] Creating LLM request for tool: ${toolName} with config ID: ${configId}`);
    
    const requestId = `llm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create tool request - Config breadcrumb specifies BOTH tool and config!
    await this.rcrtClient.createBreadcrumb({
      schema_name: 'tool.request.v1',
      title: 'LLM Request',
      tags: ['tool:request', 'workspace:tools', `agent:${this.agentDef.agent_id}`],
      context: {
        tool: toolName,  // ← From config breadcrumb! Can be openrouter, ollama, etc.
        config_id: configId,  // ← Tool loads this to get model, temperature, etc.
        input: {
          messages: messages  // ← ONLY messages, no config data!
        },
        requestId: requestId,
        requestedBy: this.agentDef.agent_id
      }
    });
    
    console.log(`✅ [${this.agentDef.agent_id}] LLM request created for ${toolName} (config will be loaded by tool)`);
    // Return immediately! Response will arrive via SSE as tool.response.v1
  }
  
  /**
   * Parse agent response (extract JSON)
   */
  private parseAgentResponse(llmOutput: string): any {
    try {
      return extractAndParseJSON(llmOutput);
    } catch (error) {
      console.warn(`Failed to parse agent response, using fallback`);
      // Fallback: wrap plain text
      return {
        action: 'create',
        breadcrumb: {
          schema_name: 'agent.response.v1',
          title: 'Agent Response',
          tags: ['agent:response', 'chat:output'],
        context: {
            message: llmOutput
          }
        }
      };
    }
  }
  
  /**
   * Create agent response breadcrumb
   * THE RCRT WAY: Inherit session tags from trigger to keep conversations isolated
   * SINGLE SOURCE OF TRUTH: All agent.response.v1 breadcrumbs created here
   */
  protected async respond(trigger: any, result: any): Promise<void> {
    // If async action, don't create response (waiting for continuation)
    if (result.async) {
      console.log(`✅ [${this.agentDef.agent_id}] Async action complete, waiting for continuation`);
      return;
    }
    
    const breadcrumbDef = result.breadcrumb || result;
    
    // THE RCRT WAY: Extract session tag from trigger to maintain conversation isolation
    const sessionTag = trigger.tags?.find((t: string) => t.startsWith('session:'));
    const baseTags = breadcrumbDef.tags || ['agent:response', 'chat:output'];
    
    // Add session tag if found (keeps responses in same session as trigger)
    const tags = sessionTag && !baseTags.includes(sessionTag)
      ? [...baseTags, sessionTag]
      : baseTags;
    
    // THE RCRT WAY: Preserve ALL context from LLM, add metadata
    // CRITICAL: LLM returns context.message - we must preserve it!
    const originalContext = breadcrumbDef.context || {};
    
    console.log(`🔍 [${this.agentDef.agent_id}] Original context keys:`, Object.keys(originalContext));
    
    // STANDARDIZED SCHEMA: Use consistent field names
    const context = {
      ...originalContext,  // Preserve message and any other LLM fields
      creator: {
        type: 'agent',
        agent_id: this.agentDef.agent_id  // Standardized: agent_id not agentId
      },
      trigger_event_id: trigger.id,  // Standardized: trigger_event_id not trigger_id
      timestamp: new Date().toISOString()  // Always include timestamp
    };
    
    console.log(`🔍 [${this.agentDef.agent_id}] Final context keys:`, Object.keys(context));
    
    await this.rcrtClient.createBreadcrumb({
      schema_name: breadcrumbDef.schema_name || 'agent.response.v1',
      title: breadcrumbDef.title || 'Agent Response',
      tags: tags,
      context: context
    });
    
    console.log(`📤 [${this.agentDef.agent_id}] Response created with tags:`, tags);
  }
  
  /**
   * Humanize key for display
   */
  private humanizeKey(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  
  /**
   * Get state for monitoring
   */
  getState() {
    return {
      agent_id: this.agentDef.agent_id,
      status: 'active',
      subscriptions: this.subscriptions.length,
      metrics: {
        events_processed: 0,
        errors: 0,
        last_activity: new Date()
      }
    };
  }
  
  /**
   * Get definition
   */
  getDefinition() {
    return { context: this.agentDef };
  }
  
  /**
   * Override vector search query (use trigger message)
   */
  private triggerMessage: string = '';
  
  protected getVectorSearchQuery(): string {
    return this.triggerMessage;
  }
}
