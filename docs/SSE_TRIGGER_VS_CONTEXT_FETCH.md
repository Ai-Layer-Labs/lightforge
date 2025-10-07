# SSE Triggers vs Context Fetches - The Real Model

## 🎯 The Revelation

**Breadcrumbs are ALREADY in the database!**

"Storing for reference" doesn't make sense - they're persistent!

---

## 💡 **What Actually Happens**

### **SSE Event Payload** (from main.rs:604-611)

```json
{
  "type": "breadcrumb.updated",
  "breadcrumb_id": "uuid",
  "owner_id": "uuid",
  "version": 42,
  "tags": ["browser:context"],
  "schema_name": "browser.page.context.v1",
  "updated_at": "2025-10-07...",
  "context": { /* FULL CONTEXT HERE! */ }
}
```

**Key insight:** Event contains the FULL context!

But then agent-executor (line 94):
```typescript
const triggeringBreadcrumb = await this.rcrtClient.getBreadcrumb(event.breadcrumb_id!);
```

**It fetches it again!** Why?

---

## 🔍 **The Reason: llm_hints Transform**

Looking at main.rs:645-678, `get_breadcrumb_context`:

```rust
let Some(mut view) = state.db.get_breadcrumb_context_for(...).await {
  
  // Apply LLM hints if present
  if let Some(hints_value) = view.context.get("llm_hints") {
    let engine = transforms::TransformEngine::new();
    match engine.apply_llm_hints(&view.context, &hints) {
      Ok(transformed) => {
        view.context = transformed;  // ← SERVER-SIDE TRANSFORM!
      }
    }
  }
  
  Ok(Json(view))
}
```

**Aha!**
- SSE event contains **RAW context**
- GET request applies **llm_hints transform**
- Agent fetches to get the **TRANSFORMED** version

---

## 🎯 **The Real Model**

### **SSE = Notification (Trigger)**

```
SSE Event:
  "Hey! user.message.v1 was created/updated"
  + metadata (id, tags, schema)
  + RAW context
  
Purpose: NOTIFICATION that something changed
```

### **Subscriptions = Context Sources to Fetch**

```json
Agent Definition:
{
  "subscriptions": {
    "selectors": [
      {"schema_name": "user.message.v1"},         // Trigger
      {"schema_name": "browser.page.context.v1"}, // Context source
      {"schema_name": "tool.catalog.v1"}          // Context source
    ]
  }
}
```

**Interpretation:**
- `user.message.v1` → When this arrives, PROCESS
- `browser.page.context.v1` → FETCH when processing
- `tool.catalog.v1` → FETCH when processing

---

## 🔄 **The Complete Flow (Corrected)**

### **Current Reality:**

```
1. User sends message
   POST /breadcrumbs → user.message.v1 created
     ↓
2. NATS event published (with full context)
     ↓
3. SSE delivers to agent (notification)
     ↓
4. Agent receives: {breadcrumb_id, schema_name, context}
     ↓
5. Agent RE-FETCHES: GET /breadcrumbs/{id}
   (To get llm_hints transform applied)
     ↓
6. Agent processes IF it has a handler
     ❌ browser.page.context.v1 has no handler!
```

### **What SHOULD Happen:**

```
1. User sends message
   POST /breadcrumbs → user.message.v1
     ↓
2. SSE event: "user.message.v1 created!"
     ↓
3. Agent recognizes: "This is a TRIGGER"
     ↓
4. Agent FETCHES context from ALL subscriptions:
   ├─ GET /breadcrumbs?schema_name=browser.page.context.v1&limit=1
   ├─ GET /breadcrumbs?schema_name=tool.catalog.v1&limit=1
   └─ (All with llm_hints applied)
     ↓
5. Agent assembles unified context:
   {
     trigger: userMessage,
     browser_page_context: latestBrowserContext,
     tool_catalog: latestCatalog
   }
     ↓
6. Agent processes with FULL context
```

---

## 🎯 **The True Subscription Model**

### **Subscriptions Are Context Sources!**

```typescript
type Subscription = {
  // What to subscribe to (for notifications)
  selector: Selector,
  
  // How to handle when event arrives
  on_event: {
    // Is this a trigger or context?
    role: 'trigger' | 'context',
    
    // How to fetch when needed
    fetch: {
      method: 'latest' | 'recent' | 'vector',
      limit?: number,
      view: 'context' | 'full'  // Which API endpoint
    }
  }
};
```

**Example:**

```json
{
  "subscriptions": {
    "selectors": [
      {
        "schema_name": "user.message.v1",
        "role": "trigger",              // SSE event triggers processing
        "fetch": {
          "method": "this_event",       // Use the event that triggered
          "view": "context"
        }
      },
      {
        "schema_name": "browser.page.context.v1",
        "role": "context",              // Fetch when triggered
        "fetch": {
          "method": "latest",           // Get latest from DB
          "limit": 1,
          "view": "context"             // llm_hints applied
        }
      }
    ]
  }
}
```

---

## 💡 **The Processing Model (Corrected)**

### **Two-Phase Processing:**

**Phase 1: SSE Notification** (Push)
```
SSE event arrives →
  Agent: "user.message.v1 created!"
  Decision: "This is a TRIGGER!"
```

**Phase 2: Context Assembly** (Pull)
```
Agent fetches ALL subscribed schemas:
  ├─ Trigger breadcrumb (the one that fired)
  ├─ browser.page.context.v1 (latest)
  ├─ tool.catalog.v1 (latest)
  └─ Any other subscriptions

Assembles unified context:
  {
    user_message: ...,
    browser_context: ...,
    tool_catalog: ...
  }

Processes with full context.
```

