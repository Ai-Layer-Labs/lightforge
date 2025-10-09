# Today's Fixes - THE RCRT WAY

## 🎯 Summary

Cleaned up messy legacy code and fixed critical bugs in **workflow orchestration**, **connection rendering**, and **browser extension persistence**.

---

## 🔧 Fix #1: Workflow Orchestrator - Dependencies Not Working

### Problem
```
[Workflow] Step calculator_step failed: 
  Error: random_step is not defined
```

LLM correctly specified `depends_on: ["random_step"]` but:
- ❌ Workflow code only looked for `dependencies` field
- ❌ Broken regex failed to auto-detect from `${...}` syntax
- ❌ Both steps ran in parallel instead of sequential

### Solution
**File**: `rcrt-visual-builder/packages/tools/src/workflow-orchestrator.ts`

1. **Support both field names**:
```typescript
dependencies: step.dependencies || step.depends_on || this.extractDependencies(...)
```

2. **Fixed broken regex**:
```typescript
// OLD (broken): Required }} at end
const varPattern = /[\$\{]{2}([^}]+)[\}]{2}/g;

// NEW (fixed): Properly matches ${...} or {{...}}
const varPattern = /\$\{([^}]+)\}|\{\{([^}]+)\}\}/g;
```

3. **Added TypeScript types** to prevent future errors

### Result
✅ Workflows now execute steps in correct dependency order
✅ Variable substitution works: `${random_step.numbers[0]}` → `65`
✅ Calculator receives actual values, not template strings

### Rebuild
```bash
pnpm --filter @rcrt-builder/tools run build
pnpm --filter tools-runner run build
docker-compose restart tools-runner
```

---

## 🎨 Fix #2: Connection Rendering - Messy Legacy Code

### Problem
Multiple overlapping connection types with inconsistent styling:
- `creation`, `subscription`, `emission`, `tool-response`, `agent-definition`, `secret-usage`, `acl-grant`, `webhook`, `agent-thinking`, `tool-request`, `tool-execution`
- Confusing colors and styles
- Code spread across multiple files
- No single source of truth

### Solution - THE RCRT WAY

**Created 3 new files**:
1. `connectionTypes.ts` - Single source of truth for styling
2. `connectionDiscovery.ts` - Clean discovery logic
3. Rewrote `Connection2D.tsx` and `Connection3D.tsx`

**Defined ONLY 4 connection types**:

| Type | Color | Style | Meaning |
|------|-------|-------|---------|
| **creates** | Green `#00ff88` | Solid | Agent/tool creates breadcrumb |
| **config** | Purple `#9333ea` | Dashed | Tool uses config |
| **subscribed** | Blue `#0099ff` | Dotted | Agent subscribed to events |
| **triggered** | Blue `#0099ff` | **Solid** (thick) | Event triggers agent |

### Visual Legend
```
Agent ──────> Breadcrumb    (Green solid)
Tool - - - -> Config        (Purple dashed)
Event ····> Agent           (Blue dotted)
Event ══════> Agent         (Blue solid, animated)
```

### Code Changes
- ✅ Nuked 11 legacy connection types
- ✅ Single source of truth in `connectionTypes.ts`
- ✅ Clean discovery in `connectionDiscovery.ts`
- ✅ Consistent 2D/3D rendering
- ✅ Self-documenting (color tells you the relationship)

### Rebuild
```bash
cd rcrt-dashboard-v2/frontend
npm run build
docker-compose build frontend
docker-compose up -d frontend
```

---

## 🔄 Fix #3: Browser Extension - Service Worker Sleep

### Problem
Chrome MV3 service workers **sleep after 30 seconds**:
- ❌ Page context stops updating after navigation
- ❌ Event listeners registered in methods get lost
- ❌ State is lost on wake-up
- ❌ Breadcrumb becomes stale
- ❌ **Dynamic `import()` forbidden** in service workers
- ❌ 401 errors when tracker starts before token ready
- ❌ Crashes on DevTools/chrome:// pages

### Solution - THE RCRT WAY

**Nuked**: `page-context-tracker.js` (454 lines of legacy code)

**Kept**: `page-context-tracker-simple.js` with MV3-compatible architecture:

