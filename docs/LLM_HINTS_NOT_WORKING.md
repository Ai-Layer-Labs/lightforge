# Critical Issue: llm_hints Transformation Not Working

## The Problem

```
⚠️ Tool catalog found but no transformed context (llm_hints may not be applied)
```

**The RCRT backend is NOT applying llm_hints transformations!**

## What Should Happen

### 1. Catalog Has llm_hints
```json
{
  "context": {
    "tools": [...],
    "activeTools": 10
  },
  "llm_hints": {
    "transform": {
      "tool_list": {
        "type": "template",
        "template": "{{#each context.tools}}...{{/each}}"
      }
    }
  }
}
```

### 2. Agent Calls GET /breadcrumbs/{id}
```javascript
const catalog = await getBreadcrumb(catalogId);
```

### 3. Backend Should Apply llm_hints
```rust
// crates/rcrt-server/src/main.rs lines 588-616
async fn get_breadcrumb_context() {
  let view = db.get_breadcrumb(...);
  
  if let Some(hints) = view.context.get("llm_hints") {
    let engine = TransformEngine::new();
    view.context = engine.apply_llm_hints(&view.context, &hints)?;
  }
  
  return view;  // Should have tool_list field!
}
```

### 4. Agent Should Receive
```json
{
  "context": {
    "tool_list": "Transformed text with examples",  // ← Created by template
    "available_tools": ["random", "calculator", ...],  // ← Created by extract
    "tools": [...],  // ← Original (if mode=merge)
    "activeTools": 10
  }
}
```

## What's Actually Happening

```
Agent calls getBreadcrumb(catalogId)
  ↓
Backend applies llm_hints
  ↓
❌ Template FAILS (probably {{{json ...}}} helper doesn't exist)
  ↓
Backend returns untransformed context
  ↓
Agent gets: { tools: [...], activeTools: 10 }
Agent doesn't get: tool_list (the transformed field)
  ↓
Warning: "llm_hints may not be applied"
```

## Why Template Fails

The template used:
```handlebars
{{{json this.examples.[0].input}}}
```

**Problem:** Handlebars doesn't have a built-in `json` helper!

## The Fixes

### Fix 1: Simplified Template (Just Did This)
```handlebars
{{#each context.tools}}
• {{name}}: {{description}}
  Output: {{#each outputSchema.properties}}{{@key}}{{/each}}
  {{#if examples}}{{#if examples.[0]}}Example: {{examples.[0].explanation}}{{/if}}{{/if}}
{{/each}}
```

**Uses only:** Standard Handlebars helpers (each, if, unless)

### Fix 2: Register json Helper in Backend
```rust
// In transforms.rs
impl TransformEngine {
  pub fn new() -> Self {
    let mut handlebars = Handlebars::new();
    
    // Register json helper
    handlebars.register_helper("json", Box::new(|h: &Helper, _: &Handlebars, _: &Context, _: &mut RenderContext, out: &mut dyn Output| -> HelperResult {
      let param = h.param(0).unwrap();
      let json_str = serde_json::to_string_pretty(param.value()).unwrap();
      out.write(&json_str)?;
      Ok(())
    }));
    
    Self { handlebars }
  }
}
```

### Fix 3: Don't Use Templates
```javascript
// Instead of template, use extract for each field
{
  "transform": {
    "tool_names": {
      "type": "extract",
      "value": "$.tools[*].name"
    },
    "tool_examples": {
      "type": "extract",
      "value": "$.tools[*].examples[0].explanation"
    }
  }
}
```

## Immediate Solution

**Rebuild with simplified template:**

```bash
pnpm install
pnpm --filter "@rcrt-builder/tools" build
docker compose build
docker compose up -d
```

The simplified template should work with standard Handlebars!

## Long-term Solution

Add `json` helper to backend's Handlebars instance in `transforms.rs`.

## Test

After deploying, check agent-runner logs for:
```
✅ Tool catalog loaded with transformed context
```

Instead of:
```
⚠️ Tool catalog found but no transformed context
```

If it still warns → backend transformation is broken
If it succeeds → agent will finally see the examples!

