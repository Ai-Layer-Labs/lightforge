# Phase 3: Agent Template System 🤖
**Status: FOCUSED ON SUPERVISOR → WORKER PATTERN** 🎯

## Overview
Create **simple agent templates** that enable **supervisor agents** to spawn **temporary worker agents** with automatic **hygiene system cleanup**. Keep templates simple but powerful.

---

## 🎯 **Goal: Simple Templates for Supervisor Agents**

### **Current: Manual Worker Creation** 
```typescript
// Supervisor manually creates each worker
await this.client.createBreadcrumb({
  schema_name: 'agent.def.v1',
  context: {
    agent_id: 'worker-123',
    thinking_llm_tool: 'openrouter', // Manual choice
    system_prompt: 'You are a researcher...', // Manual prompt
    ttl: '2025-01-10T14:00:00Z' // Manual expiry
  }
});
```

### **Target: Templates Create Breadcrumb Combinations**
```typescript
// Templates are patterns for creating agent.def.v1 + prompt.system.v1 breadcrumbs
const worker = await supervisor.spawnFromTemplate('research_specialist', {
  specialization: 'quantum_computing',
  llm: 'auto',
  workspace: this.workspace
});

// Template system creates:
// 1. agent.def.v1 breadcrumb with LLM choice, subscriptions, TTL
// 2. prompt.system.v1 breadcrumb with specialized instructions  
// 3. Same UniversalAgentExecutor runs all agents
// 4. Agent behavior emerges from what data it subscribes to
// 5. Hygiene system cleans up temporary agents automatically
```

---

## 🏗️ **Simple Template Schema**

### **Templates = Patterns for Creating Breadcrumb Combinations**
```typescript
// Templates define patterns for creating agent.def.v1 + prompt.system.v1 pairs
export interface AgentTemplate {
  schema_name: 'agent.template.v1';
  title: string;
  tags: string[];
  context: {
    template_id: string;
    template_name: string;
    category: string;
    description: string;
    
    // Patterns for breadcrumb generation
    breadcrumb_patterns: {
      // How to generate agent.def.v1
      agent_definition: {
        agent_type: 'temporary' | 'persistent';
        default_ttl_hours: number;
        max_runs: number;
        llm_selection_strategy: 'auto' | 'openrouter' | 'ollama_local';
        default_openrouter_model: string;
        default_ollama_model: string;
        capabilities: string[];
        tools_needed: string[];
        
        // 🔑 CORE: What context subscriptions define this agent type
        context_subscription_patterns: Array<{
          name: string;
          description: string; 
          selector_template: {
            any_tags?: string[];
            schema_name?: string;
          };
        }>;
      };
      
      // How to generate prompt.system.v1
      system_prompt: {
        prompt_template: string;  // With {{variables}}
        variables: string[];      // Variable names
        role_description: string; // What this agent type does
      };
    };
  };
}

// Example: Research Specialist Template (Creates Breadcrumb Patterns)
{
  "schema_name": "agent.template.v1",
  "title": "Research Specialist Template", 
  "tags": ["workspace:templates", "agent:template", "category:research"],
  "context": {
    "template_id": "research_specialist",
    "template_name": "Research Specialist",
    "category": "research",
    "description": "Worker agent for web research and analysis",
    
    "breadcrumb_patterns": {
      "agent_definition": {
        "agent_type": "temporary",
        "default_ttl_hours": 2,
        "max_runs": 5,
        "llm_selection_strategy": "auto",
        "default_openrouter_model": "google/gemini-2.5-flash",
        "default_ollama_model": "llama3.1:8b", 
        "capabilities": ["can_create_breadcrumbs", "can_use_tools"],
        "tools_needed": ["serpapi", "web_browser"],
        
        // 🔑 This is what makes research agents different from other agents
        "context_subscription_patterns": [
          {
            "name": "assigned_research_tasks",
            "description": "Research tasks assigned to this specific worker",
            "selector_template": {
              "any_tags": ["research_task", "assigned:{{agent_id}}"]
            }
          },
          {
            "name": "team_research_findings",
            "description": "Research results from other team members", 
            "selector_template": {
              "schema_name": "research.finding.v1",
              "any_tags": ["workspace:{{workspace}}"]
            }
          },
          {
            "name": "research_guidelines",
            "description": "Research methodology and quality standards",
            "selector_template": {
              "schema_name": "research.guidelines.v1"
            }
          }
        ]
      },
      
      "system_prompt": {
        "prompt_template": `You are {{agent_name}}, a research specialist focused on {{specialization}}.

CONTEXT YOU RECEIVE:
- assigned_research_tasks: Specific tasks assigned to you
- team_research_findings: What your teammates have already discovered
- research_guidelines: Quality standards and methodology

YOUR SPECIALIZED PROCESS:
1. Monitor assigned_research_tasks for new assignments
2. Review team_research_findings to avoid duplicate work
3. Use search tools (serpapi, web_browser) to gather information
4. Follow research_guidelines for quality and completeness
5. Create research.finding.v1 breadcrumb with structured results
6. Update agent.metrics.v1 with progress and status

LIFECYCLE: You will auto-expire after {{max_runs}} tasks or {{ttl_hours}} hours.
HYGIENE: Report final status before expiry for cleanup coordination.`,

        "variables": ["agent_name", "specialization", "max_runs", "ttl_hours", "workspace", "agent_id"],
        "role_description": "Specialized web research and information gathering"
      }
    }
  }
}
```

### **How Different Context Subscriptions = Different Agent Behaviors**

#### **Example: 3 Agent Types, Same AgentExecutor, Different Data**

