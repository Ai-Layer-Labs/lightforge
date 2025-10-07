# Unified Execution Model - Tools & Agents

## 🎯 The Core Principle

**Agents and Tools should work IDENTICALLY, except for the execution step:**

```
Agents:  SSE trigger → fetch context → call LLM    → respond
Tools:   SSE trigger → fetch context → run function → respond
                                       ↑
                              ONLY DIFFERENCE!
```

---

## 📊 Current State Analysis

### **Agent-Runner** (agent-executor.ts)

```typescript
async processEvent(event: SSEEvent) {
  const breadcrumb = await this.rcrtClient.getBreadcrumb(event.breadcrumb_id);
  
  // ❌ HARDCODED: Only 3 schemas processed
  if (schema === 'agent.context.v1') {
    await this.handleAgentContext(event, breadcrumb);
  } else if (schema === 'tool.response.v1') {
    await this.handleToolResponse(event, breadcrumb);
  } else {
    console.log('Ignoring...');  // ❌ browser.page.context.v1 ignored!
  }
}
```

**Problem:** Doesn't fetch context from other subscriptions!

### **Tools-Runner** (tools-runner/src/index.ts)

```typescript
async dispatchEventToTool(eventData: any, client: RcrtClientEnhanced) {
  // Only process tool.request.v1
  const isToolRequest = eventData.schema_name === 'tool.request.v1';
  
  if (isToolRequest) {
    const breadcrumb = await client.getBreadcrumb(eventData.breadcrumb_id);
    const toolName = breadcrumb.context?.tool;
    const toolInput = breadcrumb.context?.input;
    
    // Execute tool
    const result = await underlyingTool.execute(toolInput, {
      rcrtClient: client,
      agentId: breadcrumb.created_by,
      workspace: workspace,
      metadata: { requestId: breadcrumb.id },
      waitForEvent: (criteria) => globalEventBridge.waitForEvent(criteria)
    });
  }
}
```

**Problem:** Only processes `tool.request.v1`, doesn't support tool subscriptions fully!

---

## 🔌 **Unified Model: Both Should Work Identically**

### **Pattern: Fetch-on-Trigger**

```typescript
interface UniversalExecutor {
  // Same for agents and tools!
  subscriptions: Subscription[];
  
  async processSSEEvent(event: SSEEvent) {
    const subscription = this.findSubscription(event.schema_name);
    
    // 1. Determine if this is a trigger
    if (!this.isTrigger(subscription)) {
      console.log(`📝 ${event.schema_name} updated (context source)`);
      return;  // Just a notification, data is in DB
    }
    
    // 2. Fetch ALL context sources
    const context = await this.assembleContext(event);
    
    // 3. Execute (ONLY DIFFERENCE!)
    if (this.type === 'agent') {
      await this.callLLM(context);        // ← Agent
    } else if (this.type === 'tool') {
      await this.runFunction(context);    // ← Tool
    }
    
    // 4. Create response breadcrumb
    await this.createResponse(result);
  }
  
  async assembleContext(trigger: SSEEvent): Promise<any> {
    const context = { trigger: trigger };
    
    // Fetch ALL context subscriptions
    for (const sub of this.subscriptions) {
      if (sub.role === 'context') {
        const breadcrumbs = await this.fetchFromDB(sub);
        context[sub.key] = breadcrumbs[0]?.context;  // llm_hints applied!
      }
    }
    
    return context;
  }
}
```

**SAME pattern for both! Only execution differs!**

---

## 🎨 **Agent Subscriptions (Example)**

```json
{
  "agent_id": "default-chat-assistant",
  "subscriptions": {
    "selectors": [
      {
        "schema_name": "user.message.v1",
        "role": "trigger",           // SSE event triggers processing
        "fetch": "event_data"        // Use the trigger event itself
      },
      {
        "schema_name": "browser.page.context.v1",
        "role": "context",           // Fetch when triggered
        "fetch": "latest"            // Get latest from DB
      },
      {
        "schema_name": "tool.catalog.v1",
        "role": "context",
        "fetch": "latest"
      },
      {
        "schema_name": "agent.context.v1",
        "role": "trigger",           // Pre-built context ready!
        "fetch": "event_data"
      }
    ]
  }
}
```

**Processing flow:**
```
SSE: user.message.v1 arrives
  ↓ role = 'trigger'
Agent: Fetch context subscriptions
  ├─ GET browser.page.context.v1 (latest)
  └─ GET tool.catalog.v1 (latest)
Agent: Call LLM with unified context
  ↓
Agent: Create agent.response.v1
```

---

## 🛠️ **Tool Subscriptions (Example)**

