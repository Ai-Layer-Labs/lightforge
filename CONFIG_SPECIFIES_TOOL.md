# Config Breadcrumb Specifies Tool

## Your Question

> "Does the openrouter Configuration breadcrumb point to the tool that it's made for so it can route requests to the right place?"

**Answer**: It SHOULD, and now it DOES!

## The Architecture

### tool.config.v1 Breadcrumb
```json
{
  "schema_name": "tool.config.v1",
  "tags": ["tool:config:openrouter"],
  "context": {
    "toolName": "openrouter",  ← Specifies which tool!
    "config": {
      "defaultModel": "google/gemini-2.5-flash",
      "temperature": 0.7,
      "maxTokens": 4000,
      "apiKey": "secret-id"
    }
  }
}
```

**The config breadcrumb contains:**
1. ✅ **Which tool**: `toolName: "openrouter"` (or `"ollama_local"`, etc.)
2. ✅ **Tool configuration**: `config: {model, temperature, ...}`

## The Flow (Fixed!)

### Before (Hardcoded ❌)
```typescript
// Agent had tool hardcoded
context: {
  tool: 'openrouter',  // ← Hardcoded!
  config_id: configId
}
```

### After (Dynamic ✅)
```typescript
// Agent reads toolName from config breadcrumb
const config = await getBreadcrumb(configId);
const toolName = config.context.toolName;  // "openrouter" or "ollama_local"

context: {
  tool: toolName,  // ← From config!
  config_id: configId
}
```

## Benefits

✅ **Config Fully Controls Routing**
- Want to use OpenRouter? → `toolName: "openrouter"`
- Want to use Ollama? → `toolName: "ollama_local"`
- Want custom LLM? → `toolName: "custom-llm"`

✅ **One Place to Change**
- Edit config breadcrumb
- Change `toolName` from "openrouter" to "ollama_local"
- Agent automatically routes to new tool

✅ **Multiple Configs for Same Tool**
```json
// Fast config
{
  "toolName": "openrouter",
  "config": {"defaultModel": "google/gemini-2.5-flash"}
}

// Smart config
{
  "toolName": "openrouter",
  "config": {"defaultModel": "anthropic/claude-3.5-sonnet"}
}

// Local config
{
  "toolName": "ollama_local",
  "config": {"model": "llama2"}
}
```

## Complete Flow (Fully Dynamic)

```
1. User creates LLM config via Dashboard
   → tool.config.v1 breadcrumb
   → toolName: "openrouter"
   → config: {model, temperature, ...}

2. User assigns config to agent
   → agent.llm_config_id = config-breadcrumb-id

3. User sends message
   ↓
4. Agent loads config breadcrumb
   → Gets toolName: "openrouter"
   → Creates tool.request.v1:
     {
       tool: "openrouter",  ← From config!
       config_id: config-breadcrumb-id
     }

5. Tools-runner routes to correct tool
   → Finds "openrouter" tool
   → Loads config from config-breadcrumb-id
   → Executes with config

6. Response returns
```

## Switch LLMs (Easy!)

### Before Fix
```
To switch from OpenRouter to Ollama:
1. Edit agent definition
2. Change hardcoded tool name
3. Change config
4. Restart agent-runner
```

### After Fix
```
To switch from OpenRouter to Ollama:
1. Create ollama config (tool.config.v1)
   → toolName: "ollama_local"
2. Update agent → Select ollama config
3. ✅ Done! Next message uses Ollama
```

## Rebuild & Test

```powershell
docker compose build agent-runner
docker compose up -d agent-runner

# Test:
# 1. Send message - should use tool from config
# 2. Logs should show:
#    "✅ Config specifies tool: openrouter"
#    "📤 Creating LLM request for tool: openrouter"
```

## Why This Is The Right Design

**Config breadcrumb is the complete LLM specification:**
- Which tool to use (`toolName`)
- How to configure it (`config`)
- Which API key (`config.apiKey`)

**Agent just references the config ID** - doesn't know or care about the details.

**Tool gets everything from one breadcrumb** - true single source of truth!

---

**Status**: ✅ FIXED  
**Hardcoding**: Removed  
**Config**: Fully controls tool selection  
**Ready**: Rebuild agent-runner