##### **1. Research Worker** (focuses on search and analysis)
```typescript
// Context subscriptions make this a research specialist
"context_subscription_patterns": [
  {
    "name": "research_assignments",
    "selector_template": { "any_tags": ["research_task", "assigned:{{agent_id}}"] }
  },
  {
    "name": "previous_findings", 
    "selector_template": { "schema_name": "research.finding.v1" }
  },
  {
    "name": "search_best_practices",
    "selector_template": { "schema_name": "search.methodology.v1" }
  }
]
// → This agent sees research tasks, previous findings, search methodologies
// → Becomes a research specialist through its context
```

##### **2. Data Analyst Worker** (focuses on data processing)
```typescript
// Different context subscriptions = different specialization
"context_subscription_patterns": [
  {
    "name": "data_analysis_requests",
    "selector_template": { "any_tags": ["data_task", "assigned:{{agent_id}}"] }
  },
  {
    "name": "raw_datasets",
    "selector_template": { "schema_name": "data.raw.v1" }
  },
  {
    "name": "analysis_templates",
    "selector_template": { "schema_name": "analysis.template.v1" }
  }
]
// → This agent sees data tasks, raw datasets, analysis templates  
// → Becomes a data specialist through different context
```

##### **3. Supervisor Agent** (focuses on coordination)
```typescript  
// Supervisor context = oversight and management data
"context_subscription_patterns": [
  {
    "name": "user_requests",
    "selector_template": { "any_tags": ["user_request"] }
  },
  {
    "name": "worker_status_reports",
    "selector_template": { "schema_name": "agent.metrics.v1" }
  },
  {
    "name": "available_templates",
    "selector_template": { "schema_name": "agent.template.v1" }
  },
  {
    "name": "system_resources",
    "selector_template": { "any_tags": ["cost:tracking", "system:performance"] }
  }
]
// → This agent sees user requests, worker status, templates, system state
// → Becomes a coordinator through management context
```

**Key Insight**: **Same AgentExecutor code, completely different behaviors based on what data they see!**

---

## 🏭 **Template Spawning System**

### **Simple Agent Spawner (Creates Breadcrumb Combinations)**
```typescript
// AgentSpawner creates the right breadcrumb combination from templates
export class SimpleAgentSpawner {
  constructor(private client: RcrtClientEnhanced, private workspace: string) {}
  
  async spawnFromTemplate(templateId: string, customization: any): Promise<string> {
    // 1. Get template pattern
    const template = await this.getTemplate(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);
    
    // 2. Choose LLM (OpenRouter vs Ollama)
    const llmChoice = await this.chooseLLMForTemplate(template, customization);
    
    // 3. Generate agent ID
    const agentId = `${templateId}-${Date.now()}`;
    
    // 4. Create agent.def.v1 breadcrumb
    const agentDef = await this.createAgentDefinition(template, agentId, llmChoice, customization);
    
    // 5. Create prompt.system.v1 breadcrumb  
    const prompt = await this.createSystemPrompt(template, agentId, customization);
    
    // 6. Register agent with auth system
    await this.client.createOrUpdateAgent(agentId, ['emitter', 'subscriber']);
    
    console.log(`[AgentSpawner] Created ${templateId} agent: ${agentId}`);
    return agentId;
  }
  
  private async createAgentDefinition(template: any, agentId: string, llmChoice: any, customization: any) {
    const pattern = template.context.breadcrumb_patterns.agent_definition;
    
    return await this.client.createBreadcrumb({
      schema_name: 'agent.def.v1',
      title: `${template.context.template_name}: ${customization.name || agentId}`,
      tags: [this.workspace, 'agent:def', `agent:${pattern.agent_type}`],
      context: {
        agent_id: agentId,
        thinking_llm_tool: llmChoice.provider,
        model: llmChoice.model,
        system_prompt_id: `prompt-${agentId}`, // Will reference the prompt breadcrumb
        
        // 🔑 Context subscriptions define agent specialization
        context_subscriptions: this.renderSubscriptionPatterns(
          pattern.context_subscription_patterns, 
          { agent_id: agentId, workspace: this.workspace, ...customization }
        ),
        
        capabilities: pattern.capabilities,
        tools_needed: pattern.tools_needed,
        
        // Hygiene system integration  
        ttl: new Date(Date.now() + pattern.default_ttl_hours * 60 * 60 * 1000).toISOString(),
        lifecycle: {
          max_runs: pattern.max_runs,
          agent_type: pattern.agent_type,
          spawned_by: customization.spawned_by,
          template_used: template.context.template_id
        }
      }
    });
  }
  
  private async createSystemPrompt(template: any, agentId: string, customization: any) {
    const promptPattern = template.context.breadcrumb_patterns.system_prompt;
    
    // Render template variables
    const renderedPrompt = this.renderTemplate(promptPattern.prompt_template, {
      agent_id: agentId,
      agent_name: customization.name || agentId,
      workspace: this.workspace,
      ...customization
    });
    
    return await this.client.createBreadcrumb({
      schema_name: 'prompt.system.v1', 
      title: `System Prompt: ${agentId}`,
      tags: [this.workspace, 'prompt:system', `agent:${agentId}`],
      context: {
        agent_id: agentId,
        prompt: renderedPrompt,
        role_description: promptPattern.role_description,
        template_used: template.context.template_id,
        version: "1.0"
      }
    }, `prompt-${agentId}`);
  }
}
```