1. **Direct Fetch API** (no imports):
```javascript
// ✅ No dynamic imports - pure fetch
async function rcrtApi(method, endpoint, body) {
  const token = await getStoredToken();
  return fetch(`http://127.0.0.1:8081${endpoint}`, {
    method,
    headers: { 'Authorization': `Bearer ${token}` },
    body: body ? JSON.stringify(body) : null
  });
}
```

2. **Token Wait Logic**:
```javascript
// ✅ Wait up to 5s for token on startup
if (!token) {
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newToken = await getStoredToken();
    if (newToken) break;
  }
}
```

3. **Protected Page Filtering**:
```javascript
// ✅ Skip chrome://, devtools://, edge://, about:
if (tab.url.startsWith('chrome://') || 
    tab.url.startsWith('devtools://')) {
  return;
}
```

4. **Persistent Event Listeners** (top level):
```javascript
// ✅ Survives service worker sleep
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await tracker.captureAndUpdate(activeInfo.tabId);
});
```

5. **Alarm-Based Periodic Capture**:
```javascript
// ✅ Wakes up service worker every 30s
chrome.alarms.create('rcrt-page-capture', {
  periodInMinutes: 0.5
});
```

6. **State Persistence**:
```javascript
// ✅ State survives service worker restart
await chrome.storage.local.set({ browserContextState: this.state });
```

### Added Permission
```json
{
  "permissions": ["webNavigation"]
}
```

### Result
✅ No dynamic import errors
✅ Waits for token on startup
✅ Skips protected pages (devtools, chrome://)
✅ Browser context updates continue after service worker sleep
✅ No duplicate breadcrumbs
✅ State persists across restarts
✅ Captures on tab switch, navigation, and periodic alarm

### Rebuild & Test
```bash
cd extension
npm run build
```

Then:
1. Go to `chrome://extensions/`
2. Find "RCRT Chat" → Click **Reload**
3. Navigate to any website (not chrome:// or devtools://)
4. Should see: `✅ Updated browser context (v2): YourPageTitle`
5. Wait 60s, navigate again → Should still update!
6. Open DevTools → Should see: `⏭️ Skipping protected page`

---

## 📊 Impact

### Before
- ❌ Workflows failed with dependency errors
- ❌ 11+ confusing connection types
- ❌ Browser context stopped after 30s
- ❌ Messy code with duplicates

### After  
- ✅ Workflows execute correctly with dependencies
- ✅ 4 clear connection types (green/purple/blue)
- ✅ Browser context updates continuously
- ✅ Clean code, single source of truth

---

## 🚀 Next Steps

1. **Test workflows** - Try "generate random and double it"
2. **Test connections** - View dashboard, verify 4 connection types
3. **Test extension** - Navigate between pages, wait >30s, verify updates continue
4. **Deploy** - Restart docker-compose services

```bash
# Restart everything
docker-compose restart tools-runner
docker-compose restart frontend
# Reload extension manually
```

---

## 📁 Files Changed

### Workflow Fix
- `rcrt-visual-builder/packages/tools/src/workflow-orchestrator.ts`

### Connection Rendering
- `rcrt-dashboard-v2/frontend/src/utils/connectionTypes.ts` (NEW)
- `rcrt-dashboard-v2/frontend/src/utils/connectionDiscovery.ts` (NEW)
- `rcrt-dashboard-v2/frontend/src/utils/dataTransforms.ts` (CLEANED)
- `rcrt-dashboard-v2/frontend/src/components/nodes/Connection2D.tsx` (REWRITTEN)
- `rcrt-dashboard-v2/frontend/src/components/nodes/Connection3D.tsx` (REWRITTEN)
- `rcrt-dashboard-v2/frontend/src/types/rcrt.ts` (UPDATED)
- `rcrt-dashboard-v2/frontend/CONNECTION_RENDERING_RCRT_WAY.md` (NEW DOC)

### Extension Fix
- `extension/src/background/page-context-tracker-simple.js` (CLEANED)
- `extension/src/background/page-context-tracker.js` (DELETED - 454 lines nuked!)
- `extension/manifest.json` (UPDATED - added webNavigation)
- `extension/SERVICE_WORKER_SLEEP_FIX.md` (NEW DOC)

---

## 🎓 Lessons Learned - THE RCRT WAY

1. **No Duplicates**: One implementation, one source of truth
2. **No Legacy Code**: When you find mess, nuke it and rebuild clean
3. **MV3 Requires Persistence**: Alarms + top-level listeners + storage
4. **Visual Clarity**: 4 connection types is enough (green/purple/blue)
5. **Field Name Flexibility**: Support common variations (`depends_on` vs `dependencies`)

---

*Everything is a breadcrumb. Keep it clean.*

