# NO FALLBACKS - THE RCRT WAY

## 🔥 Why Fallbacks Are Evil

### The Bug They Caused

**Symptom**: Session 2 showed messages from Session 1

**Root Cause**: Fallback logic in context-builder

```javascript
// EVIL CODE (nuked):
let existing = await searchBySession(sessionId);

if (existing.length === 0 && sessionId) {
  // ❌ FALLBACK: Try consumer-only search
  existing = await searchByConsumer(consumerId);
}

if (existing.length > 0) {
  // Updates FIRST result (might be from different session!)
  updateBreadcrumb(existing[0].id);  // ❌ WRONG SESSION!
}
```

### What Happened:

1. **Session 1** → Context-builder creates context breadcrumb A
   - Tags: `consumer:default-chat-assistant, session:session-1`

2. **Session 2** → Context-builder searches `session:session-2` → Not found
   - **FALLBACK**: Searches `consumer:default-chat-assistant` → **Finds A** ❌
   - **Updates A** with Session 2's messages
   - Now breadcrumb A has messages from BOTH sessions!

3. **Session 1** → Agent loads context → Sees Session 2's messages! 🤯

---

## ✅ The Fix - NO FALLBACK

```javascript
// THE RCRT WAY (clean):
const existing = await searchBySession(sessionId);

if (existing.length > 0) {
  // Found the right session's context
  updateBreadcrumb(existing[0].id);
} else {
  // Doesn't exist yet - CREATE it
  createBreadcrumb({ tags: [`session:${sessionId}`, ...] });
}

// NO FALLBACK! Either exact match or create new!
```

### Why This Is Better:

✅ **Session 1** → Searches `session:session-1` → Not found → **Creates new** breadcrumb A
✅ **Session 2** → Searches `session:session-2` → Not found → **Creates new** breadcrumb B  
✅ **Session 1** → Searches `session:session-1` → **Finds A** → Updates A (correct!)
✅ **Session 2** → Searches `session:session-2` → **Finds B** → Updates B (correct!)

**Result**: Each session has its own context breadcrumb! ✅

---

## 🎓 The Fallback Anti-Pattern

### Fallbacks Hide Bugs:

**With Fallback**:
```
Search session:abc → Not found → Use fallback → Wrong data returned
Developer thinks: "It works!"
User thinks: "Why am I seeing wrong messages?"
```

**Without Fallback**:
```
Search session:abc → Not found → Create new → Correct!
OR
Search session:abc → Not found → Error → FIX THE BUG!
```

### Why We Had Fallbacks:

- "What if session tag is missing?"
- "What if the search fails?"
- "Better to show something than nothing?"

### Why They're Wrong:

- **Masks bugs** - System "works" but incorrectly
- **Creates confusion** - Wrong data is worse than no data
- **Prevents fixes** - Developer doesn't see the real problem

---

## 🔧 Other Fallbacks Nuked Today

### 1. Extension Page Tracker
**Removed**: Dynamic import fallback
**Result**: Clear error → We fixed it (use fetch directly)

### 2. Workflow Orchestrator  
**Removed**: Field name fallback between `depends_on` and `dependencies`
**Fixed**: Support both explicitly, log which one we're using

### 3. LLM Context Format
**Removed**: Backwards compatible `chat_history`
**Result**: Clean separation, no redundancy

---

## 📏 The Rule

> **If it doesn't work correctly, it should fail clearly.**
> **Fallbacks hide failures.**
> **THE RCRT WAY: Explicit > Implicit**

### Good Error Handling:
```javascript
if (!sessionId) {
  throw new Error('Session ID required for context assembly');
}
// Clear, explicit, forces fix
```

### Bad Fallback:
```javascript
const session = sessionId || 'default';  // ❌ Masks the bug!
```

---

## 🧪 Testing Without Fallbacks

**Before** (with fallback):
- Session isolation seems to work
- Messages bleed between sessions
- Hard to debug (system "works")

**After** (no fallback):
- Search by exact session tag
- Not found? Create new one
- Each session perfectly isolated
- Bugs are obvious immediately

---

## 🚀 Deploy

```bash
# Tools-runner (context-builder fix)
docker-compose restart tools-runner

# Extension (simplified session creation)
# chrome://extensions/ → RCRT Chat → Reload
```

---

## 🎯 Result

✅ **Perfect session isolation** - Each session has unique context breadcrumb
✅ **No cross-contamination** - Search by session tag only
✅ **Clear errors** - If tag missing, we know immediately  
✅ **THE RCRT WAY** - Explicit, debuggable, correct

---

*NO FALLBACKS. System works correctly or fails loudly. THE RCRT WAY.*