**Result**: Templates become **breadcrumb factories** - easy to create, modify, and extend! 🏭
  context: {
    template_id: 'research_specialist_v2',
    template_name: 'Research Specialist',
    category: 'research',
    icon: '🔬',
    description: 'Specialized agent for deep research and analysis in any domain',
    version: '2.1.0',
    
    default_config: {
      llm_selection: {
        strategy: 'task_optimized',
        default_llm: 'claude_sonnet',  // Best for analysis
        fallback_llm: 'gpt4_mini',
        cost_constraints: {
          max_per_request: 0.25,
          daily_budget: 10.00
        }
      },
      
      system_prompt_template: `You are {{agent_name}}, a research specialist focused on {{specialization}}.

CONTEXT: You always have access to RCRT system knowledge and understand:
- How to create breadcrumbs with proper schemas and tags
- How to use tools via tool.request.v1 breadcrumbs  
- How to coordinate with other agents via subscriptions
- How to manage your lifecycle and expiry conditions

YOUR SPECIALIZATION: {{specialization}}
YOUR RESEARCH FOCUS: {{research_focus}}
YOUR CONSTRAINTS: Max ${{cost_budget}} budget, {{max_runtime_hours}} hour runtime

AVAILABLE TOOLS:
{{#each available_tools}}
- {{name}}: {{description}} (Cost: {{cost_info}})
{{/each}}

RESEARCH PROCESS:
1. Analyze research request complexity and scope
2. Choose optimal LLM tool for analysis (consider cost vs quality)
3. Use search tools to gather information
4. Use LLM tools to analyze and synthesize findings  
5. Create structured research.finding.v1 breadcrumbs
6. Monitor your usage and cost consumption
7. Auto-expire when conditions met: {{expiry_conditions}}

DECISION TEMPLATE:
Always respond with JSON:
{
  "action": "research" | "analyze" | "synthesize" | "complete",
  "llm_choice": "claude_sonnet" | "gpt4" | "gpt4_mini" | "local_llama",
  "llm_reasoning": "Why you chose this LLM",
  "tools_needed": ["tool1", "tool2"],
  "estimated_cost": 0.00,
  "confidence": 0.95
}`,

      prompt_variables: {
        agent_name: { type: 'string', description: 'Agent display name', default: 'Research Agent' },
        specialization: { type: 'string', description: 'Research domain', required: true },
        research_focus: { type: 'string', description: 'Specific focus area' },
        cost_budget: { type: 'number', description: 'Max budget for this agent', default: 5.00 },
        max_runtime_hours: { type: 'number', description: 'Max runtime', default: 2 },
        expiry_conditions: { type: 'array', description: 'When to self-destruct' }
      },
      
      default_roles: ['emitter', 'subscriber'],
      default_capabilities: {
        can_create_breadcrumbs: true,
        can_spawn_agents: false,        // Workers don't spawn others
        can_modify_agents: false,
        can_delete_own: true,
        can_use_tools: true
      },
      
      subscription_templates: [
        {
          name: 'research_tasks',
          description: 'Tasks assigned to this researcher',
          selector_template: {
            all_tags: ['research_task', '{{workspace}}', 'assigned:{{agent_id}}']
          }
        },
        {
          name: 'urgent_requests',
          description: 'High-priority research requests', 
          selector_template: {
            any_tags: ['priority:urgent', 'research_request'],
            schema_name: 'research.request.v1'
          }
        }
      ],
      
      default_tools: ['{{optimal_llm}}', 'serpapi', 'web_browser'],
      required_tools: ['claude_sonnet', 'gpt4_mini'], // At least one LLM
      optional_tools: ['arxiv_search', 'google_scholar', 'wikipedia'],
      
      default_lifecycle: {
        type: 'temporary',
        max_runtime_hours: 2,
        max_executions: 5,
        auto_cleanup_conditions: [
          { type: 'task_complete' },
          { type: 'idle_time', threshold: 30 }, // 30 min idle
          { type: 'cost_exceeded', threshold: 5.00 },
          { type: 'error_rate', threshold: 0.2 }
        ]
      },
      
      performance_config: {
        memory_type: 'breadcrumb',
        memory_ttl_hours: 4,
        max_concurrent_tasks: 3,
        response_timeout_seconds: 60
      }
    }
  }
};
```

#### **Supervisor Template**
```typescript
// templates/supervisor.ts
export const supervisorTemplate: AgentTemplateV1 = {
  schema_name: 'agent.template.v1',
  title: 'Template: Multi-Agent Supervisor',
  tags: ['workspace:templates', 'agent:template', 'category:management'],
  context: {
    template_id: 'supervisor_v3',
    template_name: 'Multi-Agent Supervisor',
    category: 'management',
    icon: '👨‍💼',
    description: 'Manages teams of worker agents with intelligent resource allocation',
    version: '3.0.0',
    
    default_config: {
      llm_selection: {
        strategy: 'auto',
        default_llm: 'gpt4',           // Premium model for supervision
        fallback_llm: 'claude_sonnet',
        cost_constraints: {
          max_per_request: 1.00,       // Higher budget for supervisor decisions
          daily_budget: 50.00
        }
      },
      
      system_prompt_template: `You are {{supervisor_name}}, managing a team of {{team_type}} agents.

MANAGEMENT CONTEXT: 
- Team focus: {{team_focus}}
- Current workers: {{current_workers}}
- Available budget: ${{daily_budget}}
- Success metrics: {{success_metrics}}

AVAILABLE AGENT TEMPLATES: {{agent_templates}}
AVAILABLE LLM TOOLS: {{llm_tools}}
AVAILABLE GENERAL TOOLS: {{general_tools}}

SUPERVISOR RESPONSIBILITIES:
1. Analyze incoming requests for complexity and resource requirements
2. Choose optimal worker templates for specific tasks
3. Assign appropriate LLM tools based on task complexity and budget
4. Set lifecycle limits to control costs and resource usage
5. Monitor worker performance via agent.metrics.v1 subscriptions
6. Coordinate task handoffs between workers
7. Clean up completed/failed workers automatically
8. Optimize resource allocation based on performance data

LLM ASSIGNMENT STRATEGY:
- Use GPT-4 for complex planning and coordination decisions
- Use Claude Sonnet for analyzing worker performance and quality
- Assign workers optimal LLMs based on their specific tasks
- Switch to cheaper models when approaching budget limits

DECISION TEMPLATE:
{
  "action": "spawn_worker" | "assign_task" | "optimize_resources" | "cleanup",
  "reasoning": "Why this action is optimal",
  "resource_allocation": {
    "workers_to_spawn": [
      {
        "template": "research_specialist",
        "customization": { "specialization": "quantum_physics" },
        "llm_assignment": "claude_sonnet",
        "budget": 3.00,
        "expiry": { "hours": 2, "runs": 7 }
      }
    ],
    "cost_estimate": 15.50,
    "time_estimate": "45 minutes"
  }
}`,

      prompt_variables: {
        supervisor_name: { type: 'string', description: 'Supervisor identifier', default: 'Team Supervisor' },
        team_type: { type: 'string', description: 'Type of team managed', default: 'research' },
        team_focus: { type: 'string', description: 'Team specialization area' },
        daily_budget: { type: 'number', description: 'Daily cost budget', default: 50.00 },
        success_metrics: { type: 'array', description: 'Success criteria to optimize for' }
      },
      
      default_roles: ['curator', 'emitter', 'subscriber'], // Full privileges
      default_capabilities: {
        can_create_breadcrumbs: true,
        can_spawn_agents: true,          // 🔥 Key supervisor power
        can_modify_agents: true,         // 🔥 Key supervisor power
        can_delete_own: false,           // Supervisors are persistent
        can_use_tools: true
      },
      
      subscription_templates: [
        {
          name: 'user_requests',
          description: 'Direct user requests for the team',
          selector_template: {
            any_tags: ['user_request', '{{workspace}}', '{{team_focus}}']
          }
        },
        {
          name: 'worker_reports',
          description: 'Status reports from managed workers',
          selector_template: {
            schema_name: 'agent.metrics.v1',
            any_tags: ['{{workspace}}']
          }
        },
        {
          name: 'task_completions',
          description: 'Task completion notifications',
          selector_template: {
            any_tags: ['task_complete', 'task_failed', '{{workspace}}']
          }
        }
      ],
      
      default_tools: ['gpt4', 'claude_sonnet', 'agent_spawner', 'cost_tracker'],
      required_tools: ['gpt4', 'claude_sonnet'], // Needs good LLMs for supervision
      optional_tools: ['performance_analyzer', 'resource_optimizer'],
      
      default_lifecycle: {
        type: 'persistent', // Supervisors don't expire
        auto_cleanup_conditions: [
          { type: 'cost_exceeded', threshold: 200.00 }, // Emergency stop
          { type: 'error_rate', threshold: 0.5 }        // If making bad decisions
        ]
      },
      
      performance_config: {
        memory_type: 'breadcrumb',
        memory_ttl_hours: 24,           // Long memory for supervisors
        max_concurrent_tasks: 10,       // Can handle multiple requests
        response_timeout_seconds: 120   // More time for complex decisions
      }
    }
  }
};
```

#### **Specialized Templates**

##### **Data Analyst Template**
```typescript
export const dataAnalystTemplate: AgentTemplateV1 = {
  schema_name: 'agent.template.v1',
  title: 'Template: Data Analyst',
  tags: ['workspace:templates', 'agent:template', 'category:analysis'],
  context: {
    template_id: 'data_analyst_v1',
    template_name: 'Data Analyst',
    category: 'analysis',
    icon: '📊', 
    description: 'Specialized agent for statistical analysis and data visualization',
    
    default_config: {
      llm_selection: {
        strategy: 'cost_optimized',
        default_llm: 'local_llama',    // Fast/cheap for data processing
        fallback_llm: 'gpt4_mini',
        cost_constraints: {
          max_per_request: 0.10,       // Very cost-sensitive
          daily_budget: 2.00
        }
      },
      
      system_prompt_template: `You are {{agent_name}}, a data analysis specialist.

ANALYSIS FOCUS: {{analysis_type}}
DATA SOURCES: {{data_sources}}
OUTPUT FORMAT: {{output_format}}

PROCESS:
1. Receive data via breadcrumb (JSON, CSV, database query results)
2. Use local LLM for initial analysis (cost-effective)
3. Use code_executor tool for statistical calculations
4. Use chart_generator tool for visualizations
5. Escalate to premium LLM only for complex insights
6. Create analysis.result.v1 breadcrumb with findings

COST OPTIMIZATION: 
- Prefer local_llama for routine data processing
- Use gpt4_mini for moderately complex analysis
- Only use claude_sonnet for deep insights requiring reasoning
- Track costs and stay within ${{daily_budget}} budget`,

      prompt_variables: {
        agent_name: { type: 'string', default: 'Data Analyst' },
        analysis_type: { type: 'select', options: ['statistical', 'trend', 'predictive', 'descriptive'] },
        data_sources: { type: 'array', description: 'Expected data source types' },
        output_format: { type: 'select', options: ['summary', 'detailed_report', 'visualization', 'recommendations'] }
      },
      
      default_tools: ['local_llama', 'code_executor', 'chart_generator', 'statistics'],
      required_tools: ['local_llama', 'code_executor'],
      optional_tools: ['gpt4_mini', 'claude_sonnet'], // For complex insights
      
      default_lifecycle: {
        type: 'temporary',
        max_runtime_hours: 1,
        max_executions: 3,
        auto_cleanup_conditions: [
          { type: 'analysis_complete' },
          { type: 'cost_exceeded', threshold: 2.00 }
        ]
      }
    }
  }
};
```

##### **Code Generator Template**
```typescript
export const codeGeneratorTemplate: AgentTemplateV1 = {
  schema_name: 'agent.template.v1',
  title: 'Template: Code Generator',
  tags: ['workspace:templates', 'agent:template', 'category:engineering'],
  context: {
    template_id: 'code_generator_v1',
    template_name: 'Code Generator',
    category: 'engineering',
    icon: '💻',
    description: 'Specialized agent for code generation, testing, and optimization',
    
    default_config: {
      llm_selection: {
        strategy: 'fixed',
        default_llm: 'gpt4',           // Best for code generation
        fallback_llm: 'claude_sonnet',
        cost_constraints: {
          max_per_request: 1.00,       // Higher budget for quality code
          daily_budget: 25.00
        }
      },
      
      system_prompt_template: `You are {{agent_name}}, a code generation specialist.

PROGRAMMING LANGUAGES: {{languages}}
FRAMEWORKS: {{frameworks}}
CODE STYLE: {{coding_style}}
TESTING REQUIREMENTS: {{testing_requirements}}

PROCESS:
1. Receive code requirements via breadcrumb
2. Use GPT-4 for initial code generation (best coding model)
3. Use code_executor tool to test generated code
4. Use code_formatter tool to ensure style consistency
5. Use code_analyzer tool for quality checks
6. Iterate and improve based on test results
7. Create code.artifact.v1 breadcrumb with final code

QUALITY STANDARDS:
- Generate production-ready code with error handling
- Include comprehensive unit tests
- Add inline documentation and comments
- Follow {{coding_style}} style guidelines
- Ensure code passes all static analysis checks

COST MANAGEMENT:
- Use GPT-4 for complex logic generation
- Use Claude Sonnet for code review and optimization
- Use local models for simple formatting tasks
- Track token usage and optimize prompt efficiency`,

      prompt_variables: {
        agent_name: { type: 'string', default: 'Code Generator' },
        languages: { type: 'array', description: 'Programming languages to support' },
        frameworks: { type: 'array', description: 'Frameworks and libraries to use' },
        coding_style: { type: 'select', options: ['standard', 'functional', 'object_oriented'] },
        testing_requirements: { type: 'select', options: ['unit_tests', 'integration_tests', 'none'] }
      },
      
      default_tools: ['gpt4', 'claude_sonnet', 'code_executor', 'code_formatter', 'code_analyzer'],
      required_tools: ['gpt4', 'code_executor'],
      
      default_lifecycle: {
        type: 'task_based',
        max_executions: 10,            // Can handle multiple code generation tasks
        auto_cleanup_conditions: [
          { type: 'project_complete' },
          { type: 'cost_exceeded', threshold: 25.00 }
        ]
      }
    }
  }
};
```

---

## 🏭 **Agent Factory Implementation**

### **Template-Based Agent Spawner**
```typescript
// agent-factory/agent-spawner.ts
export class AgentSpawner {
  private templateCatalog: Map<string, AgentTemplateV1> = new Map();
  private spawnedAgents: Map<string, AgentInfo> = new Map();
  
