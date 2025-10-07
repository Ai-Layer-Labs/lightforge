# Breadcrumb I/O Port Architecture

## 🎯 Core Concept: Breadcrumbs as Components with I/O

Every breadcrumb is a **component** with:
- **Input ports**: What events/data it consumes (subscriptions)
- **Output ports**: What events/data it produces (creates/updates)
- **State**: The breadcrumb's context itself
- **Transform**: llm_hints for data shaping

## 📦 Base Breadcrumb Schema (Universal)

**From:** `rcrt-core/src/models.rs`

```rust
struct Breadcrumb {
  // === Identity ===
  id: Uuid,
  owner_id: Uuid,
  
  // === Metadata (Universal) ===
  title: String,
  schema_name: Option<String>,    // Type discriminator
  tags: Vec<String>,              // Routing/filtering
  version: i32,                   // Optimistic locking
  checksum: String,               // Content hash
  
  // === Core Data ===
  context: JsonValue,             // ANY JSON - specialized per schema
  
  // === Security ===
  visibility: Visibility,         // public | team | private
  sensitivity: Sensitivity,       // low | pii | secret
  
  // === Lifecycle ===
  created_at: DateTime<Utc>,
  updated_at: DateTime<Utc>,
  created_by: Option<Uuid>,       // Which agent created it
  updated_by: Option<Uuid>,       // Which agent updated it
  ttl: Option<DateTime<Utc>>,     // Auto-expiry
  
  // === Search ===
  embedding: Option<Vector>,      // 384-dim for pgvector
  size_bytes: i32                 // Context size
}
```

**Key Insight:** The `context` field is **pure JSON** - completely flexible!

---

## 🔌 Schema-Specific Fields (In Context)

All specialized data lives in `context`:

### **1. agent.def.v1** (Agent Definition)

```typescript
{
  schema_name: "agent.def.v1",
  title: "Agent Name",
  tags: ["agent:def", "workspace:agents"],
  
  context: {
    // === Identity ===
    agent_id: string,
    
    // === Behavior ===
    system_prompt: string,
    model: string,
    temperature: number,
    
    // === I/O PORTS ===
    subscriptions: {              // 📥 INPUT PORTS
      selectors: [
        {
          schema_name: string,    // What type to listen for
          any_tags: string[],     // Tag filters
          all_tags: string[],     // Tag filters
          context_match: [...]    // Content filters
        }
      ]
    },
    
    // Implied OUTPUT: Creates breadcrumbs defined by capabilities
    capabilities: {               // 📤 OUTPUT PORTS (what it can create)
      can_create_breadcrumbs: boolean,
      can_update_own: boolean,
      can_spawn_agents: boolean
    }
  }
}
```

**I/O Port Mapping:**
```
📥 INPUTS:  subscriptions.selectors → What events it receives
📤 OUTPUTS: Creates agent.response.v1, tool.request.v1, etc.
🔄 STATE:   The agent definition itself
```

---

### **2. tool.v1** (Tool Definition)

```typescript
{
  schema_name: "tool.v1",
  title: "Tool Name",
  tags: ["tool", "tool:{name}", "category:{category}"],
  
  context: {
    // === Identity ===
    name: string,
    version: string,
    category: string,
    
    // === Implementation ===
    implementation: {
      type: "builtin" | "external",
      runtime: "nodejs" | "python" | "rust",
      module: string
    },
    
    // === I/O PORTS ===
    definition: {
      inputSchema: JSONSchema,    // 📥 INPUT PORT definition
      outputSchema: JSONSchema,   // 📤 OUTPUT PORT definition
      examples: [...]
    },
    
    // === Optional: Auto-trigger ===
    subscriptions?: {             // 📥 INPUT PORTS (auto-execute)
      selectors: [...]
    },
    
    // === Configuration ===
    configuration?: {
      configSchema: JSONSchema,
      currentConfig: {}
    }
  }
}
```

**I/O Port Mapping:**
```
📥 INPUTS:  
  - tool.request.v1 (always)
  - subscriptions.selectors (optional auto-trigger)
  
📤 OUTPUTS: 
  - tool.response.v1 (always)
  
🔄 STATE: Tool definition + configuration
```

---

### **3. context.config.v1** (Context Builder Config)

