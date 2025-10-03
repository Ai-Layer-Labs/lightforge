/**
 * Context-Builder Usage Examples
 * Demonstrates scalable context assembly patterns
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

/**
 * Example 1: Chat Agent Context
 * Updates on every user message with vector-based history
 */
export async function setupChatAgentContext(
  client: RcrtClientEnhanced,
  agentId: string = 'default-chat-assistant'
) {
  const config = await client.createBreadcrumb({
    schema_name: 'context.config.v1',
    title: `Context Config for ${agentId}`,
    tags: ['context:config', `consumer:${agentId}`, 'workspace:agents'],
    context: {
      consumer_id: agentId,
      consumer_type: 'agent',
      
      sources: [
        // Vector search for semantically relevant chat history
        {
          schema_name: 'user.message.v1',
          method: 'vector',
          nn: 5,
          filters: { tag: 'workspace:agents' }
        },
        // Recent tool responses (for follow-up questions)
        {
          schema_name: 'tool.response.v1',
          method: 'recent',
          limit: 3,
          filters: {
            context_match: [{ 
              path: '$.requestedBy', 
              op: 'eq', 
              value: agentId 
            }]
          }
        },
        // Tool catalog (static, updated rarely)
        {
          schema_name: 'tool.catalog.v1',
          method: 'latest',
          filters: { tag: 'workspace:tools' }
        }
      ],
      
      update_triggers: [
        // Update when user sends message
        { schema_name: 'user.message.v1', any_tags: ['workspace:agents'] },
        // Update when tools respond
        { schema_name: 'tool.response.v1', context_match: [{ 
          path: '$.requestedBy', 
          op: 'eq', 
          value: agentId 
        }]}
      ],
      
      output: {
        schema_name: 'agent.context.v1',
        tags: ['agent:context', `consumer:${agentId}`],
        ttl_seconds: 3600
      },
      
      formatting: {
        max_tokens: 4000,
        include_metadata: false,
        deduplication_threshold: 0.95
      }
    }
  });
  
  console.log(`✅ Created context config for ${agentId}: ${config.id}`);
  
  // Register with context-builder
  const result = await client.createBreadcrumb({
    schema_name: 'tool.request.v1',
    tags: ['tool:request', 'workspace:tools'],
    context: {
      tool: 'context-builder',
      input: {
        action: 'register',
        config_id: config.id
      },
      requestId: `register-${agentId}-${Date.now()}`
    }
  });
  
  return { configId: config.id, registrationId: result.id };
}

/**
 * Example 2: Multi-Agent Research Team
 * Supervisor sees all team activity
 */
export async function setupResearchTeamContexts(client: RcrtClientEnhanced) {
  // Researcher context
  const researcherConfig = await client.createBreadcrumb({
    schema_name: 'context.config.v1',
    title: 'Researcher Agent Context',
    tags: ['context:config', 'consumer:researcher-agent'],
    context: {
      consumer_id: 'researcher-agent',
      consumer_type: 'agent',
      
      sources: [
        // Current research task
        {
          schema_name: 'research.task.v1',
          method: 'latest',
          filters: { context_match: [{ path: '$.assignedTo', op: 'eq', value: 'researcher-agent' }] }
        },
        // Vector search for relevant documents
        {
          schema_name: 'document.v1',
          method: 'vector',
          nn: 10
        },
        // Supervisor feedback
        {
          schema_name: 'supervisor.feedback.v1',
          method: 'recent',
          limit: 3,
          filters: { context_match: [{ path: '$.target', op: 'eq', value: 'researcher-agent' }] }
        }
      ],
      
      update_triggers: [
        { schema_name: 'research.task.v1' },
        { schema_name: 'supervisor.feedback.v1', context_match: [{ path: '$.target', op: 'eq', value: 'researcher-agent' }] }
      ],
      
      output: {
        schema_name: 'agent.context.v1',
        tags: ['agent:context', 'consumer:researcher-agent']
      }
    }
  });
  
  // Supervisor context
  const supervisorConfig = await client.createBreadcrumb({
    schema_name: 'context.config.v1',
    title: 'Supervisor Agent Context',
    tags: ['context:config', 'consumer:supervisor-agent'],
    context: {
      consumer_id: 'supervisor-agent',
      consumer_type: 'agent',
      
      sources: [
        // All research results from team
        {
          schema_name: 'research.result.v1',
          method: 'recent',
          limit: 20,
          filters: { tag: 'workspace:research-team' }
        },
        // All task statuses
        {
          schema_name: 'task.status.v1',
          method: 'all',
          filters: { tag: 'workspace:research-team' }
        },
        // Team metrics
        {
          schema_name: 'agent.metrics.v1',
          method: 'latest',
          filters: { tag: 'workspace:research-team' }
        }
      ],
      
      update_triggers: [
        { schema_name: 'research.result.v1', any_tags: ['workspace:research-team'] },
        { schema_name: 'task.status.v1', any_tags: ['workspace:research-team'] }
      ],
      
      output: {
        schema_name: 'agent.context.v1',
        tags: ['agent:context', 'consumer:supervisor-agent']
      },
      
      formatting: {
        max_tokens: 8000  // Supervisor needs more context
      }
    }
  });
  
  return { 
    researcherConfigId: researcherConfig.id,
    supervisorConfigId: supervisorConfig.id
  };
}