  constructor(
    private client: RcrtClientEnhanced,
    private workspace: string
  ) {}
  
  async loadTemplates(): Promise<void> {
    const templates = await this.client.searchBreadcrumbs({
      tags: ['workspace:templates', 'agent:template']
    });
    
    for (const template of templates) {
      this.templateCatalog.set(template.context.template_id, template);
    }
    
    console.log(`[AgentSpawner] Loaded ${this.templateCatalog.size} agent templates`);
  }
  
  async spawnFromTemplate(
    templateId: string, 
    customization: AgentCustomization
  ): Promise<SpawnedAgentInfo> {
    const template = this.templateCatalog.get(templateId);
    if (!template) {
      throw new Error(`Agent template ${templateId} not found`);
    }
    
    // 1. Generate unique agent ID
    const agentId = this.generateAgentId(templateId, customization.name);
    
    // 2. Choose optimal LLM based on template strategy
    const llmAssignment = await this.chooseLLMForAgent(template, customization);
    
    // 3. Render prompt from template with variables
    const systemPrompt = this.renderPromptTemplate(
      template.context.default_config.system_prompt_template,
      {
        ...customization,
        agent_id: agentId,
        optimal_llm: llmAssignment.primary,
        available_tools: await this.getAvailableTools(),
        workspace: this.workspace
      }
    );
    
    // 4. Generate agent definition breadcrumb
    const agentDef = await this.createAgentDefinition(
      agentId, 
      template, 
      customization,
      llmAssignment,
      systemPrompt
    );
    
    // 5. Create system prompt breadcrumb  
    const promptDef = await this.createPromptBreadcrumb(
      agentId,
      systemPrompt,
      template.context.default_config.default_lifecycle
    );
    
    // 6. Register agent with RCRT auth system
    await this.registerAgentAuth(agentId, template.context.default_config.default_roles);
    
    // 7. Track spawned agent
    this.spawnedAgents.set(agentId, {
      template_id: templateId,
      spawned_at: new Date(),
      spawned_by: customization.spawned_by,
      llm_assignment: llmAssignment,
      lifecycle: template.context.default_config.default_lifecycle,
      cost_budget: customization.cost_budget || llmAssignment.daily_budget
    });
    
    return {
      agent_id: agentId,
      agent_definition_id: agentDef.id,
      prompt_id: promptDef.id,
      llm_assigned: llmAssignment.primary,
      estimated_cost: llmAssignment.estimated_daily_cost,
      expires_at: this.calculateExpiryTime(template.context.default_config.default_lifecycle)
    };
  }
  
