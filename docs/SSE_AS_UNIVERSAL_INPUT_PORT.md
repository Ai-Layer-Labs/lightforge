# SSE as Universal Input Port - Architectural Analysis

## 🎯 The Core Question

**"Do all triggers come from SSE? Is that what defines it as a trigger?"**

This question reveals a fundamental architectural principle!

---

## 📡 Input Mechanisms in RCRT

Let's map ALL ways data enters the system:

### **1. REST API** (State Manipulation)

```
POST   /breadcrumbs        → Create state
PATCH  /breadcrumbs/{id}   → Update state
DELETE /breadcrumbs/{id}   → Delete state
GET    /breadcrumbs         → Read state (no side effects)
```

**Purpose:** CRUD operations, state management  
**Triggers processing?** NO! Just changes database.  
**Example:** Extension updates browser context breadcrumb

---

### **2. SSE/NATS** (Event Stream)

```
SSE: GET /events/stream → Real-time event feed
NATS: bc.{id}.updated   → Backend pub/sub
```

**Purpose:** Real-time notifications, reactive processing  
**Triggers processing?** YES! This is how agents/tools wake up.  
**Example:** Agent receives event → processes → responds

---

### **3. Webhooks** (External Push - OUTPUT only)

```
Agent registers webhook → RCRT POSTs to URL
```

**Purpose:** Push events to external systems  
**Triggers processing?** NO - this is an OUTPUT, not input  
**Example:** Slack notification on breadcrumb create

---

## 💡 **The Insight**

### **SSE IS the Input Port for Real-Time Processing!**

```
Write API (REST)          Read API (REST)         Event Stream (SSE)
     ↓                           ↓                      ↓
┌──────────┐            ┌──────────┐            ┌──────────┐
│ Database │            │ Database │            │ Database │
│  UPDATE  │            │   READ   │            │  WATCH   │
└──────────┘            └──────────┘            └────┬─────┘
                                                     │
                                              ┌──────┴─────┐
                                              │ NATS Event │
                                              └──────┬─────┘
                                                     │
                                     ┌───────────────┼───────────────┐
                                     ↓               ↓               ↓
                              ┌──────────┐   ┌──────────┐   ┌──────────┐
                              │  Agent   │   │   Tool   │   │Dashboard │
                              │ PROCESS  │   │ EXECUTE  │   │  UPDATE  │
                              └──────────┘   └──────────┘   └──────────┘
```

**Key:**
- REST = State manipulation (synchronous)
- SSE = Event notification (asynchronous, reactive)

---

## 🔄 Complete Data Flow

### **Flow 1: User Sends Message**

```
1. Extension:
   POST /breadcrumbs → Create user.message.v1
   ↓ Returns 201
   
2. RCRT Server:
   ← Inserts into DB
   ← Publishes to NATS: bc.{id}.created
   
3. NATS → SSE:
   ← Broadcast to subscribed agents
   
4. Agent-Runner:
   ← Receives via SSE ✅ THIS IS THE TRIGGER!
   ← Calls agent.processEvent()
   ← Agent responds
```

**SSE = The actual trigger mechanism!**

### **Flow 2: Browser Context Updates**

```
1. Extension:
   PATCH /breadcrumbs/{id} → Update browser.page.context.v1
   ↓ Returns 200
   
2. RCRT Server:
   ← Updates DB (version++)
   ← Publishes to NATS: bc.{id}.updated
   
3. NATS → SSE:
   ← Broadcast to subscribed agents
   
4. Agent-Runner:
   ← Receives via SSE ✅ ARRIVES AS EVENT
   ← Calls agent.processEvent()
   ← Agent... IGNORES IT? ❌
```

**The event arrives, but agent doesn't process it!**

---

## 🎯 **The Real Definition of "Trigger"**

### **Not:** "Arrives via SSE"  
**Because:** ALL subscribed events arrive via SSE!

### **Actually:** "Causes processing/action"

```typescript
// All these arrive via SSE:
user.message.v1         → 📞 TRIGGER (agent responds)
agent.context.v1        → 📞 TRIGGER (agent responds)
browser.page.context.v1 → 📝 CONTEXT (just store, don't respond)
tool.catalog.v1         → 📝 CONTEXT (just store)
tool.response.v1        → 📞 TRIGGER (if waiting) OR 📝 CONTEXT
```

---

## 🔌 **SSE as Universal Input Bus**

Think of SSE like a **message bus**:

