# Setup and Fix Guide - Complete Installation

## Overview

This guide covers the complete setup process including the new context optimization system. The `setup.sh` script now automatically:
1. Sets up infrastructure (DB, NATS, RCRT)
2. Bootstraps all system components **including schema definitions**
3. Configures context optimization with llm_hints

---

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js (for bootstrap and extension build)
- Git

### Installation Steps

```bash
# Clone the repository
git clone <your-repo>
cd ThinkOS-1

# Run the setup script (handles everything!)
./setup.sh
```

That's it! The setup script automatically:
- ✅ Builds and starts all services
- ✅ Runs database migrations (including TTL enhancements)
- ✅ Bootstraps system breadcrumbs (agents, tools, knowledge)
- ✅ **Loads schema definitions for context optimization**
- ✅ Registers agents and tools

---

## What Gets Bootstrapped

The `bootstrap.js` script (called by `setup.sh`) loads:

### 1. System Breadcrumbs (`system/*.json`)
- Default chat agent
- Agent catalog
- System configurations

### 2. Self-Contained Tools (`tools-self-contained/*.json`)
- OpenRouter LLM tool
- Breadcrumb create tool
- Workflow orchestrator
- Other utility tools

### 3. Templates (`templates/*.json`)
- Agent definition template
- LLM hints usage guide

### 4. Knowledge Base (`knowledge/*.json`)
- How to create tools
- System documentation
- Best practices

### 5. **Schema Definitions (`schemas/*.json`) - NEW!**
- `user.message.v1` - User messages with 7 day TTL
- `tool.code.v1` - Tool definitions (never expires)
- `tool.response.v1` - Tool responses with 24h TTL
- `agent.response.v1` - Agent responses with 30 day TTL
- `browser.page.context.v1` - Browser context with 1h TTL
- `tool.catalog.v1` - Tool catalog (never expires)
- `agent.context.v1` - Agent context (ephemeral, 1h TTL)

---

## Verifying Setup

### 1. Check Services Are Running

```bash
docker compose ps
```

Should show all services as healthy:
- db
- nats
- rcrt
- context-builder
- dashboard
- tools-runner
- agent-runner

### 2. Verify Schema Definitions Loaded

```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost:8081/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "owner_id": "00000000-0000-0000-0000-000000000001",
    "agent_id": "00000000-0000-0000-0000-0000000000aa",
    "roles": ["curator"]
  }' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Check schema definitions
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8081/breadcrumbs?schema_name=schema.def.v1"
```

Should return 7 schema definitions.

### 3. Test Context Optimization

Send a test message through the browser extension or API, then check:

```bash
# View context-builder logs
docker compose logs context-builder --tail=50
```

Should see:
- ✅ No "error decoding response body" warnings
- ✅ Token estimates around 400-500 (not 13,000+)
- ✅ "Published context with X breadcrumbs (~Y tokens)"

### 4. Check Agent Responses

The agent should now receive properly formatted context and give relevant responses.

---

## Troubleshooting

### Issue: Schema Definitions Not Loaded

**Symptom**: Context-builder logs show "error decoding response body"

**Solution**:
```bash
# Re-run bootstrap manually
cd bootstrap-breadcrumbs
node bootstrap.js
```

### Issue: Context-Builder Not Updated

**Symptom**: Still getting empty content or high token counts

**Solution**: Rebuild context-builder with the struct fix
```bash
docker compose build context-builder
docker compose up -d context-builder
```

### Issue: Bootstrap Version Mismatch

**Symptom**: Bootstrap says "already bootstrapped" but schemas missing

**Solution**: Delete bootstrap marker and re-run
```bash
# Find and delete bootstrap marker
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8081/breadcrumbs/{bootstrap-marker-id}"

# Re-run bootstrap
cd bootstrap-breadcrumbs
node bootstrap.js
```

---

## Manual Bootstrap (If Needed)

If `setup.sh` fails or you need to re-bootstrap:

```bash
cd bootstrap-breadcrumbs

# Ensure dependencies
npm install

# Run bootstrap
node bootstrap.js
```

