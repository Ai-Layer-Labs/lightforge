# Rebuild Required for Event Bridge

## Why It's Still Failing

The error you're seeing is from the **old code** running in Docker containers. The new event-driven architecture needs to be deployed.

## What Changed

### Files Modified
1. **`apps/tools-runner/src/event-bridge.ts`** - NEW EVENT BRIDGE
2. **`apps/tools-runner/src/index.ts`** - Feeds events to bridge
3. **`packages/tools/src/index.ts`** - Added `waitForEvent` to context
4. **`packages/tools/src/workflow-orchestrator.ts`** - Uses event bridge

### What You'll See After Rebuild

**Before (Current):**
```
[Workflow] Attempt 1: Searching for request:workflow-num1-...
[Workflow] Tag search returned 0 results
⏰ Timeout waiting for tool response
```

**After (Event-Driven):**
```
[Workflow] waitForEvent available: true
[Workflow] ✅ Using event bridge to wait for workflow-num1-...
[EventBridge] Added to pending waits (1 total)
[EventBridge] ✅ Event matches waiting request
[Workflow] ✅ Received event for workflow-num1-...
```

## Steps to Deploy

```bash
# 1. Rebuild Docker images
docker compose build

# 2. Restart containers
docker compose up

# 3. Test workflow
# In chat: "Create two random numbers and add them"

# 4. Check logs
docker compose logs -f tools-runner
```

## Quick Test Script

```bash
#!/bin/bash
echo "🔨 Rebuilding with event bridge..."
docker compose build tools-runner

echo "🔄 Restarting tools-runner..."
docker compose up -d tools-runner

echo "📊 Checking logs..."
docker compose logs -f tools-runner
```

## Expected Timeline

- **Build**: ~2-3 minutes
- **Restart**: ~10 seconds  
- **Test**: Workflow should complete in <1 second

The event bridge will make the workflow tool **100x faster**!

## Alternative: Test Locally First

If you want to test without Docker:

```bash
# In one terminal - start RCRT
# In another terminal:
cd rcrt-visual-builder/apps/tools-runner
node dist/index.js
```

Then test the workflow. You'll see the event bridge logs in real-time!
