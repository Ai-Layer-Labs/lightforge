# RCRT Browser Extension v2 - Quick Start

## 30-Second Setup

```bash
# 1. Install dependencies
cd rcrt-extension-v2
npm install

# 2. Build extension
npm run build

# 3. Load in Chrome
# - Go to chrome://extensions/
# - Enable "Developer mode"
# - Click "Load unpacked"
# - Select dist/ folder
```

## First Use

1. **Click extension icon** - Side panel opens
2. **Go to Settings tab** - Should show green "Connected" (if RCRT running)
3. **Go to Save tab** - Click "Save Page to RCRT"
4. **Watch magic happen** - 4 agents process in real-time
5. **Go to Notes tab** - Your note is there with tags, summary, insights!

## That's It!

Your extension is now:
- ✅ Saving unlimited notes (PostgreSQL)
- ✅ Processing with 4 AI agents (parallel)
- ✅ Searching semantically (pgvector)
- ✅ Tracking all browser tabs
- ✅ Syncing settings as breadcrumbs
- ✅ Collaborating in real-time (if multi-user)

---

## Key Features to Try

### 1. Save a Page (30 seconds)

1. Navigate to any article
2. Click extension icon → Save tab
3. Click "Save Page to RCRT"
4. Watch 4 processing indicators
5. All complete in 3-4 seconds!

### 2. Semantic Search (10 seconds)

1. Save 2-3 pages about different topics
2. Go to Notes tab
3. Search: "articles about databases"
4. Gets relevant results (not keyword matching!)

### 3. Chat with Context (1 minute)

1. Go to Chat tab
2. Type: "What notes do I have?"
3. Agent responds with your saved notes
4. Click "All Tabs" to show browser context

### 4. Settings as Breadcrumbs (30 seconds)

1. Go to Settings
2. Change workspace to "workspace:testing"
3. Click "Save Settings"
4. Reload extension
5. Settings persist (stored as breadcrumb!)

---

## Verification

Run these commands to verify everything works:

```bash
# Check RCRT server
curl http://localhost:8081/health

# Check agents loaded (should return 4+)
curl http://localhost:8081/breadcrumbs?schema_name=agent.def.v1 | jq '. | length'

# Check settings breadcrumb exists
curl "http://localhost:8081/breadcrumbs?schema_name=extension.settings.v1"

# Save a page, then check it was created
curl "http://localhost:8081/breadcrumbs?schema_name=note.v1"
```

---

## Troubleshooting

**Can't connect to RCRT?**
```bash
# Start RCRT
cd /path/to/ThinkOS-1
./setup.sh
```

**Agents not processing?**
```bash
# Check agent-runner logs
docker compose logs agent-runner

# Verify OpenRouter key configured
docker compose logs tools-runner | grep OPENROUTER
```

**Extension won't load?**
```bash
# Rebuild
npm run build

# Check for errors
npm run type-check
```

---

## What's Next?

- Save more pages and build your knowledge base
- Try semantic search to find related notes
- Chat with agents that have full context
- Open notes in Dashboard for 3D visualization
- Collaborate with team (if multi-user workspace)

**Enjoy RCRT Extension v2!** 🚀