```
┌─────────────────────────────────────────────────────┐
│            SSE Input Port (Event Bus)               │
│                                                     │
│  All events arrive here, but different handling:    │
│                                                     │
│  Event Type              Handler       Action       │
│  ────────────────────────────────────────────────  │
│  user.message.v1         trigger  →  Process+Reply │
│  agent.context.v1        trigger  →  Process+Reply │
│  tool.response.v1        trigger  →  Continue      │
│  browser.page.context.v1 context  →  Store         │
│  tool.catalog.v1         context  →  Store         │
│  system.message.v1       trigger  →  Process       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**SSE delivers everything, but not everything triggers processing!**

---

## 💡 **The Port Model Refined**

### **SSE is an INPUT PORT with Multiple Channels:**

```typescript
type SSEInputPort = {
  mechanism: "Server-Sent Events",
  endpoint: "GET /events/stream",
  
  channels: {
    // Channel 1: Trigger events (cause action)
    triggers: {
      schemas: ["user.message.v1", "agent.context.v1", "tool.response.v1"],
      handling: "process_immediately",
      response: "required"
    },
    
    // Channel 2: Context events (update state)
    context_updates: {
      schemas: ["browser.page.context.v1", "tool.catalog.v1"],
      handling: "store_for_later",
      response: "none"
    },
    
    // Channel 3: System events (meta)
    system: {
      schemas: ["system.message.v1", "system.ping.v1"],
      handling: "varies"
    }
  }
};
```

---

## 🔍 **Other Input Mechanisms?**

### **Polling?** ❌ No
RCRT is **event-driven**, not poll-based.

### **Scheduled/Cron?** ❌ Not primary
No built-in scheduler (could trigger via external cron → POST breadcrumb → SSE event)

### **HTTP POST?** ⚠️ Indirect
POST creates breadcrumb → NATS event → SSE → Processing

So technically HTTP creates the breadcrumb, but **SSE delivers the event that triggers processing**.

### **Direct Function Call?** ❌ No
Everything goes through events (no direct agent.execute() calls)

---

## 🎯 **Refined Definition**

### **Input Port = SSE**
**ALL reactive processing starts from SSE events.**

### **Trigger = Subset of SSE events that cause action**

```
SSE Event Taxonomy:

┌─────────────────────────────────────┐
│         ALL SSE EVENTS              │
├─────────────────────────────────────┤
│                                     │
│  ┌────────────────────────────┐    │
│  │ TRIGGER Events             │    │
│  │ (Cause immediate action)   │    │
│  ├────────────────────────────┤    │
│  │ • user.message.v1          │    │
│  │ • agent.context.v1         │    │
│  │ • tool.request.v1          │    │
│  │ • tool.response.v1 (await) │    │
│  └────────────────────────────┘    │
│                                     │
│  ┌────────────────────────────┐    │
│  │ CONTEXT Events             │    │
│  │ (Update state only)        │    │
│  ├────────────────────────────┤    │
│  │ • browser.page.context.v1  │    │
│  │ • tool.catalog.v1          │    │
│  │ • agent.def.v1             │    │
│  │ • context.config.v1        │    │
│  └────────────────────────────┘    │
│                                     │
│  ┌────────────────────────────┐    │
│  │ SYSTEM Events              │    │
│  │ (Meta/control)             │    │
│  ├────────────────────────────┤    │
│  │ • system.ping.v1           │    │
│  │ • system.message.v1        │    │
│  └────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔄 **The Two-Phase Pattern**

### **Phase 1: State Update** (REST API)

```
Extension updates breadcrumb:
  PATCH /breadcrumbs/{id}
    ↓
  Database updated
    ↓
  NATS event published
```

**This is WRITE operation. Not a trigger yet!**

### **Phase 2: Event Notification** (SSE)

```
NATS event:
  bc.{id}.updated
    ↓
  SSE delivers to subscribers
    ↓
  Agent receives event ✅ THIS IS THE TRIGGER!
    ↓
  Agent decides: process or store
```

**This is the TRIGGER. Input port activated!**

---

## 💡 **Key Architectural Principle**

### **SSE = Universal Input Port**