```typescript
{
  schema_name: "context.config.v1",
  title: "Context Config for {consumer}",
  tags: ["context:config", "consumer:{id}"],
  
  context: {
    // === Identity ===
    consumer_id: string,
    consumer_type: string,
    
    // === I/O PORTS ===
    sources: [                    // 📥 INPUT PORTS
      {
        schema_name: string,      // What to fetch
        method: "vector" | "recent" | "latest",
        limit: number,
        filters: {}
      }
    ],
    
    output: {                     // 📤 OUTPUT PORT
      schema_name: string,        // Usually agent.context.v1
      tags: string[]
    },
    
    // === Triggers ===
    update_triggers: [            // When to rebuild
      {
        schema_name: string,
        any_tags: string[]
      }
    ]
  }
}
```

**I/O Port Mapping:**
```
📥 INPUTS:  
  - sources[] (data to assemble)
  - update_triggers[] (when to execute)
  
📤 OUTPUTS: 
  - Creates/updates breadcrumb at output.schema_name
  
🔄 STATE: The configuration itself
```

---

### **4. browser.page.context.v1** (Browser State)

```typescript
{
  schema_name: "browser.page.context.v1",
  title: "Browser: {page_title}",
  tags: ["browser:context", "browser:active-tab", "url:{domain}"],
  
  context: {
    // === Page Data ===
    url: string,
    domain: string,
    title: string,
    content: {...},
    dom: {...},
    meta: {...},
    
    // === Transform ===
    llm_hints: {                  // 🔀 TRANSFORM PORT
      mode: "merge",
      transform: {...},
      exclude: [...]
    }
  }
}
```

**I/O Port Mapping:**
```
📥 INPUTS:  
  - Page navigation events (from extension)
  - Manual capture requests
  
📤 OUTPUTS: 
  - breadcrumb.updated events (passive)
  - Other breadcrumbs can reference it
  
🔀 TRANSFORM: llm_hints (server-side transform)
```

---

## 🔌 Dynamic I/O Port Model

Let's think of each breadcrumb type as having **typed ports**:

### **Port Types**

```typescript
type InputPort = {
  type: 'subscription' | 'reference' | 'trigger';
  schema: string;           // What schema it accepts
  filters?: Selector;       // Additional filtering
  cardinality: '1' | 'n';   // One or many
  required: boolean;
};

type OutputPort = {
  type: 'emit' | 'update' | 'create';
  schema: string;           // What schema it produces
  cardinality: '1' | 'n';
  tags: string[];           // Routing tags
};

type TransformPort = {
  type: 'llm_hints' | 'template' | 'extract';
  input: any;               // Input format
  output: any;              // Output format
};
```

---

## 🎨 Breadcrumb Component Diagrams

### **Agent Component**

```
┌────────────────────────────────────────────┐
│         agent.def.v1                       │
│         (Agent Component)                  │
├────────────────────────────────────────────┤
│                                            │
│ 📥 INPUT PORTS (Subscriptions)             │
│  ├─ agent.context.v1                       │
│  ├─ browser.page.context.v1                │
│  ├─ tool.response.v1                       │
│  └─ [any schema via selectors]             │
│                                            │
│ 🔄 PROCESSING                              │
│  ├─ LLM (system_prompt + context)          │
│  └─ Decision making                        │
│                                            │
│ 📤 OUTPUT PORTS (Creates)                  │
│  ├─ agent.response.v1                      │
│  ├─ tool.request.v1                        │
│  └─ [based on capabilities]                │
│                                            │
└────────────────────────────────────────────┘
```

### **Tool Component**

```
┌────────────────────────────────────────────┐
│         tool.v1                            │
│         (Tool Component)                   │
├────────────────────────────────────────────┤
│                                            │
│ 📥 INPUT PORTS                             │
│  ├─ tool.request.v1 (always)               │
│  └─ [optional: subscriptions for auto]     │
│                                            │
│ 🔄 PROCESSING                              │
│  ├─ Execute function                       │
│  └─ Transform input → output               │
│                                            │
│ 📤 OUTPUT PORTS                            │
│  └─ tool.response.v1 (always)              │
│                                            │
└────────────────────────────────────────────┘
```

### **Context Builder Component**

```
┌────────────────────────────────────────────┐
│         context.config.v1                  │
│         (Context Builder Component)        │
├────────────────────────────────────────────┤
│                                            │
│ 📥 INPUT PORTS (Sources)                   │
│  ├─ user.message.v1 (recent + vector)      │
│  ├─ agent.response.v1 (recent + vector)    │
│  ├─ tool.catalog.v1 (latest)               │
│  ├─ tool.response.v1 (recent)              │
│  └─ [ANY schema_name!]                     │
│                                            │
│ 📥 TRIGGER PORTS (Update Triggers)         │
│  └─ user.message.v1 (when to rebuild)      │
│                                            │
│ 🔄 PROCESSING                              │
│  ├─ Fetch from each source                 │
│  ├─ Deduplicate                            │
│  ├─ Token budget                           │
│  └─ Apply llm_hints                        │
│                                            │
│ 📤 OUTPUT PORTS                            │
│  └─ agent.context.v1 (assembled)           │
│                                            │
└────────────────────────────────────────────┘
```

