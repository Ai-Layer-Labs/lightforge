# RCRT Extension v2 - Session Management

## The RCRT Way

Sessions are managed via **agent.context.v1 breadcrumbs**, not local storage or crypto.randomUUID().

---

## How It Works

### 1. Session IDs

**Timestamp-based** (not UUIDs):
```typescript
const sessionId = `session-${Date.now()}`;
// Example: session-1762277876136
```

**Why timestamp?**
- Chronologically sortable
- Unique (millisecond precision)
- Human-readable (can see when session started)
- Matches existing RCRT extension pattern

### 2. Session State

Sessions are **agent.context.v1 breadcrumbs** created by context-builder:

```json
{
  "schema_name": "agent.context.v1",
  "title": "Chat Session 11/4/2025, 6:37 PM",
  "tags": [
    "agent:context",
    "session:session-1762277876136",
    "consumer:default-chat-assistant",  // ← ACTIVE TAG
    "extension:chat"
  ],
  "context": {
    "assembled_context": "...",
    "message_count": 5
  }
}
```

**Only ONE context breadcrumb** should have `consumer:default-chat-assistant` tag at a time.

### 3. Message Tagging

All messages tagged with session ID:

```json
{
  "schema_name": "user.message.v1",
  "tags": [
    "user:message",
    "extension:chat",
    "session:session-1762277876136"  // ← Links to session
  ]
}
```

**Load conversation history:**
```typescript
// Get all messages for session
const messages = await client.listBreadcrumbs({
  tag: `session:${sessionId}`
});

// Filter to user.message.v1 and agent.response.v1
// Sort by created_at
```

---

## Robustness: Single Active Context

### On Extension Startup

```typescript
// Check for multiple active contexts (cleanup)
const activeContexts = await client.searchBreadcrumbs({
  schema_name: 'agent.context.v1',
  any_tags: ['consumer:default-chat-assistant']
});

if (activeContexts.length > 1) {
  console.warn(`⚠️ Found ${activeContexts.length} active contexts`);
  
  // Keep most recent, deactivate rest
  const sorted = activeContexts.sort((a, b) => 
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  
  for (let i = 1; i < sorted.length; i++) {
    await deactivateContext(sorted[i]);
  }
}
```

### On New Session

```typescript
// FIRST: Deactivate ALL existing contexts
await deactivateAllContexts(client);

// THEN: Create new session
const sessionId = `session-${Date.now()}`;
```

### On Session Switch

```typescript
// FIRST: Deactivate all
await deactivateAllContexts(client);

// THEN: Activate target
const context = await findContextBreadcrumb(client, targetSessionId);
if (context) {
  await activateContext(client, context);
}
```

**Guarantees:** At most ONE context breadcrumb is active at any time.

---

## User Flow

### Starting Extension

1. Extension loads → checks for active session
2. If active session found → restore it
3. If no active session → show SessionManager

### Session Manager View

```
┌─────────────────────────────────────┐
│  Chat Sessions                       │
│  Select a session or create a new one│
├─────────────────────────────────────┤
│                                      │
│  [💬 Session 6:37 PM        Active] │
│     5 minutes ago                    │
│     session-1762277876136            │
│                                      │
│  [💬 Session 4:15 PM              ] │
│     2 hours ago                      │
│     session-1762270900000            │
│                                      │
│  [💬 Session Yesterday            ] │
│     1 day ago                        │
│     session-1762184500000            │
│                                      │
├─────────────────────────────────────┤
│  [+ New Chat Session]                │
└─────────────────────────────────────┘
```

### Chat View

```
┌─────────────────────────────────────┐
│ [≡] RCRT Assistant  🟢  ...876136   │
├─────────────────────────────────────┤
│ [Chat] [Notes] [Save] [Settings]    │
├─────────────────────────────────────┤
│                                      │
│  User: What notes do I have?         │
│  Agent: You have 3 notes about...    │
│                                      │
├─────────────────────────────────────┤
│ [Add Page] [All Tabs] [🗑️]          │
│ [Type message...          ] [Send]  │
└─────────────────────────────────────┘
```

- Click [≡] button → Back to SessionManager
- Click [🗑️] → Start new session (saves current)

---

## Conversation History Loading

**When switching sessions:**

```typescript
// 1. List all breadcrumbs with session tag
const breadcrumbs = await client.listBreadcrumbs({
  tag: `session:${sessionId}`
});

// 2. Fetch full details using /full endpoint
const fullMessages = await Promise.all(
  breadcrumbs.map(bc => client.getBreadcrumb(bc.id, true))
);

// 3. Filter to messages
const conversation = fullMessages.filter(bc => 
  bc.schema_name === 'user.message.v1' || 
  bc.schema_name === 'agent.response.v1'
);

// 4. Sort by created_at (chronological)
conversation.sort((a, b) => 
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
);
```

**Why /full endpoint?**
- Complete breadcrumb data (not LLM-optimized)
- Required for UI display
- See `docs/openapi.json` lines 61-67

