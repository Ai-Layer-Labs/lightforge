# Quick Fix for Deployments

## Problem Solved: Bootstrap Consolidation ✅

Users were getting wrong agent definitions because of duplicates and hardcoded fallbacks scattered throughout the codebase.

## What Changed

### Single Source of Truth
All bootstrap data now lives in **`bootstrap-breadcrumbs/`** directory.

```bash
bootstrap-breadcrumbs/
├── system/
│   ├── default-chat-agent.json  ← THE ONLY agent definition
│   └── bootstrap-marker.json
├── tools/
│   ├── openrouter.json
│   ├── calculator.json
│   ├── random.json
│   └── context-builder.json
└── bootstrap.js                 ← THE ONLY bootstrap script
```

### What Was Deleted

✅ Removed 6 duplicate files:
- `scripts/default-chat-agent.json`
- `scripts/default-chat-agent-v2.json`
- `bootstrap-breadcrumbs/system/default-chat-agent-v3.json`
- `rcrt-visual-builder/apps/agent-runner/ensure-default-agent.js` (60+ line hardcoded fallback)
- `rcrt-visual-builder/apps/agent-runner/ensure-default-agent-simple.js`
- `scripts/load-default-agent.js`

### What Was Fixed

✅ No more hardcoded fallbacks  
✅ No more duplicate agent definitions  
✅ Tools now in JSON files (not just code)  
✅ Bootstrap script loads everything from files  
✅ Clear error messages if files missing  

## For Existing Deployments

### Quick Update

```bash
# 1. Pull latest code
git pull

# 2. Clean restart
docker compose down -v
rm .env docker-compose.override.yml

# 3. Setup (will use new bootstrap system)
./setup.sh

# Done!
```

### Verify It Worked

```bash
# Check only ONE agent file exists
./validate-bootstrap.sh

# Should output:
# ✅ ✅ ✅  BOOTSTRAP VALIDATION PASSED  ✅ ✅ ✅
```

## For Forked Repositories (e.g., "lightforge")

Now you can easily customize:

### 1. Use Custom Prefix
```bash
PROJECT_PREFIX="lightforge-" ./setup.sh
```

### 2. Customize Agent
```bash
# Edit the agent definition
vim bootstrap-breadcrumbs/system/default-chat-agent.json

# Change system_prompt, model, etc.
```

### 3. Add Custom Tools
```bash
# Create new tool definition
cat > bootstrap-breadcrumbs/tools/custom-tool.json << 'EOF'
{
  "schema_name": "tool.v1",
  "title": "Custom Tool",
  "tags": ["tool", "tool:custom-tool", "workspace:tools"],
  "context": {
    "name": "custom-tool",
    "description": "Your custom tool",
    "implementation": {
      "type": "builtin",
      "module": "@rcrt-builder/tools",
      "export": "builtinTools.customTool"
    },
    "definition": {
      "inputSchema": {...},
      "outputSchema": {...}
    }
  }
}
EOF
```

### 4. Re-bootstrap
```bash
cd bootstrap-breadcrumbs && node bootstrap.js
```

## Key Benefits

✅ **Clean codebase** - No scattered duplicates  
✅ **Easy customization** - Edit JSON files  
✅ **Version control** - Git tracks changes  
✅ **Portable** - Works anywhere with any prefix  
✅ **Fail-fast** - Clear errors if something's wrong  
✅ **No surprises** - What you see is what you get  

## Files to Reference

- `BOOTSTRAP_SINGLE_SOURCE_OF_TRUTH.md` - Full explanation
- `CONSOLIDATION_COMPLETE.md` - All changes made
- `PORTABLE_SETUP_README.md` - How to use prefixes
- `bootstrap-breadcrumbs/README.md` - Bootstrap directory docs
- `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md` - Full system docs

## Quick Commands

```bash
# Validate bootstrap structure
./validate-bootstrap.sh

# Re-bootstrap (safe to run multiple times)
cd bootstrap-breadcrumbs && node bootstrap.js

# Clean restart with custom prefix
docker compose down -v
PROJECT_PREFIX="myprefix-" ./setup.sh

# Check what's running
docker compose ps
curl http://localhost:8081/health
```

---

**Status**: ✅ **RESOLVED**  
**Impact**: All deployments will now get consistent bootstrap  
**Breaking**: No - backward compatible (falls back to ensure-default-agent.js if bootstrap fails)  
**Action Required**: Pull latest code and re-run setup.sh  

---

**Summary**: Users will now always get the correct agent definition from the single source of truth in `bootstrap-breadcrumbs/system/default-chat-agent.json`. No more confusion, no more duplicates, no more hardcoded fallbacks.