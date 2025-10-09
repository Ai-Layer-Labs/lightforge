# RCRT System Rebuild Guide

## 🎯 Quick Reference

### After Fixing Tools
```bash
pnpm --filter @rcrt-builder/tools run build
pnpm --filter tools-runner run build
docker-compose restart tools-runner
```

### After Fixing Dashboard Frontend
```bash
cd rcrt-dashboard-v2/frontend
npm run build
docker-compose restart frontend
```

### After Fixing Extension
```bash
cd extension
npm run build
# Then manually: chrome://extensions/ → Reload
```

### After Fixing Agent Runner
```bash
pnpm --filter agent-runner run build
docker-compose restart agent-runner
```

### After Fixing RCRT Server (Rust)
```bash
docker-compose build rcrt
docker-compose up -d rcrt
```

---

## 📦 Component Dependencies

### Tools Package Changes Affect:
- `tools-runner` (must rebuild app)
- `agent-runner` (if using tool helpers)

### SDK Package Changes Affect:
- `agent-runner` (uses SDK)
- `tools-runner` (uses SDK)

### Runtime Package Changes Affect:
- `agent-runner` (uses AgentExecutor)

### Core Package Changes Affect:
- Everything (types and schemas)

---

## 🔄 Full System Rebuild

```bash
# 1. Build all packages
cd rcrt-visual-builder
pnpm run build:packages

# 2. Build all apps
pnpm run build:apps

# 3. Build frontend
cd ../rcrt-dashboard-v2/frontend
npm run build

# 4. Build extension
cd ../../extension
npm run build

# 5. Rebuild and restart Docker services
cd ..
docker-compose build
docker-compose up -d
```

---

## 🧹 Clean Rebuild (Nuclear Option)

```bash
# Clean everything
cd rcrt-visual-builder
pnpm run clean

# Reinstall
pnpm install

# Rebuild from scratch
pnpm run build

# Rebuild Docker images
cd ..
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## 🐛 Troubleshooting

### "Module not found" errors
```bash
# Reinstall dependencies
pnpm install
```

### Extension not updating
```bash
# Rebuild and hard reload
cd extension
npm run build
# chrome://extensions/ → Remove → Reload unpacked
```

### Tools not working after changes
```bash
# Rebuild tools chain
pnpm --filter @rcrt-builder/tools run build
pnpm --filter @rcrt-builder/runtime run build
pnpm --filter tools-runner run build
docker-compose restart tools-runner
```

### Frontend shows old data
```bash
# Hard refresh in browser
Ctrl+Shift+R (or Cmd+Shift+R on Mac)

# Or rebuild
cd rcrt-dashboard-v2/frontend
npm run build
docker-compose restart frontend
```

---

## 📝 What Gets Built Where

### Source → Distribution Mapping

```
rcrt-visual-builder/packages/tools/src/
  → packages/tools/dist/
    → apps/tools-runner/node_modules/@rcrt-builder/tools/
      → apps/tools-runner/dist/
        → Docker image: rcrt-tools-runner

rcrt-dashboard-v2/frontend/src/
  → rcrt-dashboard-v2/frontend/dist/
    → Docker image: rcrt-frontend (nginx serves static files)

extension/src/
  → extension/dist/
    → Load unpacked in Chrome
```

### Build Chain

```
1. packages/core → base types
2. packages/sdk → RCRT client
3. packages/runtime → AgentExecutor, EventBridge
4. packages/tools → tool implementations
5. apps/tools-runner → bundles tools + runtime
6. apps/agent-runner → bundles agents + runtime
```

---

## ⚡ Fast Rebuild (Development)

### Working on a single tool?
```bash
pnpm --filter @rcrt-builder/tools run build
docker-compose restart tools-runner
```

### Working on agent logic?
```bash
pnpm --filter @rcrt-builder/runtime run build
pnpm --filter agent-runner run build
docker-compose restart agent-runner
```

### Working on frontend UI?
```bash
cd rcrt-dashboard-v2/frontend
npm run dev  # Hot reload!
```

### Working on extension UI?
```bash
cd extension
npm run dev  # Watch mode
# Still need manual reload in chrome://extensions/
```

---

## 🎯 THE RCRT WAY

1. **Build packages before apps** (pnpm workspace dependency order)
2. **Restart Docker services** after rebuilds
3. **Hard reload extension** in Chrome (no auto-reload)
4. **Check console logs** for errors after restart
5. **Verify breadcrumbs** in dashboard after changes

---

## 🚀 Production Deployment

```bash
# Full production build
./scripts/build-all.sh

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

---

*Everything is a breadcrumb. Build it clean.*