/**
 * Example 3: Long-Running Workflow Context
 * Preserves state across hours/days
 */
export async function setupWorkflowContext(
  client: RcrtClientEnhanced,
  workflowId: string
) {
  const config = await client.createBreadcrumb({
    schema_name: 'context.config.v1',
    title: `Workflow Context for ${workflowId}`,
    tags: ['context:config', `consumer:${workflowId}`],
    context: {
      consumer_id: workflowId,
      consumer_type: 'workflow',
      
      sources: [
        // Workflow state (checkpointing)
        {
          schema_name: 'workflow.state.v1',
          method: 'tagged',
          filters: { tag: `workflow:${workflowId}` }
        },
        // Completed steps (preserve order)
        {
          schema_name: 'workflow.step.complete.v1',
          method: 'all',
          filters: { tag: `workflow:${workflowId}` }
        },
        // Error history (for recovery)
        {
          schema_name: 'workflow.error.v1',
          method: 'recent',
          limit: 5,
          filters: { tag: `workflow:${workflowId}` }
        },
        // Vector search for related workflows (learning)
        {
          schema_name: 'workflow.result.v1',
          method: 'vector',
          nn: 3,
          filters: { tag: 'status:completed' }
        }
      ],
      
      update_triggers: [
        { schema_name: 'workflow.state.v1', any_tags: [`workflow:${workflowId}`] },
        { schema_name: 'workflow.step.complete.v1', any_tags: [`workflow:${workflowId}`] },
        { schema_name: 'workflow.error.v1', any_tags: [`workflow:${workflowId}`] }
      ],
      
      output: {
        schema_name: 'workflow.context.v1',
        tags: ['workflow:context', `consumer:${workflowId}`],
        ttl_seconds: 86400  // 24 hours for long-running workflows
      },
      
      formatting: {
        max_tokens: 10000,  // Workflows need detailed history
        include_metadata: true
      }
    }
  });
  
  return { configId: config.id };
}

/**
 * Example 4: Human User Context (Browser Extension)
 */
export async function setupUserContext(
  client: RcrtClientEnhanced,
  userId: string
) {
  const config = await client.createBreadcrumb({
    schema_name: 'context.config.v1',
    title: `User Context for ${userId}`,
    tags: ['context:config', `consumer:${userId}`],
    context: {
      consumer_id: userId,
      consumer_type: 'human',
      
      sources: [
        // User's conversation history
        {
          schema_name: 'user.message.v1',
          method: 'recent',
          limit: 20,
          filters: { context_match: [{ path: '$.user_id', op: 'eq', value: userId }] }
        },
        // Responses to user
        {
          schema_name: 'agent.response.v1',
          method: 'recent',
          limit: 10,
          filters: { context_match: [{ path: '$.recipient', op: 'eq', value: userId }] }
        },
        // User's documents (vector search on query)
        {
          schema_name: 'document.v1',
          method: 'vector',
          nn: 5,
          filters: { context_match: [{ path: '$.owner', op: 'eq', value: userId }] }
        }
      ],
      
      update_triggers: [
        { schema_name: 'user.message.v1', context_match: [{ path: '$.user_id', op: 'eq', value: userId }] },
        { schema_name: 'agent.response.v1', context_match: [{ path: '$.recipient', op: 'eq', value: userId }] }
      ],
      
      output: {
        schema_name: 'user.context.v1',
        tags: ['user:context', `consumer:${userId}`]
      },
      
      formatting: {
        max_tokens: 6000
      }
    }
  });
  
  return { configId: config.id };
}

