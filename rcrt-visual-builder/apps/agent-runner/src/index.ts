#!/usr/bin/env node
/**
 * RCRT Agent Runner
 * Processes agent definitions (data/context) by sending context to LLMs
 * and processing structured responses to trigger tools and create breadcrumbs
 * 
 * PHILOSOPHY: Agents are context + data, NOT executable code
 */

import dotenv from 'dotenv';
import { createClient, RcrtClientEnhanced } from '@rcrt-builder/sdk';

// Track processing status to prevent duplicate executions
const processingStatus = new Map<string, 'processing' | 'completed'>();

// ============ AGENT DEFINITION INTERFACE ============

interface AgentDefinition {
  agent_name: string;
  description: string;
  triggers: Array<{
    selector: {
      any_tags?: string[];
      all_tags?: string[];
      context_match?: Array<{
        path: string;
        op: 'eq' | 'contains_any' | 'gt' | 'lt';
        value: any;
      }>;
    };
  }>;
  // No complex context gathering - just use the breadcrumb context from the API!
  llm_config: {
    model: string;
    system_prompt: string;
    response_schema: any;
  };
}

interface LLMResponse {
  response_text: string;
  tools_to_invoke?: Array<{
    tool: string;
    input: any;
    reason?: string;
  }>;
  create_breadcrumbs?: Array<{
    title: string;
    tags: string[];
    context: any;
  }>;
  confidence?: number;
}

// ============ SSE DISPATCHER ============

async function startAgentSSEDispatcher(
  client: RcrtClientEnhanced, 
  workspace: string, 
  jwtToken: string
): Promise<void> {
  try {
    console.log('📡 Starting agent SSE dispatcher...');
    console.log(`🔌 Connecting to SSE: ${client.baseUrl}/events/stream`);
    
    const response = await fetch(`${client.baseUrl}/events/stream`, {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`SSE connection failed: ${response.status}`);
    }
    
    console.log('✅ Agent SSE dispatcher connected');
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No SSE stream reader available');
    }
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const eventData = JSON.parse(line.slice(6));
            
            if (eventData.type !== 'ping') {
              console.log(`📡 Agent Event:`, {
                type: eventData.type,
                schema_name: eventData.schema_name,
                tags: eventData.tags,
                breadcrumb_id: eventData.breadcrumb_id
              });
            }
            
            await processEventForAgents(eventData, client, workspace);
          } catch (error) {
            console.warn('Failed to parse SSE event:', line, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Agent SSE dispatcher error:', error);
    setTimeout(() => startAgentSSEDispatcher(client, workspace, jwtToken), 5000);
  }
}

async function processEventForAgents(
  eventData: any, 
  client: RcrtClientEnhanced, 
  workspace: string
): Promise<void> {
  
  if ((eventData.type === 'breadcrumb.created' || eventData.type === 'breadcrumb.updated')) {
    const breadcrumbId = eventData.breadcrumb_id;
    
    if (processingStatus.get(breadcrumbId) === 'processing') {
      console.log(`⏭️ Breadcrumb ${breadcrumbId} already being processed, skipping`);
      return;
    }
    
    console.log(`🎯 Processing breadcrumb for agents: ${breadcrumbId}`);
    processingStatus.set(breadcrumbId, 'processing');
    
    if (processingStatus.size > 100) {
      processingStatus.clear();
    }
    
    try {
      // Get breadcrumb using direct API call (bypass SDK)
      const breadcrumbUrl = `${client.baseUrl}/breadcrumbs/${eventData.breadcrumb_id}`;
      const authHeader = (client as any).defaultHeaders?.Authorization;
      const breadcrumbResponse = await fetch(breadcrumbUrl, {
        headers: { 'Authorization': authHeader || '' }
      });
      
      if (!breadcrumbResponse.ok) {
        throw new Error(`Failed to get breadcrumb: ${breadcrumbResponse.status}`);
      }
      
      const triggerBreadcrumb = await breadcrumbResponse.json();
      
      // Find matching agent definitions
      const agentDefinitions = await findMatchingAgents(client, triggerBreadcrumb, workspace);
      
      // Process each matching agent
      for (const agentDef of agentDefinitions) {
        await processAgentExecution(client, triggerBreadcrumb, agentDef, workspace);
      }
      
      processingStatus.set(breadcrumbId, 'completed');
      
    } catch (error) {
      console.error('Failed to process event for agents:', error);
      processingStatus.set(breadcrumbId, 'completed');
    }
  }
}

