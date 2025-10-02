# RCRT Philosophy Violations - Complete Audit

## RCRT Core Philosophy

1. **Everything is breadcrumbs** - Persistent state in database, not memory
2. **Event-driven** - SSE/events, not polling
3. **Asynchronous** - Non-blocking, distributed
4. **Dynamic** - Discovery via breadcrumbs, not hardcoded
5. **Decoupled** - Breadcrumbs as contracts, not direct calls

## Violations Found

### ❌ CRITICAL: In-Memory State (Should Be Breadcrumbs)

#### 1. Processing Status Map
**Location:** `apps/tools-runner/src/index.ts` line 15
```javascript
const processingStatus = new Map<string, 'processing' | 'completed'>();
```

**Issue:** Deduplication state in memory  
**Problem:** Lost on restart, not shared across instances  
**RCRT Way:** Use breadcrumb tags or status field  

**Should be:**
```javascript
// Add status tag to breadcrumb when processing starts
await updateBreadcrumb(requestId, {
  tags: [...existing, 'status:processing']
});

// Check status via tag search
const processing = await searchBreadcrumbs({
  id: requestId,
  tag: 'status:processing'
});
```

#### 2. Pending Requests Map
**Location:** `apps/agent-runner/src/index.ts` line 26
```javascript
private pendingRequests = new Map<string, {...}>();
```

**Issue:** Request correlation in memory  
**Problem:** Lost on restart  
**RCRT Way:** Use breadcrumb relationships

**Should be:**
```javascript
// Tool request breadcrumb has:
{
  "context": {
    "requestId": "xyz",
    "requestedBy": "agent-123",
    "status": "pending"  // Track state in breadcrumb
  }
}

// Tool response breadcrumb links to request:
{
  "context": {
    "request_id": "xyz",  // Relationship!
    "status": "completed"
  }
}

// Search for response by request_id, not Map lookup
```

#### 3. Event History in EventBridge
**Location:** `apps/tools-runner/src/event-bridge.ts` line 26
```javascript
private eventHistory: any[] = [];  // Last 100 events in memory
```

**Issue:** Recent events cached in memory  
**Problem:** Lost on restart, not queryable  
**RCRT Way:** Recent events are already in database!

**Should be:**
```javascript
// Instead of caching in memory:
async waitForEvent(criteria, timeout) {
  // Check recent breadcrumbs first (they're in DB!)
  const recent = await searchBreadcrumbs({
    schema_name: criteria.schema_name,
    updated_since: new Date(Date.now() - 60000).toISOString()  // Last minute
  });
  
  // Then subscribe to future events
  // No need for in-memory cache
}
```

### ⚠️ MEDIUM: Periodic Polling (Should Be Event-Driven)

#### 4. Catalog Refresh Timer
**Location:** `apps/tools-runner/src/index.ts` line 418
```javascript
setInterval(async () => {
  const updatedTools = await loader.discoverTools();
  console.log(`📊 Catalog refresh: ${updatedTools.length} tools available`);
}, 30000);  // Every 30 seconds
```

**Issue:** Polling for tool changes  
**RCRT Way:** Subscribe to tool.v1 creation/updates

**Should be:**
```javascript
// Subscribe to tool.v1 events
client.subscribeToEvents({
  schema_name: 'tool.v1',
  all_tags: [workspace]
}, async (event) => {
  console.log('🆕 Tool added/updated, refreshing catalog');
  await updateCatalog();
});

// No polling needed!
```

#### 5. Health Check Timer
**Location:** `apps/agent-runner/src/index.ts` line 60
```javascript
setInterval(() => this.performHealthCheck(), healthCheckInterval);
```

**Issue:** Periodic health checks  
**RCRT Way:** Tools emit heartbeat breadcrumbs

**Should be:**
```javascript
// Each tool periodically creates:
{
  "schema_name": "tool.heartbeat.v1",
  "context": {
    "toolName": "random",
    "status": "healthy",
    "lastExecuted": "..."
  },
  "ttl": "+5m"  // Auto-expires
}

// Monitor subscribes to heartbeats
// No polling needed!
```

