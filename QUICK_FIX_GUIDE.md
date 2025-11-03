# Quick Fix Guide - Context Optimization Issues

## Problem Identified

The context-builder was failing with `"error decoding response body"` because:

1. **Schema definitions not loaded** - The 7 schema.def.v1 files weren't bootstrapped into the database
2. **Wrong struct type** - `get_breadcrumb()` was trying to deserialize into the wrong struct type

## Fixes Applied

### 1. Fixed Struct Deserialization ✅
**File**: `crates/rcrt-context-builder/src/rcrt_client.rs`

- Added `BreadcrumbContextView` struct to match server response
- Updated `get_breadcrumb()` to return `BreadcrumbContextView`
- Added better error messages for debugging

### 2. Created Bootstrap Script ✅
**File**: `bootstrap-breadcrumbs/bootstrap-schemas.sh`

Shell script to load all 7 schema definitions into the database.

---

## Steps to Fix

### Step 1: Rebuild Context-Builder

The struct fix requires recompiling:

```bash
cd crates/rcrt-context-builder
cargo build --release
```

Or rebuild the entire Docker stack:

```bash
docker-compose build context-builder
docker-compose up -d context-builder
```

### Step 2: Bootstrap Schema Definitions

Run the bootstrap script to load schema definitions:

```bash
# Set your RCRT URL (default: http://localhost:8081)
export RCRT_URL=http://localhost:8081

# Run the bootstrap script
./bootstrap-breadcrumbs/bootstrap-schemas.sh
```

Expected output:
```
🔧 Bootstrapping Schema Definitions
   RCRT URL: http://localhost:8081

📝 Requesting auth token...
✅ Auth token obtained
📚 Loading schema definitions from bootstrap-breadcrumbs/schemas/...

📦 Loading agent-context-v1... ✅ Created (abc-123...)
📦 Loading agent-response-v1... ✅ Created (def-456...)
📦 Loading browser-page-context-v1... ✅ Created (ghi-789...)
📦 Loading tool-catalog-v1... ✅ Created (jkl-012...)
📦 Loading tool-code-v1... ✅ Created (mno-345...)
📦 Loading tool-response-v1... ✅ Created (pqr-678...)
📦 Loading user-message-v1... ✅ Created (stu-901...)

✅ Schema definitions bootstrap complete!
```

### Step 3: Verify Schemas Loaded

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8081/breadcrumbs?schema_name=schema.def.v1"
```

You should see 7 breadcrumbs returned.

### Step 4: Test with User Message

1. Send a user message through your chat interface
2. Check context-builder logs - should see:
   - No more "error decoding response body" warnings
   - Actual content in breadcrumbs instead of empty `{}`
   - Accurate token counts (~400-500 instead of ~13,000)

---

## Expected Results After Fix

### Before (Broken):
```
WARN: Failed to fetch LLM content for xxx: error decoding response body
"content": {}  // Empty!
Token estimate: ~13,139
```

### After (Fixed):
```
INFO: ✅ Published context with 10 breadcrumbs (~449 tokens)
"content": {
  "formatted": "User (2025-11-03T15:05:54Z): test"
}
Token estimate: ~449
```

---

## Verification Checklist

- [ ] Context-builder rebuilt with struct fix
- [ ] Schema definitions bootstrapped (7 loaded)
- [ ] Context-builder logs show no "error decoding" warnings
- [ ] Breadcrumbs have actual content (not empty `{}`)
- [ ] Token counts reduced from ~13k to ~400-500
- [ ] LLM receives properly formatted, human-readable context
- [ ] Agent responses are relevant and accurate

---

## If Still Having Issues

### Check Schema Definitions Are Applied

Fetch a specific breadcrumb and verify llm_hints transformation:

```bash
# Get a user message breadcrumb ID from logs
BREADCRUMB_ID="3c02961a-c9e5-4949-bc58-ac853becf348"

# Fetch with transformation
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8081/breadcrumbs/$BREADCRUMB_ID"
```

Should return:
```json
{
  "id": "...",
  "title": "...",
  "context": {
    "formatted": "User (2025-11-03T...): actual message text here"
  },
  "schema_name": "user.message.v1",
  ...
}
```

If `context` still shows the raw fields instead of `formatted`, the schema definition isn't being applied.

### Check Server Logs

Look for llm_hints application:
```
DEBUG: Applied llm_hints transform for breadcrumb xxx
```

If missing, the schema definitions may not have been found.

---

## Troubleshooting

### Issue: "Could not parse llm_hints"
**Solution**: Check that schema definitions were bootstrapped correctly. Verify with:
```bash
curl "http://localhost:8081/breadcrumbs?schema_name=schema.def.v1&tag=defines:user.message.v1"
```

### Issue: Still getting empty content
**Solution**: Ensure context-builder was rebuilt after the struct fix.

### Issue: Token count still high
**Solution**: 
1. Verify schema definitions are loaded
2. Check that llm_hints are being applied (server logs)
3. Ensure agent-executor.ts changes are deployed

---

## Summary

The fix involves:
1. ✅ **Code fix**: Update `BreadcrumbContextView` struct in rcrt_client.rs
2. ✅ **Data fix**: Bootstrap 7 schema definitions 
3. ⏳ **Deploy**: Rebuild context-builder
4. ⏳ **Test**: Verify token reduction and content formatting

After these steps, you should see:
- **60-70% token reduction** (21k → ~5-7k tokens)
- **Human-readable context** ("User (timestamp): message")
- **Relevant LLM responses** (agent has proper context)

