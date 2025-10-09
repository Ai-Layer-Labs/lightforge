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
          
          // Return - tool responses will trigger agent again
          return { action: 'tools_requested', count: breadcrumbDef.context.tool_requests.length };
        }
        
        // Otherwise, create the response breadcrumb directly
        console.log(`📤 Creating agent response breadcrumb...`);
        
        // Extract session from trigger to tag response
        const sessionId = trigger.context?.session_id;
        const sessionTag = trigger.tags?.find((t: string) => t.startsWith('session:'));
        
        // Add session to response tags and context
        const tags = breadcrumbDef.tags || ['agent:response', 'chat:output'];
        if (sessionTag) {
          tags.push(sessionTag);
          console.log(`🏷️  Tagging response with ${sessionTag}`);
        }
        
        const contextWithSession = {
          ...breadcrumbDef.context,
          session_id: sessionId  // Include session for routing
        };
        
        try {
          const result = await this.rcrtClient.createBreadcrumb({
            ...breadcrumbDef,
            tags: tags,
            context: contextWithSession
          });
          console.log(`✅ Agent response created: ${result.id}`);
          return { action: 'breadcrumb_created', id: result.id };
        } catch (error) {
          console.error(`❌ Failed to create agent response:`, error);
          return { action: 'create_failed', error };
        }
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
          // Send result directly to user
          console.log(`📤 [${this.agentDef.agent_id}] Tool result sent directly to user (no LLM)`);
          
          // Format simple response with tool result
          const resultText = typeof llmOutput === 'object' 
            ? JSON.stringify(llmOutput, null, 2)
            : String(llmOutput);
          
          const message = `✅ ${toolName}: ${resultText}`;
          
          await this.rcrtClient.createBreadcrumb({
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
          });
          
          console.log(`✅ Direct response created (skipped LLM)`);
          return { action: 'direct_response', tool: toolName };
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
   */
  private formatContextForLLM(context: Record<string, any>): string {
    let formatted = '';
    
    // 1. Current Conversation (if present)
    if (context.current_conversation && context.current_conversation.length > 0) {
      formatted += `## Current Conversation\n\n`;
      context.current_conversation.forEach((msg: any) => {
        if (!msg.content) return;  // Skip messages with no content
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        formatted += `${role}: ${msg.content}\n`;
      });
      formatted += '\n';
    }
    
    // 2. Relevant History (if present)
    if (context.relevant_history && context.relevant_history.length > 0) {
      formatted += `## Relevant History\n\n`;
      const validHistory = context.relevant_history.filter((msg: any) => msg.content);
      if (validHistory.length > 0) {
        validHistory.forEach((msg: any) => {
          const role = msg.role === 'user' ? 'User' : 'Assistant';
          formatted += `${role}: ${msg.content}\n`;
        });
        formatted += '\n';
      }
    }
    
    // 3. Browser Context (if present)
    if (context.browser) {
      formatted += `## Browser\n\n`;
      formatted += `Page: ${context.browser.title}\n`;
      formatted += `URL: ${context.browser.url}\n`;
      if (context.browser.dom?.interactiveCount) {
        formatted += `Interactive elements: ${context.browser.dom.interactiveCount}\n`;
      }
      formatted += '\n';
    }
    
    // 4. Tools (if present)
    if (context.tool_catalog?.tools) {
      formatted += `## Available Tools\n\n`;
      const tools = context.tool_catalog.tools.slice(0, 15);  // Limit to 15
      tools.forEach((tool: any) => {
        formatted += `- ${tool.name}: ${tool.category || 'utility'}\n`;
      });
      formatted += '\n';
    }
    
    // 5. Other context (fallback - use JSON for unknown structures)
    for (const [key, value] of Object.entries(context)) {
      if (['current_conversation', 'relevant_history', 'browser', 'tool_catalog', 'trigger'].includes(key)) {
        continue;  // Already handled
      }
      
      const title = this.humanizeKey(key);
      formatted += `## ${title}\n\n`;
      
      if (typeof value === 'object' && value !== null) {
        formatted += '```json\n';
        formatted += JSON.stringify(value, null, 2);
        formatted += '\n```\n\n';
      } else {
        formatted += String(value) + '\n\n';
      }
    }
    
    return formatted;
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
    const userMessage = trigger.context?.message || 
                       trigger.context?.content || 
                       JSON.stringify(trigger.context);
    
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
    
    // Add creator metadata
    const context = {
      ...breadcrumbDef.context,
      creator: {
        type: 'agent',
        agent_id: this.agentDef.agent_id
      },
      trigger_id: trigger.id,
      session_id: sessionTag ? sessionTag.replace('session:', '') : undefined
    };
    
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
