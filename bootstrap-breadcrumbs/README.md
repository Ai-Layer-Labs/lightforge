# RCRT Bootstrap System

## Overview

The bootstrap system initializes RCRT with essential breadcrumbs on first run, providing:
- Tool catalog with `llm_hints` transforms
- Default chat agent using modern patterns
- Template library for learning
- Bootstrap tracking to prevent duplicates

## Structure

```
bootstrap-breadcrumbs/
├── system/                      # Core system breadcrumbs
│   ├── tool-catalog-bootstrap.json    # Tools with llm_hints
│   ├── default-chat-agent.json        # Ready-to-use chat agent
│   └── bootstrap-marker.json          # Tracks bootstrap status
├── templates/                   # Learning templates
│   ├── llm-hints-guide.json          # How to use transforms
│   └── agent-definition-template.json # Agent creation patterns
└── bootstrap.js                # Bootstrap script
```

## Features

### 1. Tool Catalog with Transforms
The tool catalog includes `llm_hints` that will transform the view when server support is added:
```json
{
  "llm_hints": {
    "transform": {
      "tool_summary": {
        "type": "template",
        "template": "{{context.activeTools}} tools available..."
      }
    },
    "mode": "replace"
  }
}
```

### 2. Modern Default Agent
- Subscribes to tool catalog for discovery
- Uses context-driven patterns
- No hardcoded tool lists

### 3. Template Library
- Teaches by example
- Self-documenting with `llm_hints`
- Agents can discover and learn

### 4. Idempotent Bootstrap
- Checks for existing bootstrap marker
- Skips already-created breadcrumbs
- Version tracking for upgrades

## Running Bootstrap

### Standalone
```bash
cd bootstrap-breadcrumbs
npm install node-fetch
node bootstrap.js
```

### Integrated with Setup
Add to `setup.sh`:
```bash
# After services are running
echo "📚 Bootstrapping system data..."
cd bootstrap-breadcrumbs && node bootstrap.js
```

### Docker Integration
```yaml
bootstrap:
  image: node:18-alpine
  volumes:
    - ./bootstrap-breadcrumbs:/app
  environment:
    - RCRT_BASE_URL=http://rcrt:8081
  command: |
    cd /app && npm install node-fetch && node bootstrap.js
  depends_on:
    rcrt:
      condition: service_healthy
```

## Bootstrap Process

1. **Check Status** - Look for existing bootstrap marker
2. **Load System** - Tool catalog, default agents
3. **Load Templates** - Guides and patterns
4. **Mark Complete** - Create bootstrap marker

## Next Steps

### Priority: Server Transform Support

Before expanding bootstrap, we need the server to process `llm_hints`:

1. **Implement in RCRT Server**
   ```rust
   fn apply_llm_hints(breadcrumb: &Breadcrumb) -> Value {
     // Process transforms
   }
   ```

2. **Test with Bootstrap Data**
   - Tool catalog should show concise view
   - Templates should demonstrate transforms

3. **Expand Bootstrap**
   - More default agents
   - Transform pattern library
   - Example workflows

## Benefits

- **Zero to Chat** - Working system immediately after setup
- **Self-Teaching** - Templates show best practices
- **Future-Ready** - llm_hints ready for server support
- **Clean Start** - Consistent initial state
