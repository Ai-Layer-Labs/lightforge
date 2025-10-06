# Browser Context Extension - Build & Install

## ✅ Build Complete!

The extension has been successfully built with the browser context tracking feature.

## 📦 Installation

### 1. Load Extension in Chrome

1. Open Chrome and go to: `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right)
3. Click **"Load unpacked"**
4. Navigate to: `D:\breadcrums\extension\dist`
5. Select the `dist` folder

### 2. Verify Installation

You should see:
- ✅ **RCRT Chat** extension appears in extensions list
- ✅ Extension icon in Chrome toolbar
- ✅ No errors in the console

### 3. Check Background Service

1. In `chrome://extensions/`, find RCRT Chat
2. Click "service worker" (under "Inspect views")
3. Console should show:
   ```
   🚀 PageContextTracker: Initializing...
   ✅ Page context tracker initialized
   ```

## 🧪 Testing

### Quick Test

1. Navigate to any webpage (e.g., `https://github.com`)
2. Check background service console for:
   ```
   📍 Tab activated: ...
   📸 Capturing page context for tab ...
   ✅ Browser context updated successfully
   ```

### With RCRT Dashboard

1. Start RCRT: `docker compose up -d`
2. Open Dashboard: `http://localhost:8082`
3. Navigate to: **Breadcrumbs** → Filter by schema: `browser.page.context.v1`
4. You should see the living breadcrumb updating as you browse

### With Agents

1. Upload example agent:
   ```bash
   curl -X POST http://localhost:8081/breadcrumbs \
     -H "Content-Type: application/json" \
     --data @../../examples/agents/page-assistant-agent.json
   ```

2. Start agent runner:
   ```bash
   cd ../../rcrt-visual-builder/apps/agent-runner
   npm run dev
   ```

3. Open extension side panel (click extension icon)
4. Navigate to a webpage
5. Ask: **"What's on this page?"**

The agent should respond with details about the current page!

## 🔧 Development

### Rebuild After Changes

```bash
cd extension
npm run build
```

Then reload the extension in `chrome://extensions/`:
1. Click the refresh icon ⟳ on the RCRT Chat extension

### Watch Mode

For active development:
```bash
npm run dev
```

This will watch for changes and rebuild automatically (you'll still need to reload the extension manually).

## 📋 Files Generated

The build creates these files in `dist/`:

```
dist/
├── manifest.json              # Extension manifest
├── background.js              # Background service + page tracker
├── page-context-tracker-*.js  # Page context tracker module
├── rcrt-client-*.js          # RCRT client module
├── buildDomTree.js           # DOM extraction utility
├── icons/                    # Extension icons
└── sidepanel/                # Chat interface
    ├── index.html
    └── index.js
```

## 🐛 Troubleshooting

### Extension not loading

- Ensure you selected the `dist` folder, not the `extension` folder
- Check for errors in `chrome://extensions/`
- Try removing and re-adding the extension

### Page context not updating

1. Check background service console for errors
2. Ensure page is not `chrome://` or `chrome-extension://` (these are skipped)
3. Verify RCRT server is running: `docker compose ps`
4. Check network tab for failed API calls

### Build errors

- Run `npm install` to ensure dependencies are installed
- Clear build cache: `rm -rf dist node_modules && npm install && npm run build`
- Check Node.js version: `node --version` (should be 16+)

## 📚 Next Steps

1. **Try the examples**: Test with sample agents
2. **View breadcrumb**: Check Dashboard for page context updates
3. **Create custom agents**: Build agents that react to specific pages
4. **Read docs**: See `../docs/BROWSER_CONTEXT_BREADCRUMB.md` for details

## 🎯 What's Working

✅ **Browser context capture** - Page data extracted on navigation  
✅ **Living breadcrumb** - Single breadcrumb updated with each page change  
✅ **Debounced updates** - Max 1 update per 500ms  
✅ **LLM hints** - Data transformed for optimal agent consumption  
✅ **Agent subscriptions** - Agents receive real-time page updates  

## 🔜 Coming Next

- **Browser actions** (`browser.action.v1`) - Click, type, navigate
- **Workflows** - Multi-step automation
- **Visual feedback** - Show agents "looking" at page elements

---

**Status**: 🟢 Ready to use!

For detailed documentation, see:
- [Technical Spec](../docs/BROWSER_CONTEXT_BREADCRUMB.md)
- [Quick Start](../examples/BROWSER_CONTEXT_QUICKSTART.md)
- [Architecture](../docs/BROWSER_CONTEXT_ARCHITECTURE.md)
