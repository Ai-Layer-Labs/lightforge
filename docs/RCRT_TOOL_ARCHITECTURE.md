# RCRT-Native Tool Architecture

## Current State (NOT RCRT)
- Tools register in memory with ToolRegistry
- Single centralized catalog breadcrumb
- No individual tool definition breadcrumbs
- Catalog built from memory, not breadcrumbs

## Proper RCRT Architecture

### 1. Tool Definition Breadcrumbs
Each tool should create its own definition breadcrumb:

```json
{
  "schema_name": "tool.definition.v1",
  "id": "tool-def-random",
  "title": "Random Number Generator",
  "tags": ["tool:definition", "workspace:tools", "category:general"],
  "context": {
    "name": "random",
    "version": "1.0.0",
    "description": "Generate random numbers",
    "category": "general",
    "inputSchema": {
      "type": "object",
      "properties": {
        "min": { "type": "number", "default": 0 },
        "max": { "type": "number", "default": 100 },
        "count": { "type": "number", "default": 1 }
      }
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "numbers": { 
          "type": "array", 
          "items": { "type": "number" },
          "description": "Array of generated numbers"
        }
      }
    },
    "examples": [
      {
        "description": "Generate single number",
        "input": { "min": 1, "max": 10 },
        "output": { "numbers": [7] },
        "usage": "Access with: result.numbers[0]"
      }
    ]
  }
}
```

### 2. Tool Configuration Breadcrumbs
For configurable tools (already exists):

```json
{
  "id": "openrouter",
  "schema_name": "tool.config.v1",
  "version": "v1.0.0",
  "tags": ["tool:config", "tool:config:openrouter"],
  "context": {
    "tool": "openrouter",
    "config": {
      "apiKey": "secret:openrouter-api-key",
      "defaultModel": "google/gemini-2.5-flash",
      "temperature": 0.7,
      "maxTokens": 4000
    }
  }
}
```

### 3. Dynamic Catalog Generation
The catalog should be built from breadcrumbs:

```javascript
async function buildCatalogFromBreadcrumbs(client) {
  // 1. Find all tool definitions
  const toolDefs = await client.searchBreadcrumbs({
    schema_name: 'tool.definition.v1',
    tag: 'workspace:tools'
  });
  
  // 2. Get full details
  const tools = await Promise.all(
    toolDefs.map(async (def) => {
      const fullDef = await client.getBreadcrumb(def.id);
      
      // 3. Check if tool has configuration
      const configSearch = await client.searchBreadcrumbs({
        tag: `tool:config:${fullDef.context.name}`
      });
      
      return {
        ...fullDef.context,
        hasConfig: configSearch.length > 0,
        configId: configSearch[0]?.id
      };
    })
  );
  
  // 4. Create/update catalog
  return {
    schema_name: 'tool.catalog.v1',
    title: 'Tool Catalog',
    tags: ['tool:catalog', 'workspace:tools'],
    context: {
      tools,
      totalTools: tools.length,
      lastUpdated: new Date().toISOString()
    }
  };
}
```

### 4. Tool Lifecycle

#### Tool Registration
1. Tool creates `tool.definition.v1` breadcrumb
2. Tool optionally creates `tool.config.v1` breadcrumb
3. Catalog aggregator discovers new tool
4. Catalog breadcrumb updated

#### Tool Discovery (by agents)
1. Agent searches for `tool.catalog.v1` OR
2. Agent searches for `tool.definition.v1` breadcrumbs directly
3. Agent reads examples to understand usage
4. Agent uses exact field names from outputSchema

#### Tool Configuration
1. UI reads `tool.definition.v1` to show configuration schema
2. User configures tool
3. Configuration saved as `tool.config.v1` breadcrumb
4. Tool reads its config on execution

## Benefits of RCRT-Native Approach

1. **Dynamic Discovery** - Tools can be added/removed without restart
2. **Self-Documenting** - Each tool explains its usage with examples
3. **Versioning** - Tool definitions have version history
4. **Distributed** - Tools can come from any source
5. **Observable** - All changes create events
6. **No Central Registry** - True decentralization

## Migration Path

1. Update RCRTToolWrapper to create `tool.definition.v1` breadcrumbs
2. Add examples to tool definitions showing field access
3. Update catalog to aggregate from breadcrumbs
4. Update agent prompts to look for examples
5. Gradually deprecate in-memory registry

This makes tools first-class RCRT citizens!
