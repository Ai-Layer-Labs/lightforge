# Clean Universal Executor Design

## 🎯 Principles

1. **No hardcoded schema handlers** - Everything generic
2. **No hardcoded key mappings** - Let subscription define key
3. **No backward compatibility** - Build it right
4. **Single implementation** - No parallel versions
5. **Fully dynamic** - Subscribe to anything, it just works

---

## 📐 Clean Subscription Schema

```typescript
type Subscription = {
  // Routing (selector pattern)
  schema_name: string,
  any_tags?: string[],
  all_tags?: string[],
  context_match?: ContextMatch[],
  
  // Behavior (explicit, required!)
  role: 'trigger' | 'context',
  
  // Context key (explicit, no magic mapping!)
  key?: string,  // If not specified, use schema_name
  
  // Fetch strategy
  fetch: {
    method: 'event_data' | 'latest' | 'recent' | 'vector',
    limit?: number,
    nn?: number
  }
};
```

**Example:**

```json
{
  "schema_name": "browser.page.context.v1",
  "role": "context",
  "key": "browser",          // Simple! No magic mapping!
  "fetch": {
    "method": "latest",
    "limit": 1
  }
}
```

**Result in assembled context:**

```typescript
{
  trigger: {...},
  browser: {...},           // ← Matches key!
  tool_catalog: {...},
  user_messages: [...]
}
```

---

## 🔧 Universal Executor (Clean)

```typescript
/**
 * Universal Executor - Works for Agents, Tools, Workflows
 * Zero hardcoding. Pure data-driven.
 */

export abstract class UniversalExecutor {
  protected rcrtClient: RcrtClientEnhanced;
  protected workspace: string;
  protected subscriptions: Subscription[];
  protected id: string;  // agent_id or tool name
  
  constructor(options: {
    rcrtClient: RcrtClientEnhanced;
    workspace: string;
    subscriptions: Subscription[];
    id: string;
  }) {
    this.rcrtClient = options.rcrtClient;
    this.workspace = options.workspace;
    this.subscriptions = options.subscriptions;
    this.id = options.id;
  }
  
  /**
   * Process ANY SSE event generically
   */
  async processSSEEvent(event: any): Promise<void> {
    if (event.type === 'ping') return;
    
    // Find subscription for this event
    const subscription = this.findMatchingSubscription(event);
    if (!subscription) return;
    
    // Check role
    if (subscription.role === 'context') {
      // Just a notification - data is in DB when we need it
      return;
    }
    
    if (subscription.role === 'trigger') {
      // TRIGGER! Assemble and process
      const triggerBreadcrumb = await this.rcrtClient.getBreadcrumb(event.breadcrumb_id);
      
      // Skip self-created
      if (this.isSelfCreated(triggerBreadcrumb)) return;
      
      // Fetch all context subscriptions
      const context = await this.assembleContext(triggerBreadcrumb);
      
      // Execute (polymorphic)
      const result = await this.execute(triggerBreadcrumb, context);
      
      // Respond
      await this.respond(triggerBreadcrumb, result);
    }
  }
  
  /**
   * Assemble context from subscriptions (pure, no hardcoding)
   */
  private async assembleContext(trigger: any): Promise<Record<string, any>> {
    const context: Record<string, any> = {};
    
    // Add trigger
    context.trigger = trigger;
    
    // Fetch each context subscription
    for (const sub of this.subscriptions) {
      if (sub.role === 'context') {
        const breadcrumbs = await this.fetchSource(sub);
        
        // Use explicit key or schema_name
        const key = sub.key || sub.schema_name;
        
        // Single or multiple based on fetch
        context[key] = (sub.fetch.limit === 1 || sub.fetch.method === 'latest')
          ? breadcrumbs[0]?.context
          : breadcrumbs.map(b => b.context);
      }
    }
    
    return context;
  }
  
  /**
   * Fetch breadcrumbs for a subscription (pure)
   */
  private async fetchSource(sub: Subscription): Promise<any[]> {
    const params: any = {
      schema_name: sub.schema_name,
      include_context: true
    };
    
    // Apply filters
    if (sub.any_tags?.[0]) params.tag = sub.any_tags[0];
    if (sub.fetch.limit) params.limit = sub.fetch.limit;
    
    // Fetch based on method
    switch (sub.fetch.method) {
      case 'latest':
      case 'recent':
        return await this.rcrtClient.searchBreadcrumbsWithContext(params);
      
      case 'vector':
        return await this.rcrtClient.vectorSearch({
          ...params,
          q: this.getSearchQuery(),
          nn: sub.fetch.nn || 5
        });
      
      default:
        return [];
    }
  }
  
  /**
   * Find matching subscription (pure selector matching)
   */
  private findMatchingSubscription(event: any): Subscription | null {
    return this.subscriptions.find(sub => {
      // Schema match
      if (sub.schema_name && sub.schema_name !== event.schema_name) return false;
      
      // Tag match
      if (sub.any_tags && !sub.any_tags.some(t => event.tags?.includes(t))) return false;
      if (sub.all_tags && !sub.all_tags.every(t => event.tags?.includes(t))) return false;
      
      // Context match
      if (sub.context_match) {
        return sub.context_match.every(m => 
          this.matchContext(event.context, m.path, m.op, m.value)
        );
      }
      
      return true;
    }) || null;
  }
  
  private matchContext(context: any, path: string, op: string, value: any): boolean {
    const actual = this.getByPath(context, path);
    if (op === 'eq') return actual === value;
    if (op === 'contains_any') return Array.isArray(actual) && actual.some(v => value.includes(v));
    return false;
  }
  
  private getByPath(obj: any, path: string): any {
    const clean = path.startsWith('$.') ? path.slice(2) : path;
    return clean.split('.').reduce((o, k) => o?.[k], obj);
  }
  
  private isSelfCreated(breadcrumb: any): boolean {
    return breadcrumb.created_by === this.id || 
           breadcrumb.context?.creator?.agent_id === this.id ||
           breadcrumb.context?.creator?.tool === this.id;
  }
  
  protected getSearchQuery(): string {
    // Override in subclass if needed
    return '';
  }
  
  // ============ ABSTRACT METHODS ============
  
  /**
   * Execute with assembled context
   * - Agent: Call LLM
   * - Tool: Run function
   */
  protected abstract execute(trigger: any, context: Record<string, any>): Promise<any>;
  
  /**
   * Create response breadcrumb
   * - Agent: agent.response.v1
   * - Tool: tool.response.v1
   */
  protected abstract respond(trigger: any, result: any): Promise<void>;
}
```

