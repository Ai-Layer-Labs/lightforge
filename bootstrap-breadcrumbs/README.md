# Bootstrap Breadcrumbs

**SINGLE SOURCE OF TRUTH for all RCRT bootstrap data**

This directory contains ALL breadcrumbs needed to bootstrap an RCRT system.

## ⚠️ IMPORTANT: No Hardcoding Policy

- ✅ All agents defined in `system/*.json`
- ✅ All tools defined in `tools/*.json`
- ✅ All templates in `templates/*.json`
- ❌ NO hardcoded fallbacks in code
- ❌ NO duplicate definitions elsewhere
- ❌ NO inline JSON in scripts

**If it's not here, it doesn't exist in the system!**

## Directory Structure

```
bootstrap-breadcrumbs/
├── system/                    # Core system breadcrumbs (agents, configs)
│   ├── bootstrap-marker.json  # Marks system as bootstrapped
│   └── default-chat-agent.json # THE ONLY agent definition (single source)
├── tools/                     # Tool definitions (tool.v1)
│   ├── openrouter.json        # OpenRouter LLM tool
│   ├── calculator.json        # Calculator utility
│   ├── random.json            # Random number generator
│   ├── context-builder.json   # Context assembly tool
│   └── ... (add more as JSON files, not code!)
├── templates/                 # Templates for users to copy
│   ├── agent-definition-template.json
│   └── tool-definition-template.json
├── bootstrap.js               # THE ONLY bootstrap script
├── package.json
└── README.md                  # This file
```

## How to Add New Breadcrumbs

### Add a New Agent
1. Create `system/my-agent.json` with schema `agent.def.v1`
2. Run: `cd bootstrap-breadcrumbs && node bootstrap.js`
3. Done! Agent is loaded

### Add a New Tool
1. Create `tools/my-tool.json` with schema `tool.v1`
2. Include implementation reference: `{"type": "builtin", "export": "builtinTools.mytool"}`
3. Run: `cd bootstrap-breadcrumbs && node bootstrap.js`
4. Done! Tool is available

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