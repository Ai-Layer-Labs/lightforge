# RCRT Event Flow - The Real Problem

## What the Logs Show

### Timeline of Events
```
17:35:52.506 - Workflow creates 3 tool.request breadcrumbs
17:35:52.529 - EventBridge waiting for responses (3 pending)
17:36:52.527 - ⏰ TIMEOUT (60 seconds later!)
17:36:52.551 - 📡 SSE delivers tool.request events ← 60 SECONDS LATE!
17:36:52.599 - Tools finally execute
17:36:52.696 - tool.response created
```

## The Core Issue

**The SSE stream takes 60 seconds to deliver breadcrumb events!**

This breaks the event-driven model because:
1. Workflow creates tool.request → Goes to database
2. Workflow waits for tool.response via EventBridge
3. SSE should immediately deliver tool.request event → tools-runner executes
4. But SSE is DELAYED by 60 seconds!
5. EventBridge times out before tools even execute

## Why 60 Seconds?

Possibilities:
1. **SSE Buffering** - Server buffers events before sending
2. **Network timeout** - Connection timeout is 60s
3. **Keep-alive interval** - SSE sends pings every 60s
4. **Database trigger delay** - Postgres NOTIFY has delay

## Solutions Evaluated

### ❌ Solution 1: Direct Execution (Fast but not RCRT)
```javascript
// Workflow directly calls tools
const result = await executeToolDirectly('random', {});
```

**Problems:**
- Breaks distributed model
- Tools must be local
- Can't scale across machines
- Not RCRT-native

### ⚠️ Solution 2: Local Fast Path
```javascript
// If tool is local, execute immediately
// Still emit breadcrumbs for event stream
if (isLocalTool(toolName)) {
  const result = await executeLocal(tool, input);
  await emitResponse(result); // Still create breadcrumb
}
```

**Problems:**
- Complex logic (local vs remote)
- Race conditions (double execution?)
- Not pure RCRT

### ✅ Solution 3: Fix the SSE Delay (RCRT-Native)

Find why SSE takes 60 seconds and fix it!

**Possible fixes:**
1. Reduce SSE ping interval
2. Disable buffering
3. Use immediate NOTIFY in Postgres
4. Fix keep-alive settings

**Benefits:**
- Truly RCRT-native
- Works for all cases
- Distributed
- Scalable

### 🚀 Solution 4: Hybrid Event Bus (RCRT-Native + Fast)

The tools-runner maintains an in-process event bus that gets events BEFORE they go to SSE:

```javascript
class ToolsRunner {
  async createBreadcrumb(breadcrumb) {
    // 1. Create in database
    const created = await db.create(breadcrumb);
    
    // 2. Emit to local event bus IMMEDIATELY
    localEventBus.emit(created);
    
    // 3. Also goes to SSE (for distributed listeners)
    // SSE can be slow, but local listeners get it instantly
    
    return created;
  }
}
```

**Flow:**
```
Workflow → createBreadcrumb() → Database
              ↓
         LocalEventBus.emit() ← INSTANT!
              ↓
         EventBridge.handleEvent()
              ↓
         Workflow continues ← <10ms!
         
         (Meanwhile)
         SSE → Other machines ← Distributed
```

**Benefits:**
- ✅ Fast (local events instant)
- ✅ RCRT-native (still uses breadcrumbs)
- ✅ Distributed (SSE for remote)
- ✅ Scalable (works for any pattern)
- ✅ No tight coupling (still event-driven)

## My Recommendation

**Solution 4: Hybrid Event Bus**

This is the RCRT way because:
1. Everything is still breadcrumbs
2. Events drive the system
3. Works locally AND distributed
4. Scales to any pattern

Implementation:
```javascript
// tools-runner creates client wrapper
const enhancedClient = {
  async createBreadcrumb(breadcrumb) {
    // Create in database
    const created = await realClient.createBreadcrumb(breadcrumb);
    
    // Immediately emit locally (don't wait for SSE)
    globalEventBridge.handleEvent(
      { type: 'breadcrumb.updated', breadcrumb_id: created.id },
      created
    );
    
    return created;
  }
};

// Tools use the enhanced client
tool.execute(input, { 
  rcrtClient: enhancedClient  // ← Gets immediate local events
});
```

This way:
- **Same process**: Events arrive instantly via local bus
- **Different process**: Events arrive via SSE (may be delayed)
- **Always works**: Breadcrumbs are created regardless
- **Fully distributed**: Remote tools still work via SSE

## Scalability Check

✅ **Single machine**: Local event bus is instant  
✅ **Multiple machines**: SSE delivers to all  
✅ **Dynamic tools**: New tools subscribe to SSE  
✅ **Tool on different machine**: Gets events via SSE  
✅ **Tool on same machine**: Gets events instantly  
✅ **Future patterns**: All benefit from fast local + distributed SSE

**This is the RCRT way - event-driven but optimized for locality!**

Should I implement the hybrid event bus?

