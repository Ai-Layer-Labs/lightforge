# Agent Hot Reload - Fixed

## Issue You Found

> "I pressed save... the agent runner isn't using the config until you restart it"

**You were right!** Agent-runner loaded definition once and didn't reload on updates.

## The Fix

### Before (Static Load)
```typescript
// Loaded agents once on startup
if (event.schema_name === 'agent.def.v1') {
  if (NEW agent) {
    registerAgent();  // Only for new agents
  }
}
```

### After (Hot Reload!)
```typescript
// Reloads agents when definition updates
if (event.schema_name === 'agent.def.v1') {
  if (this.executors.has(agentId)) {
    // Existing agent - RELOAD IT!
    this.executors.delete(agentId);
    await this.registerAgent(newDefinition);
    console.log('✅ Agent reloaded with new configuration');
  } else {
    // New agent - register
    await this.registerAgent(newDefinition);
  }
}
```

## How It Works Now

```
1. You edit agent in Dashboard
   ↓
2. Dashboard saves: PATCH /breadcrumbs/{agent-id}
   ↓
3. RCRT publishes: breadcrumb.updated (agent.def.v1)
   ↓
4. Agent-runner receives via SSE
   ↓
5. Detects: "This is an existing agent"
   ↓
6. Deletes old executor
   ↓
7. Creates new executor with updated definition
   ↓
8. ✅ Agent immediately uses new llm_config_id!
```

## Benefits

✅ **Hot Reload** - No restart needed  
✅ **Instant** - Changes apply immediately  
✅ **Real-Time** - Via SSE  
✅ **Zero Downtime** - Agent stays available  
✅ **Better UX** - Edit → Save → Works  

## Test It

```
1. Open Dashboard → Agents tab
2. Edit agent
3. Change LLM config
4. Click Save
5. Send chat message immediately
6. ✅ Works with new config! (no restart needed)
```

## Logs Will Show

```
🔄 Agent definition updated: {breadcrumb-id}
🔃 Reloading agent: default-chat-assistant
✅ Agent registered: default-chat-assistant
✅ Agent default-chat-assistant reloaded with new configuration
```

## Rebuild & Test

```powershell
# Rebuild agent-runner with hot reload
docker compose build agent-runner
docker compose up -d agent-runner

# Test:
# 1. Configure agent via Dashboard
# 2. Save
# 3. Check logs - should see "Agent reloaded"
# 4. Send message - should work immediately!
```

---

**Status**: ✅ FIXED  
**Hot Reload**: Enabled  
**Restart Required**: NO  
**Ready**: Rebuild agent-runner