### **Browser Context Component**

```
┌────────────────────────────────────────────┐
│         browser.page.context.v1            │
│         (Browser State Component)          │
├────────────────────────────────────────────┤
│                                            │
│ 📥 INPUT PORTS                             │
│  ├─ Page navigation (external)             │
│  ├─ Tab change (external)                  │
│  └─ Capture request (tool.request.v1)      │
│                                            │
│ 🔄 STATE                                   │
│  ├─ Current URL                            │
│  ├─ Page content                           │
│  ├─ DOM structure                          │
│  └─ Interactive elements                   │
│                                            │
│ 🔀 TRANSFORM PORT                          │
│  └─ llm_hints (technical → natural lang)   │
│                                            │
│ 📤 OUTPUT PORTS                            │
│  └─ breadcrumb.updated events (passive)    │
│                                            │
└────────────────────────────────────────────┘
```

---

## 🔌 Port Connection Patterns

### **Pattern A: Direct Connection** (Current browser → agent)

```
┌─────────────────┐
│ browser.page    │
│  .context.v1    │
└────────┬────────┘
         │ 📤 breadcrumb.updated
         ↓
┌────────┴────────┐
│ Agent           │
│ Subscribes via  │
│ selector        │
└─────────────────┘

Problem: Agent has NO HANDLER for this port!
```

### **Pattern B: Via Context Builder** (Indirect)

```
┌─────────────────┐
│ browser.page    │
│  .context.v1    │
└────────┬────────┘
         │ 📤 exists in DB
         ↓
┌────────┴────────┐
│ Context Builder │
│ Fetches as      │
│ source          │
└────────┬────────┘
         │ 📤 agent.context.v1
         ↓
┌────────┴────────┐
│ Agent           │
│ Has handler ✅   │
└─────────────────┘

Works! But requires context-builder as intermediary.
```

---

## 🧩 The Fundamental Issue

**RCRT has TWO composition models:**

### **Model 1: Selector-Based (Data-Driven)** ✅

```json
{
  "subscriptions": {
    "selectors": [
      {"schema_name": "ANY.SCHEMA.v1"}  // ✅ Works at subscription level
    ]
  }
}
```

Events route correctly! Selectors are fully dynamic.

### **Model 2: Handler-Based (Code-Driven)** ❌

```typescript
if (schemaName === 'agent.context.v1') {
  // Custom processing
} else if (schemaName === 'tool.response.v1') {
  // Custom processing
} else {
  // IGNORED!  ❌ Not composable!
}
```

Processing is hardcoded! Not extensible.

---

## 💡 Generic Port Model

### **What if we think of it like this:**

Every breadcrumb has **implicit ports** based on its schema:

```typescript
type BreadcrumbPorts = {
  // INPUT PORTS (defined in breadcrumb.context)
  inputs: {
    [portName: string]: {
      from_schema: string,      // What schema this port accepts
      from_selector: Selector,  // How to filter
      handling: 'accumulate' | 'replace' | 'trigger' | 'ignore'
    }
  },
  
  // OUTPUT PORTS (defined in breadcrumb.context)
  outputs: {
    [portName: string]: {
      to_schema: string,        // What schema this port produces
      to_tags: string[],        // How to route
      on_event: 'create' | 'update' | 'delete'
    }
  },
  
  // TRANSFORM PORTS (defined in llm_hints)
  transforms: {
    [portName: string]: {
      input: any,
      output: any,
      rules: TransformRule[]
    }
  }
};
```

---

## 🎯 Universal Processing Model

### **Option 1: Event Accumulator** (Stateful)

```typescript
class UniversalProcessor {
  private contextStore = new Map<string, any>();  // schema_name → latest breadcrumb
  
  async processEvent(event: BreadcrumbEvent, definition: any) {
    const breadcrumb = await this.fetch(event.breadcrumb_id);
    
    // Automatically store by schema
    this.contextStore.set(breadcrumb.schema_name, breadcrumb.context);
    
    // Check if this triggers action
    if (this.isTrigger(breadcrumb, definition)) {
      // Pass ALL stored context
      const unifiedContext = Object.fromEntries(this.contextStore);
      await this.execute(breadcrumb, unifiedContext, definition);
    }
  }
}
```

