# RCRT Bootstrap System

**Version:** 2.1.0 (Updated for optimized breadcrumb structure)

## Overview

The RCRT bootstrap system provides a **single source of truth** for all system initialization. All agents, tools, and templates are defined as JSON files in the `bootstrap-breadcrumbs/` directory and loaded into the system on startup.

**v2.1.0 Breaking Change:** Breadcrumb structure normalized - `description`, `semantic_version`, and `llm_hints` are now top-level fields (not in context).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 ONE Bootstrap Process                            │
│                                                                  │
│  setup.sh                                                        │
│     │                                                            │
│     ▼                                                            │
│  bootstrap-breadcrumbs/bootstrap.js  ← THE ONLY BOOTSTRAP       │
│     │                                                            │
│     ├─→ system/*.json       (agents)                            │
│     ├─→ tools/*.json         (tool definitions)                 │
│     └─→ templates/*.json     (user templates)                   │
│                                                                  │
│  Creates all breadcrumbs in RCRT database                       │
│     │                                                            │
│     ├─→ agent-runner auto-discovers agent.def.v1               │
│     └─→ tools-runner auto-discovers tool.v1                    │
│                                                                  │
│  ✅ System ready!                                                │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
bootstrap-breadcrumbs/
├── bootstrap.js                    # Main bootstrap script
├── package.json                    # Dependencies
├── README.md                       # Bootstrap docs
├── system/                         # System breadcrumbs
│   ├── default-chat-agent.json     # Default chat assistant
│   └── bootstrap-marker.json       # Bootstrap completion marker
├── tools/                          # Tool definitions (13 tools)
│   ├── openrouter.json
│   ├── ollama.json
│   ├── agent-helper.json
│   ├── breadcrumb-crud.json
│   ├── agent-loader.json
│   ├── calculator.json
│   ├── random.json
│   ├── echo.json
│   ├── timer.json
│   ├── context-builder.json
│   ├── file-storage.json
│   ├── browser-context-capture.json
│   ├── workflow.json
│   └── README.md
└── templates/                      # Templates for users
    ├── agent-definition-template.json
    ├── tool-definition-template.json
    └── llm-hints-guide.json
```

## How It Works

### 1. Initialization

When you run `./setup.sh`:

1. Docker Compose builds all services
2. RCRT server starts and initializes database
3. Bootstrap script runs automatically (via Docker health check or manual trigger)
4. All JSON files are loaded as breadcrumbs
5. agent-runner discovers agents
6. tools-runner discovers tools
7. System is ready!

### 2. File Format

Every bootstrap file follows the breadcrumb schema:

```json
{
  "schema_name": "agent.def.v1",
  "title": "Default Chat Assistant",
  "tags": ["agent", "agent:default-chat-assistant", "workspace:agents"],
  "context": {
    "agent_id": "default-chat-assistant",
    "llm_config": {
      "provider": "openrouter",
      "model": "anthropic/claude-3.5-sonnet",
      "temperature": 0.7
    },
    "subscriptions": [
      {
        "schema_name": "user.message.v1",
        "any_tags": ["workspace:agents"]
      }
    ]
  }
}
```

### 3. Auto-Discovery

Services discover breadcrumbs by schema:

**agent-runner** queries:
```
GET /breadcrumbs?schema_name=agent.def.v1
```

**tools-runner** queries:
```
GET /breadcrumbs?schema_name=tool.v1
```

No hardcoded registration needed!

### 4. Tag-Based Routing

All agents and tools discover and trigger via **tags**:

**Example: validation-specialist**
- Subscribes to: `tool.code.v1 + all_tags: ["workspace:tools"]`
- When tool created with `workspace:tools` tag → Triggers automatically
- Validates code → Adds "approved" tag → tools-runner loads

**Example: tools-runner**
- Loads all tool.code.v1 with `tag: "approved"`
- Listens for tool.request.v1 with `workspace:tools` tag
- Executes → Returns tool.response.v1

**Key Principle:** Tags act as routing, triggers, and filters.

**No configuration. No registration. Just tags.**

## Tool System

### Tool Definition Structure

Each tool is defined with:

```json
{
  "schema_name": "tool.v1",
  "title": "Tool Name",
  "tags": ["tool", "tool:name", "workspace:tools"],
  "context": {
    "name": "tool-name",
    "description": "What this tool does",
    "implementation": {
      "type": "builtin",
      "module": "@rcrt-builder/tools",
      "export": "builtinTools['tool-name']"
    },
    "definition": {
      "input_schema": {
        "type": "object",
        "properties": {...},
        "required": [...]
      },
      "output_schema": {
        "type": "object",
        "properties": {...}
      }
    },
    "examples": [
      {
        "description": "Example usage",
        "input": {...},
        "expected_output": {...}
      }
    ]
  }
}
```

### Breadcrumb Structure (v2.1.0)

**Standard structure:**
```json
{
  "schema_name": "tool.code.v1",
  "title": "Tool Name",
  "description": "What it does",        // NEW: Top-level
  "semantic_version": "2.0.0",          // NEW: Top-level  
  "tags": ["tool", "workspace:tools"],
  "llm_hints": {                        // NEW: Top-level
    "include": ["name", "description"],
    "exclude": ["code"]
  },
  "context": {
    // Schema-specific data only
  }
}
```

**See:** `bootstrap-breadcrumbs/templates/base-breadcrumb.json` for full specification

### Complete Tool List

1. **openrouter** - LLM API via OpenRouter
2. **ollama** - Local LLM via Ollama
3. **calculator** - Basic math operations
4. **random** - Generate random numbers
5. **echo** - Echo back input
6. **timer** - Delay/timing operations
7. **breadcrumb-crud** - Direct breadcrumb operations
8. **breadcrumb-search** - Search breadcrumbs
9. **json-transform** - JSON transformations
10. **scheduler** - Schedule operations
11. **venice** - Venice AI integration
12. **workflow** - Workflow orchestration
13. **openrouter-models-sync** - Sync model catalog
11. **file-storage** - File operations
12. **browser-context-capture** - Capture browser context
13. **workflow** - Workflow orchestration

### Tool Implementation Types

**Builtin Tools**:
```json
{
  "implementation": {
    "type": "builtin",
    "module": "@rcrt-builder/tools",
    "export": "builtinTools['tool-name']"
  }
}
```

**External Tools**:
```json
{
  "implementation": {
    "type": "external",
    "url": "https://api.example.com/tool"
  }
}
```

**Service Tools**:
```json
{
  "implementation": {
    "type": "service",
    "service_name": "context-builder",
    "endpoint": "/execute"
  }
}
```

## Agent System

### Agent Definition Structure

```json
{
  "schema_name": "agent.def.v1",
  "title": "Agent Name",
  "tags": ["agent", "agent:agent-name", "workspace:agents"],
  "context": {
    "agent_id": "agent-name",
    "description": "What this agent does",
    "llm_config": {
      "provider": "openrouter",
      "model": "anthropic/claude-3.5-sonnet",
      "temperature": 0.7,
      "max_tokens": 4096
    },
    "system_prompt": "You are an AI assistant...",
    "subscriptions": [
      {
        "schema_name": "user.message.v1",
        "any_tags": ["workspace:agents"]
      },
      {
        "schema_name": "agent.context.v1",
        "all_tags": ["agent:context", "consumer:agent-name"]
      }
    ],
    "capabilities": ["chat", "tool-use", "workflow"]
  }
}
```

### Agent Subscriptions

Agents subscribe to breadcrumb updates using **selectors**:

**By Schema**:
```json
{"schema_name": "user.message.v1"}
```

**By Tags**:
```json
{
  "schema_name": "user.message.v1",
  "any_tags": ["workspace:agents"]
}
```

**By Context Match**:
```json
{
  "schema_name": "tool.response.v1",
  "context_match": [{
    "path": "$.requestedBy",
    "op": "eq",
    "value": "agent-name"
  }]
}
```

## Best Practices

### 1. Single Source of Truth
- All definitions in `bootstrap-breadcrumbs/`
- No hardcoded fallbacks in code
- JSON files are the authority

### 2. Fail Fast
- Bootstrap fails if files are invalid
- Clear error messages
- Guides to fix issues

### 3. Version Control
- JSON files in git
- Track changes to definitions
- Easy rollback

### 4. Customization
```bash
# Fork and customize
git clone your-fork
cd your-fork

# Edit definitions
vim bootstrap-breadcrumbs/system/default-chat-agent.json

# Add custom tools
cat > bootstrap-breadcrumbs/tools/custom-tool.json << 'EOF'
{...}
EOF

# Deploy
./setup.sh
```

### 5. Testing
```bash
# Validate JSON syntax
find bootstrap-breadcrumbs -name "*.json" -exec python -m json.tool {} \; > /dev/null

# Test bootstrap
docker compose down -v
./setup.sh
docker compose logs bootstrap-runner

# Verify loaded
curl http://localhost:8081/breadcrumbs?schema_name=tool.v1 | jq '. | length'
# Should return: 13
```

## Portability

Bootstrap system supports container prefixes:

```bash
# Standard deployment
./setup.sh

# With custom prefix (for forks/multi-deployment)
PROJECT_PREFIX="mycompany-" ./setup.sh
```

This creates containers like:
- `mycompany-rcrt`
- `mycompany-agent-runner`
- `mycompany-tools-runner`

Perfect for:
- Multiple deployments on same host
- Fork identification
- Organization branding

## Troubleshooting

### Bootstrap Fails

**Check logs**:
```bash
docker compose logs bootstrap-runner
```

**Common issues**:
1. Invalid JSON syntax
2. Missing required fields
3. RCRT server not ready

**Fix**:
```bash
# Validate JSON
python -m json.tool bootstrap-breadcrumbs/tools/my-tool.json

# Restart bootstrap
docker compose restart bootstrap-runner
```

### Tools Not Loading

**Verify breadcrumbs created**:
```bash
curl http://localhost:8081/breadcrumbs?schema_name=tool.v1
```

**Check tools-runner**:
```bash
docker compose logs tools-runner | grep "tools available"
# Should show: "✅ 13 tools available"
```

### Agent Not Responding

**Verify agent loaded**:
```bash
curl http://localhost:8081/breadcrumbs?schema_name=agent.def.v1
```

**Check agent-runner**:
```bash
docker compose logs agent-runner | grep "default-chat-assistant"
```

## Advanced Topics

### Dynamic Updates

Agents and tools can be updated at runtime:

```bash
# Update agent
curl -X PATCH http://localhost:8081/breadcrumbs/:agent-id \
  -H 'Content-Type: application/json' \
  -H 'If-Match: "version-etag"' \
  -d '{"context": {...}}'

# Agent-runner detects change and reloads
```

### Migration

To migrate from old system:

1. Extract definitions from code
2. Create JSON files in bootstrap-breadcrumbs/
3. Remove hardcoded registrations
4. Run bootstrap
5. Verify with queries

### Custom Bootstrap

For advanced use cases:

```javascript
// custom-bootstrap.js
import { bootstrap } from './bootstrap-breadcrumbs/bootstrap.js';

// Add custom logic
await customSetup();

// Run standard bootstrap
await bootstrap();

// Add post-bootstrap tasks
await postSetup();
```

## Summary

The bootstrap system provides:

✅ **Single Source of Truth**: All definitions in one place
✅ **Zero Duplicates**: No conflicting definitions
✅ **No Fallbacks**: Explicit and fail-fast
✅ **Auto-Discovery**: Services find breadcrumbs automatically
✅ **Version Control**: JSON files in git
✅ **Portable**: Works anywhere with container prefixes
✅ **Maintainable**: Easy to understand and modify

**One bootstrap process, all data in files, zero hardcoding!**

