# Dashboard Duplicate Tools Fix

**Date**: 2025-11-02  
**Issue**: Dashboard was displaying each tool twice  
**Status**: ✅ **FIXED**

## Problem

The dashboard was showing duplicate tool nodes:
- "OpenRouter LLM Tool (Self-Contained)" AND "openrouter"
- "OpenRouter Models Sync Tool (Self-Contained)" AND "openrouter_models_sync"
- "Timer Tool (Self-Contained)" AND "timer"
- etc.

## Root Cause

In `rcrt-dashboard-v2/frontend/src/hooks/useRealTimeData.ts`, the data processing logic was:

1. **Line 173-175**: Converting ALL breadcrumbs to nodes → This included `tool.code.v1` breadcrumbs with full titles like "OpenRouter LLM Tool (Self-Contained)"
2. **Line 177-180**: Converting tool catalog entries to nodes → This created nodes with short names like "openrouter"

Result: **Each tool appeared twice** because `tool.code.v1` breadcrumbs were being rendered as both:
- Breadcrumb nodes (from the raw `tool.code.v1` breadcrumb)
- Tool nodes (from the `tool.catalog.v1` entry)

## Solution

Modified `useRealTimeData.ts` to **filter out `tool.code.v1` breadcrumbs** from the regular breadcrumbs list:

```typescript
// Filter out tool.code.v1 breadcrumbs (already represented in tool catalog)
// Also filter out tool config requests
const regularBreadcrumbs = breadcrumbsQuery.data.filter(b => 
  // Keep tool catalog visible as it's an important system breadcrumb
  // Filter out tool.code.v1 since they're shown via tool catalog
  b.schema_name !== 'tool.code.v1' &&
  // Filter out tool config requests which are just status breadcrumbs
  !b.tags?.includes('tool:config:request') &&
  !b.schema_name?.includes('tool.config.request')
);
```

## Why This is Correct

1. **`tool.code.v1` breadcrumbs** are the *definitions* of self-contained tools (the source code, schemas, permissions, etc.)
2. **`tool.catalog.v1` breadcrumb** is the *catalog* of all available tools (both `tool.v1` and `tool.code.v1`), extracted and aggregated by the tools-runner
3. **The dashboard should show tools from the catalog**, not the raw definition breadcrumbs

## Result

After the fix:
- ✅ Each tool appears **only once** with its catalog name ("openrouter", "timer", etc.)
- ✅ Tool nodes are properly color-coded (orange/green)
- ✅ Clicking a tool shows its configuration UI
- ✅ The underlying `tool.code.v1` breadcrumbs still exist in the database (as they should), but they're not cluttering the UI

## Files Modified

- `rcrt-dashboard-v2/frontend/src/hooks/useRealTimeData.ts` - Added `tool.code.v1` filter

## Deployment

```bash
# Rebuild and restart dashboard
docker compose build dashboard --no-cache
docker compose up -d dashboard
```

## Testing

1. Navigate to dashboard (http://localhost:8082)
2. Verify tools appear only once
3. Verify tool names match the catalog (short names)
4. Click on a tool and verify the configuration UI appears

## Related Documentation

- `docs/TOOL_V1_MIGRATION_COMPLETE.md` - Full migration from tool.v1 to tool.code.v1
- `docs/DYNAMIC_CONFIG_IMPLEMENTATION_SUMMARY.md` - Dynamic configuration UI
- `docs/TOOL_CODE_V1_SCHEMA.md` - tool.code.v1 schema documentation

