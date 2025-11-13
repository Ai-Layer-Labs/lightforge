# Knowledge Base Updated for v2.2.0 + v2.3.0

**Date:** November 13, 2025  
**Status:** ✅ Complete  
**Version:** Production-Ready

---

## 🎯 Knowledge Files Updated

### 1. how-to-create-tools.json ✅

**Changes Made:**

**Required Structure (v2.2.0):**
```json
{
  "schema_name": "tool.code.v1",
  "title": "Tool Name",  // ← Not "(Self-Contained)" suffix
  "description": "Detailed description",  // ← NEW: Top-level
  "semantic_version": "1.0.0",  // ← NEW: Top-level
  "tags": ["tool", "tool:name", "utility", "math"],  // ← Pointer tags, NO workspace:tools
  "llm_hints": {  // ← NEW: Required field
    "exclude": ["code", "permissions", "limits", "ui_schema"]
  },
  "context": {
    "name": "toolname",  // ← No description here (it's top-level)
    "code": {...}
  }
}
```

**Critical Rules Updated:**
- ✅ MUST have top-level `description` field
- ✅ MUST have top-level `semantic_version` field
- ✅ MUST have top-level `llm_hints` with exclude array
- ✅ `workspace:tools` tag added by tool-creator (NOT by tool generator)
- ❌ NEVER use `self-contained` tag (redundant)
- ❌ NEVER put description in context (it's top-level)

---

### 2. creating-tools-with-agent.json ✅

**Changes Made:**

**Tool Creation Example:**
```json
{
  "tool": "breadcrumb-create",
  "input": {
    "schema_name": "tool.code.v1",
    "title": "Tool Name",
    "description": "Detailed description here",  // ← NEW
    "semantic_version": "1.0.0",  // ← NEW
    "tags": ["tool", "tool:name", "utility", "math"],  // ← Pointer tags
    "llm_hints": {  // ← NEW
      "exclude": ["code", "permissions", "limits", "ui_schema"]
    },
    "context": {...}
  }
}
```

**Critical Reminders Updated:**
- 🔴 MUST include top-level `description` field
- 🔴 MUST include top-level `semantic_version` field
- 🔴 MUST include top-level `llm_hints` with exclude array
- 🔴 Do NOT add `workspace:tools` tag - tool-creator adds it!

---

### 3. validation-rules-v1.json ✅

**Changes Made:**

**New Section: Required Top-Level Fields**
```json
{
  "required_top_level_fields": [
    "schema_name",
    "title",
    "description",  // ← NEW requirement
    "semantic_version",  // ← NEW requirement
    "tags",
    "llm_hints",  // ← NEW requirement
    "context"
  ]
}
```

**llm_hints Requirement:**
```json
{
  "llm_hints_requirement": {
    "required": true,
    "format": "exclude-only (v2.2.0)",
    "example": {"exclude": ["code", "permissions", "limits", "ui_schema"]},
    "why": "Context-builder uses this to hide code. Also used for embeddings.",
    "validation": "MUST have llm_hints field with exclude array"
  }
}
```

**Updated metadata:**
- `last_updated`: "2025-11-13"
- `api_version`: "v2.3.0 - Use breadcrumb-approve, breadcrumb-context-merge"
- `version_note`: "evolves via breadcrumb-context-merge" (not breadcrumb-update)

---

## 📊 What Tool-Creator Will Now Know

### Perfect Tool Template (All 3 Required Fields)

```typescript
{
  // TOP-LEVEL FIELDS (v2.2.0)
  "schema_name": "tool.code.v1",
  "title": "Calculator",  // Clean name
  "description": "Performs mathematical calculations safely",  // ← REQUIRED
  "semantic_version": "1.0.0",  // ← REQUIRED
  
  // TAGS (initial - no workspace:tools!)
  "tags": ["tool", "tool:calculator", "math", "utility"],
  
  // LLM_HINTS (v2.2.0 - exclude-only)
  "llm_hints": {  // ← REQUIRED
    "exclude": ["code", "permissions", "limits", "ui_schema"]
  },
  
  // CONTEXT (implementation details)
  "context": {
    "name": "calculator",
    "code": {
      "language": "typescript",
      "source": "export async function execute..."
    },
    "input_schema": {...},
    "output_schema": {...},
    "permissions": {...},
    "limits": {...},
    "required_secrets": [],
    "ui_schema": {...},
    "examples": [...]
  }
}
```

### What Changed From Old Knowledge

**BEFORE (incomplete):**
```json
{
  "title": "Tool (Self-Contained)",
  "tags": ["tool", "tool:name", "workspace:tools", "self-contained"],
  "context": {
    "description": "In context",  // ❌ Wrong location!
    "version": "1.0.0",  // ❌ Wrong location!
    ...
  }
}
```

**AFTER (correct v2.2.0):**
```json
{
  "title": "Tool Name",  // Clean
  "description": "Top-level",  // ✅ Correct!
  "semantic_version": "1.0.0",  // ✅ Correct!
  "tags": ["tool", "tool:name", "pointer-tags"],  // No workspace:tools
  "llm_hints": {"exclude": [...]},  // ✅ New requirement!
  "context": {
    "name": "toolname",  // No description/version here
    ...
  }
}
```

---

## ✅ Validation Checklist Now Complete

**Tool-creator will validate:**

1. ✅ Top-level `description` field present
2. ✅ Top-level `semantic_version` field present
3. ✅ Top-level `llm_hints` with exclude array
4. ✅ Tags: `tool`, `tool:name`, and pointer tags (NO workspace:tools)
5. ✅ `code.source` (not just `source`)
6. ✅ All output_schema properties have `type`
7. ✅ `required_secrets` array present
8. ✅ `ui_schema` object present
9. ✅ Examples show field access patterns
10. ✅ Permissions minimal (no ffi!)

---

## 🚀 Production Impact

**When tool-creator generates tools now:**
- ✅ Includes all 3 required top-level fields
- ✅ Uses exclude-only llm_hints
- ✅ Proper tag structure (no workspace:tools initially)
- ✅ Follows v2.2.0 spec exactly
- ✅ Validation-specialist will approve on first try!

**When validation-specialist validates:**
- ✅ Uses breadcrumb-approve (not complex breadcrumb-update)
- ✅ Knows about llm_hints requirement
- ✅ Checks for description/semantic_version

**When tool-debugger fixes errors:**
- ✅ Uses breadcrumb-context-merge (not full replacement)
- ✅ Only updates broken field
- ✅ Never loses data

---

**Knowledge base is now production-perfect for v2.2.0 + v2.3.0! 🎯**

