# Back to RCRT Principles - Deep Investigation Results

## What We Found Wrong

### ❌ The Hack: ToolPromptAdapter
```javascript
// Agent code was doing this:
const fullCatalog = await getBreadcrumb(catalogId);
const toolPrompt = ToolPromptAdapter.generateToolPrompt(fullCatalog);  // ← BYPASS!

// This BYPASSES RCRT's transformation system!
```

**Why this is wrong:**
- Transforms context in application code
- Ignores llm_hints in the breadcrumb
- Duplicates what RCRT backend already does
- Adds unnecessary complexity

### ✅ The RCRT Way

```javascript
// 1. Catalog has llm_hints
{
  "schema_name": "tool.catalog.v1",
  "context": {
    "tools": [...],
  },
  "llm_hints": {
    "transform": {
      "tool_list": {
        "type": "template",
        "template": "{{#each context.tools}}...{{examples}}...{{/each}}"
      }
    }
  }
}

// 2. Agent calls RCRT API
const catalog = await rcrtClient.getBreadcrumb(catalogId);

// 3. RCRT backend (main.rs lines 588-616):
async fn get_breadcrumb_context(...) {
  let view = db.get_breadcrumb(...);
  
  // Apply llm_hints if present
  if let Some(hints) = view.context.get("llm_hints") {
    let engine = TransformEngine::new();
    view.context = engine.apply_llm_hints(&view.context, &hints)?;
  }
  
  Ok(Json(view))  // ← Returns transformed context!
}

// 4. Agent gets transformed context
catalog.context.tool_list  // ← Already transformed by backend!
```

## The RCRT Architecture (As Designed)

### Primitive 1: Breadcrumbs Store Everything
```json
{
  "context": {
    "data": "...",
    "examples": [...],
    "schemas": {...}
  },
  "llm_hints": {  // ← Transformation rules
    "transform": {
      "field_name": {
        "type": "template",
        "template": "..."
      }
    }
  }
}
```

### Primitive 2: RCRT Backend Transforms
```rust
// When you GET a breadcrumb:
fn get_breadcrumb_context() {
  let bc = database.get(id);
  
  if bc.has_llm_hints() {
    bc.context = TransformEngine.apply(bc.context, bc.llm_hints);
  }
  
  return bc.context;  // Already transformed!
}
```

### Primitive 3: Agents Use Transformed Context
```javascript
// Agent just reads the transformed data
const catalog = await getBreadcrumb(id);
const toolList = catalog.context.tool_list;  // ← Simple!

// No adapter, no manual transformation, no complexity
```

## What We Fixed

### 1. Catalog llm_hints Template (bootstrap-tools.ts)

**Before:**
```javascript
template: '{{#each tools}}- {{name}}: {{description}}\n{{/each}}'
// ❌ No examples, no output schemas
```

**After:**
```javascript
template: `{{#each context.tools}}
**{{category}}**: {{name}}
  {{description}}
  Output fields: {{#each outputSchema.properties}}{{@key}}{{/each}}
  
  {{#if examples}}
  Example:
    Input: {{{json examples.[0].input}}}
    Output: {{{json examples.[0].output}}}
    → {{examples.[0].explanation}}
  {{/if}}
{{/each}}`
// ✅ Complete information!
```

### 2. Removed ToolPromptAdapter (agent-executor.ts)

**Before:**
```javascript
import { ToolPromptAdapter } from './tool-prompt-adapter';
const toolPrompt = ToolPromptAdapter.generateToolPrompt(fullCatalog);
// ❌ Manual transformation
```

**After:**
```javascript
// No import needed!
const catalog = await rcrtClient.getBreadcrumb(catalogId);
const toolList = catalog.context.tool_list;
// ✅ RCRT backend already transformed it!
```

### 3. Removed Export (index.ts)

**Before:**
```javascript
export { ToolPromptAdapter } from './tool-prompt-adapter';
// ❌ Exposing the hack
```

**After:**
```javascript
// Removed! Not needed!
// ✅ Clean API
```

## The Simple Flow (As Designed)

```
1. Tool breadcrumb created
   └─ Has examples in definition
   
2. Catalog aggregates tools
   └─ Includes examples
   └─ Has llm_hints template
   
3. Agent calls getBreadcrumb(catalogId)
   └─ RCRT backend applies llm_hints
   └─ Returns transformed context
   
4. Agent reads context.tool_list
   └─ Has examples!
   └─ Has output fields!
   └─ Has explanations!
   
5. Agent uses correct syntax
   └─ Learned from examples
   └─ No guessing needed
```

## Benefits of The RCRT Way

1. **Simple** - No adapters, no manual transforms
2. **Consistent** - All transformations in one place (backend)
3. **Flexible** - Change template without code changes
4. **Powerful** - Handlebars, JSONPath, templates all available
5. **RCRT-Native** - Uses the system as designed

## The Key Insight

**The RCRT backend ALREADY has a transformation engine!**

Lines from `crates/rcrt-server/src/main.rs`:
```rust
// Line 588-616: get_breadcrumb_context
if let Some(hints_value) = view.context.get("llm_hints") {
    match serde_json::from_value::<transforms::LlmHints>(hints_value) {
        Ok(hints) => {
            let engine = transforms::TransformEngine::new();
            match engine.apply_llm_hints(&view.context, &hints) {
                Ok(transformed) => {
                    view.context = transformed;  // ← TRANSFORMS IT!
                }
            }
        }
    }
}
```

**We just weren't using it!**

## The Fix Summary

✅ Added examples to catalog llm_hints template  
✅ Removed ToolPromptAdapter entirely  
✅ Agent now gets transformed context from RCRT backend  
✅ Back to simple, clean RCRT architecture

## Expected After Deploy

Agent will receive:
```
**general**: random
  Generate random numbers
  Output fields: numbers
  
  Example:
    Input: {"min":1,"max":10}
    Output: {"numbers":[7]}
    → Access the number with result.numbers[0]
```

Agent will use: `${stepId.numbers[0]}` ✅ Correct!

**This is the RCRT way!** 🎯