---

## 🤖 Agent Executor (Clean)

```typescript
export class AgentExecutor extends UniversalExecutor {
  private agentDef: any;
  
  constructor(options: {
    agentDef: any;
    rcrtClient: RcrtClientEnhanced;
    workspace: string;
  }) {
    super({
      rcrtClient: options.rcrtClient,
      workspace: options.workspace,
      subscriptions: options.agentDef.context.subscriptions.selectors,
      id: options.agentDef.context.agent_id
    });
    this.agentDef = options.agentDef;
  }
  
  protected async execute(trigger: any, context: Record<string, any>): Promise<any> {
    // Call LLM with context
    const llmInput = {
      model: this.agentDef.context.model,
      system: this.agentDef.context.system_prompt,
      user: trigger.context.message || trigger.context.content,
      context: JSON.stringify(context, null, 2),
      temperature: this.agentDef.context.temperature
    };
    
    const response = await this.callLLM(llmInput);
    return this.parseJSON(response);
  }
  
  protected async respond(trigger: any, result: any): Promise<void> {
    await this.rcrtClient.createBreadcrumb(result.breadcrumb);
  }
  
  private async callLLM(input: any): Promise<string> {
    // Implementation...
    return '';
  }
  
  private parseJSON(text: string): any {
    // Implementation...
    return {};
  }
}
```

---

## 🛠️ Tool Executor (Clean)

```typescript
export class ToolExecutor extends UniversalExecutor {
  private tool: RCRTTool;
  
  constructor(options: {
    tool: RCRTTool;
    rcrtClient: RcrtClientEnhanced;
    workspace: string;
  }) {
    super({
      rcrtClient: options.rcrtClient,
      workspace: options.workspace,
      subscriptions: (options.tool as any).subscriptions?.selectors || [],
      id: options.tool.name
    });
    this.tool = options.tool;
  }
  
  protected async execute(trigger: any, context: Record<string, any>): Promise<any> {
    // Run tool function with context
    const input = trigger.context.input;
    
    const result = await this.tool.execute(input, {
      rcrtClient: this.rcrtClient,
      workspace: this.workspace,
      requestId: trigger.id,
      
      // ✅ Pass assembled context
      ...context
    });
    
    return result;
  }
  
  protected async respond(trigger: any, result: any): Promise<void> {
    const requestId = trigger.context?.requestId || trigger.id;
    
    await this.rcrtClient.createBreadcrumb({
      schema_name: 'tool.response.v1',
      title: `Response: ${this.tool.name}`,
      tags: [this.workspace, 'tool:response', `request:${requestId}`],
      context: {
        request_id: requestId,
        tool: this.tool.name,
        status: 'success',
        output: result
      }
    });
  }
}
```

