# Phase 2: LLM Tools Integration 🧠
**Status: FOCUSED & PRACTICAL** 🎯

## Overview
Make **OpenRouter and Ollama** available as **first-class tools** in RCRT, enabling supervisor agents to choose optimal LLMs for spawned workers. Keep base classes **simple but complete**.

---

## 🎯 **Practical Goal: OpenRouter + Ollama as Tools**

### **Current: Working LangChain Tools**
✅ **calculator, web_browser** - These work perfectly  
✅ **Registry system** - Stable, tested, ready for expansion

### **Target: Add LLM Tools for Agent Creation**
```typescript
// Supervisor agent chooses LLM for worker agents
class SupervisorAgent {
  async spawnWorkerAgent(task: Task) {
    // Choose LLM based on task needs
    const llm = task.complexity === 'high' ? 'openrouter_claude' : 'ollama_local';
    
    await this.client.createBreadcrumb({
      schema_name: 'agent.def.v1',
      title: `Worker: ${task.type}`,
      context: {
        agent_id: `worker-${Date.now()}`,
        thinking_llm_tool: llm,  // Assigned LLM tool
        system_prompt: this.generatePrompt(task),
        expiry: { hours: 2, runs: 5 }, // 🔑 Hygiene system handles cleanup
        spawned_by: this.agentId
      }
    });
  }
}

---

## 🏗️ **Simple LLM Tool Architecture**

### **Two LLM Providers Only: OpenRouter + Ollama**

```typescript
// Simple base class - everything needed, no over-engineering
export abstract class SimpleLLMTool implements RCRTTool {
  abstract name: string;
  abstract description: string;
  category = 'llm';
  version = '1.0.0';
  
  get inputSchema() {
    return {
      type: 'object',
      properties: {
        messages: { 
          type: 'array', 
          description: 'Chat messages in OpenAI format',
          items: { 
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['system', 'user', 'assistant'] },
              content: { type: 'string' }
            }
          }
        },
        temperature: { type: 'number', default: 0.7, minimum: 0, maximum: 2 },
        max_tokens: { type: 'number', default: 4000 },
        model: { type: 'string', description: 'Specific model to use (optional)' }
      },
      required: ['messages']
    };
  }
  
  get outputSchema() {
    return {
      type: 'object',
      properties: {
        content: { type: 'string' },
        model: { type: 'string' },
        usage: { type: 'object' },
        cost_estimate: { type: 'number' }
      }
    };
  }
  
  // Subclasses implement this
  abstract execute(input: any, context: ToolExecutionContext): Promise<any>;
  
  // Helper for getting secrets
  protected async getSecret(secretName: string, context: ToolExecutionContext): Promise<string> {
    const secrets = await context.rcrtClient.listSecrets();
    const secret = secrets.find(s => s.name.toLowerCase() === secretName.toLowerCase());
    if (!secret) throw new Error(`${secretName} not found in RCRT secrets`);
    
    const decrypted = await context.rcrtClient.getSecret(secret.id, `LLM:${this.name}`);
    if (!decrypted.value) throw new Error(`${secretName} is empty`);
    
    return decrypted.value;
  }
}

### **1. OpenRouter Tool (Multi-Model Access)**
```typescript
// llm-tools/openrouter.ts
export class OpenRouterTool extends SimpleLLMTool {
  name = 'openrouter';
  description = 'OpenRouter - Access to multiple LLM providers via unified API';
  requiredSecrets = ['OPENROUTER_API_KEY'];
  
  async execute(input: any, context: ToolExecutionContext): Promise<any> {
    const apiKey = await this.getSecret('OPENROUTER_API_KEY', context);
    
    // OpenRouter requires specific model format like "openai/gpt-4o-mini"
    const model = input.model || 'google/gemini-2.5-flash';
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'RCRT Agent System'
      },
      body: JSON.stringify({
        model: model,
        messages: input.messages,
        temperature: input.temperature || 0.7,
        max_tokens: input.max_tokens || 4000
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${error}`);
    }
    
    const data = await response.json();
    const costEstimate = await this.estimateCost(data.usage, model, context);
    
    return {
      content: data.choices[0].message.content,
      model: data.model,
      usage: data.usage,
      cost_estimate: costEstimate
    };
  }
  
  private async estimateCost(usage: any, model: string, context: ToolExecutionContext): Promise<number> {
    // Get real pricing from model catalog
    const totalTokens = usage?.total_tokens || 0;
    const costPer1K = await this.getModelCostPer1K(model, context);
    return (totalTokens / 1000) * costPer1K;
  }
  
  private async getModelCostPer1K(model: string, context: ToolExecutionContext): Promise<number> {
    // Get model info from OpenRouter models catalog breadcrumb
    const modelsCatalog = await context.rcrtClient.searchBreadcrumbs({
      tags: ['openrouter:models', 'models:catalog']
    });
    
    if (modelsCatalog.length > 0) {
      const models = modelsCatalog[0].context.models;
      const modelInfo = models.find(m => m.id === model);
      if (modelInfo?.pricing) {
        // Use real pricing from OpenRouter
        return (parseFloat(modelInfo.pricing.prompt) + parseFloat(modelInfo.pricing.completion)) * 1000;
      }
    }
    
    // Fallback to estimates if catalog not available
    const costs = {
      'google/gemini-2.5-flash': 0.009,
      'openai/gpt-4o-mini': 0.0005,
      'openai/gpt-4o': 0.015,
      'anthropic/claude-3-haiku': 0.0015
    };
    return costs[model] || 0.005;
  }
}

