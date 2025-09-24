# Context View Architecture for RCRT

## Core Insight
The RCRT API provides two views of breadcrumbs:
- **Context View** (`/breadcrumbs/{id}`): Optimized for LLM consumption
- **Full View** (`/breadcrumbs/{id}/full`): Complete raw data

## Implementation Pattern

### 1. Tool Catalog Storage (Full View)
```json
{
  "schema_name": "tool.catalog.v1",
  "context": {
    "tools": [
      {
        "name": "openrouter",
        "description": "Access to 100+ LLM models",
        "inputSchema": { /* full JSON schema */ },
        "outputSchema": { /* full JSON schema */ },
        "capabilities": { /* all details */ }
      }
    ],
    "activeTools": 10,
    "totalTools": 10,
    "lastUpdated": "2025-09-23T01:44:30.602Z"
  }
}
```

### 2. Tool Catalog Context View (LLM-Optimized)
When accessed via `/breadcrumbs/{id}`, the server transforms it:

```json
{
  "schema_name": "tool.catalog.v1",
  "context": {
    "available_tools": "openrouter (llm), file-storage (storage), calculator (math), web_browser (web)",
    "tool_instructions": "You have 10 tools available. To use a tool, create a tool.request.v1 breadcrumb with the tool name and input parameters.",
    "tools_summary": [
      {
        "name": "openrouter",
        "usage": "For LLM queries: {\"messages\": [...], \"model\": \"optional\"}"
      },
      {
        "name": "file-storage", 
        "usage": "For files: {\"action\": \"store|retrieve|list\", \"filename\": \"...\", \"content\": \"...\"}"
      }
    ]
  }
}
```

### 3. Server-Side Transform Logic

```rust
// In RCRT server
fn transform_breadcrumb_for_context(bc: &Breadcrumb) -> Breadcrumb {
    match bc.schema_name.as_deref() {
        Some("tool.catalog.v1") => transform_tool_catalog(bc),
        Some("agent.memory.v1") => redact_sensitive_memory(bc),
        Some("user.profile.v1") => extract_relevant_profile(bc),
        _ => bc.clone() // Default: return as-is
    }
}

fn transform_tool_catalog(bc: &Breadcrumb) -> Breadcrumb {
    let tools = bc.context["tools"].as_array().unwrap_or(&vec![]);
    
    // Create LLM-friendly summary
    let mut context = json!({
        "available_tools": tools.iter()
            .map(|t| format!("{} ({})", t["name"], t["category"]))
            .join(", "),
        "tool_instructions": format!(
            "You have {} tools available. To use a tool, create a tool.request.v1 breadcrumb.",
            tools.len()
        ),
        "tools_summary": tools.iter().map(|t| json!({
            "name": t["name"],
            "usage": generate_usage_hint(t)
        })).collect::<Vec<_>>()
    });
    
    Breadcrumb {
        context,
        ..bc.clone()
    }
}
```

## Benefits

1. **Single Source of Truth**: Tool catalog stores complete data
2. **API-Level Intelligence**: Transformation happens at the right layer
3. **Consistency**: All agents get the same optimized view
4. **Flexibility**: Can customize transforms per schema type
5. **Token Efficiency**: LLMs only see what they need

## Agent Simplification

Now agents just need:
```typescript
// Fetch tool catalog (automatically gets context view)
const toolCatalog = await client.getBreadcrumb(catalogId);

// Use it directly in prompt
messages.push({
  role: 'system',
  content: `Tools: ${toolCatalog.context.tool_instructions}`
});
```

## Schema-Specific Transforms

Different schemas get different context transforms:
- `tool.catalog.v1` → Concise tool list + instructions
- `agent.memory.v1` → Key memories without implementation details  
- `file.storage.v1` → File metadata without base64 content
- `webhook.config.v1` → Endpoint info without secrets

## Migration Path

1. Update RCRT server to implement context transforms
2. Remove ToolPromptAdapter from agents
3. Agents fetch breadcrumbs normally and trust the context view
4. Full view remains available for debugging/admin