// ============ DIRECT API HELPERS ============

async function createBreadcrumbDirect(
  client: RcrtClientEnhanced,
  breadcrumb: any
): Promise<{ id: string }> {
  // Get the token from the client's default headers
  const authHeader = (client as any).defaultHeaders?.Authorization;
  
  const response = await fetch(`${client.baseUrl}/breadcrumbs`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader || '',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(breadcrumb)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create breadcrumb: ${error}`);
  }
  
  return response.json();
}

// ============ AGENT PROCESSING ============

async function findMatchingAgents(
  client: RcrtClientEnhanced, 
  triggerBreadcrumb: any, 
  workspace: string
): Promise<AgentDefinition[]> {
  try {
    // Search for agent definitions using direct API call (bypass SDK)
    console.log('🔍 Searching for agent definitions...');
    const searchUrl = `${client.baseUrl}/breadcrumbs?tag=agent:definition`;
    console.log('🔍 Direct API call:', searchUrl);
    
    const authHeader = (client as any).defaultHeaders?.Authorization;
    const response = await fetch(searchUrl, {
      headers: { 'Authorization': authHeader || '' }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to search for agent definitions: ${response.status}`);
    }
    
    const agentBreadcrumbs = await response.json();
    console.log(`🔍 Found ${agentBreadcrumbs.length} agent definitions`);
    
    const matchingAgents: AgentDefinition[] = [];
    
    for (const agentBreadcrumb of agentBreadcrumbs) {
      const agentDef = agentBreadcrumb.context as AgentDefinition;
      
      if (agentDef && agentDef.triggers) {
        for (const trigger of agentDef.triggers) {
          if (await matchesSelector(triggerBreadcrumb, trigger.selector)) {
            console.log(`🎯 Agent ${agentDef.agent_name} matches trigger`);
            matchingAgents.push(agentDef);
            break; // Only match once per agent
          }
        }
      }
    }
    
    return matchingAgents;
  } catch (error) {
    console.error('Error finding matching agents:', error);
    return [];
  }
}

async function matchesSelector(breadcrumb: any, selector: any): Promise<boolean> {
  // Check tag matches
  if (selector.any_tags) {
    const hasAnyTag = selector.any_tags.some((tag: string) => 
      breadcrumb.tags?.includes(tag)
    );
    if (!hasAnyTag) return false;
  }
  
  if (selector.all_tags) {
    const hasAllTags = selector.all_tags.every((tag: string) => 
      breadcrumb.tags?.includes(tag)
    );
    if (!hasAllTags) return false;
  }
  
  // Check context matches
  if (selector.context_match) {
    for (const match of selector.context_match) {
      const value = getNestedValue(breadcrumb.context, match.path);
      
      switch (match.op) {
        case 'eq':
          if (value !== match.value) return false;
          break;
        case 'contains_any':
          if (!Array.isArray(match.value)) return false;
          const strValue = String(value || '').toLowerCase();
          const hasAny = match.value.some((v: any) => 
            strValue.includes(String(v).toLowerCase())
          );
          if (!hasAny) return false;
          break;
        case 'gt':
          if (!(value > match.value)) return false;
          break;
        case 'lt':
          if (!(value < match.value)) return false;
          break;
      }
    }
  }
  
  return true;
}

function getNestedValue(obj: any, path: string): any {
  // Simple JSONPath-like extraction (supports $.field.subfield)
  const keys = path.replace(/^\$\./, '').split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object') {
      current = current[key];
    } else {
      return undefined;
    }
  }
  
  return current;
}

