# RCRT Context Transform Implementation Proposal

## Current State
- `/breadcrumbs/{id}` returns raw context (no transformation)
- `/breadcrumbs/{id}/full` returns raw context + extra metadata
- No LLM optimization happening at API level

## Proposed Implementation

### 1. Server-Side Context Transform
```rust
// In rcrt-core/src/db.rs
impl Database {
    async fn get_breadcrumb_context_conn(&self, conn: &mut PgConnection, id: Uuid) -> Result<Option<BreadcrumbContextView>> {
        let rec = /* fetch from DB */;
        
        Ok(rec.map(|r| {
            let transformed_context = match r.schema_name.as_deref() {
                Some("tool.catalog.v1") => transform_tool_catalog(&r.context),
                Some("agent.memory.v1") => redact_sensitive_memory(&r.context),
                Some("file.storage.v1") => extract_file_metadata(&r.context),
                _ => r.context.clone()
            };
            
            BreadcrumbContextView {
                id: r.id,
                title: r.title,
                context: transformed_context,
                tags: r.tags,
                version: r.version,
                updated_at: r.updated_at,
            }
        }))
    }
}
```

### 2. Tool Catalog Transform Example
```rust
fn transform_tool_catalog(context: &JsonValue) -> JsonValue {
    let tools = context["tools"].as_array().unwrap_or(&vec![]);
    
    json!({
        "available_tools": tools.iter()
            .map(|t| format!("{}: {}", t["name"], t["description"]))
            .collect::<Vec<_>>()
            .join("\n"),
        "tool_count": tools.len(),
        "usage": "To use a tool, create a tool.request.v1 breadcrumb with 'tool' and 'input' fields.",
        "categories": tools.iter()
            .filter_map(|t| t["category"].as_str())
            .collect::<HashSet<_>>()
            .into_iter()
            .collect::<Vec<_>>()
    })
}
```

### 3. File Storage Transform Example
```rust
fn extract_file_metadata(context: &JsonValue) -> JsonValue {
    // Remove base64 content, keep only metadata
    json!({
        "filename": context["filename"],
        "mime_type": context["mime_type"],
        "size_bytes": context["size_bytes"],
        "created_at": context["created_at"],
        "file_type": context["file_type"],
        // Omit the actual content field
    })
}
```

## Benefits

1. **Proper Separation**: Raw data in DB, transformed data for LLMs
2. **Token Efficiency**: LLMs only see what they need
3. **Consistency**: All agents get same optimized view
4. **Security**: Sensitive data can be redacted in context view
5. **Backwards Compatible**: Full view remains unchanged

## Agent Usage

```typescript
// Simple - just fetch and use
const toolCatalog = await client.getBreadcrumb(catalogId);
// toolCatalog.context is already LLM-optimized!

messages.push({
  role: 'system',
  content: `Available tools:\n${toolCatalog.context.available_tools}`
});
```

## Implementation Steps

1. Add transform functions to rcrt-core
2. Update get_breadcrumb_context_conn to use transforms
3. Remove ToolPromptAdapter from agents
4. Update agent to use context view directly

## Schema Registry

Could maintain a registry of transform functions:
```rust
lazy_static! {
    static ref CONTEXT_TRANSFORMS: HashMap<&'static str, fn(&JsonValue) -> JsonValue> = {
        let mut m = HashMap::new();
        m.insert("tool.catalog.v1", transform_tool_catalog);
        m.insert("agent.memory.v1", redact_sensitive_memory);
        m.insert("file.storage.v1", extract_file_metadata);
        m
    };
}
```
