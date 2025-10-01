# Bootstrap Breadcrumbs

This directory contains the essential breadcrumbs needed to bootstrap an RCRT system.

## Directory Structure

```
bootstrap-breadcrumbs/
├── system/                    # Core system breadcrumbs
│   ├── bootstrap-marker.json  # Marks system as bootstrapped
│   ├── default-chat-agent.json # Default chat agent definition
│   ├── tool-catalog-bootstrap.json # Initial tool catalog (deprecated)
│   ├── tool-definition-template.json # Template for tool.v1 breadcrumbs
│   ├── tool-creation-guide.json # Guide for creating RCRT tools
│   ├── random-tool-definition.json # Example tool definition
│   └── openrouter-tool-definition.json # Example configurable tool
└── templates/                 # Templates and guides
    ├── agent-definition-template.json
    └── llm-hints-guide.json
```

## New Tool System (RCRT-Native)

### Tool Breadcrumbs (tool.v1)

Tools are now first-class breadcrumbs that combine definition and configuration:

```json
{
  "schema_name": "tool.v1",
  "tags": ["tool", "tool:{name}", "category:{category}"],
  "context": {
    "name": "tool-name",
    "definition": {
      "inputSchema": {},
      "outputSchema": {},
      "examples": []  // CRITICAL: Show field access patterns
    },
    "configuration": {
      "configurable": true/false,
      "configSchema": {},
      "currentConfig": {}
    }
  }
}
```

### Tool Discovery Flow

1. **Tool Creation**: Create a `tool.v1` breadcrumb
2. **Catalog Discovery**: Catalog aggregator finds new tools
3. **Agent Usage**: Agents read catalog or search tool.v1 directly
4. **Dynamic Updates**: Tools can be added/removed at runtime

### Key Principles

1. **Everything is a breadcrumb** - No in-memory registries
2. **Self-documenting** - Tools include examples showing field access
3. **Configuration included** - Single breadcrumb for definition + config
4. **Dynamic discovery** - Search breadcrumbs, not memory

## Bootstrap Process

1. System creates core breadcrumbs from `system/` directory
2. Tool definitions are created as `tool.v1` breadcrumbs
3. Catalog is built by aggregating tool breadcrumbs
4. Agents discover tools through catalog or direct search

## Migration from Old System

Old system:
- Tools registered in memory
- Catalog built from memory
- No individual tool breadcrumbs

New system:
- Tools are breadcrumbs
- Catalog aggregates from breadcrumbs
- Dynamic discovery

## Creating a New Tool

1. Copy `tool-definition-template.json`
2. Fill in your tool's details
3. Add examples showing output field access
4. Create as `tool.v1` breadcrumb
5. Tool is automatically discovered!

## Important Notes

- The `outputSchema` MUST include descriptions
- Examples MUST show how to access output fields
- For workflows, show ${stepId.field} syntax
- Configuration is optional but included in same breadcrumb