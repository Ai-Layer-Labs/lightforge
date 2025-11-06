# RCRT Browser Extension v2 - Installation Guide

## Prerequisites

1. **RCRT Server Running**
   ```bash
   cd /path/to/ThinkOS-1
   ./setup.sh
   # Verify: http://localhost:8081/health should return 200
   ```

2. **Agent Runner Running**
   ```bash
   docker compose logs agent-runner
   # Should show: "Agent registry initialized"
   ```

3. **Bootstrap Complete**
   ```bash
   docker compose logs bootstrap-runner
   # Should show 4 new agents loaded
   ```

## Installation Steps

### 1. Install Dependencies

```bash
cd rcrt-extension-v2
npm install
```

### 2. Build Extension

```bash
npm run build
```

This will create the `dist/` folder with the compiled extension.

### 3. Load in Chrome/Edge

1. Open Chrome and navigate to: `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the `rcrt-extension-v2/dist/` folder
5. The extension icon should appear in your toolbar

### 4. Pin Extension (Optional)

1. Click the extensions puzzle icon in Chrome toolbar
2. Find "RCRT Browser Extension v2"
3. Click the pin icon to keep it visible

### 5. Verify Installation

1. Click the RCRT extension icon
2. Side panel should open with connection status
3. Green dot = connected to RCRT server
4. Go to Settings tab and click "Test Connection"
5. Should show: "Successfully connected and authenticated"

## Troubleshooting

### Extension Won't Load

**Problem:** Extension fails to load in Chrome

**Solutions:**
- Check that `dist/` folder exists and contains `manifest.json`
- Run `npm run build` again
- Check console for build errors

### Cannot Connect to RCRT

**Problem:** Red connection indicator, "Cannot connect to RCRT server"

**Solutions:**
- Verify RCRT server is running: `curl http://localhost:8081/health`
- Check Settings tab for correct server URL
- Ensure no firewall blocking localhost:8081
- Check docker compose logs: `docker compose logs rcrt`

### Agents Not Processing Notes

**Problem:** Notes save but no tags/summary/insights appear

**Solutions:**
- Verify agents are loaded: `curl http://localhost:8081/breadcrumbs?schema_name=agent.def.v1`
- Should return 4 agents: note-tagger, note-summarizer, note-insights, note-eli5
- Check agent-runner logs: `docker compose logs agent-runner`
- Verify OpenRouter API key is configured

### Multi-Tab Tracking Not Working

**Problem:** Tabs not appearing in context

**Solutions:**
- Enable in Settings: "Multi-Tab Context Tracking"
- Check background service worker console:
  - Open `chrome://extensions/`
  - Find extension
  - Click "Service Worker (Inspect views)"
  - Look for "Tab context manager initialized"

## Verification Checklist

- [ ] Extension loads without errors
- [ ] Green connection indicator
- [ ] Settings tab shows "Connected"
- [ ] Can save current page
- [ ] Processing indicators show (tags, summary, insights, ELI5)
- [ ] All 4 agents complete within 5 seconds
- [ ] Notes appear in Notes tab
- [ ] Semantic search works
- [ ] Chat sends messages and receives responses
- [ ] Multi-tab tracking shows all tabs
- [ ] Dashboard integration opens correct URL

## Development Mode

For development with hot reload:

```bash
npm run dev
```

This runs Vite in watch mode. You'll need to reload the extension in Chrome after changes.

## Next Steps

Once installed:
1. Save a few pages to test note processing
2. Try semantic search: "articles about databases"
3. Chat with the agent
4. View notes in Dashboard (View in Dashboard button)
5. Check multi-tab context in Chat (All Tabs button)

