# Unified Executor Implementation Design

## 🎯 Goal

Make agents and tools use **identical execution pattern** with only the execution step different.

Enable **any subscription to automatically work** without code changes.

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│         packages/runtime/src/executor/                  │
│         UniversalExecutor (Base Class)                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Core Methods (Same for all):                           │
│  ├─ processSSEEvent(event)                              │
│  ├─ assembleContextFromSubscriptions(trigger)           │
│  ├─ findSubscription(schema_name)                       │
│  ├─ getSubscriptionRole(subscription)                   │
│  ├─ fetchContextSource(subscription)                    │
│  └─ createResponseBreadcrumb(result)                    │
│                                                         │
│  Abstract (Different for each):                         │
│  └─ execute(trigger, context): Promise<any>            │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          │
                          │ extends
          ┌───────────────┼───────────────┐
          ↓               ↓               ↓
    ┌──────────┐   ┌────────────┐  ┌──────────┐
    │  Agent   │   │    Tool    │  │ Workflow │
    │ Executor │   │  Executor  │  │ Executor │
    └──────────┘   └────────────┘  └──────────┘
```

---

## 🔧 Part 1: Base Class

**File:** `packages/runtime/src/executor/universal-executor.ts`

```typescript
/**
 * Universal Executor - Base class for Agents, Tools, Workflows
 * 
 * Core Pattern:
 * 1. Receive SSE event (trigger or context notification)
 * 2. Determine event role (trigger vs context)
 * 3. If trigger: Fetch all context subscriptions from DB
 * 4. Execute (polymorphic - LLM for agents, function for tools)
 * 5. Create response breadcrumb
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

export interface Subscription {
  // Routing
  schema_name: string;
  any_tags?: string[];
  all_tags?: string[];
  context_match?: Array<{
    path: string;
    op: string;
    value: any;
  }>;
  
  // Behavior (with defaults for backward compatibility)
  role?: 'trigger' | 'context';  // Default: infer from schema
  fetch?: {
    method: 'event_data' | 'latest' | 'recent' | 'vector';
    limit?: number;
    nn?: number;
  };
  
  // Metadata
  comment?: string;
  priority?: number;
}

export interface ExecutionContext {
  trigger: any;              // The event that triggered processing
  [key: string]: any;        // Fetched context from subscriptions
}

export interface UniversalExecutorOptions {
  rcrtClient: RcrtClientEnhanced;
  workspace: string;
  subscriptions: Subscription[];
  definition: any;  // agent.def.v1 or tool.v1 context
}

export abstract class UniversalExecutor {
  protected rcrtClient: RcrtClientEnhanced;
  protected workspace: string;
  protected subscriptions: Subscription[];
  protected definition: any;
  
  constructor(options: UniversalExecutorOptions) {
    this.rcrtClient = options.rcrtClient;
    this.workspace = options.workspace;
    this.subscriptions = options.subscriptions;
    this.definition = options.definition;
  }
  
  /**
   * Main entry point - processes ANY SSE event
   */
  async processSSEEvent(event: any): Promise<void> {
    // Skip pings
    if (event.type === 'ping') return;
    
    console.log(`📨 [${this.getExecutorName()}] Event: ${event.schema_name}`);
    
    try {
      // Find matching subscription
      const subscription = this.findMatchingSubscription(event);
      
      if (!subscription) {
        console.log(`⏭️ No subscription for ${event.schema_name}, ignoring`);
        return;
      }
      
      // Determine role
      const role = this.getSubscriptionRole(subscription, event.schema_name);
      
      if (role === 'context') {
        // Just a state update notification
        console.log(`📝 ${event.schema_name} updated (context source, will fetch when triggered)`);
        return;
      }
      
      if (role === 'trigger') {
        // This triggers processing!
        console.log(`🎯 ${event.schema_name} is a TRIGGER, assembling context...`);
        
        // Fetch the trigger breadcrumb (with llm_hints)
        const triggerBreadcrumb = await this.rcrtClient.getBreadcrumb(event.breadcrumb_id);
        
        // Prevent self-triggering
        if (this.isSelfCreated(triggerBreadcrumb)) {
          console.log(`⏭️ Skipping self-created event`);
          return;
        }
        
        // Assemble full context from all subscriptions
        const context = await this.assembleContextFromSubscriptions(triggerBreadcrumb);
        
        // Execute (polymorphic!)
        const result = await this.execute(triggerBreadcrumb, context);
        
        // Create response
        await this.createResponse(triggerBreadcrumb, result);
        
        console.log(`✅ ${event.schema_name} processed successfully`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing event:`, error);
      throw error;
    }
  }
  
  /**
   * Assemble context from all subscriptions
   * This is the CORE of the unified pattern!
   */
  protected async assembleContextFromSubscriptions(trigger: any): Promise<ExecutionContext> {
    const context: ExecutionContext = {
      trigger: trigger.context  // The event that triggered us
    };
    
    console.log(`🔍 Assembling context from ${this.subscriptions.length} subscriptions...`);
    
    // Fetch each context subscription
    for (const subscription of this.subscriptions) {
      const role = this.getSubscriptionRole(subscription, subscription.schema_name);
      
      if (role === 'context') {
        try {
          const breadcrumbs = await this.fetchContextSource(subscription);
          
          if (breadcrumbs.length > 0) {
            const key = this.getContextKey(subscription.schema_name);
            
            // Store based on fetch method
            if (subscription.fetch?.method === 'latest' || subscription.fetch?.limit === 1) {
              context[key] = breadcrumbs[0].context;  // Single item
            } else {
              context[key] = breadcrumbs.map(b => b.context);  // Array
            }
            
            console.log(`  ✅ Fetched ${key}: ${breadcrumbs.length} item(s)`);
          }
        } catch (error) {
          console.warn(`  ⚠️ Failed to fetch ${subscription.schema_name}:`, error);
          // Continue with other sources
        }
      }
    }
    
    console.log(`✅ Context assembled with ${Object.keys(context).length - 1} sources`);
    
    return context;
  }
  
  /**
   * Fetch breadcrumbs for a context subscription
   */
  protected async fetchContextSource(subscription: Subscription): Promise<any[]> {
    const method = subscription.fetch?.method || 'latest';
    const limit = subscription.fetch?.limit || 1;
    
    switch (method) {
      case 'latest':
        return await this.rcrtClient.searchBreadcrumbsWithContext({
          schema_name: subscription.schema_name,
          tag: subscription.any_tags?.[0],
          include_context: true,
          limit: limit
        });
      
      case 'recent':
        return await this.rcrtClient.searchBreadcrumbsWithContext({
          schema_name: subscription.schema_name,
          tag: subscription.any_tags?.[0],
          include_context: true,
          limit: limit
        });
      
      case 'vector':
        // For vector search, use the trigger message as query
        const query = this.getVectorSearchQuery();
        return await this.rcrtClient.vectorSearch({
          q: query,
          nn: subscription.fetch?.nn || 5,
          schema_name: subscription.schema_name
        });
      
      case 'event_data':
        // Use the event data itself (already fetched)
        return [];
      
      default:
        return [];
    }
  }
  
  /**
   * Find subscription matching this event
   */
  protected findMatchingSubscription(event: any): Subscription | null {
    for (const sub of this.subscriptions) {
      if (this.matchesSelector(event, sub)) {
        return sub;
      }
    }
    return null;
  }
  
  /**
   * Check if event matches subscription selector
   */
  protected matchesSelector(event: any, subscription: Subscription): boolean {
    // Schema name match
    if (subscription.schema_name && event.schema_name !== subscription.schema_name) {
      return false;
    }
    
    // Tag matching
    if (subscription.any_tags) {
      const hasAny = subscription.any_tags.some(tag => event.tags?.includes(tag));
      if (!hasAny) return false;
    }
    
    if (subscription.all_tags) {
      const hasAll = subscription.all_tags.every(tag => event.tags?.includes(tag));
      if (!hasAll) return false;
    }
    
    // Context matching (simplified)
    if (subscription.context_match) {
      for (const match of subscription.context_match) {
        const value = this.getValueByPath(event.context, match.path);
        if (!this.compareValues(value, match.value, match.op)) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Determine subscription role (trigger vs context)
   */
  protected getSubscriptionRole(subscription: Subscription, schema: string): 'trigger' | 'context' {
    // Explicit role wins
    if (subscription.role) {
      return subscription.role;
    }
    
    // Infer from schema (backward compatibility)
    const triggerSchemas = [
      'user.message.v1',
      'agent.context.v1',
      'tool.request.v1',
      'system.message.v1'
    ];
    
    return triggerSchemas.includes(schema) ? 'trigger' : 'context';
  }
  
  /**
   * Generate context key from schema name
   */
  protected getContextKey(schema: string): string {
    // Map common schemas to friendly names
    const keyMap: Record<string, string> = {
      'user.message.v1': 'user_message',
      'agent.response.v1': 'agent_responses',
      'tool.response.v1': 'tool_results',
      'tool.catalog.v1': 'tool_catalog',
      'browser.page.context.v1': 'browser_context',
      'agent.def.v1': 'agent_definition',
      'context.config.v1': 'context_config'
    };
    
    return keyMap[schema] || schema.replace(/\./g, '_');
  }
  
  /**
   * Check if breadcrumb was self-created
   */
  protected isSelfCreated(breadcrumb: any): boolean {
    const creatorId = breadcrumb.created_by || breadcrumb.context?.creator?.agent_id;
    const myId = this.definition.agent_id || this.definition.name;
    return creatorId === myId;
  }
  
  /**
   * Get executor name for logging
   */
  protected getExecutorName(): string {
    return this.definition.agent_id || this.definition.name || 'unknown';
  }
  
  /**
   * Helper methods for context matching
   */
  protected getValueByPath(obj: any, path: string): any {
    if (path.startsWith('$.')) path = path.substring(2);
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (!current) return undefined;
      current = current[part];
    }
    return current;
  }
  
  protected compareValues(actual: any, expected: any, op: string): boolean {
    switch (op) {
      case 'eq': return actual === expected;
      case 'ne': return actual !== expected;
      case 'contains_any':
        if (Array.isArray(actual) && Array.isArray(expected)) {
          return expected.some(e => actual.includes(e));
        }
        return false;
      default: return false;
    }
  }
  
  protected getVectorSearchQuery(): string {
    // Override in subclass if needed
    return '';
  }
  
  // ============ ABSTRACT METHODS ============
  
  /**
   * Execute with assembled context (polymorphic!)
   * - Agents: Call LLM
   * - Tools: Run function
   * - Workflows: Execute steps
   */
  protected abstract execute(trigger: any, context: ExecutionContext): Promise<any>;
  
  /**
   * Create response breadcrumb
   * - Agents: agent.response.v1
   * - Tools: tool.response.v1
   * - Workflows: workflow.result.v1
   */
  protected abstract createResponse(trigger: any, result: any): Promise<void>;
}
```

---

## 🤖 Part 2: Agent Executor (Refactored)

**File:** `packages/runtime/src/agent/agent-executor-v2.ts`

```typescript
import { UniversalExecutor, ExecutionContext, Subscription } from '../executor/universal-executor';
import { AgentDefinitionV1 } from '@rcrt-builder/core';

export class AgentExecutorV2 extends UniversalExecutor {
  private agentDef: AgentDefinitionV1;
  
  constructor(options: {
    agentDef: AgentDefinitionV1;
    rcrtClient: RcrtClientEnhanced;
    workspace: string;
  }) {
    // Extract subscriptions from agent definition
    const subscriptions = options.agentDef.context.subscriptions?.selectors || [];
    
    super({
      rcrtClient: options.rcrtClient,
      workspace: options.workspace,
      subscriptions: subscriptions,
      definition: options.agentDef.context
    });
    
    this.agentDef = options.agentDef;
  }
  
  /**
   * Execute: Call LLM with assembled context
   */
  protected async execute(trigger: any, context: ExecutionContext): Promise<any> {
    console.log(`🤖 [Agent ${this.agentDef.context.agent_id}] Calling LLM...`);
    
    // Format context for LLM
    const systemPrompt = this.agentDef.context.system_prompt;
    const userMessage = this.extractUserMessage(trigger);
    
    // Build LLM context string
    const contextString = this.formatContextForLLM(context);
    
    // Call LLM (OpenRouter)
    const llmResponse = await this.callLLM({
      model: this.agentDef.context.model || 'openrouter/google/gemini-2.0-flash-exp:free',
      systemPrompt: systemPrompt,
      userMessage: userMessage,
      context: contextString,
      temperature: this.agentDef.context.temperature || 0.7
    });
    
    // Parse JSON response
    const parsed = this.parseAgentResponse(llmResponse);
    
    return parsed;
  }
  
  /**
   * Format assembled context for LLM
   */
  private formatContextForLLM(context: ExecutionContext): string {
    let formatted = '# Available Context\n\n';
    
    for (const [key, value] of Object.entries(context)) {
      if (key === 'trigger') continue;  // Already in user message
      
      formatted += `## ${this.humanizeKey(key)}\n\n`;
      
      if (typeof value === 'object') {
        formatted += '```json\n';
        formatted += JSON.stringify(value, null, 2);
        formatted += '\n```\n\n';
      } else {
        formatted += value + '\n\n';
      }
    }
    
    return formatted;
  }
  
  /**
   * Create agent response breadcrumb
   */
  protected async createResponse(trigger: any, result: any): Promise<void> {
    // Extract breadcrumb from LLM response
    const breadcrumbDef = result.breadcrumb || result;
    
    await this.rcrtClient.createBreadcrumb({
      schema_name: breadcrumbDef.schema_name || 'agent.response.v1',
      title: breadcrumbDef.title || 'Agent Response',
      tags: breadcrumbDef.tags || ['agent:response'],
      context: {
        ...breadcrumbDef.context,
        creator: {
          type: 'agent',
          agent_id: this.agentDef.context.agent_id
        }
      }
    });
  }
  
  // Helper methods...
  private extractUserMessage(trigger: any): string {
    return trigger.context?.message || 
           trigger.context?.content || 
           JSON.stringify(trigger.context);
  }
  
  private humanizeKey(key: string): string {
    return key.replace(/_/g, ' ')
              .replace(/\b\w/g, c => c.toUpperCase());
  }
  
  private async callLLM(options: any): Promise<string> {
    // Use OpenRouter tool via RCRT
    const llmRequest = await this.rcrtClient.createBreadcrumb({
      schema_name: 'tool.request.v1',
      title: 'LLM Request',
      tags: ['tool:request', this.workspace],
      context: {
        tool: 'openrouter',
        input: {
          model: options.model,
          messages: [
            { role: 'system', content: options.systemPrompt },
            { role: 'user', content: `${options.context}\n\n${options.userMessage}` }
          ],
          temperature: options.temperature
        },
        requestId: `llm-${Date.now()}`,
        requestedBy: this.agentDef.context.agent_id
      }
    });
    
    // Wait for response (use EventBridge pattern)
    // TODO: Implement waitForEvent properly
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Fetch response
    const responses = await this.rcrtClient.searchBreadcrumbsWithContext({
      schema_name: 'tool.response.v1',
      tag: `request:${llmRequest.id}`,
      include_context: true,
      limit: 1
    });
    
    if (responses[0]) {
      return responses[0].context.output?.choices?.[0]?.message?.content || 
             responses[0].context.output || 
             '';
    }
    
    throw new Error('No LLM response received');
  }
  
  private parseAgentResponse(llmOutput: string): any {
    // Extract JSON from LLM output
    try {
      const { extractAndParseJSON } = require('../utils/json-repair');
      return extractAndParseJSON(llmOutput);
    } catch (error) {
      // Fallback
      return {
        action: 'create',
        breadcrumb: {
          schema_name: 'agent.response.v1',
          title: 'Agent Response',
          tags: ['agent:response'],
          context: {
            message: llmOutput
          }
        }
      };
    }
  }
}
```

---

## 🛠️ Part 3: Tool Executor (New)

**File:** `packages/runtime/src/tool/tool-executor.ts`

```typescript
import { UniversalExecutor, ExecutionContext, Subscription } from '../executor/universal-executor';
import { RCRTTool } from '@rcrt-builder/tools';

export class ToolExecutor extends UniversalExecutor {
  private tool: RCRTTool;
  
  constructor(options: {
    tool: RCRTTool;
    rcrtClient: RcrtClientEnhanced;
    workspace: string;
  }) {
    // Extract subscriptions from tool definition
    const subscriptions = (options.tool as any).subscriptions?.selectors || [];
    
    super({
      rcrtClient: options.rcrtClient,
      workspace: options.workspace,
      subscriptions: subscriptions,
      definition: { name: options.tool.name }
    });
    
    this.tool = options.tool;
  }
  
  /**
   * Execute: Run tool function with assembled context
   */
  protected async execute(trigger: any, context: ExecutionContext): Promise<any> {
    console.log(`🛠️ [Tool ${this.tool.name}] Executing...`);
    
    // Extract tool input from trigger
    const toolInput = trigger.context?.input || trigger.context;
    
    // Execute tool with full context
    const result = await this.tool.execute(toolInput, {
      rcrtClient: this.rcrtClient,
      workspace: this.workspace,
      requestId: trigger.id,
      metadata: { trigger: trigger.context },
      
      // ✅ NEW: Pass assembled context from subscriptions!
      assembledContext: context
    });
    
    return result;
  }
  
  /**
   * Create tool response breadcrumb
   */
  protected async createResponse(trigger: any, result: any): Promise<void> {
    const requestId = trigger.context?.requestId || trigger.id;
    
    await this.rcrtClient.createBreadcrumb({
      schema_name: 'tool.response.v1',
      title: `Response: ${this.tool.name}`,
      tags: [this.workspace, 'tool:response', `request:${requestId}`],
      context: {
        request_id: requestId,
        tool: this.tool.name,
        status: 'success',
        output: result,
        timestamp: new Date().toISOString()
      }
    });
  }
}
```

---

## 🔄 Part 4: Update ToolExecutionContext Interface

**File:** `packages/tools/src/index.ts`

```typescript
export interface ToolExecutionContext {
  requestId: string;
  workspace: string;
  agentId?: string;
  metadata?: Record<string, any>;
  rcrtClient: RcrtClientEnhanced;
  
  // ✅ NEW: Assembled context from subscriptions!
  assembledContext?: {
    browser_context?: any;
    tool_catalog?: any;
    agent_definition?: any;
    [key: string]: any;
  };
  
  // RCRT-Native: Wait for events instead of polling
  waitForEvent?: (criteria: any, timeout?: number) => Promise<any>;
}
```

---

## 🔄 Part 5: Update tools-runner

**File:** `apps/tools-runner/src/universal-tool-dispatcher.ts` (NEW)

```typescript
/**
 * Universal Tool Dispatcher
 * Uses UniversalExecutor pattern for all tools
 */

import { ToolExecutor } from '@rcrt-builder/runtime';
import { ToolLoader } from '@rcrt-builder/tools';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

export class UniversalToolDispatcher {
  private toolExecutors = new Map<string, ToolExecutor>();
  
  constructor(
    private client: RcrtClientEnhanced,
    private workspace: string
  ) {}
  
  /**
   * Load all tools and create executors
   */
  async initialize() {
    const loader = new ToolLoader(this.client, this.workspace);
    const tools = await loader.discoverTools();
    
    console.log(`🔧 Initializing ${tools.length} tool executors...`);
    
    for (const tool of tools) {
      const executor = new ToolExecutor({
        tool: tool,
        rcrtClient: this.client,
        workspace: this.workspace
      });
      
      this.toolExecutors.set(tool.name, executor);
    }
    
    console.log(`✅ ${this.toolExecutors.size} tool executors ready`);
  }
  
  /**
   * Dispatch SSE event to appropriate tool
   */
  async dispatchEvent(event: any) {
    // For each tool, check if it should handle this event
    for (const [toolName, executor] of this.toolExecutors) {
      try {
        await executor.processSSEEvent(event);
      } catch (error) {
        console.error(`❌ Tool ${toolName} error:`, error);
      }
    }
  }
}
```

---

## 📋 Implementation Steps

### **Phase 1: Create Base Class**

1. ✅ Create `packages/runtime/src/executor/universal-executor.ts`
2. ✅ Implement `processSSEEvent()` - generic event handling
3. ✅ Implement `assembleContextFromSubscriptions()` - fetch from DB
4. ✅ Add `role` inference logic (backward compatible)

### **Phase 2: Refactor AgentExecutor**

1. ✅ Extend `UniversalExecutor`
2. ✅ Implement `execute()` - call LLM
3. ✅ Implement `createResponse()` - agent.response.v1
4. ✅ Remove hardcoded schema handlers
5. ✅ Test with existing agents (should work identically!)

### **Phase 3: Create ToolExecutor**

1. ✅ Extend `UniversalExecutor`
2. ✅ Implement `execute()` - run function
3. ✅ Implement `createResponse()` - tool.response.v1
4. ✅ Update `ToolExecutionContext` interface

### **Phase 4: Update tools-runner**

1. ✅ Create `UniversalToolDispatcher`
2. ✅ Replace hardcoded `tool.request.v1` check
3. ✅ Use `ToolExecutor.processSSEEvent()` for all events
4. ✅ Test with existing tools (should work identically!)

### **Phase 5: Add role metadata** (optional, for optimization)

1. ✅ Add `role` field to subscription schema
2. ✅ Update agent/tool definitions to use explicit roles
3. ✅ Backward compatible (infer if not specified)

---

## 🎯 Backward Compatibility Strategy

### **Default Behavior (No code changes needed!)**

```typescript
// Existing agent definition (NO changes):
{
  "subscriptions": {
    "selectors": [
      {"schema_name": "agent.context.v1"}  // No role specified
    ]
  }
}

// UniversalExecutor infers:
role = inferRole('agent.context.v1') 
     = 'trigger'  // Known trigger schema
```

**Result:** Works identically to current system!

### **New Explicit Behavior (When specified)**

```typescript
// New agent definition (WITH explicit role):
{
  "subscriptions": {
    "selectors": [
      {
        "schema_name": "browser.page.context.v1",
        "role": "context"  // Explicit!
      }
    ]
  }
}

// UniversalExecutor uses explicit role
role = subscription.role = 'context'
```

**Result:** New schemas work automatically!

---

## 🎨 Migration Path

### **Phase 1: Parallel Implementation**

- Keep existing AgentExecutor as `agent-executor.ts`
- Create new `agent-executor-v2.ts`
- Run side-by-side
- Test with non-critical agents

### **Phase 2: Validation**

- Verify all existing agents work identically
- Test new subscriptions (browser context)
- Performance testing
- Error handling validation

### **Phase 3: Cutover**

- Replace `agent-executor.ts` with v2
- Update tools-runner to use `ToolExecutor`
- Deploy to production
- Monitor for issues

### **Phase 4: Cleanup**

- Remove old implementation
- Add explicit roles to definitions
- Optimize fetch patterns
- Document patterns

---

## 🔌 Example: Browser Context Working

### **With Unified Executor:**

```json
// Agent definition (NO CODE CHANGES):
{
  "subscriptions": {
    "selectors": [
      {
        "schema_name": "agent.context.v1",
        "role": "trigger"
      },
      {
        "schema_name": "browser.page.context.v1",
        "role": "context"  // ✅ Just add this!
      }
    ]
  }
}
```

**What happens:**

```
1. User asks: "What's on this page?"
   → POST user.message.v1
   
2. context-builder triggers
   → Assembles agent.context.v1
   → Includes conversation history
   
3. Agent receives agent.context.v1 via SSE
   → role = 'trigger'
   → Fetches context subscriptions:
     ├─ GET browser.page.context.v1 (latest) ✅
     └─ Returns: {summary, page_text, url, ...}
   
4. Agent calls LLM with BOTH:
   - Conversation history (from agent.context.v1)
   - Browser context (from fetch)
   
5. LLM responds:
   "You're viewing 'GitHub' at github.com. The page shows..."
   
6. Agent creates agent.response.v1
```

**IT JUST WORKS! No code changes!**

---

## 📊 Benefits

### **For Developers:**

✅ **No hardcoded handlers** - Subscribe to anything  
✅ **Agents = Tools** - Same pattern, different execution  
✅ **Easy to extend** - Add new schemas without code  
✅ **Testable** - Mock subscriptions easily  
✅ **Debuggable** - Clear fetch → process flow  

### **For System:**

✅ **Composable** - Mix and match subscriptions  
✅ **Stateless** - DB is source of truth  
✅ **Efficient** - Fetch only when needed  
✅ **Consistent** - Same pattern everywhere  
✅ **Maintainable** - Single implementation  

---

## 🎯 Summary

**The Unified Pattern:**

```
SSE Event (trigger notification)
  ↓
Determine role (trigger or context)
  ↓
IF TRIGGER:
  Fetch all context subscriptions from DB
  ↓
  Assemble unified context
  ↓
  Execute (LLM for agents, function for tools)
  ↓
  Create response breadcrumb
```

**Benefits:**
- ✅ Browser context works automatically
- ✅ Any new schema works automatically
- ✅ Tools and agents identical pattern
- ✅ No code changes for new subscriptions

**Next:** Implement UniversalExecutor base class and refactor AgentExecutor to extend it!

Ready to build?
