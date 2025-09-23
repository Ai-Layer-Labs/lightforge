# RCRT Bootstrap System Analysis

## 🔍 Current Bootstrap Process

### 1. **Infrastructure Bootstrap** (`setup.sh`)
```bash
1. Docker services startup
2. Database initialization  
3. NATS messaging setup
4. Core services (RCRT, Dashboard)
5. Agent Runner + Tools Runner
6. Visual Builder (optional)
```

### 2. **Agent Registration** (`ensure-agents.sh`)
Registers 4 core system agents:
- `00000000-0000-0000-0000-0000000000aa` - RCRT Server
- `00000000-0000-0000-0000-0000000000bb` - Tools Runner
- `00000000-0000-0000-0000-0000000000ddd` - Dashboard
- `00000000-0000-0000-0000-000000000AAA` - Agent Runner

### 3. **Example Agents** (`example-agent-definitions.json`)
Pre-defined agent definitions (but NOT auto-loaded):
- File Manager Agent
- OpenRouter Monitor Agent
- Help Assistant Agent

### 4. **Visual Builder Bootstrap** (`rcrt-visual-builder/scripts/bootstrap.ts`)
Creates:
- Workspace definition
- Tool catalog (create_agent, create_flow, etc.)
- Node templates (LLM, search, webhook, etc.)
- Example flows

## ❌ What's Missing/Outdated

### 1. **No Template Breadcrumbs**
- No `llm_hints` guidance templates
- No pattern libraries
- No self-documenting examples

### 2. **Outdated Agent Format**
- Old `agent.definition.v1` format with hardcoded prompts
- No dynamic tool discovery
- No `llm_hints` usage

### 3. **No Default Chat Agent**
- System starts with no ready-to-use agents
- Users must manually create agents

### 4. **No Transform Support**
- Server doesn't process `llm_hints` yet
- No schema transform breadcrumbs
- Context views return raw data

### 5. **Manual Bootstrap Steps**
- Example agents require manual loading
- Templates not auto-loaded
- No first-run experience

## 🚀 Proposed Bootstrap System

### Phase 1: Transform Support (Priority)
```rust
// In RCRT server
1. Implement llm_hints processing in get_breadcrumb_context
2. Add transform types: template, extract, jq, literal
3. Cache transformed views
4. Test with tool catalog transforms
```

### Phase 2: Core Bootstrap Data
```javascript
// bootstrap-breadcrumbs/
├── system/
│   ├── tool-catalog.json         // With llm_hints
│   ├── default-chat-agent.json   // Modern format
│   └── agent-registry.json       // Track active agents
├── templates/
│   ├── llm-hints-guide.json
│   ├── tool-catalog-template.json
│   ├── agent-definition-template.json
│   └── transform-patterns-guide.json
└── examples/
    ├── example-chat-flows.json
    └── example-tool-usage.json
```

### Phase 3: Smart Bootstrap Script
```javascript
// bootstrap.js
async function bootstrap() {
  // 1. Check if already bootstrapped
  const existing = await checkBootstrapStatus();
  if (existing.version === CURRENT_VERSION) return;
  
  // 2. Load core system breadcrumbs
  await loadSystemBreadcrumbs();
  
  // 3. Load template library
  await loadTemplateBreadcrumbs();
  
  // 4. Create default agents
  await createDefaultAgents();
  
  // 5. Mark bootstrap complete
  await createBootstrapMarker();
}
```

### Phase 4: Auto-Bootstrap Integration
```yaml
# In docker-compose.yml
bootstrap:
  image: node:18-alpine
  volumes:
    - ./bootstrap-breadcrumbs:/data
  environment:
    - RCRT_URL=http://rcrt:8081
  command: |
    npx tsx /data/bootstrap.js
  depends_on:
    rcrt:
      condition: service_healthy
```

## 📋 Implementation Order

### 1. **Server Transform Support** (Week 1)
- [ ] Add `applyLLMHints()` to server
- [ ] Support basic transform types
- [ ] Test with manual breadcrumbs

### 2. **Bootstrap Data Creation** (Week 1)
- [ ] Convert templates to bootstrap format
- [ ] Create modern default agents
- [ ] Add system breadcrumbs

### 3. **Bootstrap Script** (Week 2)
- [ ] Idempotent bootstrap logic
- [ ] Version tracking
- [ ] Progress reporting

### 4. **Integration** (Week 2)
- [ ] Add to docker-compose
- [ ] Update setup.sh
- [ ] Test fresh installs

## 🎯 Success Metrics

1. **Zero to Chat in 60 seconds**
   - Fresh install → working chat agent

2. **Self-Documenting**
   - Templates visible in dashboard
   - Agents learn from templates

3. **Transform Validation**
   - Tool catalog shows concise view
   - Agent sees optimized context

4. **Idempotent**
   - Multiple runs don't duplicate
   - Updates preserve user data

## 📝 Bootstrap Breadcrumb Examples

### Tool Catalog with Transform
```json
{
  "schema_name": "tool.catalog.v1",
  "title": "System Tool Catalog",
  "context": {
    "tools": [...],
    "activeTools": 10
  },
  "llm_hints": {
    "transform": {
      "summary": {
        "type": "template",
        "template": "{{context.activeTools}} tools available. Create tool.request.v1 to invoke."
      }
    },
    "mode": "replace"
  }
}
```

### Bootstrap Marker
```json
{
  "schema_name": "system.bootstrap.v1",
  "title": "Bootstrap Status",
  "tags": ["system:bootstrap"],
  "context": {
    "version": "2.0.0",
    "timestamp": "2025-09-23T...",
    "components": {
      "templates": true,
      "default_agents": true,
      "tool_catalog": true
    }
  }
}
```
