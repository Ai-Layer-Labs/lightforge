# Dynamic Context Transform Implementation Guide

## Overview

Make breadcrumbs self-describing for LLM consumption by embedding transform metadata directly in the data.

## Three Implementation Approaches

### 1. Inline Transform Hints (Simplest)

Add `llm_hints` field to any breadcrumb:

```javascript
// When creating tool catalog
await client.createBreadcrumb({
  schema_name: 'tool.catalog.v1',
  title: 'Tool Catalog',
  context: {
    tools: [...full tool data...],
    activeTools: 10
  },
  llm_hints: {
    transform: {
      summary: {
        type: 'template',
        template: '{{context.activeTools}} tools: {{#each context.tools}}{{name}} {{/each}}'
      }
    },
    mode: 'replace'  // Context view shows only transformed fields
  }
});
```

**Benefits:**
- ✅ Works immediately, no server changes needed
- ✅ Each breadcrumb controls its own presentation
- ✅ Easy to experiment and iterate

### 2. Schema Transform Breadcrumbs (Most Flexible)

Define transforms as separate breadcrumbs:

```javascript
// Create transform definition once
await client.createBreadcrumb({
  schema_name: 'schema.transform.v1',
  title: 'Tool Catalog Transform',
  tags: ['schema:transform', 'target:tool.catalog.v1'],
  context: {
    target_schema: 'tool.catalog.v1',
    transforms: [
      {
        name: 'default',
        type: 'jq',
        expression: '{tools: .tools | map({name, description}), count: .tools | length}'
      },
      {
        name: 'minimal', 
        type: 'template',
        template: 'Tools: {{#each tools}}{{name}}{{#unless @last}}, {{/unless}}{{/each}}'
      }
    ]
  }
});
```

**Benefits:**
- ✅ Centralized transform management
- ✅ Multiple transform variants per schema
- ✅ Transforms are versionable breadcrumbs

### 3. Server Default Transforms (Fallback)

Server applies smart defaults when no hints exist:

```rust
// In RCRT server
fn default_transform(schema: &str, context: &Value) -> Value {
  match schema {
    "tool.catalog.v1" => extract_tool_summary(context),
    "file.storage.v1" => remove_base64_content(context),
    "agent.memory.v1" => summarize_memories(context),
    _ => context.clone()
  }
}
```

## Implementation Phases

### Phase 1: Client-Side (Immediate)
1. Update `ToolRegistry` to add `llm_hints` to catalog
2. Update `AgentExecutor` to check for hints
3. Use `ToolPromptAdapter` as fallback

### Phase 2: Server-Side (Next Sprint)
1. Modify `get_breadcrumb_context` to process `llm_hints`
2. Add transform execution engine (template, jq, jsonpath)
3. Implement caching for transformed views

### Phase 3: Schema Registry (Future)
1. Create UI for managing schema transforms
2. Add transform validation and testing
3. Build transform marketplace

## Example: Updated Tool Catalog

```json
{
  "schema_name": "tool.catalog.v1",
  "context": {
    "tools": [/* full tool definitions */]
  },
  "llm_hints": {
    "transform": {
      "summary": {
        "type": "template", 
        "template": "Available tools: {{#each context.tools}}{{name}} {{/each}}"
      },
      "by_category": {
        "type": "jq",
        "query": ".tools | group_by(.category) | map({(.[0].category): map(.name)})"
      }
    },
    "mode": "replace"
  }
}
```

When accessed via `/breadcrumbs/{id}`, returns:
```json
{
  "context": {
    "summary": "Available tools: openrouter file-storage calculator",
    "by_category": {
      "llm": ["openrouter"],
      "storage": ["file-storage"],
      "math": ["calculator"]
    }
  }
}
```

## Migration Strategy

1. **Today**: Add `llm_hints` to tool catalog (client-side)
2. **Next Week**: Server recognizes and applies hints
3. **Next Month**: Schema transform registry
4. **Future**: Remove hardcoded transforms

## Benefits

- 🎯 **Data-Driven**: Transforms live with data
- 🔄 **Flexible**: Change without code deployment  
- 📚 **Discoverable**: Agents can see transform rules
- 🚀 **Incremental**: Works today, improves tomorrow