---

## Session Lifecycle

### Create New Session

```
User clicks "New Chat Session"
  ↓
deactivateAllContexts()
  → Remove 'consumer:default-chat-assistant' from all contexts
  ↓
sessionId = `session-${Date.now()}`
  ↓
setSessionId(sessionId)
  ↓
User sends first message
  ↓
Message tagged: session:${sessionId}
  ↓
Context-builder sees message
  ↓
Creates agent.context.v1 with:
  - tags: ['agent:context', 'session:${sessionId}', 'consumer:default-chat-assistant']
```

### Switch Sessions

```
User clicks session in list
  ↓
deactivateAllContexts()
  → All contexts lose 'consumer:default-chat-assistant' tag
  ↓
findContextBreadcrumb(targetSessionId)
  ↓
activateContext(context)
  → Add 'consumer:default-chat-assistant' tag
  ↓
loadSessionHistory(sessionId)
  → Load all messages with session:${sessionId} tag
  ↓
Display conversation history
```

---

## Benefits Over crypto.randomUUID()

### Timestamp-based Session IDs

✅ **Sortable** - Can order by session ID alone
✅ **Human-readable** - See when session started
✅ **Matches RCRT pattern** - Existing extension uses this
✅ **No collision** - Millisecond precision + monotonic

### crypto.randomUUID()

❌ Not chronologically sortable
❌ Not human-readable
❌ Doesn't match RCRT conventions
❌ Unnecessary randomness

---

## Context Breadcrumb Management

### Active Tag Pattern

**consumer:default-chat-assistant** = Agent subscribes to this context

**Only ONE context** should have this tag:
- Agents get confused with multiple active contexts
- Messages routed to wrong session
- Context assembly breaks

**Solution:** Always deactivate all before activating one.

### Pause/Resume Pattern

```typescript
// Pause = Remove active tag
tags: tags.filter(t => t !== 'consumer:default-chat-assistant')

// Activate = Add active tag
tags: [...tags, 'consumer:default-chat-assistant']
```

**Agent sees:**
- Active context → Include in subscriptions
- Paused context → Ignore (history only)

---

## Testing

### Test 1: New Session

1. Open extension → SessionManager appears
2. Click "Start First Chat"
3. Send message: "Hello"

**Expected:**
- Session ID created: `session-1762277876136`
- Message tagged: `session:session-1762277876136`
- Agent responds
- Context breadcrumb created by context-builder

**Verify:**
```bash
curl http://localhost:8081/breadcrumbs?schema_name=agent.context.v1
# Should have 1 breadcrumb with your session tag
```

### Test 2: Session Switching

1. Start session 1, send 2 messages
2. Click [≡] → Back to sessions
3. Click "New Chat Session"
4. Send message in session 2
5. Click [≡] → Back to sessions
6. Click session 1

**Expected:**
- Session 1 shows 2 messages (loaded from breadcrumbs)
- Session 2 shows 1 message
- Only selected session is active

**Verify:**
```bash
# Should return exactly 1 active context
curl "http://localhost:8081/breadcrumbs?schema_name=agent.context.v1&any_tags=consumer:default-chat-assistant"
```

### Test 3: Multiple Active Contexts (Edge Case)

1. Manually create 2 active contexts (testing)
2. Reload extension

**Expected:**
- Extension detects 2 active contexts
- Keeps most recent
- Deactivates older one
- Console shows: "⚠️ Found 2 active contexts"

---

## API Endpoints Used

### Creating Sessions

- `POST /breadcrumbs` - Create user.message.v1 (triggers context-builder)
- Context-builder creates agent.context.v1 automatically

### Loading Sessions

- `GET /breadcrumbs?schema_name=agent.context.v1&any_tags=extension:chat`
- `GET /breadcrumbs/{id}/full` - Get complete context breadcrumb

### Loading History

- `GET /breadcrumbs?tag=session:${sessionId}` - List messages
- `GET /breadcrumbs/{id}/full` - Get each message's full data

### Switching Sessions

- `PATCH /breadcrumbs/{id}` - Update context tags
- Use `If-Match` header with version for optimistic locking

---

## Session Persistence

**Sessions persist across:**
- ✅ Browser restarts (breadcrumbs in PostgreSQL)
- ✅ Extension reloads (loads active session on startup)
- ✅ Devices (if same RCRT workspace)

**Unlike Think Extension:**
- ❌ Chrome storage (lost on browser data clear)
- ❌ Per-browser (not synchronized)

---

## Summary

**The RCRT Way:**
- Sessions = Timestamp IDs (not UUIDs)
- State = agent.context.v1 breadcrumbs (not local storage)
- History = Breadcrumbs tagged with session (not in-memory)
- Active = `consumer:default-chat-assistant` tag (only one!)
- Robustness = Always deactivate all before activating one

**Result:**
- Persistent across devices
- Collaborative (multi-user)
- Observable (audit trail)
- Reliable (no duplicate active contexts)

