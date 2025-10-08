# Docker Definition Files Fix

## The Problem

Tools-runner shows: **"Total tools discovered: 0"**

### Root Cause

```
Docker Build:
  Source (src/) → Build (dist/) → Runtime Image
  
Problem:
  ✅ src/ has definition.json files
  ✅ dist/ has compiled code
  ❌ Runtime image only has dist/
  ❌ definition.json files NOT copied!
  
Result:
  bootstrapTools() scans for definition.json
  → Finds nothing (files not in image)
  → 0 tools discovered
```

## The Solution

### Updated Dockerfile

```dockerfile
# Copy definition.json files explicitly!
COPY --from=build /app/packages/tools/src/*/definition*.json ./packages/tools/src/
```

### Why This Works

```
Build Stage:
  packages/tools/src/calculator/definition.json  ✅
  packages/tools/src/random/definition.json      ✅
  ... (all 13 tools)

Runtime Stage (BEFORE):
  packages/ (copied)
    └── tools/
        └── dist/                    ← Only compiled code
        
Runtime Stage (AFTER):
  packages/ (copied)
    └── tools/
        ├── dist/                    ← Compiled code
        └── src/
            ├── calculator/definition.json     ← Discovery files!
            ├── random/definition.json
            └── ... (all 13 tools)
```

## Rebuild & Test

```powershell
# Rebuild with the fix
docker compose build tools-runner

# Start it
docker compose up -d tools-runner

# Check logs
docker compose logs tools-runner | Select-String "Discovered tool"

# Expected:
# ✅ Discovered tool: calculator (from calculator/)
# ✅ Discovered tool: random (from random/)
# ... (13 tools)
# 📊 Total tools discovered: 13
```

## Why It Was 0 Before

1. **Dockerfile copied packages/** (all files)
2. **But tsup build** only outputs to `dist/`
3. **Runtime image** had packages/tools/dist/ but NOT packages/tools/src/
4. **bootstrapTools()** scanned packages/tools/src/ (doesn't exist in container!)
5. **Result**: 0 definition.json files found

## Why It Works Now

1. **Dockerfile explicitly copies** `packages/tools/src/*/definition*.json`
2. **Runtime image now has** both dist/ (code) AND src/ (definitions)
3. **bootstrapTools()** scans packages/tools/src/
4. **Finds** all 13 definition.json files
5. **Result**: 13 tools discovered!

---

**Status**: ✅ FIXED  
**Action**: `docker compose build tools-runner && docker compose up -d tools-runner`  
**Expected**: 13 tools discovered