```
ALL processing in RCRT starts from SSE events:

┌──────────────────────────────────────────────────────┐
│                                                      │
│  External          REST API         NATS/SSE        │
│  Action         State Change     Event Delivery     │
│     ↓                ↓                  ↓            │
│                                                      │
│  User types    → POST breadcrumb → SSE event        │
│  Page loads    → PATCH breadcrumb → SSE event       │
│  Tool executes → POST response → SSE event          │
│  Timer fires   → POST trigger → SSE event           │
│                                                      │
│  Everything converges on SSE! ←                     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Insight:** REST creates/updates state. SSE notifies consumers. Processing happens on notification!

---

## 🤔 **But Not All SSE Events Are Equal**

### **Type 1: Trigger Events** (Demand Response)

```
user.message.v1 arrives via SSE
  → Agent MUST respond
  → Creates agent.response.v1
  → Synchronous request-response pattern
```

### **Type 2: Context Events** (Just Information)

```
browser.page.context.v1 arrives via SSE
  → Agent stores for later
  → No immediate response required
  → Asynchronous state update
```

### **Type 3: Completion Events** (Unblock Waiting)

```
tool.response.v1 arrives via SSE
  → Agent was waiting for this
  → Unblocks processing
  → Continuation pattern
```

---

## 🎨 **Proposed Subscription Metadata**

To make this explicit:

```typescript
type SubscriptionSelector = {
  // Routing (existing)
  schema_name: string,
  any_tags?: string[],
  all_tags?: string[],
  context_match?: ContextMatch[],
  
  // Handling (NEW!)
  behavior: {
    role: 'trigger' | 'context' | 'completion',
    storage: 'replace' | 'accumulate' | 'ignore',
    processing: 'immediate' | 'on_trigger' | 'never',
    timeout?: number  // For 'completion' events
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
        "behavior": {
          "role": "trigger",          // Causes processing
          "storage": "accumulate",    // Keep history
          "processing": "immediate"   // Process now
        }
      },
      {
        "schema_name": "browser.page.context.v1",
        "behavior": {
          "role": "context",          // Just data
          "storage": "replace",       // Keep latest only
          "processing": "on_trigger"  // Include when triggered by something else
        }
      },
      {
        "schema_name": "tool.response.v1",
        "behavior": {
          "role": "completion",       // Unblocks waiting
          "storage": "accumulate",
          "processing": "if_waiting",
          "timeout": 30000
        }
      }
    ]
  }
}
```

---

## 🔌 **SSE as Multi-Channel Input Port**

Think of SSE like a **multi-channel bus**:

```
┌────────────────────────────────────────────────────────────┐
│                    SSE Input Port                          │
│                  (Universal Event Bus)                     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  📨 Channel 1: COMMAND (Trigger Processing)                │
│  ├─ user.message.v1      → Agent: Respond now!            │
│  ├─ tool.request.v1      → Tool: Execute now!             │
│  └─ agent.context.v1     → Agent: Context ready, process! │
│                                                            │
│  📊 Channel 2: STATE (Update Context)                      │
│  ├─ browser.page.context.v1 → Store for next trigger       │
│  ├─ tool.catalog.v1         → Store for reference          │
│  └─ agent.def.v1            → Store for discovery          │
│                                                            │
│  ✅ Channel 3: RESPONSE (Complete Request)                 │
│  ├─ tool.response.v1     → Unblock waiting agent          │
│  └─ agent.response.v1    → Unblock waiting workflow       │
│                                                            │
│  🔔 Channel 4: SYSTEM (Meta/Control)                       │
│  ├─ system.ping.v1       → Keepalive                      │
│  └─ system.message.v1    → System feedback                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 🎯 **What Defines a "Trigger"?**

### **Not:** "Arrives via SSE" (everything does!)

### **Actually:** "Requires immediate processing + response"

```typescript
function isTrigger(schema: string): boolean {
  const triggerSchemas = [
    'user.message.v1',      // User expects response
    'agent.context.v1',     // Context ready to process
    'tool.request.v1',      // Tool execution required
    'system.message.v1'     // System command
  ];
  
  return triggerSchemas.includes(schema);
}

function isContextUpdate(schema: string): boolean {
  const contextSchemas = [
    'browser.page.context.v1',  // State update
    'tool.catalog.v1',          // Reference data
    'agent.def.v1',             // Definition
    'context.config.v1'         // Configuration
  ];
  
  return contextSchemas.includes(schema);
}
```

---

## 💭 **Architectural Implications**

### **1. SSE is THE Input Port**

```
Everything that causes processing arrives via SSE.

No polling ❌
No scheduled tasks ❌ (unless they POST → SSE)
No direct calls ❌

SSE is the ONLY input mechanism for reactive processing!
```

### **2. But Events Have Roles**

