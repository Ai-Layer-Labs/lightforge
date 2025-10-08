# Agent Needs LLM Configuration

## What's Happening

The agent is working correctly! It's just not configured yet.

```
❌ Agent default-chat-assistant has no llm_config_id set!
   Set via Dashboard UI: Agents → Edit Agent → Select LLM Configuration
```

## Why This Happens

The agent definition has:
```json
{
  "llm_config_id": null  ← Not configured!
}
```

**This is correct behavior** - agent refuses to run without configuration (fail-fast!).

## How to Fix

### Option 1: Via Dashboard UI (Recommended)
```
1. Visit http://localhost:8082
2. Left Panel → Click 🤖 Agents tab
3. Click "Default Chat Assistant"
4. LLM Configuration dropdown → Select a config
5. Click "Save Configuration"
6. ✅ Agent now has llm_config_id set!
```

### Option 2: Via Script (Quick)
```powershell
# Auto-configure with existing LLM config
node configure-agent-llm.js

# Output:
# ✅ Found LLM config: 503c2b0d...
# ✅ Found agent: 98ad4c14...
# 🔧 Setting llm_config_id...
# ✅ Agent configured!
```

### Option 3: Manual API Call
```bash
# 1. Find LLM config ID
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8081/breadcrumbs?schema_name=tool.config.v1&tag=tool:config:openrouter"

# Copy the ID from response

# 2. Find agent ID  
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8081/breadcrumbs?schema_name=agent.def.v1"

# Copy agent ID and version

# 3. Update agent
curl -X PATCH http://localhost:8081/breadcrumbs/{agent-id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "If-Match: {version}" \
  -d '{
    "context": {
      "llm_config_id": "{config-id-from-step-1}"
    }
  }'
```

## After Configuration

Once configured, the flow works:

```
User message
  ↓
Agent gets message
  ↓
Agent reads llm_config_id
  ↓
Creates tool.request.v1:
  {
    "tool": "openrouter",
    "config_id": "503c2b0d...",  ← Points to config
    "input": {"messages": [...]}
  }
  ↓
Tool loads config from breadcrumb
  ↓
Tool executes with config
  ↓
Response returns
```

## Why This Design Is Correct

✅ **Explicit Configuration** - Agent won't run without config  
✅ **Fail Fast** - Clear error message  
✅ **User Control** - Must explicitly choose LLM  
✅ **No Defaults** - Forces intentional setup  
✅ **Production Safe** - Can't accidentally use wrong LLM  

## Quick Setup After Fresh Install

```bash
# After ./setup.sh completes:

# 1. Configure OpenRouter (if not done)
node add-openrouter-key.js

# 2. Link agent to config
node configure-agent-llm.js

# 3. Test
# Send chat message via extension
# ✅ Should work!
```

## Or Use Dashboard UI

The dashboard Agent Config panel shows:
- ⚠️ Warning if no config selected
- Dropdown of all available LLM configs
- Save button to apply

**This is the right way - explicit configuration via RCRT breadcrumbs!** 🎉

---

**Status**: Working as designed  
**Action**: Configure agent via Dashboard or run `node configure-agent-llm.js`
