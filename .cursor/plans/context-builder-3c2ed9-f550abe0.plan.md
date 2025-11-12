<!-- f550abe0-5d2d-4648-9310-0e2cf37c26ed 2bcf6a4a-3f4c-4983-82ab-12397a1e13f5 -->
# Simplify LLM Hints - Instance Only, No Fallbacks

## Overview

Eliminate schema.def.v1 dependency for llm_hints, use ONLY instance llm_hints (on breadcrumbs themselves), simplify format to exclude-only pattern, and purge all alternative paths.

**Goal:** Each breadcrumb self-contained with simple `{"exclude": ["field1", "field2"]}` format

---

## Phase 1: Transform Engine Changes

### 1.1 Remove Schema Lookup (PURGE FALLBACK)

**File:** [`crates/rcrt-server/src/main.rs`](crates/rcrt-server/src/main.rs) around line 750-763

**Current code:**

```rust
// Load instance llm_hints
let instance_hints = view.llm_hints.as_ref()
    .and_then(|v| serde_json::from_value::<LlmHints>(v.clone()).ok());

// Load schema defaults (fallback)
let schema_hints = if instance_hints.is_none() {
    schema_cache.load_schema_hints(schema_name).await
} else {
    None
};

// Apply precedence: Instance > Schema
let final_hints = instance_hints.or(schema_hints);
```

**NEW code:**

```rust
// ONLY use instance llm_hints - no fallback!
let instance_hints = view.llm_hints.as_ref()
    .and_then(|v| serde_json::from_value::<LlmHints>(v.clone()).ok());

// That's it! If no llm_hints, return as-is (no transform)
let final_hints = instance_hints;
```

**Impact:** Eliminates schema.def.v1 dependency, no hidden fallbacks

### 1.2 Simplify LlmHints Structure

**File:** [`crates/rcrt-server/src/transforms.rs`](crates/rcrt-server/src/transforms.rs) line 39-45

**Current:**

```rust
pub struct LlmHints {
    pub transform: Option<HashMap<String, TransformRule>>,
    pub include: Option<Vec<String>>,  // Whitelist
    pub exclude: Option<Vec<String>>,  // Blacklist
    pub mode: Option<TransformMode>,
}
```

**Simplified:**

```rust
pub struct LlmHints {
    pub exclude: Vec<String>,  // Required! Just list fields to exclude
    pub transform: Option<HashMap<String, TransformRule>>,  // Optional templates
    pub mode: Option<TransformMode>,  // Optional (default: replace)
}
```

**Changes:**

- `exclude` now required (was optional)
- `include` removed entirely (use exclude instead)
- Empty exclude list `[]` means "show everything"

### 1.3 Update Transform Application

**File:** [`crates/rcrt-server/src/transforms.rs`](crates/rcrt-server/src/transforms.rs) line 125-164

**Current:**

```rust
// Apply include/exclude filters first
if let Some(include) = &hints.include {
    result = self.filter_fields(&result, include, true)?;
}
if let Some(exclude) = &hints.exclude {
    result = self.filter_fields(&result, exclude, false)?;
}
```

**Simplified:**

```rust
// Apply exclude filter (required field)
if !hints.exclude.is_empty() {
    result = self.filter_fields(&result, &hints.exclude, false)?;
}
```

**Impact:** Single, clear filtering strategy

---

## Phase 2: Breadcrumb llm_hints Updates

### 2.1 Simplify All Tool Breadcrumbs

**Files:** [`bootstrap-breadcrumbs/tools-self-contained/*.json`](bootstrap-breadcrumbs/tools-self-contained/) (14 files)

**Current format:**

```json
{
  "llm_hints": {
    "include": ["name", "description", "input_schema", "output_schema", "examples"],
    "exclude": ["code", "permissions", "limits", "ui_schema", "bootstrap"]
  }
}
```

**Simplified format:**

```json
{
  "llm_hints": {
    "exclude": ["code", "permissions", "limits", "ui_schema", "bootstrap"]
  }
}
```

**Why:** Just say what to hide, show everything else!

### 2.2 Update Schema Definitions (Optional)

**Files:** [`bootstrap-breadcrumbs/schemas/*.json`](bootstrap-breadcrumbs/schemas/) (19 files)

**Option A:** Remove llm_hints entirely (schemas are just for documentation)

**Option B:** Keep llm_hints but simplify to exclude-only

**Recommendation:** Keep llm_hints in schemas but acknowledge they're ONLY used if breadcrumb lacks llm_hints (graceful degradation for old breadcrumbs)

---

## Phase 3: Remove Schema Cache (OPTIONAL)

### 3.1 Delete SchemaDefinitionCache

**File:** [`crates/rcrt-server/src/transforms.rs`](crates/rcrt-server/src/transforms.rs) line 52-115

**If we're NOT using schema llm_hints:**

- Delete SchemaDefinitionCache struct
- Remove preload logic
- Remove database queries

**If keeping as fallback:**

- Update to new simplified LlmHints structure