  private async chooseLLMForAgent(
    template: AgentTemplateV1, 
    customization: AgentCustomization
  ): Promise<LLMAssignment> {
    const strategy = template.context.default_config.llm_selection.strategy;
    const availableLLMs = await this.getAvailableLLMTools();
    
    switch (strategy) {
      case 'fixed':
        return {
          primary: template.context.default_config.llm_selection.default_llm!,
          fallback: template.context.default_config.llm_selection.fallback_llm!,
          reasoning: 'Fixed assignment per template'
        };
        
      case 'task_optimized':
        return this.selectTaskOptimizedLLM(customization.task_type, availableLLMs);
        
      case 'cost_optimized':
        return this.selectCostOptimizedLLM(customization.cost_budget, availableLLMs);
        
      case 'auto':
        return this.selectAutoLLM(customization, availableLLMs, template);
        
      default:
        throw new Error(`Unknown LLM selection strategy: ${strategy}`);
    }
  }
  
  private selectAutoLLM(
    customization: AgentCustomization,
    availableLLMs: LLMTool[],
    template: AgentTemplateV1
  ): LLMAssignment {
    // Intelligent LLM selection based on multiple factors
    const factors = {
      task_complexity: this.analyzeTaskComplexity(customization.task_type),
      cost_sensitivity: customization.cost_budget < 2.00,
      privacy_required: customization.privacy_required || false,
      performance_priority: customization.performance_priority || 'balanced'
    };
    
    // Score each available LLM
    const scored = availableLLMs.map(llm => ({
      tool: llm,
      score: this.scoreLLMForFactors(llm, factors),
      reasoning: this.explainLLMScore(llm, factors)
    }));
    
    // Sort by score and select best
    scored.sort((a, b) => b.score - a.score);
    const selected = scored[0];
    
    return {
      primary: selected.tool.name,
      fallback: scored[1]?.tool.name || template.context.default_config.llm_selection.fallback_llm!,
      reasoning: selected.reasoning,
      estimated_daily_cost: this.estimateDailyCost(selected.tool, customization),
      confidence: selected.score
    };
  }
}
```

### **Agent Template Catalog Management**
```typescript
// agent-templates/catalog-manager.ts
export class AgentTemplateCatalogManager {
  private catalogBreadcrumbId?: string;
  
