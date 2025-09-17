import { Breadcrumb, Agent, Secret, Tool } from '../types/rcrt';

/**
 * Mock data for Dashboard v2 development and testing
 */

export const mockBreadcrumbs: Breadcrumb[] = [
  {
    id: 'breadcrumb-001',
    title: 'RCRT Dashboard v2 Configuration',
    context: {
      version: '2.0.0',
      default_view: '2d',
      real_time_updates: true,
      node_styles: {
        'chat.message.v1': { icon: '💬', color: '#00f5ff', size: 'small' },
        'agent.response.v1': { icon: '🤖', color: '#8a2be2', size: 'medium' }
      }
    },
    tags: ['dashboard:config', 'workspace:system'],
    schema_name: 'dashboard.config.v1',
    visibility: 'team',
    sensitivity: 'low',
    version: 1,
    checksum: 'abc123',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    created_by: 'agent-001',
    size_bytes: 1024,
  },
  
  {
    id: 'breadcrumb-002',
    title: 'Welcome to RCRT Dashboard v2!',
    context: {
      conversation_id: 'conv-welcome-001',
      sender: 'user',
      sender_id: 'user-001',
      content: 'Hello! Can you help me understand how RCRT works?',
      message_type: 'question',
      timestamp: '2024-01-15T10:30:00Z'
    },
    tags: ['chat:message', 'workspace:chat', 'user:input'],
    schema_name: 'chat.message.v1',
    visibility: 'team',
    sensitivity: 'low',
    version: 1,
    checksum: 'def456',
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-15T10:30:00Z',
    size_bytes: 512,
  },
  
  {
    id: 'breadcrumb-003',
    title: 'Agent Thinking: Understanding RCRT',
    context: {
      agent_id: 'agent-helpful-001',
      conversation_id: 'conv-welcome-001',
      parent_message_id: 'breadcrumb-002',
      thinking_step: 1,
      thought_process: 'User is asking about RCRT. I should explain the core concepts: breadcrumbs, agents, and real-time connections.',
      confidence: 0.85,
      next_actions: ['explain_concepts', 'provide_examples']
    },
    tags: ['agent:thinking', 'workspace:internal', 'agent:helpful'],
    schema_name: 'agent.thinking.v1',
    visibility: 'team',
    sensitivity: 'low',
    version: 1,
    checksum: 'ghi789',
    created_at: '2024-01-15T10:30:05Z',
    updated_at: '2024-01-15T10:30:05Z',
    created_by: 'agent-helpful-001',
    size_bytes: 768,
  },
  
  {
    id: 'breadcrumb-004',
    title: 'Agent Response: RCRT Explanation',
    context: {
      agent_id: 'agent-helpful-001',
      conversation_id: 'conv-welcome-001',
      responding_to: 'breadcrumb-002',
      content: 'RCRT (Right Context Right Time) is a system for managing contextual information through breadcrumbs. Think of breadcrumbs as smart memory units that can be searched, connected, and shared between agents.',
      response_type: 'explanation',
      confidence: 0.92,
      sources_used: ['docs/rcrt-overview.md']
    },
    tags: ['agent:response', 'workspace:chat', 'agent:helpful'],
    schema_name: 'agent.response.v1',
    visibility: 'team',
    sensitivity: 'low',
    version: 1,
    checksum: 'jkl012',
    created_at: '2024-01-15T10:30:15Z',
    updated_at: '2024-01-15T10:30:15Z',
    created_by: 'agent-helpful-001',
    size_bytes: 1536,
  },
  
  {
    id: 'breadcrumb-005',
    title: 'Chat Assistant Agent Definition',
    context: {
      agent_entity_id: 'agent-helpful-001',
      agent_name: 'chat-assistant',
      description: 'Helpful assistant for answering user questions about RCRT',
      category: 'intelligent',
      execution: {
        type: 'javascript',
        code: 'console.log("Processing user question:", triggerBreadcrumb.context.content);'
      },
      subscriptions: ['chat:message', 'user:input'],
      triggers: [{
        selector: {
          all_tags: ['chat:message', 'user:input']
        }
      }]
    },
    tags: ['agent:definition', 'workspace:agents'],
    schema_name: 'agent.definition.v1',
    visibility: 'team',
    sensitivity: 'low',
    version: 1,
    checksum: 'mno345',
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2024-01-15T09:00:00Z',
    created_by: 'agent-system-001',
    size_bytes: 2048,
  },
  
  {
    id: 'breadcrumb-006',
    title: 'Tool Request: OpenRouter LLM',
    context: {
      tool: 'openrouter',
      input: {
        model: 'anthropic/claude-3-sonnet',
        messages: [
          { role: 'user', content: 'Explain RCRT in simple terms' }
        ]
      },
      request_id: 'req-001'
    },
    tags: ['tool:request', 'workspace:tools'],
    schema_name: 'tool.request.v1',
    visibility: 'team',
    sensitivity: 'low',
    version: 1,
    checksum: 'pqr678',
    created_at: '2024-01-15T10:25:00Z',
    updated_at: '2024-01-15T10:25:00Z',
    created_by: 'agent-helpful-001',
    size_bytes: 896,
  },
  
  {
    id: 'breadcrumb-007',
    title: 'Tool Response: OpenRouter LLM',
    context: {
      tool: 'openrouter',
      request_id: 'req-001',
      status: 'success',
      output: {
        content: 'RCRT is a system for managing contextual information...',
        model: 'anthropic/claude-3-sonnet',
        usage: { prompt_tokens: 50, completion_tokens: 100 }
      }
    },
    tags: ['tool:response', 'workspace:tools'],
    schema_name: 'tool.response.v1',
    visibility: 'team',
    sensitivity: 'low',
    version: 1,
    checksum: 'stu901',
    created_at: '2024-01-15T10:25:10Z',
    updated_at: '2024-01-15T10:25:10Z',
    created_by: 'agent-tools-runner',
    size_bytes: 1280,
  }
];

export const mockAgents: Agent[] = [
  {
    id: 'agent-helpful-001',
    roles: ['emitter', 'subscriber', 'intelligent'],
    created_at: '2024-01-15T09:00:00Z',
  },
  
  {
    id: 'agent-tools-runner',
    roles: ['emitter', 'curator'],
    created_at: '2024-01-15T08:00:00Z',
  },
  
  {
    id: 'agent-system-001',
    roles: ['curator', 'emitter', 'subscriber'],
    created_at: '2024-01-15T08:00:00Z',
  }
];

export const mockSecrets: Secret[] = [
  {
    id: 'secret-001',
    name: 'OPENROUTER_API_KEY',
    scope_type: 'global',
    created_at: '2024-01-15T08:00:00Z',
  },
  
  {
    id: 'secret-002', 
    name: 'CLAUDE_API_KEY',
    scope_type: 'workspace',
    scope_id: 'workspace-tools',
    created_at: '2024-01-15T08:00:00Z',
  }
];

export const mockTools: Tool[] = [
  {
    name: 'openrouter',
    description: 'Access to multiple LLM models via OpenRouter API',
    parameters: {
      model: { type: 'string', required: true },
      messages: { type: 'array', required: true },
      temperature: { type: 'number', default: 0.7 }
    },
    required_secrets: ['OPENROUTER_API_KEY']
  },
  
  {
    name: 'calculator',
    description: 'Basic mathematical calculations',
    parameters: {
      expression: { type: 'string', required: true }
    }
  },
  
  {
    name: 'echo',
    description: 'Echo back the input for testing',
    parameters: {
      message: { type: 'string', required: true }
    }
  }
];
