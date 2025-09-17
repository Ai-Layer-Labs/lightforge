/**
 * RCRT Agent Framework
 * Execution engine for agent definitions stored as breadcrumbs
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

// ============ CORE INTERFACES ============

export interface AgentExecutionContext {
  rcrtClient: RcrtClientEnhanced;
  agentEntityId: string;
  workspace: string;
  metadata: {
    requestId: string;
    triggeredBy: string;
    timestamp: string;
    agentDefinitionId: string;
  };
}

export interface AgentDefinitionBreadcrumb {
  id: string;
  title: string;
  tags: string[];
  schema_name: 'agent.definition.v1';
  context: {
    agent_name: string;
    description: string;
    version: string;
    category: string;
    agent_entity_id?: string;
    
    triggers: Array<{
      selector: {
        any_tags?: string[];
        all_tags?: string[];
        schema_name?: string;
      };
      conditions?: {
        max_executions_per_hour?: number;
        cooldown_seconds?: number;
      };
    }>;
    
    capabilities: {
      can_create: boolean;
      can_modify: boolean;
      can_use_tools: boolean;
      can_create_agents: boolean;
      max_execution_time: number;
    };
    
    execution: {
      type: 'javascript';
      code: string;
    };
  };
}

// ============ AGENT EXECUTION ENGINE ============

export class AgentExecutionEngine {
  private executionHistory = new Map<string, Date[]>();
  
  constructor(private client: RcrtClientEnhanced) {}
  
  async findTriggeredAgentDefinitions(triggerBreadcrumb: any): Promise<AgentDefinitionBreadcrumb[]> {
    try {
      const breadcrumbs = await this.client.listBreadcrumbs();
      const agentDefs = breadcrumbs.filter((b: any) => 
        b.tags?.includes('agent:definition') && 
        b.schema_name === 'agent.definition.v1'
      );
      
      console.log(`🔍 Found ${agentDefs.length} agent definitions`);
      
      const triggeredDefs: AgentDefinitionBreadcrumb[] = [];
      
      for (const breadcrumb of agentDefs) {
        try {
          const fullBreadcrumb = await this.client.getBreadcrumb(breadcrumb.id);
          const agentDef = fullBreadcrumb as AgentDefinitionBreadcrumb;
          
          for (const trigger of agentDef.context.triggers || []) {
            if (this.matchesTrigger(triggerBreadcrumb, trigger)) {
              if (this.checkRateLimit(agentDef, trigger)) {
                triggeredDefs.push(agentDef);
                console.log(`🎯 Agent ${agentDef.context.agent_name} triggered by: ${triggerBreadcrumb.title}`);
                break;
              } else {
                console.log(`⏰ Agent ${agentDef.context.agent_name} rate limited`);
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to check agent definition ${breadcrumb.title}:`, error);
        }
      }
      
      return triggeredDefs;
    } catch (error) {
      console.error('Failed to find triggered agent definitions:', error);
      return [];
    }
  }
  
  async executeAgentDefinition(
    agentDef: AgentDefinitionBreadcrumb,
    triggerBreadcrumb: any,
    workspace: string
  ): Promise<any> {
    console.log(`🤖 Executing agent: ${agentDef.context.agent_name}`);
    
    const startTime = Date.now();
    const executionContext: AgentExecutionContext = {
      rcrtClient: this.client,
      agentEntityId: agentDef.context.agent_entity_id || 'unknown',
      workspace: workspace,
      metadata: {
        requestId: triggerBreadcrumb.id,
        triggeredBy: triggerBreadcrumb.title,
        timestamp: new Date().toISOString(),
        agentDefinitionId: agentDef.id
      }
    };
    
    try {
      const sandbox = this.createExecutionSandbox(executionContext);
      const result = await this.executeCode(agentDef.context.execution.code, triggerBreadcrumb, sandbox);
      
      const executionTime = Date.now() - startTime;
      this.recordExecution(agentDef.context.agent_name);
      
      console.log(`✅ Agent ${agentDef.context.agent_name} executed successfully in ${executionTime}ms`);
      
      return {
        status: 'success',
        output: result,
        execution_time_ms: executionTime,
        agent_name: agentDef.context.agent_name,
        agent_definition_id: agentDef.id
      };
      
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ Agent ${agentDef.context.agent_name} execution failed:`, error);
      
      await this.client.createBreadcrumb({
        schema_name: 'agent.response.v1',
        title: `Agent Error: ${agentDef.context.agent_name}`,
        tags: [workspace, 'agent:response', 'agent:error'],
        context: {
          agent_name: agentDef.context.agent_name,
          agent_definition_id: agentDef.id,
          triggered_by: triggerBreadcrumb.id,
          status: 'error',
          error: error.message,
          execution_time_ms: executionTime,
          timestamp: new Date().toISOString()
        }
      });
      
      throw error;
    }
  }
  
  private matchesTrigger(breadcrumb: any, trigger: any): boolean {
    const selector = trigger.selector;
    
    console.log(`🔍 Trigger matching debug:`, {
      breadcrumbTitle: breadcrumb.title,
      breadcrumbTags: breadcrumb.tags,
      breadcrumbSchema: breadcrumb.schema_name,
      selectorAnyTags: selector.any_tags,
      selectorAllTags: selector.all_tags,
      selectorSchema: selector.schema_name
    });
    
    const anyTagsMatch = !selector.any_tags || 
      selector.any_tags.some((tag: string) => breadcrumb.tags?.includes(tag));
    
    const allTagsMatch = !selector.all_tags || 
      selector.all_tags.every((tag: string) => breadcrumb.tags?.includes(tag));
    
    const schemaMatch = !selector.schema_name || 
      breadcrumb.schema_name === selector.schema_name;
    
    console.log(`🔍 Match results:`, {
      anyTagsMatch,
      allTagsMatch, 
      schemaMatch,
      finalResult: anyTagsMatch && allTagsMatch && schemaMatch
    });
    
    return anyTagsMatch && allTagsMatch && schemaMatch;
  }
  
  private checkRateLimit(agentDef: AgentDefinitionBreadcrumb, trigger: any): boolean {
    const maxExecutions = trigger.conditions?.max_executions_per_hour;
    if (!maxExecutions) return true;
    
    const agentName = agentDef.context.agent_name;
    const executions = this.executionHistory.get(agentName) || [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const recentExecutions = executions.filter(date => date > oneHourAgo);
    return recentExecutions.length < maxExecutions;
  }
  
  private recordExecution(agentName: string): void {
    const executions = this.executionHistory.get(agentName) || [];
    executions.push(new Date());
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filtered = executions.filter(date => date > oneDayAgo);
    
    this.executionHistory.set(agentName, filtered);
  }
  
  private createExecutionSandbox(context: AgentExecutionContext): any {
    return {
      getSecret: async (secretName: string, reason?: string) => {
        const secrets = await context.rcrtClient.listSecrets();
        const secret = secrets.find((s: any) => s.name.toLowerCase() === secretName.toLowerCase());
        if (!secret) throw new Error(`Secret "${secretName}" not found`);
        
        const decrypted = await context.rcrtClient.getSecret(
          secret.id, 
          reason || `Agent:${context.agentEntityId}`
        );
        return decrypted.value;
      },
      
      invokeTool: async (toolName: string, toolInput: any) => {
        const toolRequest = await context.rcrtClient.createBreadcrumb({
          schema_name: 'tool.request.v1',
          title: `Agent Tool Request: ${toolName}`,
          tags: [context.workspace, 'tool:request', 'agent:tool-call'],
          context: {
            tool: toolName,
            input: toolInput,
            requested_by_agent: context.agentEntityId
          }
        });
        
        return { 
          tool_request_id: toolRequest.id,
          status: 'requested'
        };
      },
      
      searchBreadcrumbs: async (query: string, filters?: any) => {
        const searchParams = new URLSearchParams({
          q: query,
          limit: (filters?.limit || 10).toString()
        });
        
        const results = await fetch(`${context.rcrtClient.baseUrl}/breadcrumbs/search?${searchParams}`, {
          headers: { 'Authorization': `Bearer ${context.rcrtClient.token}` }
        });
        
        return results.ok ? await results.json() : [];
      },
      
      createBreadcrumb: async (breadcrumbData: any) => {
        return await context.rcrtClient.createBreadcrumb({
          schema_name: 'agent.response.v1',
          tags: [context.workspace, 'agent:response'],
          ...breadcrumbData,
          context: {
            agent_definition_id: context.metadata.agentDefinitionId,
            triggered_by: context.metadata.requestId,
            ...breadcrumbData.context
          }
        });
      },
      
      console: {
        log: (...args: any[]) => console.log(`[Agent:${context.agentEntityId}]`, ...args),
        warn: (...args: any[]) => console.warn(`[Agent:${context.agentEntityId}]`, ...args),
        error: (...args: any[]) => console.error(`[Agent:${context.agentEntityId}]`, ...args)
      }
    };
  }
  
  private async executeCode(code: string, triggerBreadcrumb: any, sandbox: any): Promise<any> {
    try {
      const agentFunction = new Function(
        'triggerBreadcrumb', 
        'getSecret',
        'invokeTool', 
        'searchBreadcrumbs',
        'createBreadcrumb',
        'console',
        `return (async function() { ${code} })();`
      );
      
      const result = await Promise.race([
        agentFunction(
          triggerBreadcrumb,
          sandbox.getSecret,
          sandbox.invokeTool,
          sandbox.searchBreadcrumbs,
          sandbox.createBreadcrumb,
          sandbox.console
        ),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Agent execution timeout')), 30000)
        )
      ]);
      
      return result;
      
    } catch (error: any) {
      throw new Error(`Agent code execution failed: ${error.message}`);
    }
  }
}

export class AgentRegistry {
  private executionEngine: AgentExecutionEngine;

  constructor(client: RcrtClientEnhanced, private workspace: string) {
    this.executionEngine = new AgentExecutionEngine(client);
  }

  async processEvent(triggerBreadcrumb: any): Promise<void> {
    try {
      const triggeredAgents = await this.executionEngine.findTriggeredAgentDefinitions(triggerBreadcrumb);
      
      if (triggeredAgents.length === 0) {
        console.log(`📋 No agents triggered by: ${triggerBreadcrumb.title}`);
        return;
      }
      
      console.log(`🤖 Found ${triggeredAgents.length} agents triggered by: ${triggerBreadcrumb.title}`);
      
      for (const agentDef of triggeredAgents) {
        try {
          await this.executionEngine.executeAgentDefinition(
            agentDef, 
            triggerBreadcrumb, 
            this.workspace
          );
        } catch (error) {
          console.error(`Failed to execute agent ${agentDef.context.agent_name}:`, error);
        }
      }
      
    } catch (error) {
      console.error('Failed to process event for agents:', error);
    }
  }
}

export async function createAgentRegistry(
  client: RcrtClientEnhanced,
  workspace: string
): Promise<AgentRegistry> {
  return new AgentRegistry(client, workspace);
}