/**
 * Example 5: Analytics Dashboard Context
 * Time-windowed aggregation
 */
export async function setupAnalyticsContext(client: RcrtClientEnhanced) {
  const config = await client.createBreadcrumb({
    schema_name: 'context.config.v1',
    title: 'Analytics Dashboard Context',
    tags: ['context:config', 'consumer:analytics-dashboard'],
    context: {
      consumer_id: 'analytics-dashboard',
      consumer_type: 'dashboard',
      
      sources: [
        // All tool executions (last hour)
        {
          schema_name: 'tool.response.v1',
          method: 'recent',
          limit: 1000,
          filters: { 
            // Would need time-based filtering in real implementation
            tag: 'workspace:tools'
          }
        },
        // Agent metrics
        {
          schema_name: 'agent.metrics.v1',
          method: 'all'
        },
        // System health
        {
          schema_name: 'system.hygiene.v1',
          method: 'latest'
        }
      ],
      
      update_triggers: [
        // Update every 5 minutes (could use a cron breadcrumb)
        { schema_name: 'system.cron.v1', context_match: [{ path: '$.schedule', op: 'eq', value: '*/5 * * * *' }] }
      ],
      
      output: {
        schema_name: 'analytics.context.v1',
        tags: ['analytics:context', 'consumer:analytics-dashboard']
      },
      
      formatting: {
        max_tokens: 16000  // Dashboards can handle large context
      }
    }
  });
  
  return { configId: config.id };
}

/**
 * Utility: Create context config from template
 */
export async function createContextConfig(
  client: RcrtClientEnhanced,
  consumerId: string,
  template: 'chat-agent' | 'workflow' | 'supervisor' | 'analytics' | 'custom',
  customConfig?: Partial<any>
): Promise<{ id: string }> {
  const templates = {
    'chat-agent': {
      sources: [
        { schema_name: 'user.message.v1', method: 'vector', nn: 5 },
        { schema_name: 'tool.response.v1', method: 'recent', limit: 3 },
        { schema_name: 'tool.catalog.v1', method: 'latest' }
      ],
      update_triggers: [
        { schema_name: 'user.message.v1' },
        { schema_name: 'tool.response.v1' }
      ],
      formatting: { max_tokens: 4000 }
    },
    'workflow': {
      sources: [
        { schema_name: 'workflow.state.v1', method: 'tagged' },
        { schema_name: 'workflow.step.complete.v1', method: 'all' }
      ],
      update_triggers: [
        { schema_name: 'workflow.state.v1' },
        { schema_name: 'workflow.step.complete.v1' }
      ],
      formatting: { max_tokens: 10000, include_metadata: true }
    },
    'supervisor': {
      sources: [
        { schema_name: 'agent.response.v1', method: 'recent', limit: 20 },
        { schema_name: 'task.status.v1', method: 'all' }
      ],
      update_triggers: [
        { schema_name: 'agent.response.v1' },
        { schema_name: 'task.status.v1' }
      ],
      formatting: { max_tokens: 8000 }
    },
    'analytics': {
      sources: [
        { schema_name: 'system.metrics.v1', method: 'all' },
        { schema_name: 'agent.metrics.v1', method: 'all' }
      ],
      update_triggers: [
        { schema_name: 'system.cron.v1' }
      ],
      formatting: { max_tokens: 16000 }
    }
  };
  
  const baseConfig = templates[template] || templates['chat-agent'];
  
  return await client.createBreadcrumb({
    schema_name: 'context.config.v1',
    title: `Context Config for ${consumerId}`,
    tags: ['context:config', `consumer:${consumerId}`],
    context: {
      consumer_id: consumerId,
      consumer_type: template,
      ...baseConfig,
      ...customConfig,
      output: {
        schema_name: 'agent.context.v1',
        tags: ['agent:context', `consumer:${consumerId}`],
        ...customConfig?.output
      }
    }
  });
}