### ⚠️ LOW: UI State (Acceptable)

#### 6. Dashboard Zustand Store
**Location:** `rcrt-dashboard-v2/frontend/src/stores/DashboardStore.tsx`
```javascript
nodes: Map<string, RenderNode>;
selectedNodeIds: string[];
camera: { position, zoom };
```

**Status:** ✅ ACCEPTABLE  
**Why:** Ephemeral UI state (camera position, selections)  
**Not needed in breadcrumbs:** Temporary, local-only state

#### 7. Canvas Positions
**Location:** Various dashboard files
```javascript
nodePositions: [];
canvasOffset: { x, y };
```

**Status:** ✅ ACCEPTABLE  
**Why:** Rendering state, not business logic  
**Could be breadcrumbs:** For persistence, but optional

### ✅ OK: Legitimate Caching

#### 8. Secret Cache
**Location:** `packages/nodes/security/src/secrets-node.ts`
```javascript
this.cacheSecret(key, secret);
```

**Status:** ✅ ACCEPTABLE  
**Why:** Performance optimization for already-fetched data  
**Source of truth:** Still in breadcrumbs/secrets

#### 9. Module Cache
**Location:** `packages/node-sdk/src/dev-server.ts`
```javascript
delete require.cache[resolvedPath];
```

**Status:** ✅ ACCEPTABLE  
**Why:** Node.js runtime cache, not business state

## Severity Breakdown

### 🔴 Critical (Violates RCRT)
1. **processingStatus Map** - Should use breadcrumb tags/status
2. **pendingRequests Map** - Should use breadcrumb relationships

### 🟡 Medium (Not Pure RCRT)
3. **eventHistory cache** - Should query recent breadcrumbs
4. **Periodic catalog refresh** - Should subscribe to tool.v1 events
5. **Health check polling** - Should use heartbeat breadcrumbs

### 🟢 Acceptable (UI/Performance)
6. Dashboard UI state - Ephemeral, local-only
7. Secret caching - Performance optimization
8. Module caching - Runtime optimization

## The Pattern

### ❌ Violates RCRT
```javascript
// In-memory business state
const state = new Map();
state.set(id, data);

// Periodic polling
setInterval(() => checkForUpdates(), 30000);

// Request correlation in memory
pendingRequests.set(requestId, {...});
```

### ✅ RCRT Way
```javascript
// Business state as breadcrumbs
await createBreadcrumb({
  context: { status: 'processing' }
});

// Event subscription
subscribeToEvents({ schema_name: '...' }, handleEvent);

// Relationship via breadcrumb fields
{
  context: {
    request_id: 'xyz'  // Link to request breadcrumb
  }
}
```

## Fix Priority

### Must Fix (Breaks distributed/persistent)
1. **processingStatus** → Use breadcrumb status tags
2. **pendingRequests** → Use breadcrumb request_id relationships

### Should Fix (Not pure RCRT)
3. **eventHistory** → Query recent breadcrumbs instead
4. **Periodic refresh** → Subscribe to events
5. **Health checks** → Use heartbeat breadcrumbs

### Can Keep (Reasonable)
6. UI state → Ephemeral, acceptable
7. Caching → Performance, acceptable

## Recommended Fixes

### Phase 1: State Management
```javascript
// Instead of processingStatus Map:
{
  "schema_name": "tool.request.v1",
  "tags": ["tool:request", "status:processing"],  // ← Track in tags
  "context": {
    "tool": "random",
    "processingStarted": "2025-10-02T12:00:00Z"
  }
}

// Check if processing:
const isProcessing = breadcrumb.tags.includes('status:processing');
```

### Phase 2: Event Subscriptions
```javascript
// Instead of setInterval for catalog:
client.subscribeToEvents({
  schema_name: 'tool.v1'
}, () => updateCatalog());

// Event-driven, real-time!
```

## Conclusion

**Major violations:** 2 (in-memory state Maps)  
**Medium violations:** 3 (polling instead of events)  
**Acceptable:** UI state and caching  

**The critical ones are small fixes that would make the system fully distributed and restartable!**