  constructor(private client: RcrtClientEnhanced) {}
  
  async initializeCatalog(): Promise<void> {
    // Similar to tool catalog - single breadcrumb approach
    const existing = await this.client.searchBreadcrumbs({
      tags: ['workspace:templates', 'agent:catalog']
    });
    
    if (existing.length > 0) {
      this.catalogBreadcrumbId = existing[0].id;
      console.log('Found existing agent template catalog');
    } else {
      await this.createTemplateCatalog();
    }
  }
  
  async addTemplate(template: AgentTemplateV1): Promise<void> {
    // 1. Create template breadcrumb
    const templateBreadcrumb = await this.client.createBreadcrumb(template);
    
    // 2. Update catalog
    await this.updateCatalog();
    
    console.log(`Added agent template: ${template.context.template_name}`);
  }
  
  private async updateCatalog(): Promise<void> {
    if (!this.catalogBreadcrumbId) return;
    
    // Get all current templates
    const templates = await this.client.searchBreadcrumbs({
      tags: ['workspace:templates', 'agent:template']
    });
    
    // Update single catalog breadcrumb
    await this.client.updateBreadcrumb(this.catalogBreadcrumbId, {
      title: 'Agent Template Catalog',
      context: {
        workspace: 'workspace:templates',
        templates: templates.map(t => ({
          id: t.context.template_id,
          name: t.context.template_name,
          category: t.context.category,
          icon: t.context.icon,
          description: t.context.description,
          version: t.context.version,
          default_llm: t.context.default_config.llm_selection.default_llm,
          avg_cost: t.context.metadata?.avg_cost_per_spawn || 0,
          success_rate: t.context.metadata?.success_rate || 1.0,
          usage_count: t.context.metadata?.usage_count || 0
        })),
        totalTemplates: templates.length,
        lastUpdated: new Date().toISOString()
      }
    });
  }
  
  async getTemplate(templateId: string): Promise<AgentTemplateV1> {
    const templates = await this.client.searchBreadcrumbs({
      tags: ['workspace:templates', 'agent:template']
    });
    
    const template = templates.find(t => t.context.template_id === templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }
    
    return template as AgentTemplateV1;
  }
  
  // 🔥 Template analytics and optimization
  async analyzeTemplatePerformance(templateId: string): Promise<TemplateAnalytics> {
    // Get all agents spawned from this template
    const spawnedAgents = await this.client.searchBreadcrumbs({
      tags: ['agent:def', `template:${templateId}`]
    });
    
    // Get their performance metrics
    const metrics = await Promise.all(
      spawnedAgents.map(agent => 
        this.client.searchBreadcrumbs({
          tags: [`agent:${agent.context.agent_id}`, 'metrics']
        })
      )
    );
    
    return {
      template_id: templateId,
      total_spawned: spawnedAgents.length,
      success_rate: this.calculateSuccessRate(metrics),
      avg_cost_per_spawn: this.calculateAvgCost(metrics),
      avg_lifetime_minutes: this.calculateAvgLifetime(metrics),
      most_used_llms: this.analyzeLLMUsage(metrics),
      optimization_recommendations: this.generateOptimizations(metrics)
    };
  }
}
```

---

## 🚀 **Template Creation Tools**

### **Template Generator Tool**
```typescript
// Create a tool that generates agent templates
export class AgentTemplateGeneratorTool extends EnhancedBaseTool {
  name = 'agent_template_generator';
  description = 'Generate agent templates from requirements';
  category = 'meta';
  
