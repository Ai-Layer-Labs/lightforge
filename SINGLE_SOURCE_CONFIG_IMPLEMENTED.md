# Single Source of Truth: IMPLEMENTED ✅

## Your Insight

> "We need a single source of truth for all config and it needs to be RCRT, right context right time"

**Absolutely correct!** Config was being duplicated. Now fixed.

## The Clean Flow (No Duplication)

### 1. Agent Definition
```json
{
  "agent_id": "default-chat-assistant",
  "llm_config_id": "503c2b0d-e178-4c47-b898-a77b90fa33d2",  ← Breadcrumb ID!
  "system_prompt": "..."
}
```

### 2. Agent Creates Request (ONLY Reference!)
```json
{
  "schema_name": "tool.request.v1",
  "context": {
    "tool": "openrouter",
    "config_id": "503c2b0d-e178-4c47-b898-a77b90fa33d2",  ← Pass ID!
    "input": {
      "messages": [...]  ← ONLY messages, NO config!
    }
  }
}
```

### 3. Tool Loads Config (SINGLE SOURCE!)
```javascript
// openrouter.ts execute()
const configId = context.metadata.config_id;

// Load config from breadcrumb (direct ID lookup)
const configBreadcrumb = await rcrtClient.getBreadcrumb(configId);

const config = configBreadcrumb.context.config;
// Now has:
// - model: "google/gemini-2.5-flash"
// - temperature: 0.7
// - maxTokens: 4000
// - apiKey: "secret-id"

// Execute with config
await openrouterAPI({
  model: config.defaultModel,        ← From breadcrumb!
  temperature: config.temperature,   ← From breadcrumb!
  messages: input.messages
});
```

## Before vs After

### Before (Duplication ❌)
```
Agent → Loads config
     → Copies data into tool.request
       {model: "gemini-2.5-flash", temperature: 0.7, ...}
     
Tool → ALSO loads config
    → Has TWO sources
    → Chooses: input.model || config.model
    
Problem: Config loaded twice, data duplicated
```

### After (Single Source ✅)
```
Agent → Gets config ID
     → Passes ONLY ID in tool.request
       {config_id: "uuid", input: {messages: [...]}}
     
Tool → Loads config ONCE from breadcrumb ID
    → Uses config.defaultModel, config.temperature
    
Result: Config loaded once, single source of truth
```

## Benefits

✅ **No Duplication** - Config loaded once, by tool  
✅ **Direct Lookup** - ID-based, no search needed  
✅ **Faster** - One API call vs search + get  
✅ **Cleaner** - Requests smaller (no config data)  
✅ **True RCRT** - Right context (config) at right time (execution)  
✅ **Hot Swap** - Update config breadcrumb, next execution uses it  

## UI Integration

### Agent Config Panel
```
LLM Configuration: [Dropdown▼]
  → openrouter - google/gemini-2.5-flash (temp: 0.7)
  → openrouter - anthropic/claude-3.5-sonnet (temp: 0.5)
  → ollama_local - llama2

When selected:
  → Saves config breadcrumb ID to agent.llm_config_id
  → NOT the tag, the actual breadcrumb ID!
```

### Shown in UI
```
✓ Config ID: 503c2b0d...
  Tool will load this breadcrumb to get model, temperature, etc.
```

## Complete Flow (Clean!)

```
1. User configures LLM via UI
   → Creates tool.config.v1 breadcrumb
   → ID: 503c2b0d-e178-4c47-b898-a77b90fa33d2
   
2. User assigns config to agent via UI
   → Updates agent.def.v1:
     llm_config_id: "503c2b0d..."
   
3. User sends chat message
   → Agent creates tool.request.v1:
     {
       config_id: "503c2b0d...",
       input: {messages: [...]}
     }
   
4. Tool executes
   → Loads breadcrumb 503c2b0d...
   → Gets config.defaultModel
   → Calls API with config
   
5. Response returns
   ← Used exact config from breadcrumb!
```

## Testing

```powershell
# Rebuild
docker compose build agent-runner tools-runner

# Start
docker compose up -d

# Test flow
# 1. Create LLM config via Dashboard (or use existing)
# 2. Open Agents panel
# 3. Edit agent
# 4. Select LLM config from dropdown (saves ID!)
# 5. Save agent
# 6. Send chat message
# 7. Check logs:
#    Agent: "Creating LLM request with config ID: 503c2b0d..."
#    Tool: "Loading config from breadcrumb: 503c2b0d..."
#    Tool: "Using config: model=gemini-2.5-flash"
```

## Why This Is Perfect

**Right Context**: Config breadcrumb  
**Right Time**: When tool executes  
**Right Place**: Tool loads it (not agent)  
**Right Way**: Direct ID reference (no duplication)  

**This IS the RCRT way!** 🎉

---

**Status**: ✅ Implemented  
**Duplication**: Eliminated  
**Source of Truth**: tool.config.v1 breadcrumb  
**Ready**: Rebuild and test!
