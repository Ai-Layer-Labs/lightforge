# Fix for Tools Not Displaying in Dashboard

## The Problem

The tools are registering in the tool catalog but not showing in the dashboard because:

1. The dashboard loads tools from the catalog breadcrumb's `context.tools` array
2. The tools runner was using `llm_hints` with `mode: 'replace'` which **replaced** the entire context
3. This removed the `tools` array, leaving only the transformed fields (`tool_summary`, `available_tools`, `categories`)

## The Solution

Changed `llm_hints` mode from `'replace'` to `'merge'` in both:
- `createCatalogBreadcrumb()` method
- `updateCatalog()` method

This preserves the original `context.tools` array while adding the LLM-friendly summaries.

## To Apply the Fix

```bash
# 1. Rebuild the tools runner
docker compose build tools-runner

# 2. Restart it
docker compose restart tools-runner

# 3. Wait a moment for it to update the catalog
sleep 10

# 4. Refresh the dashboard
```

## Why This Happened

The `llm_hints` feature is designed to transform breadcrumb context for LLMs. With `mode: 'replace'`, it completely replaces the context with just the transformed fields. The dashboard needs the original `tools` array to create tool nodes.

Using `mode: 'merge'` keeps both:
- Original data (including the `tools` array) for the dashboard
- Transformed summaries for LLMs