### **2. Ollama Tool (Local Models)**
```typescript
// llm-tools/ollama.ts  
export class OllamaTool extends SimpleLLMTool {
  name = 'ollama_local';
  description = 'Ollama - Fast, free, private local models';
  requiredSecrets = []; // No API key needed!
  
  async execute(input: any, context: ToolExecutionContext): Promise<any> {
    // Check if Ollama is available
    await this.checkOllamaHealth();
    
    const model = input.model || 'llama3.1:8b';
    
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: input.messages,
        options: {
          temperature: input.temperature || 0.7,
          top_p: input.top_p || 0.9
        },
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama error ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    return {
      content: data.message?.content || '',
      model: model,
      usage: this.estimateUsage(data.message?.content || ''),
      cost_estimate: 0 // Free!
    };
  }
  
  private async checkOllamaHealth(): Promise<void> {
    try {
      const health = await fetch('http://localhost:11434/api/tags');
      if (!health.ok) {
        throw new Error('Ollama service not responding');
      }
    } catch (error) {
      throw new Error('Ollama not available - ensure Ollama is running on localhost:11434');
    }
  }
  
  private estimateUsage(content: string) {
    // Rough token estimation for local models
    const estimatedTokens = Math.ceil(content.length / 4);
    return {
      prompt_tokens: estimatedTokens,
      completion_tokens: estimatedTokens, 
      total_tokens: estimatedTokens * 2
    };
  }
}
```

### **3. OpenRouter Models Catalog (Store as Breadcrumb)**
```typescript
// Create and maintain OpenRouter models catalog as breadcrumb
export class OpenRouterModelsCatalog {
  constructor(private client: RcrtClientEnhanced, private workspace: string) {}
  
  async initializeModelsCatalog(): Promise<void> {
    // Check for existing model catalog
    const existing = await this.client.searchBreadcrumbs({
      tags: ['openrouter:models', 'models:catalog']
    });
    
    if (existing.length === 0 || this.shouldUpdateCatalog(existing[0])) {
      await this.updateModelsCatalog();
    }
  }
  
  private async updateModelsCatalog(): Promise<void> {
    try {
      // Fetch current models from OpenRouter API
      const response = await fetch('https://openrouter.ai/api/v1/models');
      const modelsData = await response.json();
      
      // Create/update models catalog breadcrumb
      await this.client.createBreadcrumb({
        schema_name: 'openrouter.models.catalog.v1',
        title: 'OpenRouter Available Models',
        tags: [this.workspace, 'openrouter:models', 'models:catalog'],
        context: {
          models: modelsData.data.map(model => ({
            id: model.id,                           // "google/gemini-2.5-flash"
            name: model.name,                       // Human readable name
            description: model.description,
            pricing: {
              prompt: model.pricing.prompt,         // Per token cost
              completion: model.pricing.completion,
              currency: 'USD'
            },
            context_length: model.context_length,
            capabilities: {
              input_modalities: model.architecture.input_modalities,
              output_modalities: model.architecture.output_modalities,
              supports_tools: model.supported_parameters.includes('tools')
            },
            provider: model.id.split('/')[0],       // "anthropic", "openai", etc.
            updated_at: new Date().toISOString()
          })),
          total_models: modelsData.data.length,
          last_updated: new Date().toISOString(),
          source: 'https://openrouter.ai/api/v1/models'
        }
      }, `openrouter-models-${Date.now()}`);
      
      console.log(`[OpenRouter] Updated models catalog with ${modelsData.data.length} models`);
      
    } catch (error) {
      console.error('[OpenRouter] Failed to update models catalog:', error);
    }
  }
  
  private shouldUpdateCatalog(existingCatalog: any): boolean {
    // Update daily or if older than 24 hours
    const lastUpdate = new Date(existingCatalog.context.last_updated);
    const hoursOld = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
    return hoursOld >= 24;
  }
}

// Integration with Tool Registry
export async function registerAllLLMTools(
  client: RcrtClientEnhanced,
  workspace: string
): Promise<RCRTToolWrapper[]> {
  const wrappers: RCRTToolWrapper[] = [];

  // 1. Initialize OpenRouter models catalog
  const modelsCatalog = new OpenRouterModelsCatalog(client, workspace);
  await modelsCatalog.initializeModelsCatalog();

  // 2. Add OpenRouter tool
  const openRouterTool = new OpenRouterTool();
  const openRouterWrapper = new RCRTToolWrapper(openRouterTool, client, workspace);
  await openRouterWrapper.start();
  wrappers.push(openRouterWrapper);

  // 3. Add Ollama tool (if available)
  try {
    const ollamaTool = new OllamaTool(); 
    const ollamaWrapper = new RCRTToolWrapper(ollamaTool, client, workspace);
    await ollamaWrapper.start();
    wrappers.push(ollamaWrapper);
  } catch (error) {
    console.warn('[LLM Tools] Ollama not available:', error.message);
  }

  console.log(`Registered ${wrappers.length} LLM tools for workspace: ${workspace}`);
  return wrappers;
}
```

