# Duplicates Fixed

## Issue 1: "Agent responded but no content found" ✅

**Problem**: Extension was trying to parse JSON wrappers before extracting message

**Fix**: Simplified extraction to directly read `context.message`

```typescript
// BEFORE (complex parsing)
if (trimmed.startsWith('```json') || trimmed.startsWith('{')) {
  // Parse JSON, extract message...
}
// Then show messageContent

// AFTER (simple)
const messageContent = breadcrumb.context?.message;
// Done!
```

## Issue 2: Duplicate Responses ✅

**Problem**: Agent had TWO triggers:
```json
{
  "schema_name": "agent.context.v1",  // Trigger 1
  "role": "trigger"
},
{
  "schema_name": "user.message.v1",   // Trigger 2 (fallback)
  "role": "trigger"
}
```

**Flow causing duplicates**:
```
User sends message
  ↓
context-builder auto-triggers
  ├─→ Creates agent.context.v1
  │   └─→ Agent processes (creates LLM request #1)
  │
  └─→ user.message.v1 ALSO triggers agent directly
      └─→ Agent processes AGAIN (creates LLM request #2)
      
Result: 2 LLM requests, 2 responses!
```

**Fix**: Remove fallback trigger
```json
{
  "schema_name": "agent.context.v1",  // ONLY trigger
  "role": "trigger"
}
// user.message.v1 removed as trigger
```

**Clean flow**:
```
User sends message
  ↓
context-builder auto-triggers
  ↓
Creates agent.context.v1
  ↓
Agent processes ONCE
  ↓
ONE LLM request
  ↓
ONE response
```

## Benefits

✅ **No Duplicates** - Agent triggered once  
✅ **Clean Messages** - Direct extraction  
✅ **Predictable** - Single path  
✅ **Efficient** - No wasted LLM calls  

## Rebuild & Test

```powershell
# Rebuild extension
cd extension
npm run build

# Rebuild agent-runner
docker compose build agent-runner
docker compose up -d agent-runner

# Test
# Send message in extension
# Should see ONE response (no duplicates!)
```

---

**Status**: ✅ BOTH FIXED  
**Duplicates**: Removed fallback trigger  
**Messages**: Clean extraction  
**Ready**: Rebuild & enjoy!
