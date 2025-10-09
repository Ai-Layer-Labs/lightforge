# Session Isolation - COMPLETE FIX

## 🎯 What We Fixed

### Problem: "Sessions are bleeding into each other"
**Actually**: Semantic search (intended) looked like session bleed (bug)

### Two Fixes Applied:

## ✅ Fix #1: Agent Response Session Tags

**Issue**: Agent responses didn't have session tags → couldn't filter them

**Solution**: Inherit session tag from trigger
```typescript
// In agent-executor.ts
const sessionTag = trigger.tags?.find(t => t.startsWith('session:'));
const tags = [...baseTags, sessionTag];  // Add to response
```

**Result**: 
- Agent responses now tagged with `session:abc123`
- Can filter responses by session
- Clean session isolation

---

## ✅ Fix #2: Separate Current vs Semantic Context

**Issue**: Recent (session) + Semantic (all sessions) merged into one array → confusing!

**Solution**: Split into two distinct arrays

**File**: `context-builder-tool.ts`

### Input (Config):
```javascript
sources: [
  {
    schema_name: 'user.message.v1',
    method: 'recent',
    conversation_scope: 'current'  // ← THIS session only
  },
  {
    schema_name: 'user.message.v1',
    method: 'vector',  // ← ALL sessions (semantic)
    nn: 10
  }
]
```

### Output (Separated):
```javascript
{
  "current_conversation": [
    // THIS session only (recent + chronological)
    {"role": "user", "content": "I'm testing", "source": "session"},
    {"role": "assistant", "content": "How can I help?", "source": "session"}
  ],
  
  "relevant_history": [
    // ALL sessions (semantic + relevant)
    {"role": "user", "content": "similar question", "source": "semantic"}
  ],
  
  "chat_history": [
    // Combined array (backwards compatibility)
  ]
}
```

---

## 🎓 Why The Hybrid Approach

### Recent (Session-Filtered):
- **Purpose**: Maintain conversation context
- **Scope**: THIS session only
- **Method**: Chronological (last 20)
- **Key**: `current_conversation`

### Semantic (All Sessions):
- **Purpose**: Find relevant past knowledge
- **Scope**: ALL sessions
- **Method**: Vector similarity (top 10)
- **Key**: `relevant_history`

### Why Both?

**Example**: User asks "What's my favorite color?"

- **Current conversation**: Empty (just started session)
- **Relevant history**: Finds "My favorite color is blue" from Session 3 days ago
- **Result**: Agent can answer even in new session! ✅

---

## 📊 LLM Receives Clear Context

### Before (Confusing):
```
chat_history: [all messages mixed together, can't tell which is current]
```

### After (Clear):
```
current_conversation: [what we're talking about NOW]
relevant_history: [related things from the past]
```

The LLM can now:
- Prioritize current conversation
- Use relevant history as background
- Know which is which

---

## 🧪 Testing

### Test Session Isolation:
1. **Session 1**: Say "My name is Alice"
2. **Session 2**: Say "My name is Bob"
3. **Session 1**: Ask "What's my name?"
4. **Expected**: 
   - `current_conversation`: ["My name is Alice", "What's my name?"]
   - `relevant_history`: ["My name is Bob"] ← Semantic match but different session
   - **Answer**: "Your name is Alice" ✅

### Test Semantic Memory:
1. **Session 1**: "I love pizza"
2. **Session 2** (new): "What food do I like?"
3. **Expected**:
   - `current_conversation`: ["What food do I like?"]
   - `relevant_history`: ["I love pizza"] ← From old session!
   - **Answer**: "You mentioned you love pizza" ✅

---

## 📦 Rebuild Commands

```bash
# 1. Runtime (session tag inheritance)
pnpm --filter @rcrt-builder/runtime run build
pnpm --filter agent-runner run build

# 2. Tools (context separation)
pnpm --filter @rcrt-builder/tools run build
pnpm --filter tools-runner run build

# 3. Restart services
docker-compose restart agent-runner tools-runner
```

---

## 🎯 Benefits

✅ **Session isolation** - Current conversation stays clean
✅ **Semantic memory** - Can recall from any session
✅ **Clear distinction** - LLM knows which is which
✅ **Backwards compatible** - `chat_history` still available
✅ **THE RCRT WAY** - Tags carry context, separation is explicit

---

*Hybrid search: Best of both worlds!*

