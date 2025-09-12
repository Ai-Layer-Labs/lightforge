# Quick Start: RCRT Dependencies for Extension

## 🚀 Extension Ready!

The extension is built and ready to load. It will work in **offline mode** initially, then connect to RCRT when services are available.

## 🔧 Loading Extension (Works Immediately)

1. **Chrome Extensions**: `chrome://extensions/`
2. **Developer Mode**: Enable toggle (top right)
3. **Load Unpacked**: Select `extension/dist/` folder
4. **Test**: Click extension icon → sidepanel opens

**Status**: Extension loads and works with local storage immediately!

## 📡 Starting RCRT Services (For Full Features)

### Step 1: RCRT Dashboard (Essential)
```bash
# Terminal 1 - Start dashboard proxy
cd crates/rcrt-dashboard
cargo run

# Should see:
# Dashboard listening on 0.0.0.0:8082
```

**Extension will connect to**: `http://localhost:8082` (Docker dashboard port)

### Step 2: RCRT Core Server (For persistence)
```bash
# Terminal 2 - Start core RCRT service  
cargo run -p rcrt-server

# Should see:
# RCRT server listening on 0.0.0.0:8080
```

### Step 3: Tools Runner (For chat responses)
```bash
# Terminal 3 - Start tools that handle chat
cd rcrt-visual-builder/apps/tools-runner
npm start

# Should see:
# 🚀 Tools runner is ready and listening for requests
```

## 🧪 Testing Flow

### Immediate Test (No dependencies)
1. Load extension → ✅ Works
2. Open sidepanel → ✅ UI appears  
3. Type message → ✅ UI responds (locally)

### RCRT Integration Test (After starting services)
1. **Reload extension** (click reload button)
2. **Check console**: Should see `✅ Got JWT token from RCRT dashboard`
3. **Send chat message**: Creates breadcrumb in RCRT
4. **View in dashboard**: `http://localhost:8082` → see breadcrumbs

## 🔍 Debugging

### Extension Console
```javascript
// Check RCRT status
chrome.runtime.getBackgroundPage(bg => {
  bg.console.log('Current state');
});
```

### Service Worker Console  
1. **Chrome Extensions** → Your extension
2. **Service Worker** → "Inspect views service worker"
3. **Console** → See connection messages

### Expected Messages
```
✅ Working: Extension UI loads and works locally
🔧 Connecting: Tries to reach dashboard 
❌ Offline: Falls back gracefully if dashboard unavailable
✅ Connected: JWT token acquired, ready for breadcrumb operations
```

## 🎯 What's Integrated

| Feature | Status | Description |
|---------|--------|-------------|
| **Chat UI** | ✅ Working | React interface with local storage |
| **RCRT Auth** | ✅ Ready | JWT via dashboard proxy |  
| **Breadcrumb Creation** | 🔧 Ready | Chat → breadcrumbs |
| **Agent Discovery** | 🔧 Ready | RCRT agents as crews |
| **Event Stream** | 🔧 Planned | SSE for real-time updates |
| **Browser Automation** | 🔧 Planned | DOM state → breadcrumbs |

**The extension is ready to test!** Start with just loading it, then add RCRT services for enhanced features.
