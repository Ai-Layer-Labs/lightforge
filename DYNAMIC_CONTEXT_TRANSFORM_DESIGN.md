# Dynamic Context Transform Design

## Option 1: Transform Metadata in Breadcrumbs

Each breadcrumb can include a `context_transform` field:

```json
{
  "schema_name": "tool.catalog.v1",
  "title": "Tool Catalog",
  "context": {
    "tools": [...full tool data...]
  },
  "context_transform": {
    "type": "jq",
    "query": ".tools | map({name, description}) | {available_tools: map(\"\\(.name): \\(.description)\") | join(\"\\n\"), count: length}"
  }
}
```

Or using JSONPath:
```json
{
  "context_transform": {
    "type": "jsonpath",
    "mappings": {
      "available_tools": "$.tools[*].name",
      "descriptions": "$.tools[*].description",
      "count": "$.tools.length"
    }
  }
}
```

Or using a template:
```json
{
  "context_transform": {
    "type": "template",
    "template": "You have {{tools.length}} tools available:\n{{#each tools}}- {{name}}: {{description}}\n{{/each}}"
  }
}
```

## Option 2: Schema Transform Breadcrumbs

Create special breadcrumbs that define transforms for schemas:

```json
{
  "schema_name": "schema.transform.v1",
  "title": "Tool Catalog Transform",
  "tags": ["schema:transform", "for:tool.catalog.v1"],
  "context": {
    "target_schema": "tool.catalog.v1",
    "transform": {
      "type": "javascript",
      "code": `
        function transform(context) {
          const tools = context.tools || [];
          return {
            available_tools: tools.map(t => \`\${t.name}: \${t.description}\`).join('\\n'),
            tool_count: tools.length,
            categories: [...new Set(tools.map(t => t.category))],
            usage: 'Create tool.request.v1 breadcrumb to invoke'
          };
        }
      `
    }
  }
}
```

## Option 3: Hybrid - Transform Hints + Defaults

Breadcrumbs can include optional transform hints:

```json
{
  "schema_name": "tool.catalog.v1",
  "context": {...},
  "llm_hints": {
    "summarize": ["tools"],
    "include": ["activeTools", "lastUpdated"],
    "format": "list"
  }
}
```

Server applies smart defaults based on hints:
- `summarize`: Create concise version of arrays/objects
- `include`: Only include specified fields
- `exclude`: Remove specified fields
- `format`: Apply formatting (list, table, prose)

## Implementation in RCRT Server

```rust
async fn get_breadcrumb_context(breadcrumb: &Breadcrumb) -> JsonValue {
    // 1. Check for inline transform
    if let Some(transform) = breadcrumb.context.get("context_transform") {
        return apply_transform(transform, &breadcrumb.context);
    }
    
    // 2. Check for schema transform breadcrumb
    if let Some(schema_name) = &breadcrumb.schema_name {
        if let Some(transform_bc) = find_transform_for_schema(schema_name).await {
            return apply_transform(&transform_bc.context.transform, &breadcrumb.context);
        }
    }
    
    // 3. Apply hints if present
    if let Some(hints) = breadcrumb.context.get("llm_hints") {
        return apply_hints(hints, &breadcrumb.context);
    }
    
    // 4. Default: return as-is
    breadcrumb.context.clone()
}
```

## Example: Tool Catalog with Transform

```javascript
// When creating tool catalog
await client.createBreadcrumb({
  schema_name: "tool.catalog.v1",
  title: "Available Tools",
  context: {
    tools: [...],
    // This defines how LLMs see it
    context_transform: {
      type: "extract",
      fields: {
        "tool_list": "$.tools[*].name",
        "tool_help": {
          template: "{{tools.length}} tools: {{#each tools}}{{name}} {{/each}}"
        },
        "usage": {
          literal: "Create tool.request.v1 with tool name and input"
        }
      }
    }
  }
});
```

## Benefits

1. **Fully Data-Driven**: No hardcoded server logic
2. **Flexible**: Each breadcrumb can define its own transform
3. **Versionable**: Schema transforms are just breadcrumbs
4. **Extensible**: Add new transform types without server changes
5. **Discoverable**: Agents can see how data will be transformed

## Transform Types

1. **JQ**: Powerful JSON query language
2. **JSONPath**: Simple path extraction
3. **Template**: Handlebars/Mustache templates
4. **JavaScript**: Full JS functions (sandboxed)
5. **Extract**: Field mapping with literals
6. **XSLT-like**: For complex transforms

## Migration Path

1. Start with `llm_hints` (easiest)
2. Add support for inline `context_transform`
3. Implement schema transform breadcrumbs
4. Gradually move transforms from code to data
