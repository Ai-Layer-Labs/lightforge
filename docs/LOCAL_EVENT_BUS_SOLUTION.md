# Local Event Bus - RCRT-Native Solution

## The Problem (From Your Logs)

```
17:35:52.506 → Workflow creates tool.request
17:35:52.529 → EventBridge waits for tool.response
17:36:52.527 → ⏰ Timeout (60s)
17:36:52.551 → 📡 SSE finally delivers tool.request ← TOO LATE!
```

**SSE has 60-second latency for same-process events!**

## The RCRT-Native Solution

### Hybrid Event Bus Pattern

```
         createBreadcrumb()
                ↓
           ┌─────────┐
           │ Database│
           └────┬────┘
                │
        ┌───────┴───────┐
        │               │
        ↓               ↓
  Local EventBus    SSE Stream
  (instant!)        (distributed)
        │               │
        ↓               ↓
  Same Process      Other Machines
```

### Why This Is RCRT-Native

1. ✅ **Everything is breadcrumbs** - No shortcuts
2. ✅ **Events drive the system** - Still event-driven
3. ✅ **Asynchronous** - Non-blocking
4. ✅ **Distributed** - Works across machines
5. ✅ **Decoupled** - No direct function calls

### Implementation

```javascript
// Enhanced client wrapper
class LocalEventBusClient {
  constructor(realClient, eventBridge) {
    this.realClient = realClient;
    this.eventBridge = eventBridge;
  }
  
  async createBreadcrumb(breadcrumb) {
    // 1. Create in database (RCRT-native)
    const created = await this.realClient.createBreadcrumb(breadcrumb);
    
    // 2. Emit locally IMMEDIATELY (optimization)
    // This doesn't bypass SSE, it supplements it!
    setImmediate(() => {
      this.eventBridge.handleEvent(
        { 
          type: 'breadcrumb.updated',
          breadcrumb_id: created.id,
          schema_name: created.schema_name
        },
        created
      );
    });
    
    // 3. SSE will ALSO deliver (for distributed listeners)
    
    return created;
  }
  
  // All other methods pass through
  async getBreadcrumb(id) {
    return this.realClient.getBreadcrumb(id);
  }
  
  async searchBreadcrumbs(params) {
    return this.realClient.searchBreadcrumbs(params);
  }
  
  // etc...
}
```

## Scalability Analysis

### Scenario 1: Same Machine (Workflow + Tools)
```
Workflow → createBreadcrumb() → Database
              ↓ (immediate)
         LocalEventBus
              ↓ (<1ms)
         EventBridge
              ↓
         Workflow continues ← FAST!
```
✅ **Works perfectly**

### Scenario 2: Different Machines (Distributed)
```
Machine A: Workflow → createBreadcrumb() → Database
                          ↓
                      SSE/NATS
                          ↓
Machine B: Tool Runner → Receives SSE → Executes
                          ↓
                      SSE/NATS
                          ↓
Machine A: EventBridge → Receives response via SSE
```
✅ **Still works** (via SSE)

### Scenario 3: Mixed (Some Local, Some Remote)
```
Workflow → Creates 3 tool requests
    ↓
Tool 1 (local) → LocalEventBus → Executes instantly
Tool 2 (remote) → SSE → Different machine
Tool 3 (local) → LocalEventBus → Executes instantly
    ↓
All responses come back via EventBridge
```
✅ **Optimal** (fast for local, works for remote)

### Scenario 4: External Tool Creation
```
Agent A → Creates tool.request for workflow
    ↓
SSE → tools-runner receives
    ↓
Workflow executes → Creates sub-requests
    ↓
LocalEventBus → Sub-tools execute instantly
```
✅ **Works** (only workflow's sub-requests are local)

### Scenario 5: Tool on Different Runner
```
Tools-Runner A: Workflow
Tools-Runner B: Custom Tool

Workflow (A) → Creates request → Database
                    ↓
               SSE → Both A & B
                    ↓
Runner B → Has the tool → Executes
                    ↓
            Response → Database
                    ↓
               SSE → Both A & B
                    ↓
Runner A EventBridge → Receives → Workflow continues
```
✅ **Fully distributed**

## Key Insight

**The local event bus is an OPTIMIZATION, not a bypass!**

- Breadcrumbs still created ✅
- Events still emitted ✅  
- SSE still delivers ✅
- Remote tools still work ✅
- Local tools are just FASTER ✅

It's like having both:
- **Fast lane**: Local events (<1ms)
- **Distributed lane**: SSE events (varies)

Both lanes deliver the SAME events!

## Comparison to Other Systems

### Redis Pub/Sub Pattern
```
publish(event) → Redis → All subscribers
                  ↓
            (No local optimization)
```

### Kafka Pattern
```
produce(event) → Kafka → Consumers
                  ↓
            (Broker always in middle)
```

### RCRT Hybrid Pattern
```
createBreadcrumb() → Database → SSE → Distributed
        ↓
  LocalEventBus → Same process (fast!)
```

**Best of both worlds!**

## Does It Scale?

| Pattern | Local (1 machine) | Distributed (N machines) | Dynamic Tools |
|---------|-------------------|--------------------------|---------------|
| Direct calls | ⚡ Fast | ❌ No | ❌ No |
| SSE only | 🐌 Slow | ✅ Yes | ✅ Yes |
| **Hybrid** | ⚡ Fast | ✅ Yes | ✅ Yes |

## My Recommendation

✅ **YES, implement the hybrid event bus!**

It's RCRT-native because:
1. Everything is still breadcrumbs
2. Events still drive the system
3. Works distributed
4. Scales dynamically

It's also practical because:
1. Local tools are instant
2. Remote tools work via SSE
3. No breaking changes
4. Simple implementation

**This is the scalable, dynamic, RCRT-native solution!**

Want me to implement it?