### 3.2 Remove from AppState

**File:** [`crates/rcrt-server/src/main.rs`](crates/rcrt-server/src/main.rs)

```rust
// REMOVE:
pub struct AppState {
    schema_cache: Arc<transforms::SchemaDefinitionCache>,  // ← DELETE
    // ...
}
```

---

## Phase 4: Update Documentation

### 4.1 llm_hints Examples

**Document simplified format:**

````markdown
# llm_hints Format (v2.2.0)

**Simple exclude pattern (recommended):**
```json
{
  "llm_hints": {
    "exclude": ["field1", "field2"]
  }
}
````

**With template:**

```json
{
  "llm_hints": {
    "exclude": ["verbose_field"],
    "transform": {
      "summary": {
        "type": "template",
        "template": "{{name}}: {{description}}"
      }
    },
    "mode": "replace"
  }
}
```

**What it does:**

1. Exclude specified fields
2. Optionally apply transform template
3. Mode: replace (use transform) or merge (combine with filtered)
````

---

## Phase 5: Testing

### 5.1 Verify Transform Works
```bash
# Get a tool with llm_hints
TOOL_ID=$(curl -s "http://localhost:8081/breadcrumbs?schema_name=tool.code.v1&tag=tool:calculator" | jq -r '.[0].id')

# Fetch with transform
curl -s "http://localhost:8081/breadcrumbs/$TOOL_ID" | jq '.'

# Should NOT have: code, permissions, limits
# Should have: name, description, schemas, examples
````


### 5.2 Check Error Handling

```bash
# Create breadcrumb without llm_hints
# Should work (no transform applied, returns raw)

# Create with invalid llm_hints
# Should error clearly (fail fast, no silent fallback)
```

---

## Breaking Changes

### Removed

- ❌ `include` field in llm_hints (use exclude instead)
- ❌ schema.def.v1 fallback for llm_hints (instance only!)
- ❌ SchemaDefinitionCache (if not needed)
- ❌ Backwards compatibility (old format not supported)

### Changed

- `exclude` is now the ONLY filtering strategy
- llm_hints MUST be on breadcrumb itself (no schema fallback)
- Empty llm_hints = no transform (not an error)

---

## Migration Guide

### For Existing Breadcrumbs

**Before:**

```json
{
  "llm_hints": {
    "include": ["name", "description"],
    "exclude": ["metadata"]
  }
}
```

**After:**

```json
{
  "llm_hints": {
    "exclude": ["metadata", "internal", "any_other_field_not_in_include_list"]
  }
}
```

**Conversion:** List all fields NOT in include list as excludes

### For New Breadcrumbs

**Just specify what to exclude:**

```json
{
  "llm_hints": {
    "exclude": ["code", "permissions"]
  }
}
```

---

## File Changes Summary

### Application Code (3 files)

1. `crates/rcrt-server/src/main.rs` - Remove schema lookup fallback
2. `crates/rcrt-server/src/transforms.rs` - Simplify LlmHints struct, remove include logic
3. `crates/rcrt-context-builder/src/output/publisher.rs` - Already fixed (proper JSON handling)

### Bootstrap Files (14+ files)

1. All tools in `tools-self-contained/` - Remove include, keep only exclude
2. All schemas in `schemas/` - Optional: simplify or remove llm_hints

### Documentation

1. Update llm_hints guide
2. Document new simplified format
3. Remove references to schema.def.v1 for llm_hints

---

## Expected Results

**Token reduction:**

- Current: 11,494 tokens (pretty-printed JSON with all fields)
- After: ~2,100 tokens (excluded fields removed, clean JSON)

**Clarity:**

- Before: "Which fallback is being used? Schema or instance?"
- After: "Breadcrumb has llm_hints, use it. Period."

**Maintainability:**

- Before: Update schema.def.v1, hope it applies correctly
- After: Update breadcrumb llm_hints, it works immediately

---

## Success Criteria

- [ ] Transform uses ONLY instance llm_hints (no schema lookup)
- [ ] `include` field removed from LlmHints struct
- [ ] `exclude` is sole filtering strategy
- [ ] All 14 tools have simplified llm_hints (exclude only)
- [ ] Context shows ~2,100 tokens (not 11,494)
- [ ] No "code", "permissions", "limits" in tool context
- [ ] Fail-fast if transform breaks (no silent fallbacks)

---

**Pure, simple, self-contained - the RCRT way!** 🎯

### To-dos

- [x] Remove schema.def.v1 fallback from rcrt-server/src/main.rs - use ONLY instance llm_hints
- [x] Change LlmHints struct to exclude-only (remove include field)
- [x] Remove include filtering logic from apply_llm_hints()
- [x] Update all 14 tool breadcrumbs to exclude-only llm_hints
- [x] Simplify or remove llm_hints from schema.def.v1 files
- [x] Optional: Remove SchemaDefinitionCache if no longer needed
- [x] Verify tools have clean context without excluded fields
- [x] Confirm context is ~2,100 tokens (not 11,494)