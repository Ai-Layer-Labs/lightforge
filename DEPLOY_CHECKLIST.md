# Deploy Checklist - EventBridge & RCRT-Native Tools

## Current Status: ❌ Not Deployed

The logs show:
1. ❌ No EventBridge logs → Old code running
2. ❌ Agent using `.result` instead of `.numbers[0]` → Old agent definition
3. ✅ Tools ARE executing and creating responses
4. ✅ SSE events ARE arriving

## What Needs to Happen

### 1. Rebuild Docker Images
```bash
docker compose build
```

This will include:
- ✅ EventBridge in tools-runner
- ✅ Event-driven workflow tool
- ✅ Pure RCRT-native tool loading
- ✅ Bootstrap tools script

### 2. Update Agent Definition in Database

The agent is using an OLD prompt. You need to either:

**Option A: Delete and recreate**
```bash
# Via UI - delete the default-chat-assistant agent
# System will recreate from ensure-default-agent.js
```

**Option B: Run update script**
```bash
node rcrt-visual-builder/apps/agent-runner/ensure-default-agent.js
```

**Option C: Update via API**
Upload the new agent definition from:
`bootstrap-breadcrumbs/system/default-chat-agent.json`

### 3. Restart System
```bash
docker compose down
docker compose up
```

### 4. Verify Logs Show EventBridge

Look for these logs:
```
[EventBridge] Initialized
[EventBridge] Added to pending waits (1 total)
[EventBridge] ✅ Event matches waiting request
[Workflow] ✅ Using event bridge
[Workflow] ✅ Received event for workflow-...
```

### 5. Test Workflow

Should complete in <1 second:
```
User: "Create two random numbers and add them"
→ Numbers generated
→ Sum calculated  
→ Result returned
✅ Done!
```

## Why It's Still Failing

### Issue 1: Old Docker Images
```
Your running code:  2 hours old (before EventBridge)
Your source code:   5 minutes old (with EventBridge)
```

### Issue 2: Old Agent Definition
```
Agent in DB:     Uses {{...}} syntax and .result field
Agent in files:  Uses ${...} syntax and .numbers[0] field
```

## Quick Deploy

```bash
# 1. Build everything
docker compose build

# 2. Restart
docker compose down
docker compose up -d

# 3. Update agent (from host)
node ensure-default-agent.js

# 4. Test
# In chat: "Create two random numbers and add them"

# 5. Watch logs
docker compose logs -f tools-runner | grep -E "EventBridge|Workflow"
```

## Expected After Deploy

```
[EventBridge] Initialized
[Workflow] waitForEvent available: true
[Workflow] ✅ Using event bridge to wait for workflow-generate_random_1-...
[EventBridge] Added to pending waits (1 total)
[EventBridge] ✅ Event matches waiting request
[Workflow] ✅ Received event for workflow-generate_random_1-... 
→ Result: { numbers: [42] }
[Workflow] ✅ Received event for workflow-generate_random_2-...
→ Result: { numbers: [87] }
[Workflow] ✅ Received event for workflow-add_numbers-...
→ Result: { result: 129 }
✅ Workflow completed in 180ms!
```

**The code is ready, it just needs to be deployed!**