---

## 📝 Clean Agent Definition Example

```json
{
  "schema_name": "agent.def.v1",
  "title": "Default Chat Assistant",
  "context": {
    "agent_id": "default-chat-assistant",
    "model": "openrouter/google/gemini-2.0-flash-exp:free",
    "temperature": 0.7,
    "system_prompt": "You are a helpful assistant...",
    
    "subscriptions": {
      "selectors": [
        {
          "schema_name": "user.message.v1",
          "any_tags": ["user:message"],
          "role": "trigger",
          "key": "user_message",
          "fetch": {"method": "event_data"}
        },
        {
          "schema_name": "browser.page.context.v1",
          "any_tags": ["browser:active-tab"],
          "role": "context",
          "key": "browser",
          "fetch": {"method": "latest", "limit": 1}
        },
        {
          "schema_name": "tool.catalog.v1",
          "role": "context",
          "key": "tools",
          "fetch": {"method": "latest", "limit": 1}
        }
      ]
    }
  }
}
```

**Clean! Explicit! No magic!**

---

## 🛠️ Clean Tool Definition Example

```json
{
  "schema_name": "tool.v1",
  "title": "Web Analyzer",
  "context": {
    "name": "web-analyzer",
    "description": "Analyzes web pages",
    
    "subscriptions": {
      "selectors": [
        {
          "schema_name": "tool.request.v1",
          "context_match": [{"path": "$.tool", "op": "eq", "value": "web-analyzer"}],
          "role": "trigger",
          "key": "request",
          "fetch": {"method": "event_data"}
        },
        {
          "schema_name": "browser.page.context.v1",
          "any_tags": ["browser:active-tab"],
          "role": "context",
          "key": "current_page",
          "fetch": {"method": "latest", "limit": 1}
        }
      ]
    },
    
    "definition": {
      "inputSchema": {...},
      "outputSchema": {...}
    }
  }
}
```

**Tool receives:**

```typescript
{
  trigger: {...},
  current_page: {...}  // ← Uses explicit key!
}
```

---

## 🔧 Simplified Universal Executor

```typescript
export abstract class UniversalExecutor {
  protected rcrtClient: RcrtClientEnhanced;
  protected subscriptions: Subscription[];
  protected id: string;
  
  async processSSEEvent(event: any): Promise<void> {
    if (event.type === 'ping') return;
    
    const sub = this.subscriptions.find(s => this.matches(event, s));
    if (!sub) return;
    
    if (sub.role === 'context') return;  // Just notification
    
    if (sub.role === 'trigger') {
      const trigger = await this.rcrtClient.getBreadcrumb(event.breadcrumb_id);
      if (this.isSelf(trigger)) return;
      
      const context = await this.assemble(trigger);
      const result = await this.execute(trigger, context);
      await this.respond(trigger, result);
    }
  }
  
  private async assemble(trigger: any): Promise<Record<string, any>> {
    const ctx: Record<string, any> = { trigger };
    
    for (const sub of this.subscriptions.filter(s => s.role === 'context')) {
      const breadcrumbs = await this.fetch(sub);
      const key = sub.key || sub.schema_name;  // ← No hardcoded mapping!
      ctx[key] = sub.fetch.limit === 1 ? breadcrumbs[0]?.context : breadcrumbs.map(b => b.context);
    }
    
    return ctx;
  }
  
  private async fetch(sub: Subscription): Promise<any[]> {
    return await this.rcrtClient.searchBreadcrumbsWithContext({
      schema_name: sub.schema_name,
      tag: sub.any_tags?.[0],
      include_context: true,
      limit: sub.fetch.limit || 1
    });
  }
  
  private matches(event: any, sub: Subscription): boolean {
    if (sub.schema_name !== event.schema_name) return false;
    if (sub.any_tags && !sub.any_tags.some(t => event.tags?.includes(t))) return false;
    if (sub.all_tags && !sub.all_tags.every(t => event.tags?.includes(t))) return false;
    return true;
  }
  
  private isSelf(b: any): boolean {
    return b.created_by === this.id || b.context?.creator?.agent_id === this.id;
  }
  
  // Polymorphic methods
  protected abstract execute(trigger: any, context: Record<string, any>): Promise<any>;
  protected abstract respond(trigger: any, result: any): Promise<void>;
}
```

