# RCRT Integration Guide

This document outlines the integration of the Chrome extension with the RCRT ecosystem.

## Architecture Overview

```
Chrome Extension
    ↓
Dashboard Proxy (localhost:3001)
    ↓ (JWT Auth)
RCRT Core API (localhost:8081)
    ↓ (SSE Events)
Tools Runner (handles chat responses)
```

## Integration Strategy

### Phase 1: Parallel Operation ✅
- [x] Create RCRT client adapter
- [x] Create bridge for gradual migration  
- [x] Maintain backward compatibility

### Phase 2: Feature Parity (In Progress)
- [ ] Replace chat sessions with RCRT breadcrumbs
- [ ] Integrate agent/crew discovery
- [ ] Add real-time event stream support
- [ ] Browser state → breadcrumb conversion

### Phase 3: Full Migration
- [ ] Remove legacy API dependencies  
- [ ] Pure RCRT workflow
- [ ] Advanced breadcrumb management UI

## Key Components

### 1. RCRT Client (`src/lib/rcrt-client.ts`)
- Connects to dashboard proxy (CORS-compliant)
- JWT authentication 
- Breadcrumb CRUD operations
- SSE event stream support

### 2. RCRT Adapter (`src/lib/rcrt-adapter.ts`)
- Gradual migration layer
- Feature flag controlled (`useRCRT`)
- Maps legacy APIs to RCRT equivalents
- Fallback to original APIs

### 3. Background Bridge (`src/background/rcrt-bridge.js`)
- Handles browser automation requests from RCRT
- Converts browser state to breadcrumbs
- Event-driven architecture

## Data Flow Mapping

### Chat Messages → Breadcrumbs
```javascript
// Legacy
{ role: 'user', content: 'Hello' }

// RCRT Equivalent
{
  title: 'Chat: user message',
  context: {
    role: 'user',
    content: 'Hello',
    sessionId: 'session-123',
    source: 'chrome_extension'
  },
  tags: ['chat:message', 'chat:user', 'chrome:extension'],
  schema_name: 'chat.message.v1'
}
```

### Chat Sessions → Session Breadcrumbs
```javascript
// Legacy
{ session_id: '123', title: 'Chat', messages: [...] }

// RCRT Equivalent  
{
  title: 'Chat Session: Chat',
  context: {
    type: 'chat_session',
    title: 'Chat', 
    messages: [...],
    metadata: {}
  },
  tags: ['chat:session', 'chrome:extension'],
  schema_name: 'chat.session.v1'
}
```

### Browser State → State Breadcrumbs
```javascript
{
  title: 'Browser: Page Title',
  context: {
    url: 'https://example.com',
    title: 'Page Title',
    viewport: { width: 1920, height: 1080 },
    snapshot: { /* DOM tree */ },
    source: 'chrome_extension'
  },
  tags: ['browser:state', 'chrome:extension', 'url:example.com'],
  schema_name: 'browser.state.v1'
}
```

## Integration Benefits

### 1. **Unified Context**
- All extension activities become searchable breadcrumbs
- Chat history integrates with broader workspace context
- Browser automation events are auditable

### 2. **Real-time Collaboration**  
- Multiple agents can see extension activity
- SSE events enable reactive workflows
- Tool responses flow back to extension UI

### 3. **Advanced Capabilities**
- Vector search across chat history
- ACL-controlled sharing of browser states
- Webhook notifications for extension events

## Configuration

### Environment Variables
```bash
# Dashboard Proxy (required for CORS compliance)
DASHBOARD_URL=http://localhost:3001

# RCRT Core (internal)
RCRT_BASE_URL=http://localhost:8081  

# Feature Flags
ENABLE_RCRT_INTEGRATION=true
FALLBACK_TO_LEGACY_API=true
```

### Chrome Extension Settings
```javascript
// In extension storage
{
  rcrt_enabled: true,
  dashboard_proxy_url: 'http://localhost:3001',
  workspace_tag: 'workspace:chrome-extension',
  auto_create_breadcrumbs: true
}
```

## Usage Examples

### Enable RCRT Integration
```javascript
import { ExtensionAPI } from './lib/api';

// Check if RCRT is available
const usingRCRT = await ExtensionAPI.isUsingRCRT();
console.log('RCRT Status:', usingRCRT);

// Enable RCRT (falls back automatically if unavailable)
const success = await ExtensionAPI.enableRCRT();
```

### Create Chat Session
```javascript
// Works with both legacy and RCRT backends
const session = await ExtensionAPI.createSession('My Chat Session');
console.log('Session ID:', session.id);
```

### Send Chat Message
```javascript
const response = await ExtensionAPI.chat({
  session_id: sessionId,
  messages: [{ role: 'user', content: 'Hello!' }],
  options: { crew_id: 'orchestrator' }
});
```

### Browser State Integration
```javascript
// Automatically create breadcrumb for current page
const pageData = {
  url: window.location.href,
  title: document.title,
  viewport: { width: window.innerWidth, height: window.innerHeight }
};

await ExtensionAPI.createBrowserStateBreadcrumb(pageData);
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure using dashboard proxy, not direct RCRT connection
2. **Auth Failures**: Check dashboard is running on localhost:3001
3. **SSE Disconnects**: Background service handles auto-reconnection
4. **Legacy Fallback**: Set `FALLBACK_TO_LEGACY_API=true` for migration period

### Debug Mode
```javascript
// Enable detailed logging
localStorage.setItem('rcrt_debug', 'true');

// Check adapter status
const { rcrtAdapter } = await import('./lib/rcrt-adapter');
console.log('RCRT Status:', rcrtAdapter.isUsingRCRT());
```

## Next Steps

1. **Start Dashboard Proxy**: Ensure `rcrt-dashboard` is running on port 3001
2. **Test Integration**: Use feature flags to test RCRT functionality
3. **Gradual Migration**: Replace UI components one by one
4. **Monitor Events**: Watch dashboard for extension-generated breadcrumbs
5. **Full Migration**: Remove legacy API dependencies when stable
