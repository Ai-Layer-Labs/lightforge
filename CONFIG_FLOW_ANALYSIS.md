# Configuration Flow Analysis

## Current Flow (With Duplication Issues)

### Step 1: User Sends Message
```
Extension → user.message.v1 breadcrumb
```

### Step 2: Agent Runner Picks Up Message
```javascript
// agent-executor.ts loads agent definition
const agentDef = breadcrumb; // Has llm_config.tag

// Agent executor calls loadLLMConfig()
const llmConfig = await this.loadLLMConfig();
// Searches for: tool.config.v1 with tag from agent definition
// Returns: {toolName: "openrouter", config: {model, temperature, ...}}
```

### Step 3: Agent Creates tool.request.v1
```javascript
// agent-executor.ts createLLMRequest()
await createBreadcrumb({
  schema_name: 'tool.request.v1',
  context: {
    tool: llmConfig.toolName,              // "openrouter" (from breadcrumb)
    input: {
      model: llmConfig.config.defaultModel,  // "google/gemini-2.5-flash" (from breadcrumb)
      temperature: llmConfig.config.temperature,  // 0.7 (from breadcrumb)
      messages: [...]
    }
  }
});
```

### Step 4: Tools Runner Picks Up Request
```javascript
// tools-runner receives tool.request.v1
const toolName = breadcrumb.context.tool;  // "openrouter"
const toolInput = breadcrumb.context.input;  // {model, messages, ...}

// Load tool from breadcrumbs
const tool = await loader.loadToolByName('openrouter');

// Execute
const result = await tool.execute(toolInput, context);
```

### Step 5: Tool Executes
```javascript
// openrouter.ts execute()
async execute(input, context) {
  // PROBLEM: Tool ALSO loads configuration!
  const config = await this.loadToolConfiguration(context);
  
  // Now has TWO sources of config:
  // 1. input.model (from agent)
  // 2. config.defaultModel (from tool.config.v1)
  
  // Which one wins?
  const finalModel = input.model || config.defaultModel;  ← Duplication!
}
```

## The Problem: Triple Config Sources!

```
1. Agent loads tool.config.v1
   ↓ Puts model in tool.request.v1
   
2. Tool.request.v1 has model in input
   
3. Tool ALSO loads tool.config.v1
   ↓ Has model in config
   
Which is source of truth? 🤔
```

## The Solution: Single Source of Truth

### Principle
**tool.config.v1 breadcrumb is THE ONLY source**

### Flow Should Be:

```
1. Agent Definition
   {
     "llm_config": {
       "tag": "tool:config:openrouter"  ← ONLY reference, no data!
     }
   }
   
2. Agent Executor
   // DON'T load config here!
   // Just pass reference to tool
   await createBreadcrumb({
     schema_name: 'tool.request.v1',
     context: {
       tool: "openrouter",
       config_tag: "tool:config:openrouter",  ← Pass reference!
       input: {
         messages: [...]  ← ONLY messages, no model!
       }
     }
   });
   
3. Tool Executor
   // Load config from breadcrumb
   const configTag = request.context.config_tag || "tool:config:openrouter";
   const config = await loadConfig(configTag);
   
   // Use config
   const model = config.defaultModel;
   const temperature = config.temperature;
   
   // Execute with config
   await openrouterAPI(model, temperature, messages);
```

## Benefits of Single Source

✅ **One Place to Update** - Edit tool.config.v1, all users affected  
✅ **No Duplication** - Config not copied into requests  
✅ **Hot Swap** - Update config, next execution uses it  
✅ **Consistent** - Everyone sees same config  
✅ **Traceable** - Config changes tracked in breadcrumb history  

## What Needs to Change

### 1. Agent Executor (Simplified)
```typescript
// REMOVE: loadLLMConfig()
// REMOVE: Putting model/temperature in tool.request

// ADD: Just pass config reference
private async createLLMRequest(trigger, context) {
  const llmConfigTag = this.agentDef.llm_config?.tag || 'tool:config:openrouter';
  
  await createBreadcrumb({
    schema_name: 'tool.request.v1',
    context: {
      tool: 'openrouter',  // Or get from config
      config_tag: llmConfigTag,  ← Reference!
      input: {
        messages: [...]  ← ONLY messages!
      }
    }
  });
}
```

### 2. Tool Executor (Loads Config)
```typescript
// Tool is THE ONLY place that loads config
async execute(input, context) {
  // Get config tag from request
  const configTag = context.metadata?.config_tag || 
                    context.requestMetadata?.config_tag ||
                    'tool:config:openrouter';  // fallback
  
  // Load config from breadcrumb
  const config = await this.loadToolConfiguration(configTag, context);
  
  // Use config
  const model = config.defaultModel;
  const temperature = input.temperature || config.temperature;
  
  // Execute
  return await this.callAPI(model, temperature, input.messages);
}
```

## The Clean Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Single Source of Truth: tool.config.v1 Breadcrumb         │
├─────────────────────────────────────────────────────────────┤
│ {                                                           │
│   "schema_name": "tool.config.v1",                         │
│   "tags": ["tool:config:openrouter"],                      │
│   "context": {                                             │
│     "toolName": "openrouter",                              │
│     "config": {                                             │
│       "defaultModel": "google/gemini-2.5-flash",           │
│       "temperature": 0.7,                                   │
│       "maxTokens": 4000                                     │
│     }                                                        │
│   }                                                          │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                         ↓
         ┌───────────────┴───────────────┐
         │                               │
    ┌────▼─────┐                   ┌─────▼────┐
    │ Agent    │                   │ Tool     │
    │          │                   │          │
    │ Refs tag │                   │ Loads it │
    └──────────┘                   └──────────┘
         │                               │
         │ tool.request.v1               │
         │ config_tag: "tool:config:..."│
         └──────────────►────────────────┘
                        │
                        ▼
                   Tool Execution
                   (uses config)
```

## Test After Fix

```powershell
# Rebuild
docker compose build tools-runner agent-runner

# Test
# 1. Send chat message
# 2. Check logs - should show ONE config load (in tool)
# 3. Change config in UI
# 4. Send another message
# 5. Should use NEW config immediately
```

Should I implement this single-source-of-truth fix? It will clean up the duplication and make config management perfect.