**Clean! ~100 lines! Zero hardcoding!**

---

## 🤖 Agent Implementation

```typescript
export class AgentExecutor extends UniversalExecutor {
  private systemPrompt: string;
  private model: string;
  
  protected async execute(trigger: any, context: Record<string, any>): Promise<any> {
    const formatted = JSON.stringify(context, null, 2);
    const message = trigger.context.message || trigger.context.content;
    
    const llmResponse = await this.callOpenRouter({
      model: this.model,
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: `Context:\n${formatted}\n\nUser: ${message}` }
      ]
    });
    
    return JSON.parse(llmResponse);
  }
  
  protected async respond(trigger: any, result: any): Promise<void> {
    await this.rcrtClient.createBreadcrumb(result.breadcrumb);
  }
}
```

---

## 🛠️ Tool Implementation

```typescript
export class ToolExecutor extends UniversalExecutor {
  private toolFunction: Function;
  
  protected async execute(trigger: any, context: Record<string, any>): Promise<any> {
    const input = trigger.context.input;
    return await this.toolFunction(input, context);
  }
  
  protected async respond(trigger: any, result: any): Promise<void> {
    await this.rcrtClient.createBreadcrumb({
      schema_name: 'tool.response.v1',
      title: `Response: ${this.id}`,
      tags: [this.workspace, 'tool:response'],
      context: {
        request_id: trigger.id,
        tool: this.id,
        output: result
      }
    });
  }
}
```

---

## 🎯 Complete Example

### **Agent Definition:**

```json
{
  "agent_id": "page-aware-assistant",
  "subscriptions": {
    "selectors": [
      {
        "schema_name": "user.message.v1",
        "role": "trigger",
        "key": "user_message",
        "fetch": {"method": "event_data"}
      },
      {
        "schema_name": "browser.page.context.v1",
        "role": "context",
        "key": "page",
        "fetch": {"method": "latest", "limit": 1}
      },
      {
        "schema_name": "user.message.v1",
        "role": "context",
        "key": "history",
        "fetch": {"method": "recent", "limit": 20}
      }
    ]
  }
}
```

### **What Agent Receives:**

```typescript
{
  trigger: {
    id: "uuid",
    schema_name: "user.message.v1",
    context: {
      message: "What's on this page?"
    }
  },
  page: {
    url: "https://github.com",
    title: "GitHub",
    content: {...}
  },
  history: [
    {message: "Previous question 1"},
    {message: "Previous question 2"}
  ]
}
```

**Clean! Explicit! Everything has a clear name!**

---

## 🎯 Benefits

### **Pure Data-Driven:**

✅ No hardcoded schema names  
✅ No hardcoded key mappings  
✅ No magic inference  
✅ Explicit everywhere  

### **Truly Composable:**

✅ Subscribe to ANY schema  
✅ Define your own keys  
✅ Choose fetch method  
✅ Works immediately  

### **Simple:**

✅ ~100 line base class  
✅ Clear responsibility  
✅ Easy to understand  
✅ Easy to test  

---

## 📋 Implementation Plan

### **Step 1: Create UniversalExecutor**
- Single file, ~100 lines
- Zero hardcoding
- Pure generic

### **Step 2: Implement AgentExecutor**
- Extends UniversalExecutor
- Implements execute() → LLM
- Implements respond() → agent.response.v1

### **Step 3: Implement ToolExecutor**
- Extends UniversalExecutor
- Implements execute() → function
- Implements respond() → tool.response.v1

### **Step 4: Update Definitions**
- Add `role` and `key` to all subscriptions
- Explicit, no inference
- Clear semantics

### **Step 5: Deploy**
- Replace old implementations
- Single pattern everywhere
- Test and iterate

---

## 🎯 Result

**A truly composable system where:**

```
Subscribe to anything → Define role → Define key → It works

No code changes.
No hardcoded mappings.
No magic.
Pure data-driven.
```

**This is The RCRT Way!** ✨

Ready to implement?
