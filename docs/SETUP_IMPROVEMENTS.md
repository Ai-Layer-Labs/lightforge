# Setup Script Improvements

## Changes Made

### 1. Context Builder Integration
- ✅ Added `context-builder` to startup sequence
- ✅ Starts after RCRT core but before agent-runner
- ✅ Included in custom prefix configuration
- ✅ Added to system components documentation

### 2. Tools Runner Order-of-Operations Fix

**Problem**: Tools-runner needed manual restart to load OpenRouter model catalog

**Root Cause**: 
- Bootstrap tools (like `openrouter-models-sync`) run on tools-runner startup
- They execute asynchronously via breadcrumb subscriptions
- Agent-runner was starting before models catalog was populated
- Required manual restart to pick up the synced models

**Solution**:
```bash
# 1. Bootstrap tools are uploaded to database
cd bootstrap-breadcrumbs && node bootstrap.js

# 2. Wait for bootstrap tools to execute
sleep 20  # Allows openrouter-models-sync to fetch and create catalog

# 3. Restart tools-runner to ensure model catalog is loaded
docker compose restart tools-runner
sleep 10

# 4. NOW start agent-runner (models catalog is ready)
docker compose up -d agent-runner
```

**Why This Works**:
- Bootstrap tools have `"bootstrap": "once"` configuration
- They run automatically on first tools-runner startup
- The restart ensures tools catalog includes the newly synced models
- Agent-runner starts with complete model catalog available

### 3. Timing Optimizations
- Reduced initial core services wait from 20s → 15s
- Added explicit 15s wait for tools-runner initialization
- Added 20s wait for bootstrap tools to complete execution
- Added 10s wait after tools-runner restart
- Final 10s wait for agent-runner initialization

Total setup time: ~85 seconds (was ~70s, but now **reliable**)

## Startup Sequence

```
1. db, nats, rcrt, context-builder, dashboard, tools-runner start
   ↓ (15s wait)
   
2. builder starts (optional)
   ↓ (30s wait)
   
3. Tools-runner is ready
   ↓ (15s wait)
   
4. Bootstrap script uploads tool definitions
   ↓ (20s wait for bootstrap tools to execute)
   
5. Tools-runner restart (picks up model catalog)
   ↓ (10s wait)
   
6. agent-runner starts (models catalog ready!)
   ↓ (10s wait)
   
7. ✅ System fully operational
```

## Services Order

**Critical Dependencies**:
```
db ────────┐
           ├──> rcrt ────> context-builder
nats ──────┘                    │
                                ├──> tools-runner ──> agent-runner
                                └──> dashboard
```

## What No Longer Requires Manual Intervention

### Before
```bash
./setup.sh
# Wait...
# ❌ Agent can't find OpenRouter models
docker compose restart tools-runner
# ✅ Now it works
```

### After
```bash
./setup.sh
# Wait ~85 seconds...
# ✅ Everything works automatically!
```

## Testing the Fix

```bash
# Clean slate
docker compose down -v

# Run setup
./setup.sh

# Verify model catalog exists
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8081/api/breadcrumbs?schema=openrouter.models.catalog.v1

# Should return the models catalog (not empty)

# Test chat with OpenRouter
# Open extension, send message
# Should work without manual intervention
```

## Bootstrap Tools Behavior

Bootstrap tools with `"bootstrap": "once"` or `"bootstrap": "continuous"`:
- Run automatically when tools-runner starts
- Execute based on `trigger_event` detection
- Create breadcrumbs (like model catalogs) asynchronously
- May take several seconds to complete

**Key Insight**: The tools-runner restart after bootstrap ensures:
1. All bootstrap breadcrumbs are in the database
2. All bootstrap tools have executed at least once
3. The tool catalog includes freshly synced data
4. Agent-runner starts with complete system state

## Future Improvements

### Potential Optimizations
1. **Health Checks**: Add health check endpoints to tools-runner
   - `/health/ready` - returns 200 when all bootstrap tools complete
   - Agent-runner waits for tools-runner ready state

2. **Breadcrumb Polling**: Check for model catalog existence
   ```bash
   while ! curl -s http://localhost:8081/api/breadcrumbs?schema=openrouter.models.catalog.v1 | grep -q models; do
     sleep 2
   done
   ```

3. **Event-Based Startup**: Use SSE to detect when bootstrap completes
   - Listen for `tool.response.v1` from `openrouter_models_sync`
   - Start agent-runner only after receiving success event

### Why We Don't Do These Yet
- Setup script is already reliable with fixed waits
- Adding complexity for 10-15 seconds savings isn't worth it
- Bootstrap only runs once, subsequent startups are faster
- Current approach is simple and works across all platforms

## Troubleshooting

### If Models Still Don't Load
```bash
# Check if model catalog exists
docker compose logs tools-runner | grep "openrouter_models_sync"

# Should see:
# ✅ Bootstrap tool executed: openrouter_models_sync
# ✅ Created breadcrumb: openrouter.models.catalog.v1
```

### If Bootstrap Tools Don't Run
```bash
# Check tools-runner logs
docker compose logs tools-runner --tail=100

# Should see:
# [Bootstrap] Found 2 bootstrap tools
# [Bootstrap] ✅ openrouter_models_sync succeeded
# [Bootstrap] ✅ scheduler succeeded
```

### Manual Fix (if needed)
```bash
# Force re-run bootstrap
cd bootstrap-breadcrumbs && node bootstrap.js

# Wait for tools to execute
sleep 20

# Restart tools-runner
docker compose restart tools-runner

# Restart agent-runner
docker compose restart agent-runner
```

## Related Documentation
- `docs/CONTEXT_BUILDER_RUST.md` - Context builder service details
- `docs/SCHEDULE_SYSTEM.md` - Bootstrap and scheduler system
- `docs/TOOL_CODE_V1_SCHEMA.md` - Self-contained tool definitions

