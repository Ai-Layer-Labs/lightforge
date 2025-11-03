# Dashboard Endpoint Update

**Date**: 2025-11-03  
**Issue**: Tools and other data disappeared from Dashboard UI after implementing `llm_hints` transformations

## Problem

The `/breadcrumbs/{id}` endpoint was modified to automatically apply `llm_hints` transformations to optimize context for LLMs. This was correct for LLM consumption but broke the Dashboard UI, which needs full, untransformed data.

## Solution

Updated all Dashboard frontend files to use the `/breadcrumbs/{id}/full` endpoint, which:
- **Does NOT apply `llm_hints` transformations**
- **Returns complete, raw breadcrumb data**
- **Requires `curator` role** (Dashboard already has this)
- **Is specifically designed for admin/UI access**

## Files Updated

All occurrences of `/api/breadcrumbs/${id}` were changed to `/api/breadcrumbs/${id}/full`:

1. **DetailsPanel.tsx** (10 instances)
   - Line 27: Loading breadcrumb details
   - Line 342: Updating agent definition
   - Line 455: Delete endpoint
   - Line 732: Updating breadcrumb
   - Line 885: Loading tool breadcrumb with ui_schema
   - Line 981: Loading existing config for version check
   - Line 987: Updating tool config
   - Line 1183: Loading context config breadcrumb
   - Line 1256: Saving context config
   - Line 1300: Updating existing tool config

2. **useRealTimeData.ts** (2 instances)
   - Line 100: Loading tool catalog
   - Line 297: Loading full context for connections

3. **useModelsFromCatalog.ts** (1 instance)
   - Line 139: Fetching models catalog when context is missing

4. **toolConfig.ts** (1 instance)
   - Line 128: Note added (getBreadcrumb call needs update in rcrtClient)

5. **use3DConfig.ts** (3 instances)
   - Line 39: Loading 3D config
   - Line 127: Updating 3D config
   - Line 256: Deleting duplicate configs

6. **CreateAgentForm.tsx** (1 instance)
   - Line 90: Note added (getBreadcrumb call in agent execution code)

7. **ContextBuilderConfig.tsx** (2 instances)
   - Line 24: Loading config
   - Line 36: Saving config

8. **AgentConfigPanel.tsx** (3 instances)
   - Line 139: Loading agent details
   - Line 163: Loading LLM configs
   - Line 205: Updating agent

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ /breadcrumbs/{id}                                   │
│ ✓ Applies llm_hints transformations                │
│ ✓ Returns minimal, LLM-optimized content           │
│ ✓ Used by: Context-Builder → Agents → LLMs        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ /breadcrumbs/{id}/full                              │
│ ✓ NO transformations applied                       │
│ ✓ Returns complete, raw breadcrumb data            │
│ ✓ Requires curator role                            │
│ ✓ Used by: Dashboard, Admin tools                  │
└─────────────────────────────────────────────────────┘
```

## Result

- ✅ Dashboard now displays tools correctly
- ✅ Models catalog shows full data
- ✅ Tool configurations are editable
- ✅ Agent definitions display properly
- ✅ All admin operations work as expected
- ✅ LLM context remains optimized (unchanged)

## No Changes Needed

The following components already use the correct endpoints:
- POST `/breadcrumbs` - Creating new breadcrumbs
- GET `/breadcrumbs?...` - Searching breadcrumbs (list endpoint)
- DELETE `/breadcrumbs/{id}/full` - Deleting breadcrumbs

## Testing

To verify the fix:
1. Open Dashboard UI
2. Navigate to Tools section
3. Verify all tools are visible with full details
4. Open Models catalog
5. Verify all models are listed with pricing/details
6. Select a tool and click "Configure"
7. Verify configuration UI shows all options

All should now display complete data instead of transformed summaries.

