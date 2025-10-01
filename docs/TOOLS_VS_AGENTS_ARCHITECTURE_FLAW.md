# Critical Architecture Flaw: Tools Can't Subscribe to Events

## The Problem You Just Identified

### How Agents Work (CORRECT) ✅
```javascript
class AgentExecutor {
  async start() {
    // Subscribe to SSE
    this.eventStream = await subscribeToEvents(selectors);
    
    // Process events as they arrive
    this.eventStream.on('event', (event) => {
      this.processEvent(event);
    });
  }
  
  async processEvent(event) {
    // Handle tool.response.v1
    // Handle user.message.v1
    // Handle tool.catalog.v1
    // etc.
  }
}
```

### How Tools Work (WRONG) ❌
```javascript
class WorkflowTool {
  async execute(input, context) {
    // Create tool request
    await context.rcrtClient.createBreadcrumb({
      schema_name: 'tool.request.v1',
      ...
    });
    
    // ❌ POLL for response (not RCRT-native!)
    while (!found) {
      const responses = await client.searchBreadcrumbs(...);
      if (responses.length > 0) return;
      await sleep(500);
    }
  }
}
```

## The Core Issue

**Tools execute synchronously but need async event handling!**

```
Agent:
  Start → Subscribe to SSE → Process events forever → Stop

Tool:
  Execute → Return result → Done
  ↑ NO EVENT SUBSCRIPTION!
```

## Why This Breaks Workflow Tool

```javascript
// Workflow executes
async execute(input, context) {
  // Creates tool.request.v1
  await createBreadcrumb({...});
  
  // ❌ Tries to SEARCH for tool.response.v1
  // Should: LISTEN for tool.response.v1 via SSE!
  const response = await waitForToolResponse();
}
```

**The workflow tool has NO ACCESS to the event stream!**

## The RCRT-Native Solution

### Option 1: Context Provides Event Listener
```typescript
interface ToolExecutionContext {
  rcrtClient: RcrtClientEnhanced;
  
  // NEW: Event subscription API
  onEvent(selector: Selector, handler: (event) => void): () => void;
  waitForEvent(selector: Selector, timeout: number): Promise<any>;
}

// Usage in workflow:
const response = await context.waitForEvent({
  schema_name: 'tool.response.v1',
  context_match: [
    { path: '$.request_id', op: 'eq', value: requestId }
  ]
}, 60000);
```

### Option 2: Workflow Gets Its Own SSE Connection
```typescript
class WorkflowOrchestratorTool {
  private activeSubscriptions = new Map();
  
  async execute(input, context) {
    // Subscribe to responses for THIS workflow
    const stopListener = await client.subscribeToEvents(
      { schema_name: 'tool.response.v1' },
      (event) => this.handleResponseEvent(event)
    );
    
    try {
      // Execute workflow
      await this.executeSteps(steps);
    } finally {
      stopListener();
    }
  }
  
  private handleResponseEvent(event) {
    // Match event to pending requests
    const pending = this.activeSubscriptions.get(event.context.request_id);
    if (pending) {
      pending.resolve(event.context);
    }
  }
}
```

### Option 3: Tools-Runner Provides Event Bridge
```typescript
// Tools-runner maintains the SSE connection
// Provides event relay to running tools

class ToolExecutionContext {
  private eventBridge: EventBridge;
  
  waitForBreadcrumb(requestId: string): Promise<any> {
    return this.eventBridge.waitFor({
      schema_name: 'tool.response.v1',
      request_id: requestId
    });
  }
}

// Tools-runner's event bridge
class EventBridge {
  private pending = new Map();
  
  constructor(sseStream) {
    sseStream.on('event', (event) => {
      // Check if any tool is waiting for this
      const waiting = this.pending.get(event.context.request_id);
      if (waiting) {
        waiting.resolve(event);
      }
    });
  }
  
  waitFor(criteria): Promise<any> {
    return new Promise((resolve, reject) => {
      this.pending.set(criteria.request_id, { resolve, reject });
    });
  }
}
```

## Current State (Broken)

```
Tools-Runner → SSE Stream → Events → tools-runner processes them
                                    ↓
                            Calls tool.execute()
                                    ↓
                            Tool has NO ACCESS to events!
                                    ↓
                            Tool tries to SEARCH instead
                                    ↓
                            FAILS due to indexing delay
```

## RCRT-Native State (Fixed)

```
Tools-Runner → SSE Stream → Events → EventBridge
                                          ↓
                            Tool requests via context.waitForEvent()
                                          ↓
                            EventBridge matches and resolves
                                          ↓
                            Tool gets event immediately!
```

## You're Absolutely Right

The fallback is redundant because:
1. If tag search fails, it's an **indexing issue**
2. Searching again won't help
3. The event HAS ALREADY HAPPENED (we can see it!)
4. We just can't FIND it via search

**The solution is EVENT-DRIVEN, not SEARCH-DRIVEN!**
