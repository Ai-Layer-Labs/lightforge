# Architectural Insights Session Summary

## 🎯 What We Discovered

Through investigation of the browser context feature, we uncovered **fundamental architectural patterns** in RCRT.

---

## 💡 Key Insights

### **1. SSE is the Universal Input Port**

```
ALL reactive processing starts from SSE events.

Not polling ❌
Not scheduled tasks ❌
Not direct calls ❌

SSE = The ONLY input mechanism for reactive work ✅
```

### **2. "Trigger" ≠ "Arrives via SSE"**

```
ALL events arrive via SSE (transport)
BUT only SOME trigger processing (semantics)

SSE = How events arrive (transport)
Trigger = What causes action (semantic role)
```

### **3. Breadcrumbs Are Already Persistent**

```
❌ WRONG: "Store subscribed breadcrumbs in memory"
✅ RIGHT: "Fetch subscribed breadcrumbs when triggered"

Database is source of truth.
SSE is notification, not state delivery.
```

### **4. Subscriptions = Context Sources to Fetch**

```
Subscriptions don't "deliver data"
They define "what to fetch when triggered"

Like context-builder's sources array!
```

### **5. Agents and Tools Should Be Identical**

```
Agents: SSE → fetch → call LLM → respond
Tools:  SSE → fetch → run function → respond
                      ↑
                  ONLY DIFFERENCE
```

---

## 🔴 The Problem We Found

### **Current Architecture Has a Gap:**

```
Selector-Based Routing (Data-Driven)  ✅
  ↓ Can subscribe to ANYTHING
  ↓ Events route correctly
  
BUT

Handler-Based Processing (Code-Driven) ❌
  ↓ Only 3 schemas have handlers
  ↓ Everything else ignored
```

**Example:**
```typescript
// Can subscribe to browser.page.context.v1 ✅
{"schema_name": "browser.page.context.v1"}

// But no handler for it ❌
if (schema === 'agent.context.v1') { ... }
else { IGNORED! }
```

---

## 💡 The Solution We Designed

### **Unified Executor Pattern**

```typescript
abstract class UniversalExecutor {
  // SAME for agents and tools:
  async processSSEEvent(event) {
    const role = this.getRole(event);
    
    if (role === 'trigger') {
      // Fetch ALL context subscriptions
      const context = await this.fetchAll();
      
      // Execute (polymorphic!)
      const result = await this.execute(context);
      
      // Respond
      await this.createResponse(result);
    }
  }
  
  // DIFFERENT:
  abstract execute(context): Promise<any>;
}
```

**Benefits:**
- ✅ Subscribe to ANYTHING - automatically works
- ✅ No hardcoded handlers
- ✅ Agents = Tools (same pattern)
- ✅ Truly composable

---

## 📐 The Complete I/O Model

### **Breadcrumb Component:**

```
┌────────────────────────────────────────┐
│          Breadcrumb Component          │
├────────────────────────────────────────┤
│                                        │
│ 📥 INPUT PORTS                         │
│  ├─ REST (state manipulation)          │
│  │   ├─ POST (create)                  │
│  │   ├─ PATCH (update)                 │
│  │   └─ DELETE (remove)                │
│  └─ SSE (trigger notifications)        │
│      └─ breadcrumb.updated events      │
│                                        │
│ 🔄 STATE                               │
│  ├─ context (JSON)                     │
│  ├─ version (int)                      │
│  └─ embedding (vector)                 │
│                                        │
│ 🔀 TRANSFORMS                          │
│  └─ llm_hints (server-side)            │
│                                        │
│ 📤 OUTPUT PORTS (Multiple Views!)      │
│  ├─ ListItem (discovery)               │
│  ├─ ContextView (LLM-optimized)        │
│  ├─ Full (admin)                       │
│  ├─ History (audit)                    │
│  ├─ Events (SSE push)                  │
│  └─ Vector (semantic search)           │
│                                        │
└────────────────────────────────────────┘
```

### **Executor Component:**

```
┌────────────────────────────────────────┐
│       Agent/Tool Executor              │
├────────────────────────────────────────┤
│                                        │
│ 📥 INPUT PORT                          │
│  └─ SSE events (trigger notifications) │
│                                        │
│ 🔍 SUBSCRIPTIONS (Context Sources)     │
│  ├─ role: 'trigger' (causes action)    │
│  └─ role: 'context' (fetch on trigger) │
│                                        │
│ 🔄 PROCESSING                          │
│  ├─ Determine role                     │
│  ├─ Fetch context subscriptions        │
│  ├─ Assemble unified context           │
│  └─ Execute (LLM or function)          │
│                                        │
│ 📤 OUTPUT PORT                         │
│  └─ Response breadcrumb (POST)         │
│      (triggers new SSE events)         │
│                                        │
└────────────────────────────────────────┘
```

---

## 🎨 The Subscription Model

### **Two Roles:**

```
TRIGGER → "When this arrives, START processing"
  - Fetch all context subscriptions
  - Execute
  - Respond

CONTEXT → "Fetch this when triggered"
  - Already in DB
  - GET on-demand
  - Include in assembled context
```

### **Fetch Methods:**