---

## 🎯 **Simple Model Selection for Agents**

### **Smart Supervisor Uses Model Catalog**
```typescript
// Supervisor can access real OpenRouter model data via breadcrumbs
export class SmartLLMChooser {
  constructor(private client: RcrtClientEnhanced, private workspace: string) {}
  
  async chooseLLMForTask(task: { type: string, complexity: string, budget?: number }): Promise<LLMChoice> {
    // Get real model data from OpenRouter catalog
    const modelsCatalog = await this.client.searchBreadcrumbs({
      tags: [this.workspace, 'openrouter:models', 'models:catalog']
    });
    
    if (task.complexity === 'high' && (task.budget || 5) > 0.50) {
      // Use paid models for complex tasks - check actual pricing
      return this.selectBestOpenRouterModel(modelsCatalog[0]?.context.models, task);
    } else {
      // Use free local models for simple tasks
      return { 
        provider: 'ollama_local',
        model: 'llama3.1:8b',
        estimated_cost: 0,
        reasoning: 'Simple task, using free local model'
      };
    }
  }
  
  private selectBestOpenRouterModel(availableModels: any[], task: any): LLMChoice {
    if (!availableModels) {
      // Fallback if catalog not available
      return {
        provider: 'openrouter',
        model: 'google/gemini-2.5-flash',
        estimated_cost: 0.009,
        reasoning: 'Using default model - catalog unavailable'
      };
    }
    
    // Filter models by task type and budget
    const suitableModels = availableModels.filter(model => {
      const promptCost = parseFloat(model.pricing.prompt) * 1000; // Per 1k tokens
      return promptCost <= (task.budget || 0.01);
    });
    
    // Choose based on task type
    const preferences = {
      'analysis': (m) => m.id.includes('claude') ? 10 : (m.id.includes('gpt-4') ? 8 : 5),
      'coding': (m) => m.id.includes('gpt-4') ? 10 : (m.id.includes('claude') ? 8 : 5),
      'creative': (m) => m.id.includes('claude') ? 10 : 5,
      'simple': (m) => m.id.includes('mini') || m.id.includes('haiku') ? 10 : 5
    };
    
    const scorer = preferences[task.type] || preferences['simple'];
    const bestModel = suitableModels.sort((a, b) => scorer(b) - scorer(a))[0];
    
    return {
      provider: 'openrouter',
      model: bestModel.id,
      estimated_cost: parseFloat(bestModel.pricing.prompt) * 1000,
      reasoning: `Selected ${bestModel.name} for ${task.type} task (cost: $${bestModel.pricing.prompt}/token)`
    };
  }
}

// Example: Supervisor spawning worker with intelligent LLM choice from real model data
class SupervisorAgent {
  async spawnWorkerForTask(task: Task): Promise<string> {
    const chooser = new SmartLLMChooser(this.client, this.workspace);
    const llmChoice = await chooser.chooseLLMForTask(task); // Now async!
    
    console.log(`[Supervisor] ${llmChoice.reasoning}`); // Log selection reasoning
    
    const workerDef = await this.client.createBreadcrumb({
      schema_name: 'agent.def.v1',
      title: `Worker: ${task.type}`,
      tags: [this.workspace, 'agent:def', 'agent:temporary'], // 🔑 temporary tag
      context: {
        agent_id: `worker-${task.type}-${Date.now()}`,
        thinking_llm_tool: llmChoice.provider,  // 'openrouter' or 'ollama_local'
        model: llmChoice.model,                 // Specific model from catalog
        system_prompt: this.generatePromptForTask(task),
        
        // 🔑 Hygiene system integration
        ttl: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        lifecycle: {
          max_runs: 5,
          max_runtime_hours: 2,
          cleanup_on_complete: true
        },
        
        cost_estimate: llmChoice.estimated_cost,  // Real cost from OpenRouter API
        spawned_by: this.agentId,
        task_assignment: task
      }
    });
    
    return workerDef.id;
  }
}

interface LLMChoice {
  provider: 'openrouter' | 'ollama_local';
  model: string;                    // "google/gemini-2.5-flash" or "llama3.1:8b"
  estimated_cost: number;           // Real cost per 1k tokens
  reasoning: string;                // Why this model was chosen
}
```

