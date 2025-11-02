# Dashboard Tool Configuration Fix

**Date**: 2025-11-02  
**Issue**: Dynamic configuration UI not appearing for tools displayed from catalog  
**Status**: ✅ **FIXED**

## Problem

After filtering out `tool.code.v1` breadcrumbs from the dashboard display (to avoid duplicates), clicking on a tool node no longer showed the dynamic configuration UI. Instead, users saw a blank configuration panel or fallback UI.

## Root Cause

The data flow issue:

1. **Tool nodes are created from catalog** → `node.data` contains a lightweight `Tool` object (from `tool.catalog.v1`)
2. **Lightweight `Tool` objects don't have `ui_schema`** → Only the full `tool.code.v1` breadcrumb contains this
3. **`DetailsPanel` checks `node.data?.context?.ui_schema`** → Returns `undefined` for catalog tools
4. **Dynamic UI form doesn't render** → Falls back to legacy/empty UI

The catalog contains metadata about tools (name, description, input/output schemas) but **not** the full `ui_schema` needed for dynamic configuration.

## Solution

Modified `EditToolForm` in `DetailsPanel.tsx` to:

1. **Detect if node is from catalog** (no `ui_schema` in `node.data`)
2. **Fetch the full `tool.code.v1` breadcrumb** by searching for it using the tool name
3. **Store in `toolBreadcrumb` state** for use in UI rendering
4. **Use `toolBreadcrumb` if available**, otherwise fall back to `node.data`

### Code Changes

```typescript
// Added state to store full tool breadcrumb
const [toolBreadcrumb, setToolBreadcrumb] = useState<any>(null);

// In useEffect, after loading secrets:
// If node data doesn't have ui_schema (catalog tool), fetch the full tool.code.v1 breadcrumb
if (!node.data?.context?.ui_schema) {
  console.log('🔍 Fetching full tool.code.v1 breadcrumb for:', toolName);
  try {
    const toolSearchParams = new URLSearchParams({
      schema_name: 'tool.code.v1',
      tag: `tool:${toolName}`
    });
    
    const toolResponse = await authenticatedFetch(`/api/breadcrumbs?${toolSearchParams.toString()}`);
    
    if (toolResponse.ok) {
      const toolBreadcrumbs = await toolResponse.json();
      if (toolBreadcrumbs.length > 0) {
        // Get the full breadcrumb to access context with ui_schema
        const toolBreadcrumbId = toolBreadcrumbs[0].id;
        const fullToolResponse = await authenticatedFetch(`/api/breadcrumbs/${toolBreadcrumbId}`);
        
        if (fullToolResponse.ok) {
          const fullToolBreadcrumb = await fullToolResponse.json();
          console.log('✅ Loaded full tool breadcrumb with ui_schema');
          setToolBreadcrumb(fullToolBreadcrumb);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to load tool.code.v1 breadcrumb:', error);
  }
}

// Later, when checking for ui_schema:
const toolData = toolBreadcrumb || node.data;
const uiSchema = toolData?.context?.ui_schema;
```

## Why This is the Right Approach

### Why Not Store `ui_schema` in Catalog?

1. **Catalog is meant to be lightweight** - It's read by agents and tools frequently
2. **`ui_schema` is dashboard-specific** - Not needed for agent/tool interactions
3. **Separation of concerns** - Catalog = API metadata, Breadcrumb = full definition

### Why Fetch on Demand?

1. **Lazy loading** - Only fetch when user clicks on a tool
2. **Fresh data** - Always gets latest `ui_schema` from database
3. **Minimal overhead** - Single additional request per tool configuration

## Result

After the fix:

✅ Click on any tool → Dynamic configuration UI appears  
✅ All `ui_schema` fields render correctly (secrets, models, sliders, etc.)  
✅ Configuration saves and loads properly  
✅ Works for all `tool.code.v1` self-contained tools  
✅ Graceful fallback if `tool.code.v1` breadcrumb not found

## Testing

1. Navigate to dashboard (http://localhost:8082)
2. Click on the `openrouter` tool
3. Verify dynamic configuration form appears with:
   - API Key Secret dropdown (loaded from secrets)
   - Default Model dropdown (loaded from OpenRouter models catalog)
   - Max Tokens number input
   - Temperature slider
4. Configure and save
5. Reload page and verify configuration persists

## Files Modified

- `rcrt-dashboard-v2/frontend/src/components/panels/DetailsPanel.tsx`:
  - Added `toolBreadcrumb` state
  - Added logic to fetch full `tool.code.v1` breadcrumb
  - Updated `toolData` to use fetched breadcrumb when available
  - Fixed all references to use `toolName` variable

## Related Issues

- **Previous Fix**: `docs/DASHBOARD_DUPLICATE_TOOLS_FIX.md` - Filtered out `tool.code.v1` from display
- **This Fix**: Fetches `tool.code.v1` on demand for configuration UI
- **Root Cause**: Both issues stem from the dual representation of tools (catalog + breadcrumbs)

## Related Documentation

- `docs/DYNAMIC_CONFIG_IMPLEMENTATION_SUMMARY.md` - Dynamic configuration system
- `docs/TOOL_CODE_V1_SCHEMA.md` - Schema for self-contained tools
- `docs/DASHBOARD_DUPLICATE_TOOLS_FIX.md` - Previous fix that caused this issue

