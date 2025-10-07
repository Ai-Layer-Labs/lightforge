# Breadcrumb Views & I/O Ports - Complete Model

## 🔍 Key Insight: Breadcrumbs Have Multiple Output Views

From OpenAPI and code analysis:

```
Same Breadcrumb → Different Views (Output Formats)
├─ ListItem         (minimal: id, title, tags, version)
├─ ContextView      (LLM-optimized: with llm_hints applied)
├─ Full             (complete: includes embedding, metadata)
└─ Raw             (internal: database representation)
```

## 📦 Breadcrumb Output Views

### **1. ListItem** (Discovery View)

**Endpoint:** `GET /breadcrumbs?tag=...`

```typescript
{
  id: uuid,
  title: string,
  tags: string[],
  version: number,
  updated_at: datetime
}
```

**Purpose:** Fast discovery, navigation, filtering  
**Use case:** "Show me all agents", "List tools", UI breadcrumb lists  
**Size:** ~200 bytes

---

### **2. BreadcrumbContextView** (LLM View)

**Endpoint:** `GET /breadcrumbs/{id}`

```typescript
{
  id: uuid,
  title: string,
  context: JSON,          // 🔀 WITH llm_hints APPLIED!
  tags: string[],
  schema_name: string,
  version: number,
  updated_at: datetime
}
```

**Purpose:** Optimized for LLM consumption  
**Transform:** Server-side llm_hints applied  
**Use case:** Agents reading context, chat responses  
**Size:** ~5-50KB (transformed)

**Example Transform:**
```json
// RAW context (technical):
{
  "dom": {"map": {/* 1000+ nodes */}},
  "session": {"extensionId": "xyz"}
}

// ContextView (llm_hints applied - natural language):
{
  "summary": "User is viewing 'GitHub' at github.com. 23 interactive elements.",
  "page_text": "Clean extracted content...",
  // dom.map EXCLUDED per llm_hints
}
```

---

### **3. BreadcrumbFull** (Admin View)

**Endpoint:** `GET /breadcrumbs/{id}/full`  
**Requires:** ACL `read_full` or curator role

```typescript
{
  id: uuid,
  owner_id: uuid,
  title: string,
  context: JSON,          // 🔴 RAW - NO transform!
  tags: string[],
  schema_name: string,
  visibility: enum,
  sensitivity: enum,
  version: number,
  checksum: string,
  ttl: datetime | null,
  created_at: datetime,
  updated_at: datetime,
  created_by: uuid | null,
  updated_by: uuid | null,
  size_bytes: number,
  embedding: float[384] | null
}
```

**Purpose:** Full audit trail, debugging, system operations  
**Use case:** Dashboard admin view, debugging, migrations  
**Size:** ~5-50KB + 1.5KB (embedding)

---

### **4. History View**

**Endpoint:** `GET /breadcrumbs/{id}/history`

```typescript
[
  {
    version: number,
    context: JSON,        // Historical snapshot
    updated_at: datetime,
    updated_by: uuid
  }
]
```

**Purpose:** Version control, audit trail, rollback  
**Use case:** "What changed?", compliance, debugging

---

## 🔌 I/O Port Model with Views

### **Breadcrumb as Multi-Port Component**

```typescript
type BreadcrumbComponent = {
  // === CORE DATA ===
  state: {
    id: uuid,
    context: JSON,      // The actual data
    version: number,    // State version
    tags: string[],     // Routing metadata
    schema_name: string // Type discriminator
  },
  
  // === INPUT PORTS ===
  inputs: {
    // Defined by subscriptions (if agent/tool)
    subscriptions?: Selector[],
    
    // Universal CRUD inputs (all breadcrumbs)
    create: { POST /breadcrumbs },
    update: { PATCH /breadcrumbs/{id} },
    delete: { DELETE /breadcrumbs/{id} }
  },
  
  // === OUTPUT PORTS (Multiple Views!) ===
  outputs: {
    // Discovery port (fast, minimal)
    list: {
      endpoint: "GET /breadcrumbs?tag=...",
      view: ListItem,
      size: "~200 bytes",
      transform: "none"
    },
    
    // LLM port (optimized for AI consumption)
    context: {
      endpoint: "GET /breadcrumbs/{id}",
      view: ContextView,
      size: "~5-50KB",
      transform: "llm_hints applied"  // 🔀 Server-side!
    },
    
    // Admin port (full details)
    full: {
      endpoint: "GET /breadcrumbs/{id}/full",
      view: BreadcrumbFull,
      size: "~5-50KB + embedding",
      transform: "none",
      requires: "ACL or curator"
    },
    
    // Event port (real-time updates)
    events: {
      endpoint: "SSE /events/stream",
      event: "breadcrumb.updated",
      triggers: "on create/update",
      routing: "via NATS + selectors"
    },
    
    // History port (audit trail)
    history: {
      endpoint: "GET /breadcrumbs/{id}/history",
      view: "Version[]",
      transform: "none"
    },
    
    // Search port (semantic)
    vector: {
      endpoint: "GET /breadcrumbs/search?q=...",
      view: ListItem[],
      method: "pgvector similarity",
      requires: "embedding != null"
    }
  },
  
  // === TRANSFORM PORTS ===
  transforms: {
    llm_hints: {
      input: context (raw),
      output: context (transformed),
      applied: "server-side on GET",
      rules: {
        transform: {key: TransformRule},
        include: string[],
        exclude: string[],
        mode: "merge" | "replace"
      }
    }
  }
};
```

