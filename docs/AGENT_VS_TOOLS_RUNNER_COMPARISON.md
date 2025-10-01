# Agent-Runner vs Tools-Runner Architecture

## They Work the SAME Way Now! ✅

### Agent-Runner Architecture

```javascript
class ModernAgentRegistry {
  // 1. Centralized SSE connection
  async startCentralizedSSE(jwtToken) {
    const stream = await fetch('/events/stream', { headers: { Authorization } });
    
    // Process all events
    for (const event of stream) {
      await this.routeEventToAgent(event);
    }
  }
  
  // 2. Route to appropriate agents
  async routeEventToAgent(event) {
    // Check agent subscriptions
    for (const [agentId, executor] of this.executors) {
      if (this.matchesAgentSubscriptions(event, agentDef)) {
        executor.processEvent(event);  // ← Agent processes event
      }
    }
  }
}

class AgentExecutor {
  // 3. Process events
  async processEvent(event) {
    if (event.schema_name === 'tool.response.v1') {
      await this.handleToolResponse(event);
    } else if (event.schema_name === 'user.message.v1') {
      await this.handleChatMessage(event);
    }
  }
}
```

### Tools-Runner Architecture (NOW FIXED!)

```javascript
class ToolsRunner {
  // 1. Centralized SSE connection
  async startCentralizedSSEDispatcher(client, workspace, jwtToken) {
    const stream = await fetch('/events/stream', { headers: { Authorization } });
    
    // Process all events
    for (const event of stream) {
      // Feed to event bridge
      globalEventBridge.handleEvent(event, breadcrumb);
      
      // Dispatch to tool
      await dispatchEventToTool(event, client, workspace);
    }
  }
  
  // 2. Dispatch to appropriate tool
  async dispatchEventToTool(event, client, workspace) {
    const loader = new ToolLoader(client, workspace);
    const tool = await loader.loadToolByName(toolName);
    
    // Execute with event bridge in context
    const result = await tool.execute(input, {
      rcrtClient: client,
      waitForEvent: (criteria, timeout) => globalEventBridge.waitForEvent(criteria, timeout)
    });
  }
}

class EventBridge {
  // 3. Handle events
  handleEvent(event, breadcrumb) {
    // Check if any tool is waiting
    for (const wait of pendingWaits) {
      if (matches(breadcrumb, wait.criteria)) {
        wait.resolve(breadcrumb);  // ← Tool gets event!
      }
    }
  }
}
```

## The Parallel Structure

| Component | Agent-Runner | Tools-Runner |
|-----------|--------------|--------------|
| **SSE Connection** | ✅ `startCentralizedSSE()` | ✅ `startCentralizedSSEDispatcher()` |
| **Event Router** | ✅ `routeEventToAgent()` | ✅ `dispatchEventToTool()` |
| **Event Matching** | ✅ `matchesAgentSubscriptions()` | ✅ `EventBridge.matches()` |
| **Event Processing** | ✅ `AgentExecutor.processEvent()` | ✅ `EventBridge.handleEvent()` |
| **No Polling** | ✅ Pure events | ✅ Pure events (now!) |

## Key Difference

### Agent-Runner
```javascript
// Agents have subscriptions in their definition
{
  "subscriptions": {
    "selectors": [
      { "schema_name": "user.message.v1" },
      { "schema_name": "tool.response.v1", "context_match": [...] }
    ]
  }
}

// Router checks: does this event match agent's subscriptions?
if (matchesAgentSubscriptions(event, agentDef)) {
  executor.processEvent(event);
}
```

### Tools-Runner
```javascript
// Tools don't have subscriptions (they execute on demand)
// But they can WAIT for events during execution

// Tool requests an event
const response = await context.waitForEvent({
  schema_name: 'tool.response.v1',
  request_id: 'xyz'
});

// EventBridge delivers it when it arrives
```

## Both Are Event-Driven! ✅

### Agent Flow
```
SSE → Agent Registry → Match Subscriptions → AgentExecutor.processEvent()
```

### Tool Flow (Now)
```
SSE → EventBridge → Match Criteria → waitForEvent() resolves
```

## The Agent-Runner Also Has Event Correlation!

Look at this code from agent-runner (lines 26-31, 160-167):

```javascript
class ModernAgentRegistry {
  private pendingRequests = new Map();  // ← Same pattern!
  
  async routeEventToAgent(event) {
    // Check if this is a tool response we're waiting for
    if (event.schema_name === 'tool.response.v1' && event.context?.requestId) {
      const pending = this.pendingRequests.get(event.context.requestId);
      if (pending) {
        pending.resolve(event);  // ← Exactly like our EventBridge!
        this.pendingRequests.delete(event.context.requestId);
        return;
      }
    }
  }
}
```

**The agent-runner ALREADY had this pattern for correlating tool responses!**

## Summary

**YES**, they work the same way:
1. ✅ Both have centralized SSE
2. ✅ Both route events
3. ✅ Both use event correlation (not polling)
4. ✅ Both are RCRT-native

The tools-runner just needed an EventBridge to do what the agent-runner's `pendingRequests` map does!

**Now both runners are architecturally aligned!** 🎉
