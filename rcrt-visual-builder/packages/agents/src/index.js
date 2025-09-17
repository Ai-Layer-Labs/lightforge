/**
 * RCRT Agent Framework
 * Execution engine for agent definitions stored as breadcrumbs
 */

// ============ AGENT EXECUTION ENGINE ============

export class AgentExecutionEngine {
  constructor(client) {
    this.client = client;
    this.executionHistory = new Map();
  }
  
  async findTriggeredAgentDefinitions(triggerBreadcrumb) {
    try {
      const breadcrumbs = await this.client.listBreadcrumbs();
      const agentDefs = breadcrumbs.filter(b => 
        b.tags?.includes('agent:definition') && 
        b.schema_name === 'agent.definition.v1'
      );
      
      console.log(`🔍 Found ${agentDefs.length} agent definitions`);
      
      const triggeredDefs = [];
      
      for (const breadcrumb of agentDefs) {
        try {
          const fullBreadcrumb = await this.client.getBreadcrumb(breadcrumb.id);
          
          for (const trigger of fullBreadcrumb.context.triggers || []) {
            if (this.matchesTrigger(triggerBreadcrumb, trigger)) {
              if (this.checkRateLimit(fullBreadcrumb, trigger)) {
                triggeredDefs.push(fullBreadcrumb);
                console.log(`🎯 Agent ${fullBreadcrumb.context.agent_name} triggered by: ${triggerBreadcrumb.title}`);
                break;
              } else {
                console.log(`⏰ Agent ${fullBreadcrumb.context.agent_name} rate limited`);
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
  
  async executeAgentDefinition(agentDef, triggerBreadcrumb, workspace) {
    console.log(`🤖 Executing agent: ${agentDef.context.agent_name}`);
    
    const startTime = Date.now();
    const executionContext = {
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
      
    } catch (error) {
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
  
  matchesTrigger(breadcrumb, trigger) {
    const selector = trigger.selector;
    
    const anyTagsMatch = !selector.any_tags || 
      selector.any_tags.some(tag => breadcrumb.tags?.includes(tag));
    
    const allTagsMatch = !selector.all_tags || 
      selector.all_tags.every(tag => breadcrumb.tags?.includes(tag));
    
    const schemaMatch = !selector.schema_name || 
      breadcrumb.schema_name === selector.schema_name;
    
    return anyTagsMatch && allTagsMatch && schemaMatch;
  }
  
  checkRateLimit(agentDef, trigger) {
    const maxExecutions = trigger.conditions?.max_executions_per_hour;
    if (!maxExecutions) return true;
    
    const agentName = agentDef.context.agent_name;
    const executions = this.executionHistory.get(agentName) || [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const recentExecutions = executions.filter(date => date > oneHourAgo);
    return recentExecutions.length < maxExecutions;
  }
  
  recordExecution(agentName) {
    const executions = this.executionHistory.get(agentName) || [];
    executions.push(new Date());
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filtered = executions.filter(date => date > oneDayAgo);
    
    this.executionHistory.set(agentName, filtered);
  }
  
  createExecutionSandbox(context) {
    return {
      getSecret: async (secretName, reason) => {
        const secrets = await context.rcrtClient.listSecrets();
        const secret = secrets.find(s => s.name.toLowerCase() === secretName.toLowerCase());
        if (!secret) throw new Error(`Secret "${secretName}" not found`);
        
        const decrypted = await context.rcrtClient.getSecret(
          secret.id, 
          reason || `Agent:${context.agentEntityId}`
        );
        return decrypted.value;
      },
      
      invokeTool: async (toolName, toolInput) => {
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
      
      searchBreadcrumbs: async (query, filters = {}) => {
        const searchParams = new URLSearchParams({
          q: query,
          limit: (filters.limit || 10).toString()
        });
        
        const results = await fetch(`${context.rcrtClient.baseUrl}/breadcrumbs/search?${searchParams}`, {
          headers: { 'Authorization': `Bearer ${context.rcrtClient.token}` }
        });
        
        return results.ok ? await results.json() : [];
      },
      
      createBreadcrumb: async (breadcrumbData) => {
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
        log: (...args) => console.log(`[Agent:${context.agentEntityId}]`, ...args),
        warn: (...args) => console.warn(`[Agent:${context.agentEntityId}]`, ...args),
        error: (...args) => console.error(`[Agent:${context.agentEntityId}]`, ...args)
      }
    };
  }
  
  async executeCode(code, triggerBreadcrumb, sandbox) {
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
      
    } catch (error) {
      throw new Error(`Agent code execution failed: ${error.message}`);
    }
  }
}

export class AgentRegistry {
  constructor(client, workspace) {
    this.executionEngine = new AgentExecutionEngine(client);
    this.workspace = workspace;
  }

  async processEvent(triggerBreadcrumb) {
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

export async function createAgentRegistry(client, workspace) {
  return new AgentRegistry(client, workspace);
}
