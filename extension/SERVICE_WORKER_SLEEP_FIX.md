# Service Worker Sleep Fix - THE RCRT WAY

## 🐛 The Problem

Chrome MV3 service workers **sleep after ~30 seconds of inactivity**. When they sleep:
- ❌ Event listeners registered in methods get lost
- ❌ Timers/intervals stop running
- ❌ Class instance state is lost
- ❌ Page context tracking stops working
- ❌ **Dynamic `import()` is forbidden** in service workers

**Result**: Browser context breadcrumb stops updating after navigation.

**Error**: `TypeError: import() is disallowed on ServiceWorkerGlobalScope`

## ✅ The Solution - THE RCRT WAY

### 1. **Persistent Event Listeners at Top Level**

**WRONG** (old way - gets lost on sleep):
```javascript
class Tracker {
  setupListeners() {
    chrome.tabs.onUpdated.addListener(...);  // ❌ Lost on sleep
  }
}
```

**RIGHT** (THE RCRT WAY - survives sleep):
```javascript
// At module top level - persists across sleep cycles
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  await simplePageContextTracker.captureAndUpdate(tabId);
});
```

### 2. **Persistent Alarms Replace Intervals**

**WRONG** (old way):
```javascript
setInterval(() => capture(), 30000);  // ❌ Stops when service worker sleeps
```

**RIGHT** (THE RCRT WAY):
```javascript
chrome.alarms.create('rcrt-page-capture', {
  periodInMinutes: 0.5  // ✅ Wakes up service worker every 30s
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'rcrt-page-capture') {
    await tracker.captureActiveTab();
  }
});
```

### 3. **State Persistence via chrome.storage**

**WRONG** (old way):
```javascript
this.state = { breadcrumbId: '...' };  // ❌ Lost on sleep
```

**RIGHT** (THE RCRT WAY):
```javascript
async persistState() {
  await chrome.storage.local.set({ 
    browserContextState: this.state 
  });
}

async initialize() {
  const stored = await chrome.storage.local.get(['browserContextState']);
  this.state = stored.browserContextState || defaultState;
}
```

### 4. **Direct Fetch API (No Client Library Imports)**

**WRONG** (old way - causes import error):
```javascript
import { rcrtClient } from '../lib/rcrt-client.js';  // ❌ Dynamic import fails
```

**RIGHT** (THE RCRT WAY - direct API):
```javascript
async function rcrtApi(method, endpoint, body = null) {
  const token = await getStoredToken();
  const response = await fetch(`http://127.0.0.1:8081${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: body ? JSON.stringify(body) : null
  });
  return await response.json();
}
```

### 5. **Re-initialization on Wake-Up**

```javascript
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!tracker.state.initialized) {
    console.log('🔄 Service worker woke up, re-initializing...');
    await tracker.initialize();
  }
});
```

## 🎯 What We Nuked

Deleted `page-context-tracker.js` (454 lines of legacy code).

Kept only `page-context-tracker-simple.js` with:
- ✅ Persistent listeners at top level
- ✅ Alarm-based periodic capture
- ✅ State persistence
- ✅ Auto-recovery after sleep

## 📋 Required Permissions

Added to `manifest.json`:
```json
{
  "permissions": [
    "webNavigation",  // ← For onCommitted listener
    "alarms"         // ← For periodic capture
  ]
}
```

## 🧪 Testing

1. Install the extension
2. Navigate to a website
3. Check console: Should see "✅ Updated browser context"
4. Wait 60 seconds (service worker sleeps)
5. Navigate to another page
6. Check console: Should see "🔄 Service worker woke up" then update
7. Verify breadcrumb still updates in dashboard

## 🚀 How It Works

```
User navigates → Event fires → Wakes service worker → 
  Restores state from storage → Captures page → 
    Updates breadcrumb → Persists state → 
      Service worker sleeps...
        
⏰ Alarm fires (30s) → Wakes service worker → 
  Checks if initialized → Captures current page →
    Updates breadcrumb → Service worker sleeps...
```

## Benefits

- ✅ Works across service worker sleep/wake cycles
- ✅ No state loss
- ✅ No duplicate breadcrumbs
- ✅ Keeps context fresh every 30s
- ✅ Clean, single implementation
- ✅ THE RCRT WAY

## Related Issues Fixed

- Browser context stops updating after ~30 seconds
- Page navigation not detected after idle period
- Duplicate breadcrumbs on service worker restart
- Lost state after Chrome extension background page sleep

