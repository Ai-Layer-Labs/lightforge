# Extension Service Worker - FULLY FIXED

## 🐛 Problems Solved

### 1. Dynamic Import Error
**Error**: `TypeError: import() is disallowed on ServiceWorkerGlobalScope`

**Cause**: Service workers can't use dynamic `import()` statements

**Solution**: Use direct `fetch()` API instead of importing client library
```javascript
// OLD (broken):
import { rcrtClient } from '../lib/rcrt-client.js';

// NEW (works):
async function rcrtApi(method, endpoint, body) {
  const token = await getStoredToken();
  return await fetch(`http://127.0.0.1:8081${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : null
  });
}
```

### 2. 401 Authorization Error on Startup
**Error**: `RCRT API error 401: missing Authorization`

**Cause**: Tracker initializes before background script gets JWT token

**Solution**: Wait for token with retry logic
```javascript
async ensureBreadcrumb() {
  const token = await getStoredToken();
  if (!token) {
    console.log('⏳ Waiting for token...');
    // Retry up to 5 seconds
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const newToken = await getStoredToken();
      if (newToken) break;
    }
  }
  // Now proceed...
}
```

### 3. DevTools Page Error
**Error**: `Cannot access contents of url "devtools://..."`

**Cause**: Extension tried to inject into Chrome DevTools pages

**Solution**: Skip protected pages
```javascript
// Skip these URL schemes:
- chrome://
- chrome-extension://
- devtools://
- edge://
- about:
```

### 4. Service Worker Sleep (Main Issue)
**Cause**: Event listeners registered in methods get lost when service worker sleeps

**Solution**: Move all listeners to **top level** (outside class)
```javascript
// ✅ Top level - survives sleep
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await tracker.captureAndUpdate(activeInfo.tabId);
});
```

---

## ✅ What Works Now

1. **Persistent tracking** - Survives service worker sleep/wake cycles
2. **Token retry** - Waits for authentication before creating breadcrumbs
3. **Protected page skip** - Gracefully ignores devtools, chrome://, etc.
4. **State persistence** - Breadcrumb ID/version saved to storage
5. **Periodic capture** - Alarm fires every 30s to keep context fresh
6. **Navigation tracking** - All 3 navigation events handled:
   - Tab activation (`onActivated`)
   - Page load (`onUpdated` with status=complete)
   - URL change (`webNavigation.onCommitted`)

---

## 🧪 Testing

1. **Install extension** → Should see `✅ PageContextTracker: Ready`
2. **Navigate to website** → Should see `✅ Updated browser context`
3. **Open DevTools** → Should see `⏭️ Skipping protected page`
4. **Wait 60 seconds** (service worker sleeps)
5. **Navigate again** → Should see `🔄 Service worker woke up` then update
6. **Check dashboard** → Browser context breadcrumb should be current

---

## 🎯 Architecture

```
Service Worker Lifecycle:
┌─────────────────────────────────────┐
│ Service Worker Active               │
│ • Listeners attached (top level)    │
│ • State in memory                   │
│ • Alarm registered                  │
└──────────┬──────────────────────────┘
           │
     (30s idle)
           │
           ▼
┌─────────────────────────────────────┐
│ Service Worker Sleeping             │
│ • Memory cleared                    │
│ • Listeners still active ✅         │
│ • Alarm still ticking ✅            │
└──────────┬──────────────────────────┘
           │
    (Event fires)
           │
           ▼
┌─────────────────────────────────────┐
│ Service Worker Wakes Up             │
│ • Restore state from storage        │
│ • Re-initialize if needed           │
│ • Handle event                      │
│ • Update breadcrumb                 │
└─────────────────────────────────────┘
```

---

## 📦 Files Changed

- ✅ `page-context-tracker-simple.js` - Clean MV3 implementation
- ❌ `page-context-tracker.js` - **DELETED** (454 lines nuked!)
- ✅ `manifest.json` - Added `webNavigation` permission
- ✅ `background.js` - Calls simple tracker only

---

## 🚀 Deployment

```bash
cd extension
npm run build
```

Then manually:
1. Go to `chrome://extensions/`
2. Find "RCRT Chat"
3. Click **Reload** button
4. Navigate to any website
5. Verify browser context updates in dashboard

---

*THE RCRT WAY: No dynamic imports, persistent listeners, state in storage.*

