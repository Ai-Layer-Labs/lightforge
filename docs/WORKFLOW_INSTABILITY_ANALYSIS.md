# Workflow Instability - Root Cause Analysis

## The Pattern

**Success Rate:** ~50% (2 out of ~8 attempts)

**When it works:**
```json
{
  "tool": "workflow",
  "input": {
    "steps": [...]  // ✅ Correct structure
  }
}
```

**When it fails:**
```json
// Error 1: "steps.map is not a function"
{
  "tool": "workflow",
  "input": {
    "workflow": {  // ❌ Extra nesting!
      "steps": [...]
    }
  }
}

// Error 2: "random_number_1 is not defined"  
{
  "tool": "workflow",
  "input": {
    "steps": [
      { "id": "random_number_1", ... },
      { 
        "id": "add",
        "input": {
          "expression": "${wrong_field_path}"  // ❌ Bad field access
        }
      }
    ]
  }
}

// Error 3: "Cannot read properties of undefined"
{
  "tool": "workflow",
  "input": undefined  // ❌ No input at all!
}
```

## Root Cause: LLM Inconsistency

The agent (powered by gemini-2.5-flash) is **inconsistent** in structuring workflow requests:

1. Sometimes wraps in `{ workflow: { steps: [...] } }`
2. Sometimes uses wrong field names
3. Sometimes sends malformed input

## Why This Happens

### The Agent Doesn't Have the Examples!

Looking at the logs:
```
⚠️ Tool catalog found but no transformed context (llm_hints may not be applied)
```

**The llm_hints transformation is STILL failing!**

Even with the simplified template, the backend isn't creating the `tool_list` field.

**This means the agent is BLIND** - it doesn't see:
- Output schema fields
- Examples
- Explanations

**So it's guessing!**

## The Fixes Applied

### 1. Input Validation (Just Added)
```javascript
if (!input.steps || !Array.isArray(input.steps)) {
  throw new Error(`Invalid workflow input: steps must be an array, got ${typeof input.steps}`);
}
```

**This will catch:** Extra nesting, wrong structure

### 2. Null Safety in extractDependencies (Just Added)
```javascript
if (!input || typeof input !== 'object') {
  return [];
}
```

**This will catch:** Undefined inputs

### 3. Simplified llm_hints Template (Just Did)
Removed `{{{json ...}}}` helper that doesn't exist

## Why It Still Fails

**The llm_hints transformation is STILL not working!**

Possible reasons:
1. Template syntax still wrong
2. Backend Handlebars version incompatible
3. Transformation engine has a bug
4. llm_hints not in right place in breadcrumb

## Next Steps to Debug

### 1. Test llm_hints Manually
```bash
# Check if backend can parse the template
curl http://localhost:8081/breadcrumbs/{catalog-id}
# Should have tool_list field if transformation worked
```

### 2. Check Backend Logs
```bash
docker compose logs rcrt | grep -i "transform\|llm_hints"
```

### 3. Simplify Template Further
Try the absolute simplest template:
```javascript
{
  "transform": {
    "tool_list": {
      "type": "literal",
      "literal": "Test: transformation works!"
    }
  }
}
```

If this appears → transformation engine works, template is the issue  
If this doesn't appear → transformation engine is broken

## Temporary Workaround

Until llm_hints work, we could:
1. Add examples directly to system prompt (hack but works)
2. Create a separate examples breadcrumb
3. Use the simplified tool list without transformations

**But the real fix is: Make llm_hints transformation work in the backend!**

The instability will continue until the agent can SEE the examples.

