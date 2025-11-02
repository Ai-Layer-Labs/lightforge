# Workflow Tool Structure Fix

**Date**: 2025-11-02  
**Issue**: Workflow tool had incorrect structure compared to other self-contained tools  
**Status**: ✅ **FIXED**

## Problem

The workflow tool (`bootstrap-breadcrumbs/tools-self-contained/workflow.json`) was written with an incorrect structure:

###  What Was Wrong

1. **`source` at wrong level** - Had `source` as a top-level property in `context` instead of nested in a `code` object
2. **Missing `code` wrapper** - Didn't wrap the source code in a `code` object with `language` property
3. **Extra invalid fields** - Had `runtime: "deno"` and `entry_point: "execute"` which aren't part of the schema
4. **Wrong tags** - Used `tool:code` instead of `tool`
5. **Missing fields** - Lacked `required_secrets` and `ui_schema` fields
6. **Duplicate source** - Had the source code duplicated (once incorrectly, once as template literal)

### Incorrect Structure

```json
{
  "context": {
    "name": "workflow",
    "runtime": "deno",        // ❌ Not part of schema
    "entry_point": "execute",  // ❌ Not part of schema
    "permissions": {...},
    "source": `...`            // ❌ Wrong location
  }
}
```

### Correct Structure

```json
{
  "context": {
    "name": "workflow",
    "code": {                  // ✅ Wrapper object
      "language": "typescript",
      "source": "..."          // ✅ Nested properly
    },
    "permissions": {...},
    "required_secrets": [],    // ✅ Added
    "ui_schema": {...}         // ✅ Added
  }
}
```

## The Fix

### 1. Moved `source` into `code` object

**Before:**
```json
"source": `...code...`
```

**After:**
```json
"code": {
  "language": "typescript",
  "source": "...code..."
}
```

### 2. Fixed tags

**Before:**
```json
"tags": ["tool:code", "workspace:tools", "tool:workflow", "category:orchestration"]
```

**After:**
```json
"tags": ["tool", "tool:workflow", "workspace:tools", "self-contained"]
```

### 3. Removed invalid fields

Removed `runtime: "deno"` and `entry_point: "execute"` which aren't part of the `tool.code.v1` schema.

### 4. Added missing fields

```json
"required_secrets": [],
"ui_schema": {
  "configurable": false
}
```

### 5. Removed duplicate source

Deleted the incorrectly placed `source` field at the end of the context object.

### 6. Incremented version

Changed version from `2.0.0` to `2.0.1` to trigger bootstrap update.

## Why This Matters

The Deno tool runtime expects a specific structure:
1. **`code.source`** - Extracts the TypeScript source code from `context.code.source`
2. **`code.language`** - Validates the language is supported
3. **Schema validation** - Checks input_schema, output_schema, permissions, etc.

Without the correct structure, the tool:
- ❌ Won't be loaded by the Deno runtime
- ❌ Can't have its source code extracted
- ❌ Fails schema validation
- ❌ Never appears in the tool catalog

## Comparison with Correct Tool

Looking at `timer.json` (correct structure):

```json
{
  "schema_name": "tool.code.v1",
  "title": "Timer Tool (Self-Contained)",
  "tags": ["tool", "tool:timer", "workspace:tools", "self-contained"],
  "context": {
    "name": "timer",
    "description": "Wait for a specified number of seconds",
    "version": "2.0.0",
    "code": {                              // ✅ Code wrapper
      "language": "typescript",
      "source": "/**\n * Timer Tool..."  // ✅ Source inside
    },
    "input_schema": {...},
    "output_schema": {...},
    "permissions": {...},
    "limits": {...},
    "required_secrets": [],                // ✅ Present
    "ui_schema": {                         // ✅ Present
      "configurable": false
    },
    "examples": [...]
  }
}
```

## Files Modified

- `bootstrap-breadcrumbs/tools-self-contained/workflow.json` - Complete restructure

## Next Steps

To apply the fix:

1. **Re-run bootstrap** to upload the corrected workflow tool:
   ```bash
   cd bootstrap-breadcrumbs && node bootstrap.js
   ```

2. **Restart tools-runner** to pick up the new tool:
   ```bash
   docker compose restart tools-runner
   ```

3. **Verify** it appears in the tool list:
   ```bash
   docker compose logs tools-runner | grep workflow
   ```

## Related Documentation

- `docs/TOOL_CODE_V1_SCHEMA.md` - Full schema specification
- `docs/TOOL_V1_MIGRATION_COMPLETE.md` - Migration from old tool.v1
- `bootstrap-breadcrumbs/tools-self-contained/README.md` - Tool template guidelines

## Lesson Learned

**Always use an existing, working tool as a template when creating new self-contained tools.**

The correct pattern is:
1. Copy a working tool like `timer.json` or `echo.json`
2. Modify the logic inside `code.source`
3. Update name, description, schemas, examples
4. Keep the structure identical (code wrapper, required_secrets, ui_schema, etc.)