Output should show:
```
🚀 RCRT Bootstrap System v2.0.0
=====================================
🔐 Obtained JWT token

1️⃣ Checking bootstrap status...
2️⃣ Loading system breadcrumbs...
   ✅ Created: Default Chat Assistant
3️⃣ Loading self-contained tools...
   ✅ Created: OpenRouter LLM Tool
4️⃣ Loading template library...
   ✅ Created: Agent Definition Template
5️⃣ Loading knowledge base...
   ✅ Created: How to Create Tools
6️⃣ Loading schema definitions...
   ✅ Created: User Message Schema Definition (defines user.message.v1)
   ✅ Created: Tool Code Schema Definition (defines tool.code.v1)
   ✅ Created: Tool Response Schema Definition (defines tool.response.v1)
   ✅ Created: Agent Response Schema Definition (defines agent.response.v1)
   ✅ Created: Browser Page Context Schema Definition (defines browser.page.context.v1)
   ✅ Created: Tool Catalog Schema Definition (defines tool.catalog.v1)
   ✅ Created: Agent Context Schema Definition (defines agent.context.v1)
7️⃣ Creating bootstrap marker...
   ✅ Bootstrap complete!
```

---

## Expected Results

After successful setup:

### Token Reduction
- **Before**: 13,000-21,000 tokens
- **After**: 400-500 tokens
- **Reduction**: ~95% (even better than expected!)

### Context Quality
- Human-readable format: `"User (timestamp): message"`
- Only essential fields included
- No raw JSON objects
- Clear section headers

### Agent Responses
- Relevant and contextual
- Based on actual conversation history
- Aware of available tools
- Properly formatted

---

## Adding New Schema Definitions

1. Create a new file in `bootstrap-breadcrumbs/schemas/`
2. Follow the schema.def.v1 format (see existing examples)
3. Run `node bootstrap.js` to load it

Example:
```json
{
  "schema_name": "schema.def.v1",
  "title": "My Custom Schema Definition",
  "tags": ["schema:definition", "system:bootstrap", "defines:my.custom.v1"],
  "context": {
    "defines_schema": "my.custom.v1",
    "llm_hints": {
      "transform": {
        "formatted": {
          "type": "format",
          "format": "{field1}: {field2}"
        }
      },
      "mode": "replace"
    },
    "lifecycle": {
      "ttl_policy": {
        "type": "duration",
        "config": {"hours": 24}
      }
    }
  }
}
```

---

## Files Changed in This Implementation

### Created
- `bootstrap-breadcrumbs/schemas/` (7 schema definition files)
- `migrations/0007_ttl_enhancements.sql`
- `IMPLEMENTATION_SUMMARY.md`
- `QUICK_FIX_GUIDE.md`
- `SETUP_AND_FIX_GUIDE.md` (this file)

### Modified
- `bootstrap-breadcrumbs/bootstrap.js` (added schema loading)
- `crates/rcrt-server/src/transforms.rs` (Format transform, SchemaDefinitionCache)
- `crates/rcrt-server/src/hygiene.rs` (TTL cleanup functions)
- `crates/rcrt-server/src/main.rs` (read tracking)
- `crates/rcrt-core/src/models.rs` (TTL fields)
- `crates/rcrt-context-builder/src/rcrt_client.rs` (BreadcrumbContextView)
- `crates/rcrt-context-builder/src/output/publisher.rs` (lightweight extraction)
- `crates/rcrt-context-builder/src/retrieval/assembler.rs` (token estimation)
- `rcrt-visual-builder/packages/runtime/src/agent/agent-executor.ts` (context formatter)
- `bootstrap-breadcrumbs/system/default-chat-agent.json` (updated comments)

---

## Next Steps

1. **Test the system**: Send messages and verify responses
2. **Monitor logs**: Check context-builder and agent-runner logs
3. **Adjust schemas**: Tweak llm_hints as needed for your use case
4. **Create custom schemas**: Add new schema definitions for your data types

---

## Support

If you encounter issues:
1. Check the logs: `docker compose logs -f [service-name]`
2. Verify schema definitions are loaded (see verification steps)
3. Ensure context-builder is rebuilt with latest changes
4. Re-run bootstrap if needed

For detailed implementation notes, see `IMPLEMENTATION_SUMMARY.md`.

