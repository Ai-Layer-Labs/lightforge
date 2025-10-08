# Agent LLM Configuration Fix

## Issues You Identified

1. ❌ Agent has hardcoded `model: "openrouter/anthropic/claude-3.5-sonnet"`
2. ❌ Shouldn't default to openrouter
3. ❌ Should be able to select ANY LLM tool breadcrumb
4. ❌ Chat definition not configurable via breadcrumbs

## The Fix

### Before (Hardcoded)
```json
{
  "agent_id": "default-chat-assistant",
  "model": "openrouter/anthropic/claude-3.5-sonnet",  ← Hardcoded!
  "temperature": 0.7,
  "max_tokens": 4000
}
```

### After (Configurable)
```json
{
  "agent_id": "default-chat-assistant",
  
  "llm_config": {
    "type": "breadcrumb",
    "schema_name": "tool.config.v1",
    "tag": "tool:config:openrouter",          ← References breadcrumb!
    "comment": "Agent uses LLM config from breadcrumb"
  }
}
```

## How It Should Work

### 1. You Create LLM Config via UI
```json
// Created by Dashboard UI
{
  "schema_name": "tool.config.v1",
  "tags": ["tool:config:openrouter", "tool:config"],
  "context": {
    "toolName": "openrouter",
    "config": {
      "apiKey": "secret-id-here",
      "defaultModel": "google/gemini-2.5-flash",
      "temperature": 0.7,
      "maxTokens": 4000
    }
  }
}
```

### 2. Agent Loads Config Dynamically
```typescript
// Agent executor loads config from breadcrumb
const llmConfig = agent.context.llm_config;

// Search for config breadcrumb
const configs = await client.searchBreadcrumbs({
  schema_name: llmConfig.schema_name,
  tag: llmConfig.tag
});

// Use latest config
const config = configs[0].context.config;

// Now agent knows:
// - Which tool: "openrouter"
// - Which model: "google/gemini-2.5-flash"  
// - Settings: temperature, maxTokens, etc.
```

### 3. Agent Calls Tool with Config
```typescript
// Create tool request using config
await client.createBreadcrumb({
  schema_name: 'tool.request.v1',
  context: {
    tool: config.toolName,  // "openrouter"
    input: {
      model: config.defaultModel,  // "google/gemini-2.5-flash"
      temperature: config.temperature,
      messages: [...]
    }
  }
});
```

## Benefits

✅ **No Hardcoding** - Agent doesn't know about openrouter  
✅ **Flexible** - Switch to ollama by changing one breadcrumb  
✅ **UI Configurable** - Change model via dashboard  
✅ **Multiple Configs** - Can have dev/staging/prod LLM configs  
✅ **Hot Swap** - Update config breadcrumb, agent uses new settings  

## How to Switch LLMs

### Option 1: Change Existing Config
```bash
# Via Dashboard UI:
# 1. Find tool.config.v1 breadcrumb
# 2. Edit context.toolName from "openrouter" to "ollama_local"
# 3. Update context.config with ollama settings
# 4. Save
# ✅ Agent now uses ollama!
```

### Option 2: Create New Config, Update Agent
```bash
# 1. Create new config
curl -X POST http://localhost:8081/breadcrumbs \
  -d '{
    "schema_name": "tool.config.v1",
    "tags": ["tool:config:ollama"],
    "context": {
      "toolName": "ollama_local",
      "config": {"model": "llama2"}
    }
  }'

# 2. Update agent definition
curl -X PATCH http://localhost:8081/breadcrumbs/{agent-id} \
  -d '{
    "context": {
      "llm_config": {
        "tag": "tool:config:ollama"  ← Changed from openrouter!
      }
    }
  }'

# ✅ Agent now uses ollama!
```

## Agent Executor Needs Update

The agent-executor needs to:

1. **Load LLM config from breadcrumb**
```typescript
const llmConfigTag = agentDef.context.llm_config.tag;
const configs = await client.searchBreadcrumbs({
  schema_name: 'tool.config.v1',
  tag: llmConfigTag
});
const llmConfig = configs[0].context;
```

2. **Use config when calling LLM**
```typescript
await client.createBreadcrumb({
  schema_name: 'tool.request.v1',
  context: {
    tool: llmConfig.toolName,  // Dynamic!
    input: {
      model: llmConfig.config.defaultModel,
      temperature: llmConfig.config.temperature,
      messages: [...]
    }
  }
});
```

## Why openrouter Tool Not Found

The error: `"Tool openrouter not found"`

**Cause**: Agent is trying to call "openrouter" tool directly but:
1. Tool breadcrumbs might not be loaded yet
2. Or agent-executor isn't loading config properly

**Check**:
```bash
# Verify openrouter tool exists
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8081/breadcrumbs?schema_name=tool.v1&tag=tool:openrouter"

# Should return the openrouter tool breadcrumb
```

## Updated Agent Definition

The agent now:
- ❌ No hardcoded model
- ✅ References llm_config breadcrumb
- ✅ Loads config dynamically
- ✅ Works with any LLM tool
- ✅ Fully configurable via UI

## Next Steps

1. ✅ Agent definition updated (no hardcoded model)
2. ⏳ Agent executor needs update to load config from breadcrumb
3. ⏳ Test with openrouter config breadcrumb
4. ⏳ Test switching to ollama

---

**Your vision of configuration-driven agents is the right architecture!**
