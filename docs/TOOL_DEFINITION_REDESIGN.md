# Tool Definition Redesign - The RCRT Way

## Current Problem
Tools are registered in memory and a centralized catalog is created. This violates RCRT principles:
- Tools don't publish their own definitions as breadcrumbs
- No way to discover tools dynamically
- Catalog is built from memory, not from breadcrumbs

## Proposed Solution: Tool Definition Breadcrumbs

### 1. Each Tool Publishes Its Definition
```json
{
  "schema_name": "tool.definition.v1",
  "title": "Random Number Generator Tool",
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
        "numbers": { "type": "array", "items": { "type": "number" } }
      }
    },
    "examples": [
      {
        "title": "Generate single number",
        "input": { "min": 1, "max": 10 },
        "output": { "numbers": [7] }
      },
      {
        "title": "Generate multiple",
        "input": { "min": 0, "max": 100, "count": 3 },
        "output": { "numbers": [42, 73, 15] }
      }
    ],
    "capabilities": {
      "async": true,
      "timeout": 30000,
      "retries": 0
    },
    "llm_hints": {
      "usage": "Use ${stepId}.numbers[0] to access first number",
      "common_patterns": [
        "Generate two numbers and add: ${num1.numbers[0]} + ${num2.numbers[0]}",
        "Generate array: returns { numbers: [...] }"
      ]
    }
  }
}
```

### 2. Tool Catalog Discovers Definitions
Instead of building from memory, the catalog should:
```javascript
// Search for all tool definitions
const toolDefs = await client.searchBreadcrumbs({
  schema_name: 'tool.definition.v1',
  tag: 'workspace:tools'
});

// Build catalog from breadcrumbs
const catalog = await Promise.all(
  toolDefs.map(def => client.getBreadcrumb(def.id))
);
```

### 3. Dynamic Tool Discovery
- Tools can be added/removed at runtime
- No restart needed
- Tools from different sources can participate
- Versioning through breadcrumb history

### 4. Tool-Specific Hints
Each tool can provide:
- Usage examples with actual field names
- Common patterns
- Output structure explanation
- Integration tips

### 5. Agent Discovery Flow
1. Agent searches for `tool.catalog.v1` OR `tool.definition.v1` breadcrumbs
2. For each tool, agent sees:
   - Full input/output schemas
   - Examples showing exact field access
   - LLM hints for common patterns
3. Agent learns from examples, not hardcoded instructions

## Benefits
- **True RCRT**: Everything is a breadcrumb
- **Dynamic**: Tools can come and go
- **Self-Documenting**: Tools explain themselves
- **No Hardcoding**: Agent learns from breadcrumbs
- **Extensible**: Any system can add tools

## Implementation Steps
1. Update RCRTToolWrapper to create definition breadcrumbs
2. Change ToolRegistry to search for definitions
3. Add examples and llm_hints to tool definitions
4. Update agent to look for examples in tool definitions
5. Remove hardcoded tool names from all prompts

This makes the tool system truly RCRT-native!