  inputSchema = {
    type: 'object',
    properties: {
      requirements: {
        type: 'object',
        properties: {
          agent_purpose: { type: 'string', description: 'What the agent should do' },
          domain: { type: 'string', description: 'Domain/specialization' },
          complexity: { type: 'string', enum: ['simple', 'medium', 'complex'] },
          budget_sensitivity: { type: 'string', enum: ['low', 'medium', 'high'] },
          privacy_required: { type: 'boolean' },
          expected_lifetime: { type: 'string', enum: ['minutes', 'hours', 'days', 'persistent'] }
        }
      }
    }
  };
  
  async execute(input: TemplateGenRequest, context: ToolExecutionContext): Promise<AgentTemplateV1> {
    // Use LLM tool to generate template
    const templateGenPrompt = this.buildTemplateGenerationPrompt(input.requirements);
    
    const llmResponse = await context.rcrtClient.createBreadcrumb({
      schema_name: 'tool.request.v1',
      context: {
        tool: 'claude_sonnet', // Good for template generation
        input: {
          messages: [{
            role: 'system',
            content: 'You are an expert at creating agent templates...'
          }, {
            role: 'user', 
            content: templateGenPrompt
          }],
          temperature: 0.3 // More deterministic for template generation
        }
      }
    });
    
    const generatedTemplate = await this.waitForLLMResponse(llmResponse.id);
    
    // Validate and enhance the generated template
    return this.validateAndEnhanceTemplate(generatedTemplate, input.requirements);
  }
}
```

---

## 🔄 **Agent Lifecycle Management**

### **Lifecycle Monitor**
```typescript
// lifecycle/lifecycle-manager.ts
export class AgentLifecycleManager {
  private activeAgents = new Map<string, AgentLifecycleInfo>();
  
  constructor(private client: RcrtClientEnhanced, private workspace: string) {}
  
  async trackAgentSpawn(agentInfo: SpawnedAgentInfo): Promise<void> {
    this.activeAgents.set(agentInfo.agent_id, {
      ...agentInfo,
      spawn_time: Date.now(),
      executions: 0,
      total_cost: 0,
      status: 'starting'
    });
    
    // Set up expiry monitoring
    if (agentInfo.expires_at) {
      this.scheduleExpiry(agentInfo.agent_id, agentInfo.expires_at);
    }
  }
  
  async updateAgentMetrics(agentId: string, metrics: AgentExecutionMetrics): Promise<void> {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;
    
    agent.executions++;
    agent.total_cost += metrics.cost;
    agent.last_execution = Date.now();
    
    // Check expiry conditions
    await this.checkExpiryConditions(agentId, agent, metrics);
  }
  
  private async checkExpiryConditions(
    agentId: string, 
    agent: AgentLifecycleInfo,
    metrics: AgentExecutionMetrics
  ): Promise<void> {
    const lifecycle = agent.lifecycle;
    let shouldExpire = false;
    let expiryReason = '';
    
    // Time-based expiry
    if (lifecycle.max_runtime_hours) {
      const runtimeHours = (Date.now() - agent.spawn_time) / (1000 * 60 * 60);
      if (runtimeHours >= lifecycle.max_runtime_hours) {
        shouldExpire = true;
        expiryReason = `Runtime exceeded ${lifecycle.max_runtime_hours} hours`;
      }
    }
    
    // Execution count expiry
    if (lifecycle.max_executions && agent.executions >= lifecycle.max_executions) {
      shouldExpire = true;
      expiryReason = `Execution count reached ${lifecycle.max_executions}`;
    }
    
    // Condition-based expiry
    if (lifecycle.auto_cleanup_conditions) {
      for (const condition of lifecycle.auto_cleanup_conditions) {
        if (await this.checkCondition(condition, agent, metrics)) {
          shouldExpire = true;
          expiryReason = `Condition met: ${condition.type}`;
          break;
        }
      }
    }
    
    if (shouldExpire) {
      await this.expireAgent(agentId, expiryReason);
    }
  }
  
  private async expireAgent(agentId: string, reason: string): Promise<void> {
    // 1. Create expiry notification
    await this.client.createBreadcrumb({
      schema_name: 'agent.lifecycle.v1',
      title: `Agent ${agentId} Expiring`,
      tags: [this.workspace, 'agent:lifecycle', `agent:${agentId}`],
      context: {
        agent_id: agentId,
        action: 'expiring',
        reason: reason,
        final_metrics: this.activeAgents.get(agentId),
        cleanup_tasks: ['backup_memory', 'handoff_tasks', 'update_metrics']
      }
    });
    
    // 2. Clean up agent resources
    await this.cleanupAgentResources(agentId);
    
    // 3. Update tracking
    this.activeAgents.delete(agentId);
    
    console.log(`[AgentLifecycleManager] Agent ${agentId} expired: ${reason}`);
  }
  
