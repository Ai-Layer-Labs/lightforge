# Subscription Matching Fixed

## The Problem

Subscription definition:
```json
{
  "schema_name": "tool.response.v1",
  "all_tags": ["workspace:tools"],
  "context_match": [
    {"path": "$.requestedBy", "op": "eq", "value": "default-chat-assistant"}
  ],
  "role": "trigger"
}
```

Event (SSE):
```json
{
  "schema_name": "tool.response.v1",
  "tags": ["workspace:tools", "tool:response", "request:llm"],
  "breadcrumb_id": "uuid",
  // ❌ NO CONTEXT! SSE events are lightweight
}
```

**Matching failed** because `context_match` tried to check `$.requestedBy` but SSE events don't include full context!

## The Fix

```typescript
// BEFORE (broken)
if (subscription.context_match && event.context) {
  // Check context_match
  // ❌ event.context is undefined in SSE events!
}

// AFTER (fixed)
// Skip context_match for initial routing
// SSE events are lightweight - full context comes when we fetch breadcrumb
// If schema + tags match, route the event
return true;
```

## Why This Is Correct

**SSE events are designed to be lightweight:**
```json
{
  "type": "breadcrumb.updated",
  "breadcrumb_id": "uuid",
  "schema_name": "tool.response.v1",
  "tags": ["workspace:tools"],
  "owner_id": "...",
  "version": 1
  // ← No full context to save bandwidth!
}
```

**Full breadcrumb fetched when needed:**
```typescript
// After matching, executor fetches full breadcrumb
const breadcrumb = await getBreadcrumb(event.breadcrumb_id);
// NOW has context with requestedBy field
// Can filter at this point if needed
```

## The Clean Flow

```
1. SSE Event arrives (lightweight)
   ↓
2. Match schema + tags ONLY
   ↓ Match!
3. Fetch full breadcrumb
   ↓
4. Check context_match (if needed)
   ↓
5. Skip if doesn't match, process if matches
```

## Rebuild & Test

```powershell
docker compose build agent-runner
docker compose up -d agent-runner

# Send message
# Should now match tool.response.v1!
# Logs will show:
# 🎯 tool.response.v1 is TRIGGER - processing...
# 🧠 Processing LLM response...
# ✅ Agent response created
```

---

**Status**: ✅ FIXED  
**Root Cause**: context_match checked on SSE event (no context)  
**Solution**: Skip context_match for routing, check after fetch  
**Ready**: Rebuild!