```
Same transport (SSE), different semantics:

COMMAND events  → Process now
STATE events    → Store for later
RESPONSE events → Complete pending
SYSTEM events   → Meta operations
```

### **3. The Subscription Should Declare Role**

```json
{
  "schema_name": "browser.page.context.v1",
  "role": "context",        // 🆕 Explicit!
  "on_receive": "store"     // Don't trigger processing
}

vs

{
  "schema_name": "user.message.v1",
  "role": "trigger",        // 🆕 Explicit!
  "on_receive": "process"   // Immediate action required
}
```

---

## 🔄 **Unified Processing Model**

### **What SHOULD happen:**

```typescript
class UniversalEventProcessor {
  private contextStore = new Map<string, any>();
  
  async processSSEEvent(event: BreadcrumbEvent) {
    const breadcrumb = await this.fetch(event.breadcrumb_id);
    const subscription = this.findSubscription(breadcrumb.schema_name);
    
    if (!subscription) return;  // Not subscribed
    
    // Determine handling from subscription metadata
    const role = subscription.behavior?.role || this.inferRole(breadcrumb.schema_name);
    
    switch (role) {
      case 'trigger':
        // Immediate processing required
        await this.processTrigger(breadcrumb);
        break;
        
      case 'context':
        // Just store for later
        this.contextStore.set(breadcrumb.schema_name, breadcrumb.context);
        console.log(`📝 Stored ${breadcrumb.schema_name} as context`);
        break;
        
      case 'completion':
        // Unblock pending request
        await this.completeRequest(breadcrumb);
        break;
    }
  }
  
  async processTrigger(trigger: any) {
    // Assemble context from store
    const context = Object.fromEntries(this.contextStore);
    
    // Add trigger
    context.trigger = trigger.context;
    
    // Execute (call LLM for agents, run function for tools)
    await this.execute(context);
  }
}
```

**Now ANY subscription works, role determines handling!**

---

## 🎯 **Back to Your Question**

> "Do all triggers come from SSE?"

**YES!** SSE is the **universal input port** for all reactive processing.

> "Is that what defines it as a trigger?"

**NO!** Arriving via SSE means it's an **input**.  
Being a **trigger** means it **causes processing**.

**The distinction:**
- **Input port** = SSE (transport mechanism)
- **Trigger** = Semantic role (causes action)

---

## 📊 **Complete I/O Model**

```
┌───────────────────────────────────────────────────────┐
│                 Breadcrumb Component                  │
├───────────────────────────────────────────────────────┤
│                                                       │
│  📥 INPUT PORTS                                        │
│  ├─ SSE/Events (real-time, reactive)                  │
│  │   ├─ Trigger channel (immediate action)           │
│  │   ├─ Context channel (state update)               │
│  │   └─ Completion channel (unblock)                 │
│  └─ REST/CRUD (state manipulation)                    │
│      ├─ POST (create)                                 │
│      ├─ PATCH (update)                                │
│      └─ DELETE (remove)                               │
│                                                       │
│  🔄 PROCESSING                                         │
│  ├─ Role-based handling (trigger vs context)          │
│  └─ Transform (llm_hints)                             │
│                                                       │
│  📤 OUTPUT PORTS                                       │
│  ├─ Events (NATS/SSE) - real-time                     │
│  ├─ Views (REST GET) - on-demand                      │
│  │   ├─ ListItem (discovery)                         │
│  │   ├─ ContextView (LLM, transformed)               │
│  │   ├─ Full (admin, raw)                            │
│  │   └─ History (audit)                              │
│  └─ Search (pgvector) - semantic                      │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## 💡 **Key Insights**

1. **SSE is THE input port** - All processing starts here
2. **Not all SSE events trigger** - Some just update state
3. **Role should be explicit** - "trigger" vs "context" in subscription
4. **Transport ≠ Semantics** - SSE is how, role is what

---

## 🎯 **Architectural Answer**

**Your question reveals the solution:**

If SSE is the universal input port, then **ALL subscriptions should work the same way**:

```typescript
// Receive via SSE
event arrives → 

// Determine role
if (subscription.role === 'trigger') {
  process now
} else if (subscription.role === 'context') {
  store for later
}

// When processing, include ALL stored context
context = {
  trigger: triggerEvent,
  browser_page: storedBrowserContext,
  tool_catalog: storedCatalog,
  // ... everything subscribed to
}
```

**Then changing subscriptions truly "just works"!**

The role metadata makes it **explicit** instead of **implicit** (hardcoded).

This makes RCRT truly composable! What do you think?