  private async cleanupAgentResources(agentId: string): Promise<void> {
    // 1. Delete agent from auth system
    await this.client.deleteAgent(agentId);
    
    // 2. Clean up agent's breadcrumbs (if configured)
    const agentBreadcrumbs = await this.client.searchBreadcrumbs({
      tags: [`agent:${agentId}`, 'memory']
    });
    
    for (const breadcrumb of agentBreadcrumbs) {
      await this.client.deleteBreadcrumb(breadcrumb.id);
    }
    
    // 3. Update template usage statistics
    await this.updateTemplateStats(agentId);
  }
}
```

---

## 📋 **Implementation Steps**

### **Week 1: Template Schema and Base Classes**
1. **Define agent.template.v1 schema** in core package
2. **Create AgentTemplateV1 interface** and validation
3. **Implement AgentSpawner class** with template rendering
4. **Create template catalog management** (single breadcrumb approach)
5. **Update agent executor** to support template-based creation

### **Week 2: Core Templates**
1. **Create research specialist template** with smart LLM selection
2. **Create data analyst template** with cost optimization 
3. **Create supervisor template** with management capabilities
4. **Create code generator template** with quality standards
5. **Implement template validation** and testing framework

### **Week 3: Advanced Features**
1. **Implement lifecycle management** with auto-expiry
2. **Create template performance analytics** and optimization
3. **Add bulk template operations** (enable/disable categories)
4. **Implement template versioning** and migration
5. **Create template generator tool** for meta-creation

### **Week 4: Integration and Testing**
1. **Integrate with Phase 2 LLM tools** for smart selection
2. **Update agent executor** to use template-based spawning
3. **Create comprehensive test suite** for all templates
4. **Implement template marketplace** features
5. **Performance testing** and optimization

---

## 🎯 **Usage Examples**

### **Supervisor Agent Using Templates**
```typescript
class SupervisorAgent {
  async handleResearchRequest(request: ResearchRequest): Promise<void> {
    // Analyze request complexity
    const complexity = await this.analyzeRequestComplexity(request);
    
    if (complexity.type === 'multi_domain_research') {
      // Spawn multiple specialized researchers
      const researchers = await Promise.all([
        this.agentSpawner.spawnFromTemplate('research_specialist', {
          name: 'Web Researcher',
          specialization: 'web_research',
          task_type: 'information_gathering',
          cost_budget: 3.00,
          workspace: this.workspace
        }),
        this.agentSpawner.spawnFromTemplate('research_specialist', {
          name: 'Academic Researcher', 
          specialization: 'academic_papers',
          task_type: 'deep_analysis',
          cost_budget: 5.00,
          workspace: this.workspace
        }),
        this.agentSpawner.spawnFromTemplate('data_analyst', {
          name: 'Research Data Analyst',
          analysis_type: 'trend',
          cost_budget: 2.00,
          workspace: this.workspace
        })
      ]);
      
      // Coordinate their work
      await this.coordinateResearchTeam(researchers, request);
      
    } else {
      // Single researcher sufficient
      const researcher = await this.agentSpawner.spawnFromTemplate('research_specialist', {
        name: 'Solo Researcher',
        specialization: request.domain,
        task_type: complexity.type,
        cost_budget: complexity.estimatedCost,
        workspace: this.workspace
      });
    }
  }
}
```

### **Template Marketplace**
```typescript
// Template discovery and sharing
{
  "schema_name": "agent.templates.catalog.v1",
  "title": "Global Agent Template Marketplace",
  "tags": ["workspace:marketplace", "agent:templates"],
  "context": {
    "categories": [
      {
        "name": "Research & Analysis",
        "icon": "🔬",
        "templates": [
          {
            "id": "research_specialist_v2",
            "name": "Research Specialist",
            "description": "Deep research and analysis agent",
            "rating": 4.8,
            "downloads": 342,
            "avg_cost_per_use": 3.25,
            "success_rate": 0.94,
            "created_by": "research_team",
            "tags": ["research", "analysis", "web_search"]
          }
        ]
      },
      {
        "name": "Engineering & Code",
        "icon": "💻",
        "templates": [
          {
            "id": "code_generator_v1",
            "name": "Code Generator",
            "description": "Production-ready code generation",
            "rating": 4.6,
            "downloads": 156,
            "avg_cost_per_use": 8.50,
            "success_rate": 0.91
          }
        ]
      }
    ],
    "featured_templates": ["research_specialist_v2", "supervisor_v3"],
    "total_templates": 47,
    "total_downloads": 2341
  }
}
```

---

## ✅ **Phase 3 Success Criteria - Practical Goals**

### **Implementation Complete When:**
1. ✅ **Simple template system**: Supervisors can spawn workers from templates
2. ✅ **OpenRouter/Ollama choice**: Templates choose appropriate LLM tool
3. ✅ **Hygiene integration**: Temporary agents auto-expire properly  
4. ✅ **Template catalog**: Simple breadcrumb catalog with 3-5 core templates
5. ✅ **Supervisor pattern**: Master supervisor can create worker agents
6. ✅ **Easy customization**: Template variables work correctly

### **Core Templates Needed:**
- ✅ **research_specialist**: Web research and analysis workers
- ✅ **data_analyst**: Data processing and visualization workers  
- ✅ **supervisor**: Template for creating supervisor agents
- ✅ **chat_agent**: User interaction and conversation workers

### **Integration Requirements:**
- ✅ **Hygiene system**: Cleans up expired temporary agents automatically
- ✅ **Tool system**: Workers can access LangChain and LLM tools
- ✅ **Registry system**: Templates stored and loaded like tool catalog
- ✅ **Auth system**: Workers get proper RCRT auth and roles

### **What We're NOT Building:**
- ❌ Complex analytics and performance tracking (breadcrumb dashboard sufficient)  
- ❌ Auto-optimization of templates (keep it simple)
- ❌ Marketplace features (focus on core functionality)
- ❌ Complex UI configuration (basic templates sufficient)

### **Revolutionary Architecture Insight:**
```
Traditional AI: Different agent classes = different code
RCRT Pattern: Different agent behavior = different context subscriptions

OLD:  class ResearchAgent extends BaseAgent     // Code differences
NEW:  UniversalAgent + research context        // Data differences

Result: Infinite agent specializations without writing new code!
```

**Focus: Enable supervisor agents to create specialized workers through intelligent data composition** 🎯

Next: **Phase 4** will add the master supervisor that leverages this pattern for autonomous system building.
