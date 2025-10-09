# Session Core Issues - Fixed

## Issues You Found

### 1. New Session Has Old Messages ❌
**Symptom**: New session shows messages from previous sessions  
**Root Cause**: Session filter was ADDITIVE, not EXCLUSIVE

```javascript
// BEFORE (additive - broken)
recentFilters.any_tags = [...existingTags, `session:${sessionId}`];
// Results: tag=extension:chat OR tag=session:xxx
// Matches: Old messages (have extension:chat) + new messages (have session:xxx)

// AFTER (exclusive - fixed)
recentFilters.any_tags = [`session:${sessionId}`];
// Results: tag=session:xxx ONLY
// Matches: ONLY messages from this session
```

### 2. All Sessions Have Active Tag ❌
**Symptom**: Agent subscribes to ALL sessions simultaneously  
**Root Cause**: Extension didn't pause old session before creating new one

```typescript
// BEFORE (broken)
startNewSession() {
  createBreadcrumb({tags: ['consumer:default-chat-assistant']});
  // Old session STILL has active tag!
}

// AFTER (fixed)
startNewSession() {
  if (activeSessionId) {
    // Pause current first
    updateBreadcrumb(activeSessionId, {
      tags: ['consumer:default-chat-assistant-paused']
    });
  }
  // Then create new
  createBreadcrumb({tags: ['consumer:default-chat-assistant']});
}
```

## Why This Matters

### Before Fix
```
Session 1: consumer:default-chat-assistant ✓
Session 2: consumer:default-chat-assistant ✓
Session 3: consumer:default-chat-assistant ✓

Agent subscribes to ALL THREE!
Context-builder updates ALL THREE!
Chaos!
```

### After Fix
```
Session 1: consumer:default-chat-assistant-paused
Session 2: consumer:default-chat-assistant-paused  
Session 3: consumer:default-chat-assistant ✓

Agent subscribes to ONLY Session 3!
Context-builder updates ONLY Session 3!
Clean!
```

## The Clean Flow Now

```
1. User has active session (Session 1)
   ↓
2. Clicks "New Session"
   ↓
3. Extension:
   a. Gets Session 1 breadcrumb
   b. Removes consumer:default-chat-assistant tag
   c. Adds consumer:default-chat-assistant-paused tag
   d. Updates Session 1 breadcrumb
   ↓
4. Extension:
   a. Creates NEW agent.context.v1
   b. Tags: consumer:default-chat-assistant (ACTIVE!)
   c. Tags: session:${timestamp}
   ↓
5. Agent now subscribes to ONLY new session
6. Context-builder updates ONLY new session
7. User sends message
   → Tagged: session:${new-session-id}
   ↓
8. Context-builder filters recent by session tag
   → Gets ONLY messages from THIS session
   ↓
9. Clean isolated conversation!
```

## Benefits

✅ **Atomic Switching** - One session active at a time  
✅ **Clean Filtering** - Only session messages included  
✅ **No Leakage** - Old sessions don't pollute new ones  
✅ **Proper Isolation** - Each session independent  

## Rebuild & Test

```powershell
cd extension && npm run build && cd ..
docker compose build tools-runner
docker compose up -d

# Test:
# 1. Start chat (creates Session 1)
# 2. Send messages
# 3. Click "New Session"
#    → Should pause Session 1
#    → Create Session 2
# 4. Send message
#    → Should ONLY show in Session 2 context
#    → NO old messages!
```

---

**Status**: ✅ Core Issues Fixed  
**Approach**: Pause before create, exclusive filtering  
**Ready**: Rebuild and test proper session isolation!