```json
{
  "name": "browser-context-capture",
  "subscriptions": {
    "selectors": [
      {
        "schema_name": "tool.request.v1",
        "role": "trigger",           // Tool invocation
        "context_match": [{"path": "$.tool", "op": "eq", "value": "browser-context-capture"}]
      },
      {
        "schema_name": "browser.navigation.v1",
        "role": "trigger",           // Auto-trigger on navigation
        "fetch": "event_data"
      },
      {
        "schema_name": "browser.page.context.v1",
        "role": "context",           // Current browser state
        "fetch": "latest"
      }
    ]
  }
}
```

**Processing flow:**
```
SSE: tool.request.v1 arrives
  ↓ role = 'trigger'
Tool: Fetch context subscriptions
  └─ GET browser.page.context.v1 (latest)
Tool: Execute function(input, context)
  ↓
Tool: Create tool.response.v1
```

---

## 🎯 **Unified Execution Interface**

### **Base Executor (Abstract)**

```typescript
abstract class UniversalExecutor {
  protected subscriptions: Subscription[];
  
  // SAME for agents and tools
  async processSSEEvent(event: SSEEvent) {
    const subscription = this.findSubscription(event.schema_name);
    
    if (!subscription) return;  // Not subscribed
    
    const role = subscription.role || this.inferRole(subscription);
    
    if (role === 'trigger') {
      // Assemble context from all subscriptions
      const context = await this.assembleContextFromSubscriptions(event);
      
      // Execute (polymorphic!)
      const result = await this.execute(event, context);
      
      // Create response
      await this.createResponse(event, result);
    }
    // If role === 'context', do nothing
  }
  
  // SAME for both
  async assembleContextFromSubscriptions(trigger: SSEEvent) {
    const context = {};
    
    for (const sub of this.subscriptions) {
      if (this.getRole(sub) === 'context') {
        const breadcrumbs = await this.fetchFromDB(sub);
        const key = this.getContextKey(sub.schema_name);
        context[key] = breadcrumbs[0]?.context;
      }
    }
    
    // Add the trigger event itself
    context.trigger = trigger;
    
    return context;
  }
  
  // DIFFERENT for agents vs tools
  protected abstract async execute(trigger: SSEEvent, context: any): Promise<any>;
}
```

### **Agent Executor (Specialization)**

```typescript
class AgentExecutor extends UniversalExecutor {
  protected async execute(trigger: SSEEvent, context: any): Promise<any> {
    // Format for LLM
    const formatted = this.formatForLLM(context);
    
    // Call LLM
    const response = await this.callLLM(formatted);
    
    // Parse response
    return this.parseAgentResponse(response);
  }
}
```

### **Tool Executor (Specialization)**

```typescript
class ToolExecutor extends UniversalExecutor {
  private toolFunction: Function;
  
  protected async execute(trigger: SSEEvent, context: any): Promise<any> {
    // Extract tool input from trigger
    const input = trigger.context.input;
    
    // Run tool function
    const result = await this.toolFunction(input, {
      ...context,  // Include all fetched context!
      rcrtClient: this.rcrtClient,
      workspace: this.workspace
    });
    
    return result;
  }
}
```

---

## 🎯 **The Only Difference**

```typescript
// SAME:
- Receive SSE events
- Determine role (trigger vs context)
- Fetch context subscriptions from DB
- Assemble unified context

// DIFFERENT:
- Agents: Pass to LLM
- Tools: Pass to function

// SAME AGAIN:
- Create response breadcrumb
- Publish via NATS/SSE
```

---

## 📋 **Implementation Checklist**

### **1. Add role to subscriptions** (schema extension)

```typescript
type SubscriptionSelector = {
  schema_name: string,
  any_tags?: string[],
  all_tags?: string[],
  context_match?: ContextMatch[],
  
  // 🆕 NEW:
  role?: 'trigger' | 'context',
  fetch?: 'event_data' | 'latest' | 'recent' | 'vector',
  limit?: number
};
```

### **2. Create UniversalExecutor base class**

```typescript
abstract class UniversalExecutor {
  // Common: SSE handling, context assembly, response creation
  abstract execute(trigger, context): Promise<any>;
}
```

### **3. Refactor AgentExecutor**

```typescript
class AgentExecutor extends UniversalExecutor {
  // Remove hardcoded handlers
  // Use generic fetch-on-trigger pattern
  execute() { return this.callLLM(); }
}
```

### **4. Refactor ToolExecutor** (tools-runner)

```typescript
class ToolExecutor extends UniversalExecutor {
  // Remove hardcoded tool.request.v1 check
  // Use generic fetch-on-trigger pattern
  execute() { return this.runFunction(); }
}
```