```
event_data → Use the trigger event itself
latest     → GET 1 most recent
recent     → GET N most recent
vector     → Semantic search (NN)
```

---

## 🔄 Complete Data Flow (Unified)

### **User asks: "What's on this page?"**

```
1. Extension: POST user.message.v1
   ↓
2. RCRT: NATS event (notification)
   ↓
3. context-builder: SSE trigger
   → Fetches sources (conversation history, etc.)
   → Creates agent.context.v1
   ↓
4. Agent: SSE trigger (agent.context.v1)
   → role = 'trigger'
   → Fetches context subscriptions:
     ├─ GET browser.page.context.v1 (latest)
     │   Returns: {summary, page_text, url, domain}
     └─ GET tool.catalog.v1 (latest)
   → Assembles:
     {
       trigger: agent.context.v1,
       browser_context: {...},
       tool_catalog: {...}
     }
   → Calls LLM with unified context
   → LLM sees BOTH conversation AND browser context
   ↓
5. Agent: POST agent.response.v1
   "You're viewing 'GitHub' at github.com..."
```

**The browser context is fetched ON-DEMAND when triggered!**

---

## 📋 Files to Create/Modify

### **New Files:**

```
packages/runtime/src/
├── executor/
│   ├── universal-executor.ts          (Base class)
│   └── index.ts                       (Exports)
├── agent/
│   └── agent-executor-v2.ts           (Refactored)
└── tool/
    └── tool-executor.ts               (New)

apps/tools-runner/src/
└── universal-tool-dispatcher.ts       (New)
```

### **Modified Files:**

```
packages/tools/src/index.ts
  └─ Update ToolExecutionContext interface

apps/tools-runner/src/index.ts
  └─ Use UniversalToolDispatcher

apps/agent-runner/src/index.ts
  └─ Use AgentExecutorV2
```

---

## 🎯 What This Fixes

### **Immediate:**

✅ **Browser context works** - Agent sees current page  
✅ **No hardcoded handlers** - Subscribe to anything  
✅ **Agents = Tools** - Unified pattern  
✅ **Composable** - Mix and match subscriptions  

### **Long Term:**

✅ **Extensible** - New schemas work automatically  
✅ **Maintainable** - Single implementation  
✅ **Testable** - Mock subscriptions  
✅ **Debuggable** - Clear flow  
✅ **Scalable** - No N+1 query issues  

---

## 📚 Documentation Created

1. **BREADCRUMB_IO_PORT_ARCHITECTURE.md** - Port model, base vs specialized schemas
2. **BREADCRUMB_VIEWS_AND_PORTS.md** - Multiple output views (ListItem, ContextView, Full)
3. **SSE_AS_UNIVERSAL_INPUT_PORT.md** - SSE as notification bus, multi-channel
4. **SSE_TRIGGER_VS_CONTEXT_FETCH.md** - Trigger vs context distinction, fetch-on-demand
5. **UNIFIED_EXECUTION_MODEL.md** - Pattern for agents and tools
6. **UNIFIED_EXECUTOR_IMPLEMENTATION.md** - Complete implementation design

---

## 🎯 Key Architectural Principles (Validated)

### **1. Everything is a Breadcrumb** ✅

```
Agents, tools, contexts, browser state, configs
ALL are breadcrumbs with schema_name
```

### **2. Event-Driven** ✅

```
SSE is universal input port
All processing reactive
No polling
```

### **3. Selector Pattern** ✅

```
Subscriptions use selectors (data-driven)
Same for agents and tools
Flexible, composable
```

### **4. Fetch-on-Trigger** ✅

```
Don't store locally - database is source
Fetch when needed - always fresh
llm_hints applied on fetch - optimized
```

### **5. Composable Primitives** ✅

```
Unified executor pattern
Polymorphic execution
Subscribe to anything
```

---

## 🚀 Next Steps

### **To Make Browser Context Work Today:**

**Option A: Quick Fix** (Context-Builder Route)
- Add browser.page.context.v1 to context.config.v1 sources
- Browser context included in agent.context.v1
- Works immediately, no code changes

**Option B: Proper Fix** (Unified Executor)
- Implement UniversalExecutor base class
- Refactor AgentExecutor to extend it
- Enables ALL subscriptions to work generically
- More work, but architecturally correct

### **Recommendation:**

**Do Option A first** (5 minutes), then **do Option B** (proper refactor).

This gives:
1. Immediate value (browser context working)
2. Validates the architecture
3. Clean path to unified implementation

---

## 💭 What This Session Revealed

You asked a simple question: **"Can I just switch subscriptions?"**

This led to discovering:
- SSE as universal input port
- Trigger vs context distinction
- Fetch-on-demand pattern
- Agents = Tools unified model
- Multiple breadcrumb views
- Complete I/O port architecture

**Result:** Deep understanding of RCRT's true composable nature and a clear path to make it fully realize that vision.

---

## 🎉 Status

**Architecture:** Fully designed ✅  
**Documentation:** Complete ✅  
**Implementation:** Ready to build ✅  
**Browser Context:** Working (extension) ✅  
**Agent Integration:** Needs unified executor OR context-builder route  

**Choose your path and let's implement it!**