---

## 🔄 **Integration with Existing Systems**

### **Generic AgentExecutor - Behavior Comes from Breadcrumbs**
```typescript
// ONE AgentExecutor for ALL agents - behavior comes from data, not code
class UniversalAgentExecutor {
  private agentDef: any;          // agent.def.v1 breadcrumb
  private systemPrompt: any;      // prompt.system.v1 breadcrumb  
  private contextSources: any[];  // What breadcrumbs to subscribe to
  
  constructor(agentDefBreadcrumb: any) {
    this.agentDef = agentDefBreadcrumb;
  }
  
  async initialize(): Promise<void> {
    // 1. Load system prompt breadcrumb
    this.systemPrompt = await this.loadSystemPrompt();
    
    // 2. Set up context subscriptions from agent definition
    this.contextSources = await this.setupContextSubscriptions();
    
    // 3. Start listening for events
    await this.startEventSubscriptions();
  }
  
  private async loadSystemPrompt(): Promise<any> {
    // Agent references a prompt breadcrumb, not hardcoded prompt
    const promptId = this.agentDef.context.system_prompt_id;
    if (!promptId) throw new Error('Agent missing system_prompt_id');
    
    return await this.rcrtClient.getBreadcrumb(promptId);
  }
  
  private async setupContextSubscriptions(): Promise<any[]> {
    // Agent defines what breadcrumbs to subscribe to for context
    const subscriptionConfig = this.agentDef.context.context_subscriptions || [];
    
    return subscriptionConfig.map(sub => ({
      name: sub.name,
      selector: sub.selector,
      description: sub.description
    }));
  }
  
  async makeDecision(trigger: any): Promise<any> {
    // 1. Gather context from subscribed breadcrumbs
    const contextBreadcrumbs = await this.gatherContextBreadcrumbs();
    
    // 2. Build messages with system prompt + context + trigger
    const messages = [
      {
        role: 'system',
        content: this.systemPrompt.context.prompt
      },
      {
        role: 'system', 
        content: `CURRENT CONTEXT:\n${JSON.stringify(contextBreadcrumbs, null, 2)}`
      },
      {
        role: 'user',
        content: `NEW EVENT:\n${JSON.stringify(trigger, null, 2)}`
      }
    ];
    
    // 3. Use assigned LLM tool for thinking
    const llmTool = this.agentDef.context.thinking_llm_tool || 'ollama_local';
    const model = this.agentDef.context.model; // For OpenRouter
    
    const toolRequest = await this.rcrtClient.createBreadcrumb({
      schema_name: 'tool.request.v1',
      title: `Agent ${this.agentDef.context.agent_id} Decision`,
      tags: [this.workspace, 'tool:request', 'agent:thinking'],
      context: {
        tool: llmTool,
        input: { messages, model, temperature: 0.7, max_tokens: 4000 },
        metadata: { agent_id: this.agentDef.context.agent_id, trigger_id: trigger.id }
      }
    });
    
    return await this.waitForToolResponse(toolRequest.id);
  }
  
  private async gatherContextBreadcrumbs(): Promise<any[]> {
    const contextData = [];
    
    // Gather breadcrumbs from each context subscription
    for (const contextSource of this.contextSources) {
      try {
        const breadcrumbs = await this.rcrtClient.searchBreadcrumbs(contextSource.selector);
        contextData.push({
          source: contextSource.name,
          description: contextSource.description,
          data: breadcrumbs.slice(0, 5) // Limit context size
        });
      } catch (error) {
        console.warn(`Failed to gather context from ${contextSource.name}:`, error);
      }
    }
    
    return contextData;
  }
}
```