---

## 🎯 Critical Architectural Insight

**Breadcrumbs have DIFFERENT OUTPUTS for DIFFERENT CONSUMERS:**

```
Same Breadcrumb (browser.page.context.v1)
  ↓
┌─────────────────┬──────────────────┬────────────────┐
│ For Discovery   │ For LLMs         │ For Admin      │
├─────────────────┼──────────────────┼────────────────┤
│ ListItem        │ ContextView      │ Full           │
│ (no context)    │ (llm_hints ON)   │ (everything)   │
│                 │                  │                │
│ title, tags     │ + transformed    │ + embedding    │
│ version         │   context        │ + checksum     │
│                 │                  │ + audit data   │
└─────────────────┴──────────────────┴────────────────┘
```

**This is POLYMORPHIC OUTPUT!** Same data, different representations based on consumer needs.

---

## 🔌 Port Connection with Views

### **Example: Agent Reading Browser Context**

```
┌──────────────────────────────────────┐
│ browser.page.context.v1              │
│ State: { url, content, dom, ... }    │
└──────────────┬───────────────────────┘
               │
    ┌──────────┴─────────┬─────────────┬─────────────┐
    │                    │             │             │
    ▼                    ▼             ▼             ▼
┌────────┐        ┌────────────┐  ┌────────┐  ┌──────────┐
│ Events │        │  Context   │  │  Full  │  │  Vector  │
│ Port   │        │  Port      │  │  Port  │  │  Port    │
└───┬────┘        └─────┬──────┘  └───┬────┘  └────┬─────┘
    │                   │             │            │
    │ SSE               │ GET /id     │ GET /full  │ GET /search
    │                   │             │            │
    ▼                   ▼             ▼            ▼
┌────────┐        ┌────────────┐  ┌────────┐  ┌──────────┐
│ Agent  │        │   Agent    │  │ Admin  │  │  Search  │
│ (via   │        │  (direct   │  │  UI    │  │  Engine  │
│ sub)   │        │   fetch)   │  │        │  │          │
└────────┘        └────────────┘  └────────┘  └──────────┘
                   ↓ Sees transformed data!
```

---

## 💡 The Real Architecture Question

**How do subscriptions map to views?**

### **Current Behavior:**

```typescript
// Agent subscribes
{
  "subscriptions": {
    "selectors": [{"schema_name": "browser.page.context.v1"}]
  }
}

// What happens:
1. NATS event arrives (just metadata: id, tags, type)
2. AgentExecutor fetches: await client.getBreadcrumb(id)
3. Returns: ContextView (with llm_hints applied!)
4. BUT: AgentExecutor ignores it (no handler!)
```

### **The Gap:**

```
Subscription routes correctly ✅
Event arrives at agent ✅
Breadcrumb fetched correctly ✅
Transform applied correctly ✅
Agent IGNORES it ❌ ← NO HANDLER
```

---

## 🎨 Universal Port Model

Every breadcrumb type should support:

