# Session Isolation Fix - THE RCRT WAY

## 🐛 The Problem - Confusing Session + Semantic Mix

**Symptom**: Messages from old sessions appear in new session's chat history (but it's actually semantic search!)

**Example (Before Fix)**:
```
Session 1 (5:19 PM) - chat_history:
- "I'm doing some testing"          ← Current session
- "just running some tests"         ← Current session  
- "what about now?"                 ← OLD session (semantic match!)
- "What am I looking at now"        ← OLD session (semantic match!)
```

**It LOOKS like session bleed, but actually:**
- Recent (session-filtered): First 2 messages ✅
- Semantic (all sessions): Last 2 messages ✅

**The real problem**: They're mixed in ONE array, so you can't tell which is which!

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

## ✅ The Fix - Hybrid Approach with Clear Separation

### Fix #1: Session Tag Inheritance (Agent Responses)

**File**: `rcrt-visual-builder/packages/runtime/src/agent/agent-executor.ts`

```typescript
// THE RCRT WAY: Extract session tag from trigger
const sessionTag = trigger.tags?.find((t: string) => t.startsWith('session:'));
const baseTags = breadcrumbDef.tags || ['agent:response', 'chat:output'];

// Add session tag to responses (enables session filtering)
const tags = sessionTag && !baseTags.includes(sessionTag)
  ? [...baseTags, sessionTag]
  : baseTags;

// Also add to context
const context = {
  ...breadcrumbDef.context,
  session_id: sessionTag ? sessionTag.replace('session:', '') : undefined,
  trigger_id: trigger.id
};
```

### Fix #2: Separate Current vs Semantic Context

**File**: `rcrt-visual-builder/packages/tools/src/context-tools/context-builder-tool.ts`

**THE RCRT WAY - Hybrid Strategy**:
- **Recent search** with `conversation_scope: 'current'` → Filters by session tag
- **Vector search** with no session filter → Finds semantically relevant from ALL sessions

**Output Format** (Now Clear):
```javascript
{
  "current_conversation": [
    // Only messages from THIS session (chronological)
    {"role": "user", "content": "...", "source": "session"}
  ],
  "relevant_history": [
    // Semantically similar from ALL sessions
    {"role": "user", "content": "...", "source": "semantic"}
  ],
  "chat_history": [
    // Combined (backwards compatibility)
  ]
}
```

## 🎯 How The Hybrid Strategy Works

### Context Sources (2 searches per schema):

**User Messages**:
1. **Recent (session-filtered)**: Last 20 from THIS session only
2. **Vector (semantic)**: Top 10 relevant from ALL sessions

**Agent Responses**:
1. **Recent (session-filtered)**: Last 20 from THIS session only  
2. **Vector (semantic)**: Top 10 relevant from ALL sessions

### Output (Now Separated):

```javascript
{
  "current_conversation": [
    // THIS session only (chronological order)
    {"role": "user", "content": "I'm doing some testing", "source": "session"},
    {"role": "user", "content": "just running some tests", "source": "session"}
  ],
  
  "relevant_history": [
    // ALL sessions (semantic relevance)
    {"role": "user", "content": "what about now?", "source": "semantic"},
    {"role": "user", "content": "What am I looking at", "source": "semantic"}
  ],
  
  "chat_history": [
    // Combined for backwards compatibility
    // (All messages, deduplicated)
  ]
}
```

### Why This Is Better:

✅ **LLM can prioritize** current conversation over semantic matches
✅ **Clear distinction** between "what we just talked about" vs "related topics"
✅ **No confusion** - separated = self-documenting
✅ **Semantic search still works** - finds relevant info across ALL sessions
✅ **Session isolation maintained** - current conversation is clean

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