### **5. Update tool definitions**

Tools can now have subscriptions with roles:
```json
{
  "name": "context-builder",
  "subscriptions": {
    "selectors": [
      {
        "schema_name": "user.message.v1",
        "role": "trigger"  // Run when user messages arrive
      }
    ]
  }
}
```

---

## 🎯 **The Unified Architecture**

```
┌─────────────────────────────────────────────────────┐
│              RCRT Universal Executor                │
│              (Base Pattern)                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📥 SSE EVENT (Trigger Notification)                │
│  ↓ breadcrumb_id, schema_name, tags                │
│                                                     │
│  🔍 ROLE DETECTION                                  │
│  ↓ subscription.role = 'trigger' or 'context'?     │
│                                                     │
│  IF TRIGGER:                                        │
│  ├─ 🔎 FETCH ALL CONTEXT SUBSCRIPTIONS             │
│  │   └─ GET /breadcrumbs (latest, recent, vector)  │
│  │       (llm_hints applied!)                       │
│  │                                                  │
│  ├─ 📦 ASSEMBLE UNIFIED CONTEXT                     │
│  │   └─ {trigger, browser_context, tool_catalog}   │
│  │                                                  │
│  ├─ 🔄 EXECUTE (Polymorphic!)                       │
│  │   ├─ Agent: → LLM(context)                      │
│  │   └─ Tool: → function(input, context)           │
│  │                                                  │
│  └─ 📤 CREATE RESPONSE                              │
│      ├─ Agent: → agent.response.v1                 │
│      └─ Tool: → tool.response.v1                   │
│                                                     │
│  IF CONTEXT:                                        │
│  └─ Do nothing (it's in DB for later fetch)        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🛠️ **Tools Currently Missing Context Assembly**

Looking at current tools-runner code:

```typescript
// Current (WRONG):
await underlyingTool.execute(toolInput, {
  rcrtClient: client,
  agentId: breadcrumb.created_by,
  workspace: workspace,
  // ❌ NO CONTEXT FROM SUBSCRIPTIONS!
});
```

**Should be:**

```typescript
// Unified (RIGHT):
// 1. Fetch context subscriptions
const context = await this.assembleContextFromSubscriptions(toolDef, trigger);

// 2. Execute with full context
await underlyingTool.execute(toolInput, {
  rcrtClient: client,
  workspace: workspace,
  // ✅ Include all subscribed context!
  context: {
    browser_page: context.browser_page_context,
    tool_catalog: context.tool_catalog,
    // ... all subscriptions
  }
});
```

---

## 🎯 **Example: context-builder Tool**

**context-builder ALREADY does this correctly!**

```typescript
// It subscribes to user.message.v1 (trigger)
subscriptions: {
  selectors: [{
    schema_name: 'user.message.v1',
    any_tags: ['user:message']
  }]
}

// When triggered, it FETCHES sources from DB
async execute(input: any) {
  const triggerEvent = input.trigger_event;
  
  // Fetch sources (defined in context.config.v1)
  for (const source of config.sources) {
    breadcrumbs = await client.fetch(source);  // From DB!
    assembled[source.schema_name] = breadcrumbs;
  }
  
  // Update output
  await client.updateBreadcrumb(contextId, assembled);
}
```

**This is the PERFECT pattern! All other tools/agents should match!**

---

## 📐 **Unified Subscription Schema**

```typescript
type UniversalSubscription = {
  // Routing (existing)
  schema_name: string,
  any_tags?: string[],
  all_tags?: string[],
  context_match?: ContextMatch[],
  
  // Behavior (NEW - explicit!)
  role: 'trigger' | 'context',
  
  // Fetch strategy (NEW - explicit!)
  fetch: {
    method: 'event_data' | 'latest' | 'recent' | 'vector',
    limit?: number,
    nn?: number  // For vector search
  }
};
```

**Example for Agent:**

```json
{
  "subscriptions": {
    "selectors": [
      {
        "schema_name": "user.message.v1",
        "role": "trigger",
        "fetch": {"method": "event_data"}
      },
      {
        "schema_name": "browser.page.context.v1",
        "role": "context",
        "fetch": {"method": "latest", "limit": 1}
      }
    ]
  }
}
```

**Example for Tool:**

```json
{
  "name": "web-analyzer",
  "subscriptions": {
    "selectors": [
      {
        "schema_name": "tool.request.v1",
        "context_match": [{"path": "$.tool", "op": "eq", "value": "web-analyzer"}],
        "role": "trigger",
        "fetch": {"method": "event_data"}
      },
      {
        "schema_name": "browser.page.context.v1",
        "role": "context",
        "fetch": {"method": "latest"}
      }
    ]
  }
}
```

---

## 🔄 **Unified Processing Flow**

### **Flow 1: Agent Processing**

```
1. SSE: user.message.v1 arrives (trigger)
     ↓