### **Hygiene System Integration for Temporary Agents**
```typescript
// Automatic cleanup of temporary agents (already works!)
// The existing hygiene system will clean up:
// 1. Agents with 'agent:temporary' tag after TTL expires
// 2. Agent breadcrumbs when max_runs reached
// 3. Associated memory and metrics breadcrumbs

// NEW PATTERN: Agent behavior from breadcrumb composition
// 1. Agent Definition (references prompt, defines subscriptions)
{
  "schema_name": "agent.def.v1",
  "title": "Research Worker Agent", 
  "tags": ["workspace:research", "agent:def", "agent:temporary"],
  "context": {
    "agent_id": "worker-research-1757549123456",
    "thinking_llm_tool": "openrouter",
    "model": "google/gemini-2.5-flash",
    "system_prompt_id": "prompt-research-worker-001", // 🔑 References separate prompt
    
    // 🔑 What context this agent gets (defines its specialization)
    "context_subscriptions": [
      {
        "name": "my_tasks",
        "selector": { "any_tags": ["research_task", "assigned:worker-research-1757549123456"] }
      },
      {
        "name": "team_findings",
        "selector": { "schema_name": "research.finding.v1", "tags": ["workspace:research"] }
      }
    ],
    
    "ttl": "2025-01-10T16:00:00Z",
    "lifecycle": { "max_runs": 5, "spawned_by": "supervisor-research-001" }
  }
}

// 2. Separate Prompt Breadcrumb (defines agent personality/instructions)
{
  "id": "prompt-research-worker-001",
  "schema_name": "prompt.system.v1",
  "title": "Research Worker System Prompt",
  "tags": ["workspace:research", "prompt:system", "worker:research"],
  "context": {
    "agent_id": "worker-research-1757549123456",
    "prompt": `You are a research worker specializing in web research.

CONTEXT AVAILABLE TO YOU:
- my_tasks: Research tasks assigned specifically to you
- team_findings: Previous research findings from your team

YOUR PROCESS:
1. Check my_tasks for new research assignments
2. Use search tools (serpapi, web_browser) to gather information
3. Review team_findings to avoid duplicate research
4. Create research.finding.v1 breadcrumb with your results
5. Update agent.metrics.v1 with your progress

You are temporary - work efficiently and complete your assigned tasks.`,
    "version": "1.0"
  }
}

// 3. Different Agent = Different Prompt + Different Subscriptions
// Data Analyst Worker would have:
// - Different prompt: "You are a data analyst..."
// - Different subscriptions: data.raw.v1, analysis.request.v1, etc.
// - Same AgentExecutor code runs both!

---

## ✅ **Success Criteria - Data-Driven Agents**

### **Phase 2 Complete When:**

1. ✅ **OpenRouter tool working**: Access to 100+ models via correct format
2. ✅ **Ollama tool working**: Local models for free, private processing  
3. ✅ **OpenRouter models catalog**: Real model data stored as breadcrumb, updated daily
4. ✅ **Universal AgentExecutor**: One class runs all agents, behavior from breadcrumbs
5. ✅ **Prompt + context pattern**: Agents differentiated by prompt and subscriptions
6. ✅ **Hygiene integration**: Temporary agents auto-expire with existing system

### **Key Architectural Insights:**
- ✅ **Agents = Data, not Code**: Behavior comes from prompt + context subscriptions
- ✅ **One AgentExecutor for all**: Supervisor, worker, analyst - same execution engine
- ✅ **Specialization via breadcrumbs**: Different prompts + different context = different agents
- ✅ **Real-time model data**: OpenRouter catalog updated daily with actual pricing
- ✅ **Smart model selection**: Choose optimal models from real data, not hardcoded lists

### **Agent Architecture Pattern:**
```
Agent Behavior = agent.def.v1 + prompt.system.v1 + context_subscriptions
                    ↓              ↓                    ↓
                Basic config   Instructions        What data it sees
```

**This creates incredibly flexible agents where new specializations = new breadcrumbs, not new code!** 🧠

### **Implementation Priority:**
1. **Week 1**: OpenRouter + Ollama LLM tools with model catalog
2. **Week 1**: Update AgentExecutor to use prompt.system.v1 breadcrumbs  
3. **Week 2**: Test supervisor → worker spawning with real model selection
4. **Week 2**: Verify different context subscriptions create different agent behaviors

**Next Phase**: Agent Template System will provide easy patterns for creating these breadcrumb combinations.