---

## 🔄 **This IS What context-builder Does!**

```typescript
// context-builder-tool.ts (simplified)

async execute(input: any, context: ToolExecutionContext) {
  const triggerEvent = input.trigger_event;
  
  // Fetch ALL sources defined in config
  const assembled = {};
  
  for (const source of config.sources) {
    const breadcrumbs = await client.fetchMatching(source);
    assembled[source.schema_name] = breadcrumbs;
  }
  
  // Update agent.context.v1 with assembled data
  return assembled;
}
```

**It doesn't "store" anything! It FETCHES on-demand when triggered!**

---

## 🎯 **The Real Architecture**

### **SSE Event = Trigger Notification**

```
SSE says: "Something changed!"
  ├─ breadcrumb_id (which one)
  ├─ schema_name (what type)
  ├─ context (full data - RAW)
  └─ tags (routing)
```

### **Subscriptions = Context Sources**

```
Agent says: "When triggered, fetch these:"
  ├─ browser.page.context.v1 (latest)
  ├─ tool.catalog.v1 (latest)
  └─ user.message.v1 (recent 20 + vector 10)
```

### **Processing = Trigger + Fetched Context**

```
Trigger arrives (user.message.v1) →
  Fetch subscribed contexts →
  Assemble unified context →
  Process →
  Respond
```

---

## 💡 **Why This Makes Sense**

### **Breadcrumbs Are Persistent!**

```
❌ WRONG: "Store browser context in memory"
  - Why? It's in the database!
  - Duplication of storage
  - Stale data risk

✅ RIGHT: "Fetch browser context when triggered"
  - Database is source of truth
  - Always fresh
  - No state management needed
```

### **SSE Is Just a Notification Bus**

```
SSE doesn't deliver STATE, it delivers NOTIFICATIONS.

Event: "browser.page.context.v1 was updated"
  ↓
Agent: "Okay, noted. When I process next, I'll fetch it."
  ↓
Later: Trigger arrives (user.message.v1)
  ↓
Agent: "Let me fetch all my context sources..."
  GET /breadcrumbs?schema_name=browser.page.context.v1&limit=1
  ↓
Agent: "Now I have fresh browser context + trigger, process!"
```

---

## 🔌 **Refined I/O Port Model**

```
┌────────────────────────────────────────────────────┐
│              Agent/Tool Component                  │
├────────────────────────────────────────────────────┤
│                                                    │
│  📥 SSE INPUT (Notification Bus)                   │
│  ↓ Receives: Event notifications                   │
│  ↓ Contains: Metadata + raw context                │
│  ↓ Purpose: "Something changed!"                   │
│                                                    │
│  🔍 CONTEXT FETCH (On-Demand)                      │
│  ↓ Triggered by: SSE "trigger" events             │
│  ↓ Fetches: ALL subscribed schemas                │
│  ↓ Method: GET /breadcrumbs with filters          │
│  ↓ Returns: ContextView (llm_hints applied)       │
│                                                    │
│  🔄 PROCESSING                                     │
│  ↓ Input: Trigger + fetched contexts              │
│  ↓ Logic: LLM call, tool execution, etc.          │
│                                                    │
│  📤 OUTPUT                                         │
│  ↓ Creates: Response breadcrumbs                  │
│  ↓ Method: POST /breadcrumbs                      │
│  ↓ Triggers: New SSE events                       │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## 🎯 **Your Insight Applied**

### **SSE Events = Triggers** ✅

```
All events arrive via SSE, but:
  - SOME cause processing (triggers)
  - SOME just notify state changed (context updates)
```

### **Context Subscriptions = What to Fetch** ✅

```
Subscriptions aren't "stored locally"
They're "sources to fetch when triggered"

Like context-builder's sources array!
```

---

## 💡 **Unified Model**

```typescript
class UniversalProcessor {
  async processSSEEvent(event: SSEEvent) {
    const subscription = this.findSubscription(event.schema_name);
    
    if (subscription.role === 'trigger') {
      // This event triggers processing!
      
      // Fetch ALL context sources from subscriptions
      const context = {};
      
      for (const sub of this.allSubscriptions) {
        if (sub.role === 'context') {
          const breadcrumbs = await this.fetch(sub.selector);
          context[sub.schema_name] = breadcrumbs[0].context;  // llm_hints applied!
        }
      }
      
      // Add the trigger itself
      context.trigger = event.context;  // Or fetch for transform
      
      // Process with full context
      await this.execute(context);
      
    } else if (subscription.role === 'context') {
      // Just a state update notification
      console.log(`📝 ${event.schema_name} updated (will fetch when triggered)`);
      // Do nothing! It's in the DB when we need it.
    }
  }
}
```

**No local storage needed! Database is the state store!**

---

## 🎯 **Summary**

**Your insights:**

1. ✅ **SSE = Trigger notifications** (not state delivery)
2. ✅ **Breadcrumbs are persistent** (don't need local storage)
3. ✅ **Subscriptions = fetch sources** (what to GET when triggered)

**This means:**
- SSE delivers events (push)
- Agent fetches context on-demand (pull)
- Database is source of truth
- No state duplication

**This is EXACTLY how context-builder works!**

Agent should work the same way:
- Receive SSE trigger
- Fetch all context subscriptions from DB
- Assemble and process

Want me to design how to implement this unified fetch-on-trigger model for AgentExecutor?