2. Agent: Fetch context subscriptions
   ├─ GET /breadcrumbs?schema_name=browser.page.context.v1&limit=1
   ├─ GET /breadcrumbs?schema_name=tool.catalog.v1&limit=1
   └─ (All return ContextView with llm_hints)
     ↓
3. Agent: Assemble
   {
     user_message: triggerEvent,
     browser_page_context: fetchedBrowser,
     tool_catalog: fetchedCatalog
   }
     ↓
4. Agent: Execute
   → callLLM(systemPrompt, context)
     ↓
5. Agent: Respond
   → POST agent.response.v1
```

### **Flow 2: Tool Processing**

```
1. SSE: tool.request.v1 arrives (trigger)
     ↓
2. Tool: Fetch context subscriptions
   ├─ GET /breadcrumbs?schema_name=browser.page.context.v1&limit=1
   └─ (If tool subscribed to it)
     ↓
3. Tool: Assemble
   {
     tool_input: triggerEvent.context.input,
     browser_page_context: fetchedBrowser  // ← Tool can use this!
   }
     ↓
4. Tool: Execute
   → runFunction(input, contextWithSubscriptions)
     ↓
5. Tool: Respond
   → POST tool.response.v1
```

---

## 💡 **This Enables New Patterns**

### **Example: Browser-aware tool**

```json
{
  "name": "smart-search",
  "description": "Searches based on current page context",
  "subscriptions": {
    "selectors": [
      {
        "schema_name": "tool.request.v1",
        "context_match": [{"path": "$.tool", "op": "eq", "value": "smart-search"}],
        "role": "trigger"
      },
      {
        "schema_name": "browser.page.context.v1",
        "role": "context"  // ← Tool can access browser context!
      }
    ]
  }
}
```

**Tool implementation:**

```typescript
async execute(input: any, context: ToolExecutionContext) {
  // Access browser context from subscriptions!
  const browserContext = context.browser_page_context;
  
  // Use current page URL/domain in search
  const searchQuery = `${input.query} site:${browserContext.domain}`;
  
  return await search(searchQuery);
}
```

---

## 🎯 **The Unified Architecture**

```
┌──────────────────────────────────────────────────────┐
│         UniversalExecutor (Base Class)               │
├──────────────────────────────────────────────────────┤
│                                                      │
│  processSSEEvent(event)                              │
│  assembleContextFromSubscriptions(trigger)           │
│  createResponse(result)                              │
│  findSubscription(schema_name)                       │
│  getRole(subscription)                               │
│                                                      │
│  abstract execute(trigger, context): Promise<any>   │
│                                                      │
└──────────────┬───────────────────┬───────────────────┘
               │                   │
      ┌────────┴────────┐   ┌──────┴──────┐
      │                 │   │             │
┌─────▼──────┐  ┌──────▼─────┐  ┌────▼─────┐
│   Agent    │  │    Tool    │  │ Workflow │
│  Executor  │  │  Executor  │  │ Executor │
├────────────┤  ├────────────┤  ├──────────┤
│            │  │            │  │          │
│ execute(): │  │ execute(): │  │execute():│
│  callLLM() │  │ function() │  │ steps()  │
│            │  │            │  │          │
└────────────┘  └────────────┘  └──────────┘
```

**Same base, different execution mechanism!**

---

## 📝 **Key Principles**

### **1. SSE = Trigger Notifications**
- Events say "something changed"
- Contain metadata + context (raw)
- Don't "deliver state", they "trigger fetch"

### **2. Subscriptions = Fetch Specifications**
- Define what to fetch when triggered
- Specify method (latest, recent, vector)
- Database is always source of truth

### **3. Execution = Polymorphic**
- Agents: context → LLM → response
- Tools: context → function → response
- Workflows: context → steps → response

### **4. Stateless = Fetch on Trigger**
- No local caching needed
- Database has the data
- Always fresh, never stale

---

## 🎯 **Summary**

**Your insight:**
> "SSE events are triggers, context subscriptions are what is retrieved when something is run"

**This is EXACTLY right!**

**The model:**
```
SSE Event (trigger) → Fetch context subscriptions from DB → Execute → Respond
```

**Same for agents and tools, only execution differs!**

**This makes the system truly composable:**
- ✅ Subscribe to anything
- ✅ Fetch on-demand
- ✅ No code changes
- ✅ Agents and tools identical pattern

Want me to design the unified implementation that makes both agent-runner and tools-runner use this exact same pattern?
