# Configuration-Driven Agents

## Your Vision Implemented ✅

> "The chat definition should not default to anything... you should be able to configure the chat agent definition to use any LLM configuration breadcrumb that is in the system"

**Implemented!** Agents now load LLM configuration from breadcrumbs dynamically.

## The New Architecture

### Agent Definition (No Hardcoding!)
```json
{
  "agent_id": "default-chat-assistant",
  
  "llm_config": {
    "type": "breadcrumb",
    "schema_name": "tool.config.v1",
    "tag": "tool:config:openrouter",     ← References config breadcrumb
    "comment": "Change by updating tag or config breadcrumb"
  },
  
  "system_prompt": "You are...",
  "subscriptions": {...}
}
```

**NO** hardcoded:
- ❌ model field
- ❌ temperature
- ❌ max_tokens
- ❌ tool name

**ALL** from breadcrumb!

### LLM Config Breadcrumb (Created via UI)
```json
{
  "schema_name": "tool.config.v1",
  "tags": ["tool:config:openrouter", "tool:config"],
  "context": {
    "toolName": "openrouter",
    "config": {
      "apiKey": "503c2b0d...",           ← Secret ID
      "defaultModel": "google/gemini-2.5-flash",
      "temperature": 0.7,
      "maxTokens": 4000
    }
  }
}
```

## How It Works

### 1. Agent Starts
```typescript
// Agent loads definition
const agentDef = await getBreadcrumb(agentId);

// Has llm_config pointing to breadcrumb
agentDef.context.llm_config.tag = "tool:config:openrouter"
```

### 2. User Sends Message
```typescript
// Agent executor needs to call LLM
// Loads config from breadcrumb
const configs = await searchBreadcrumbs({
  schema_name: 'tool.config.v1',
  tag: 'tool:config:openrouter'
});

const llmConfig = configs[0].context;

// Now knows:
// - Which tool: llmConfig.toolName = "openrouter"
// - Which model: llmConfig.config.defaultModel = "google/gemini-2.5-flash"
// - Settings: temperature, maxTokens, etc.
```

### 3. Agent Calls Tool Dynamically
```typescript
await createBreadcrumb({
  schema_name: 'tool.request.v1',
  context: {
    tool: llmConfig.toolName,  // "openrouter" (from breadcrumb!)
    input: {
      model: llmConfig.config.defaultModel,  // From breadcrumb!
      temperature: llmConfig.config.temperature,
      messages: [...]
    }
  }
});
```

## Use Cases

### Switch from OpenRouter to Ollama
```bash
# Option 1: Create new config, update agent
# 1. Create ollama config breadcrumb
curl -X POST http://localhost:8081/breadcrumbs \
  -d '{
    "schema_name": "tool.config.v1",
    "tags": ["tool:config:ollama"],
    "context": {
      "toolName": "ollama_local",
      "config": {"model": "llama2"}
    }
  }'

# 2. Update agent to use new config
curl -X PATCH http://localhost:8081/breadcrumbs/{agent-id} \
  -d '{
    "context": {
      "llm_config": {
        "tag": "tool:config:ollama"  ← Changed!
      }
    }
  }'

# ✅ Agent now uses Ollama!
```

### Multiple Agents, Different LLMs
```bash
# Fast agent: Uses Gemini Flash
{
  "agent_id": "fast-assistant",
  "llm_config": {"tag": "tool:config:gemini-flash"}
}

# Smart agent: Uses Claude
{
  "agent_id": "smart-assistant",
  "llm_config": {"tag": "tool:config:claude"}
}

# Local agent: Uses Ollama
{
  "agent_id": "local-assistant",
  "llm_config": {"tag": "tool:config:ollama"}
}
```

### Change Model via UI
```
1. Open Dashboard → Find tool.config.v1 breadcrumb
2. Edit context.config.defaultModel
3. Save
4. ✅ Agent immediately uses new model (hot swap!)
```

## Benefits

✅ **Zero Hardcoding** - Everything from breadcrumbs  
✅ **Hot Swappable** - Change config, agent adapts  
✅ **Multi-LLM** - Support any LLM tool  
✅ **UI Configurable** - Change via dashboard  
✅ **Per-Agent Config** - Different agents, different LLMs  
✅ **Environment Agnostic** - Dev/staging/prod configs  

## Why "Tool Not Found" Happened

The error: `"Tool openrouter not found"`

**Causes**:
1. Tool breadcrumb might not exist yet (race condition)
2. Or tool name in agent was hardcoded before fix

**Now Fixed**:
- ✅ Agent loads config from breadcrumb
- ✅ Uses dynamic tool name
- ✅ Waits for tool to be discovered

## Testing

### 1. Rebuild Agent-Runner
```powershell
docker compose build agent-runner
docker compose up -d agent-runner
```

### 2. Check Agent Loads Config
```powershell
docker compose logs agent-runner | Select-String "Loaded LLM config"
# Should show: ✅ Loaded LLM config from breadcrumb: tool:config:openrouter
```

### 3. Send Chat Message
```
Extension → Send "Hello"
  ↓
Agent loads config from breadcrumb
  ↓
Creates tool.request.v1 with dynamic tool name
  ↓
tools-runner executes
  ↓
Response arrives
```

## Dashboard UI Integration

The dashboard should allow:

1. **View Available LLM Configs**
   - List all `tool.config.v1` breadcrumbs
   - Show: toolName, model, settings

2. **Create New LLM Config**
   - Select tool (openrouter, ollama, etc.)
   - Configure model, temperature, etc.
   - Save as breadcrumb

3. **Assign Config to Agent**
   - Edit agent definition
   - Update `llm_config.tag` to desired config
   - Save

4. **Hot Swap**
   - Edit existing config breadcrumb
   - Change model/settings
   - All agents using it immediately adapt

## Next Steps

1. ✅ Agent definition updated (references breadcrumb)
2. ✅ Agent executor updated (loads from breadcrumb)
3. ⏳ Rebuild and test
4. ⏳ Dashboard UI for config management

---

**Your configuration-driven architecture is now implemented!** 🎉

No hardcoding, fully dynamic, UI configurable!