```typescript
interface UniversalBreadcrumbPorts {
  // === INPUT PORTS (How to write) ===
  write: {
    create: "POST /breadcrumbs",
    update: "PATCH /breadcrumbs/{id}",  // With version locking
    delete: "DELETE /breadcrumbs/{id}"
  },
  
  // === OUTPUT PORTS (How to read) ===
  read: {
    // For discovery
    list: {
      endpoint: "GET /breadcrumbs?...",
      view: "ListItem[]",
      use: "Navigation, filtering, counts"
    },
    
    // For LLMs (PRIMARY for agents!)
    context: {
      endpoint: "GET /breadcrumbs/{id}",
      view: "ContextView",
      transform: "llm_hints applied",
      use: "Agent decision making, chat"
    },
    
    // For admin/debugging
    full: {
      endpoint: "GET /breadcrumbs/{id}/full",
      view: "BreadcrumbFull",
      transform: "none",
      requires: "ACL",
      use: "Debugging, migration, audit"
    },
    
    // For history/audit
    history: {
      endpoint: "GET /breadcrumbs/{id}/history",
      view: "HistoryItem[]",
      use: "Audit, rollback, comparison"
    }
  },
  
  // === EVENT PORTS (Real-time) ===
  events: {
    // Passive events (broadcast)
    created: {
      subject: "bc.{id}.created",
      payload: "breadcrumb metadata + context"
    },
    updated: {
      subject: "bc.{id}.updated",
      payload: "breadcrumb metadata + context"
    },
    
    // Targeted events (via subscriptions)
    matched: {
      subject: "agents.{agent_id}.events",
      condition: "selector match",
      routing: "server-side fanout"
    }
  },
  
  // === SEARCH PORTS (Semantic) ===
  search: {
    // Vector similarity
    vector: {
      endpoint: "GET /breadcrumbs/search?q=...",
      method: "pgvector cosine similarity",
      requires: "embedding != null",
      returns: "ListItem[]"
    },
    
    // Tag/schema filtering
    tagged: {
      endpoint: "GET /breadcrumbs?tag=...&schema_name=...",
      method: "exact match",
      returns: "ListItem[]"
    }
  },
  
  // === TRANSFORM PORTS (Data shaping) ===
  transform: {
    // Server-side (automatic)
    llm_hints: {
      applied: "on GET /breadcrumbs/{id}",
      rules: "defined in context.llm_hints",
      output: "ContextView"
    }
  }
}
```

---

## 🔄 View Selection by Consumer Type

### **Different Consumers Need Different Views:**

| Consumer Type | View Needed | Why |
|---------------|-------------|-----|
| **Agent (LLM)** | ContextView | llm_hints transform for clean natural language |
| **Dashboard UI** | ListItem + ContextView | Fast lists + detail views |
| **Admin/Debug** | Full | Need embedding, audit metadata |
| **Search Engine** | Vector | Need embedding for similarity |
| **Context Builder** | ContextView | Assembled contexts should be LLM-ready |
| **Event Subscriber** | Event (partial) | Just metadata + context, no embedding |

---

## 🎯 The Port Composition Question

**When Agent subscribes to `browser.page.context.v1`:**

```
Agent → Subscription → Event arrives → Fetch breadcrumb

Question: Which view does it fetch?

Currently:
  client.getBreadcrumb(id) 
    → Returns ContextView
    → llm_hints already applied ✅

But then:
  AgentExecutor ignores it ❌
  (No handler for browser.page.context.v1)
```

---

## 💡 **The Complete I/O Model**

Let's think of each breadcrumb as having **typed I/O with multiple output formats**:

### **Schema: browser.page.context.v1**

```typescript
{
  // === INPUTS (How data enters) ===
  inputs: {
    capture_request: {
      from: "extension OR tool.request.v1",
      method: "PATCH /breadcrumbs/{id}",
      frequency: "on navigation"
    }
  },
  
  // === STATE (The data itself) ===
  state: {
    context: {
      url, domain, title, content, dom, meta,
      llm_hints: {/* transform rules */}
    },
    version: number,
    tags: string[]
  },
  
  // === OUTPUTS (Multiple views!) ===
  outputs: {
    // Real-time event (subscribers)
    event: {
      trigger: "on update",
      subject: "bc.{id}.updated + agents.{agent_id}.events",
      payload: {
        type: "breadcrumb.updated",
        breadcrumb_id: uuid,
        schema_name: string,
        tags: string[],
        context: JSON  // Raw? Or transformed?
      }
    },
    
    // LLM-optimized view (GET request)
    llm_view: {
      endpoint: "GET /breadcrumbs/{id}",
      transform: "llm_hints.transform applied",
      exclude: "llm_hints.exclude fields",
      format: "ContextView"
    },
    
    // Full admin view
    admin_view: {
      endpoint: "GET /breadcrumbs/{id}/full",
      transform: "none",
      includes: "embedding, audit metadata"
    },
    
    // Minimal list view
    list_view: {
      endpoint: "GET /breadcrumbs?schema_name=...",
      format: "ListItem",
      fields: ["id", "title", "tags", "version"]
    }
  }
}
```

---

## 🤔 **Discussion: Event Payload Question**

**Critical question: What does the SSE event contain?**

Looking at the code (`rcrt-server/src/main.rs:604-620`):

```rust
let payload = json!({
    "type": "breadcrumb.updated",
    "breadcrumb_id": bc.id,
    "owner_id": auth.owner_id,
    "version": bc.version,
    "tags": bc.tags,
    "schema_name": bc.schema_name,
    "updated_at": bc.updated_at,
    "context": bc.context  // 🔴 FULL CONTEXT in event!
});
```

**So events contain the FULL CONTEXT!**

**But is llm_hints applied to the event payload?**

Looking at line 638:
```rust
fanout_events_and_webhooks(&state, auth.owner_id, &bc, &updated).await;
```

The `&bc` is the raw breadcrumb from DB. **llm_hints are only applied on GET requests**, not in events!

---

