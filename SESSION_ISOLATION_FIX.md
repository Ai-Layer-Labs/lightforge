# Session Isolation Fix - THE RCRT WAY

## 🐛 The Problem - Session Bleed

**Symptom**: Messages from Session A appear in Session B's chat history

**Example**:
```
Session 1 (4:45:10 PM):
- "just running some tests"
- "what about now?"  ← From Session 2!
- "What am I looking at now"  ← From Session 2!
- "generate a random number"  ← From Session 2!

Session 2 (2:55:31 PM):
- "what about now?"
- "What am I looking at now"
- "generate a random number"
```

## 🔍 Root Cause

### The Flow:
1. User sends message with `session:abc123` tag ✅
2. Context-builder creates context with `session:abc123` tag ✅
3. Agent receives trigger (has `session:abc123` in tags) ✅
4. **Agent creates response with ONLY `['agent:response', 'chat:output']`** ❌
5. Context-builder searches for recent responses → Gets ALL responses!

### The Bug:
```typescript
// OLD (broken):
tags: breadcrumbDef.tags || ['agent:response', 'chat:output'],
// ❌ Session tag lost!
```

The **LLM doesn't know about session tags** - they're infrastructure metadata, not something we want in the prompt.

## ✅ The Fix - Session Tag Inheritance

**File**: `rcrt-visual-builder/packages/runtime/src/agent/agent-executor.ts`

```typescript
// THE RCRT WAY: Extract session tag from trigger
const sessionTag = trigger.tags?.find((t: string) => t.startsWith('session:'));
const baseTags = breadcrumbDef.tags || ['agent:response', 'chat:output'];

// Add session tag if found (keeps responses in same session as trigger)
const tags = sessionTag && !baseTags.includes(sessionTag)
  ? [...baseTags, sessionTag]
  : baseTags;

// Also add to context for easy querying
const context = {
  ...breadcrumbDef.context,
  session_id: sessionTag ? sessionTag.replace('session:', '') : undefined,
  trigger_id: trigger.id
};
```

## 🎯 How It Works

### Before (Broken):
```
User Message:
  tags: ['user:message', 'extension:chat', 'session:abc123']

Context Update:
  tags: ['agent:context', 'consumer:default-chat-assistant', 'session:abc123']

Agent Response:
  tags: ['agent:response', 'chat:output']  ❌ No session tag!
```

### After (Fixed):
```
User Message:
  tags: ['user:message', 'extension:chat', 'session:abc123']

Context Update:
  tags: ['agent:context', 'consumer:default-chat-assistant', 'session:abc123']

Agent Response:
  tags: ['agent:response', 'chat:output', 'session:abc123']  ✅ Inherited!
  context: { session_id: 'abc123' }  ✅ Also in context!
```

## 🔄 Why This Matters

The context-builder uses this filter in `context-builder-config.json`:
```json
{
  "schema_name": "agent.response.v1",
  "fetch": {
    "method": "recent",
    "limit": 10,
    "conversation_scope": "current"  ← Filters by session!
  }
}
```

With the fix:
- ✅ Search for `agent.response.v1` + `session:abc123` → Only Session 1 responses
- ✅ Each session sees only its own history
- ✅ Clean conversation isolation

## 🧪 Testing

1. **Create Session 1**, send: "Hello session 1"
2. **Create Session 2**, send: "Hello session 2"  
3. **Switch to Session 1**, send: "What did I say?"
4. **Expected**: Agent only sees "Hello session 1"
5. **Before Fix**: Agent would see both messages ❌
6. **After Fix**: Agent sees only Session 1 message ✅

## 📦 Rebuild Commands

```bash
cd rcrt-visual-builder
pnpm install  # If needed
pnpm --filter @rcrt-builder/runtime run build
pnpm --filter agent-runner run build
docker-compose restart agent-runner
```

## 🎓 Lessons Learned - THE RCRT WAY

1. **Tags carry context** - Session, user, workspace - all in tags
2. **Infrastructure tags should inherit** - Agents shouldn't have to know about them
3. **LLM output is pure** - No infrastructure metadata in JSON
4. **Runtime adds the glue** - Session tags inherited automatically
5. **Both tag AND context** - Redundant but enables different query patterns

---

## Related Issues This Fixes

- ✅ Session isolation in chat
- ✅ Multi-user support (when we add user tags)
- ✅ Workspace isolation (already works, same pattern)
- ✅ Clean conversation history

---

*Everything is a breadcrumb. Tags keep them organized.*