async function processAgentExecution(
  client: RcrtClientEnhanced,
  triggerBreadcrumb: any,
  agentDef: AgentDefinition,
  workspace: string
): Promise<void> {
  console.log(`🤖 Processing agent: ${agentDef.agent_name}`);
  
  try {
    // 1. Use the breadcrumb context directly (API already provides LLM-ready context)
    // No complex context gathering needed!
    
    // 2. Call LLM with simple breadcrumb context
    const llmResponse = await callLLM(client, agentDef.llm_config, triggerBreadcrumb);
    
    // 3. Process structured response
    await processLLMResponse(client, llmResponse, agentDef, triggerBreadcrumb, workspace);
    
    console.log(`✅ Agent ${agentDef.agent_name} completed successfully`);
    
  } catch (error) {
    console.error(`❌ Agent ${agentDef.agent_name} failed:`, error);
    
    // Create error response using direct API
    await createBreadcrumbDirect(client, {
      schema_name: 'agent.response.v1',
      title: `${agentDef.agent_name} Error`,
      tags: ['agent:response', 'agent:error', workspace],
      context: {
        agent_name: agentDef.agent_name,
        response_to: triggerBreadcrumb.id,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
}

// No complex context gathering function needed!
// The breadcrumb context from GET /breadcrumbs/{id} is already designed for LLM usage

async function callLLM(
  client: RcrtClientEnhanced,
  llmConfig: AgentDefinition['llm_config'],
  triggerBreadcrumb: any
): Promise<LLMResponse> {
  // Simple approach - just use the breadcrumb context directly!
  
  const contextText = `**Breadcrumb Context:**
Title: ${triggerBreadcrumb.title}
Tags: ${triggerBreadcrumb.tags?.join(', ') || 'none'}
Context: ${JSON.stringify(triggerBreadcrumb.context, null, 2)}`;
  
  // Create a tool request for the existing OpenRouter LLM tool using direct API
  const toolRequest = await createBreadcrumbDirect(client, {
    schema_name: 'tool.request.v1',
    title: 'LLM Request for Agent',
    tags: ['tool:request', 'workspace:tools'],
    context: {
      tool: 'openrouter',
      input: {
        messages: [
          {
            role: 'system',
            content: llmConfig.system_prompt + '\n\nPlease respond with valid JSON matching the required schema.'
          },
          {
            role: 'user',
            content: contextText
          }
        ],
        model: llmConfig.model || 'google/gemini-2.5-flash',
        temperature: 0.7,
        max_tokens: 4000
      }
    }
  });
  
  // Wait for LLM response (simplified - in production would use proper event listening)
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    // Look for the most recent tool response from openrouter using direct API
    const responseUrl = `${client.baseUrl}/breadcrumbs?tag=tool:response`;
    const authHeader = (client as any).defaultHeaders?.Authorization;
    const responseSearch = await fetch(responseUrl, {
      headers: { 'Authorization': authHeader || '' }
    });
    
    if (!responseSearch.ok) {
      throw new Error(`Failed to search for tool responses: ${responseSearch.status}`);
    }
    
    const responses = await responseSearch.json();
    
    // Find the response that matches our request
    const matchingResponse = responses.find((r: any) => 
      r.context?.tool === 'openrouter' && 
      r.context?.status === 'success'
    );
    
    if (matchingResponse) {
      const output = matchingResponse.context?.output;
      
      if (output && output.content) {
        try {
          // Try to parse as JSON first (for structured responses)
          const parsed = JSON.parse(output.content);
          return parsed as LLMResponse;
        } catch (parseError) {
          // If not JSON, treat as plain text response
          console.warn('LLM returned non-JSON response, wrapping in response_text');
          return {
            response_text: output.content || 'LLM response received but could not parse',
            confidence: 0.7
          };
        }
      }
    }
    
    // Fallback response
    return {
      response_text: 'I processed your request but encountered an issue getting a proper response.',
      confidence: 0.1
    };
    
  } catch (error) {
    console.error('Error getting LLM response:', error);
    return {
      response_text: 'I encountered an error while processing your request.',
      confidence: 0
    };
  }
}

// No complex formatting needed - just use breadcrumb context directly!

async function processLLMResponse(
  client: RcrtClientEnhanced,
  llmResponse: LLMResponse,
  agentDef: AgentDefinition,
  triggerBreadcrumb: any,
  workspace: string
): Promise<void> {
  // Create agent response breadcrumb using direct API
  await createBreadcrumbDirect(client, {
    schema_name: 'agent.response.v1',
    title: `${agentDef.agent_name} Response`,
    tags: ['agent:response', workspace],
    context: {
      agent_name: agentDef.agent_name,
      response_to: triggerBreadcrumb.id,
      content: llmResponse.response_text,
      confidence: llmResponse.confidence || 0.8,
      timestamp: new Date().toISOString()
    }
  });
  
  // Invoke tools if requested
  if (llmResponse.tools_to_invoke) {
    for (const toolRequest of llmResponse.tools_to_invoke) {
      console.log(`🛠️ Agent ${agentDef.agent_name} invoking tool: ${toolRequest.tool}`);
      
      await createBreadcrumbDirect(client, {
        schema_name: 'tool.request.v1',
        title: `Tool Request: ${toolRequest.tool}`,
        tags: ['tool:request', 'workspace:tools'],
        context: {
          tool: toolRequest.tool,
          input: toolRequest.input,
          requested_by: agentDef.agent_name,
          reason: toolRequest.reason || 'Agent decision',
          agent_request_id: triggerBreadcrumb.id
        }
      });
    }
  }
  
  // Create additional breadcrumbs if requested
  if (llmResponse.create_breadcrumbs) {
    for (const breadcrumb of llmResponse.create_breadcrumbs) {
      console.log(`📝 Agent ${agentDef.agent_name} creating breadcrumb: ${breadcrumb.title}`);
      
      await createBreadcrumbDirect(client, {
        schema_name: breadcrumb.schema_name || 'agent.created.v1',
        title: breadcrumb.title,
        tags: [...(breadcrumb.tags || []), workspace, `created-by:${agentDef.agent_name}`],
        context: {
          ...breadcrumb.context,
          created_by_agent: agentDef.agent_name,
          created_from: triggerBreadcrumb.id,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
}

// ============ MAIN ============

dotenv.config();

const config = {
  rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
  workspace: process.env.WORKSPACE || 'workspace:agents',
  deploymentMode: process.env.DEPLOYMENT_MODE || 'local',
};

async function main() {
  console.log('🤖 RCRT Agent Runner starting...');
  console.log('Configuration:', config);
  
  if (config.deploymentMode === 'docker') {
    console.log('Waiting for services to be ready...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  try {
    const tokenRequest = {
      owner_id: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
      agent_id: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000AAA',
      roles: ['curator', 'emitter', 'subscriber']
    };
    
    const resp = await fetch(`${config.rcrtBaseUrl}/auth/token`, { 
      method: 'POST', 
      headers: { 'content-type': 'application/json' }, 
      body: JSON.stringify(tokenRequest)
    });
    
    if (!resp.ok) {
      throw new Error(`Token request failed: ${resp.status}`);
    }
    
    const json = await resp.json();
    const jwtToken = json?.token;
    
    if (!jwtToken) {
      throw new Error('No token in response');
    }
    
    console.log('✅ Obtained JWT token for agent runner');
    
    const client = new RcrtClientEnhanced(config.rcrtBaseUrl, 'jwt', jwtToken, {
      autoRefresh: true
    });

    console.log('✅ Connected to RCRT');

    console.log('✅ Agent runner initialized (no registry needed - agents are data!)');

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down agent runner...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down agent runner...');
      process.exit(0);
    });

    console.log('🚀 Agent runner ready - listening for agent execution events');
    console.log(`🤖 Workspace: ${config.workspace}`);
    
    await startAgentSSEDispatcher(client, config.workspace, jwtToken);
    
  } catch (error) {
    console.error('❌ Failed to start agent runner:', error);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// ES module equivalent of require.main === module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