**Every subscription automatically becomes available in context!**

### **Option 2: Context Assembly on Demand** (Stateless)

```typescript
async processEvent(event: BreadcrumbEvent, definition: any) {
  const trigger = await this.fetch(event.breadcrumb_id);
  
  // Only process triggers
  if (!this.isTrigger(trigger, definition)) return;
  
  // Assemble context from ALL subscriptions
  const context = {};
  
  for (const selector of definition.subscriptions.selectors) {
    const breadcrumbs = await this.fetchMatching(selector);
    const key = selector.schema_name.replace(/\./g, '_');
    context[key] = breadcrumbs.map(b => b.context);
  }
  
  // Execute with assembled context
  await this.execute(trigger, context, definition);
}
```

**Fetches everything on-demand when triggered!**

---

## 🤔 **Discussion Questions**

### **1. What Defines a "Trigger" vs "Context"?**

**Current implicit rule:**
- `user.message.v1` = trigger (causes processing)
- `agent.context.v1` = trigger (causes processing)
- Everything else = context (just accumulate)

**Should this be explicit in schema?**

```json
{
  "subscriptions": {
    "selectors": [
      {
        "schema_name": "user.message.v1",
        "role": "trigger"        // 🆕 Explicit!
      },
      {
        "schema_name": "browser.page.context.v1",
        "role": "context"        // 🆕 Explicit!
      }
    ]
  }
}
```

### **2. How to Handle State?**

**Option A: Keep latest of each schema** (Simple)
```typescript
contextStore = {
  'browser.page.context.v1': latestBrowserContext,
  'tool.catalog.v1': latestCatalog
}
```

**Option B: Keep history** (Complex)
```typescript
contextStore = {
  'user.message.v1': [last 20 messages],
  'browser.page.context.v1': latestOnly
}
```

**Should this be configurable per subscription?**

### **3. Agent vs Context-Builder Roles?**

**Option A: Agents fetch their own context** (Self-contained)
- Each agent assembles from subscriptions
- Duplicates context-builder logic

**Option B: Context-builder is universal** (Single point)
- ALL context goes through context-builder
- Agents just receive unified context
- **Current design seems to lean here!**

**Option C: Hybrid** (Flexible)
- Simple agents: Direct subscriptions
- Complex agents: Use context-builder
- Agent decides based on needs

### **4. Should Subscriptions BE the Port Definition?**

**Current:**
```json
"subscriptions": {
  "selectors": [{"schema_name": "x.v1"}]  // Just routing
}
```

**Enhanced:**
```json
"io_ports": {
  "inputs": {
    "browser_context": {
      "selector": {"schema_name": "browser.page.context.v1"},
      "handling": "replace",   // Keep latest
      "required": false,
      "priority": 2
    },
    "user_message": {
      "selector": {"schema_name": "user.message.v1"},
      "handling": "trigger",   // Causes processing
      "required": true,
      "priority": 1
    }
  },
  "outputs": {
    "response": {
      "schema_name": "agent.response.v1",
      "on_event": "trigger_processed"
    }
  }
}
```

---

## 🎯 **The Core Architectural Question**

**Should RCRT have:**

### **A) Universal Generic Processor** (Pure composable)
- ANY subscription automatically included in context
- Processing triggered by ANY event (or specific role='trigger')
- No hardcoded handlers
- True "breadcrumbs as components"

### **B) Typed Processors with Fallback** (Hybrid)
- Special handling for known patterns (agent.context.v1, tool.response.v1)
- Generic handling for unknown schemas (accumulate as context)
- Best of both worlds?

### **C) Pipeline Architecture** (Explicit)
- Define processing pipelines in breadcrumbs
- "When X arrives, do Y, then Z"
- Dataflow programming

---

## 💭 **My Thoughts**

The current design is **almost there** but has a gap:

**What works:**
- ✅ Selector-based routing (fully dynamic)
- ✅ context-builder (universal assembler)
- ✅ Events flow correctly

**What's missing:**
- ❌ AgentExecutor hardcodes what it processes
- ❌ No generic "any subscription becomes context" pattern
- ❌ Have to write code for each new event type

**The fix might be:**
1. Make AgentExecutor accumulate ALL subscribed schemas
2. Define "trigger" vs "context" roles in selectors
3. Pass unified context to LLM
4. Let LLM decide what to do with different context types

**This would make it truly composable without sacrificing the special handling where needed.**

What's your vision? Should subscriptions automatically become available context, or should we keep the current model where context-builder is the universal assembler?