## 🎯 **The Architectural Discovery**

### **Two Ways to Get Breadcrumb Data:**

**1. Via Event (SSE/NATS) - Push**
```
breadcrumb.updated event
  ↓
Contains: RAW context (no llm_hints transform!)
  ↓
Agent receives: Technical data
```

**2. Via GET Request - Pull**
```
GET /breadcrumbs/{id}
  ↓
Server applies: llm_hints transform
  ↓
Agent receives: Clean natural language
```

### **Current AgentExecutor Behavior:**

```typescript
async processEvent(event: BreadcrumbEvent): Promise<void> {
  const breadcrumb = await this.rcrtClient.getBreadcrumb(event.breadcrumb_id);
  // ↑ Fetches ContextView (llm_hints applied) ✅
  
  if (breadcrumb.schema_name === 'agent.context.v1') {
    // Process it ✅
  } else if (breadcrumb.schema_name === 'browser.page.context.v1') {
    // IGNORED! ❌
  }
}
```

---

## 🔌 **Generic Port Mapping**

**What SHOULD happen:**

```typescript
// Agent definition
{
  "subscriptions": {
    "selectors": [
      {
        "schema_name": "browser.page.context.v1",
        "port_mapping": {           // 🆕 Explicit!
          "target_key": "browser_context",
          "view": "context",        // Use ContextView (llm_hints)
          "handling": "replace",    // Keep latest
          "trigger": false          // Don't trigger processing
        }
      },
      {
        "schema_name": "agent.context.v1",
        "port_mapping": {
          "target_key": "assembled_context",
          "view": "context",
          "handling": "replace",
          "trigger": true           // DOES trigger processing
        }
      }
    ]
  }
}
```

**Then AgentExecutor:**

```typescript
private contextStore = new Map<string, any>();

async processEvent(event: BreadcrumbEvent): Promise<void> {
  const breadcrumb = await this.rcrtClient.getBreadcrumb(event.breadcrumb_id);
  // ↑ Gets ContextView (llm_hints applied)
  
  // Find subscription config for this schema
  const subscription = this.findSubscription(breadcrumb.schema_name);
  
  if (!subscription) return;
  
  // Generic handling based on port_mapping
  const key = subscription.port_mapping.target_key || breadcrumb.schema_name;
  
  if (subscription.port_mapping.handling === 'replace') {
    this.contextStore.set(key, breadcrumb.context);
  } else if (subscription.port_mapping.handling === 'accumulate') {
    const existing = this.contextStore.get(key) || [];
    this.contextStore.set(key, [...existing, breadcrumb.context]);
  }
  
  // Trigger processing if specified
  if (subscription.port_mapping.trigger) {
    await this.process(breadcrumb, this.contextStore);
  }
}
```

**Now ANY subscription automatically becomes available context!**

---

## 🎨 **View Selection Strategy**

### **Question: Which view for which operation?**

| Operation | View | Reason |
|-----------|------|--------|
| **Event routing** | Event payload | Fast, contains context |
| **Agent processing** | ContextView | llm_hints for LLM |
| **Context assembly** | ContextView | Pre-transformed |
| **Admin debug** | Full | Need everything |
| **UI list** | ListItem | Fast, minimal |
| **Vector search** | Needs embedding | Full or custom |

---

## 💭 **Key Insights for Discussion**

### **1. Events Contain Raw Context**

SSE events have the **raw context** (no llm_hints). This means:
- Agents that process events directly see technical data
- Agents that fetch via GET see transformed data

**Should events also apply llm_hints?** Or is fetch-on-event the right pattern?

### **2. Multiple Output Formats = Adapter Pattern**

Breadcrumbs already implement **output adapters**:
- ListItem adapter (discovery)
- ContextView adapter (LLM)
- Full adapter (admin)

**Should we make this explicit in schemas?**

### **3. Port Mapping Should Be Explicit**

Instead of hardcoded handlers, define in subscription:
```json
{
  "schema_name": "browser.page.context.v1",
  "handling": {
    "mode": "replace",      // How to store
    "view": "context",      // Which output view
    "trigger": false,       // Causes processing?
    "key": "browser_context" // Where to put it
  }
}
```

---

## 🎯 **Summary for Architecture Decision**

**The system has:**
- ✅ Multiple views (polymorphic output) ← Good!
- ✅ Flexible routing (selectors) ← Good!
- ✅ Transform layer (llm_hints) ← Good!
- ❌ Hardcoded handlers (not composable) ← Need to fix!

**To make it truly composable:**

1. **Add port metadata to subscriptions** (handling, view, trigger)
2. **Make AgentExecutor generic** (use port metadata instead of switch)
3. **Unified context** (all subscriptions available to LLM)

**Then changing subscriptions truly "just works" without code changes!**

What do you think? Should we formalize the port mapping in the subscription schema?
