# update-breadcrumb.js - Hot-Reload Breadcrumbs

Quick script to update breadcrumbs in the running RCRT system without full restarts.

## Usage

```bash
node scripts/update-breadcrumb.js <path-to-json-file>
```

## Examples

**Update agent definition:**
```bash
node scripts/update-breadcrumb.js bootstrap-breadcrumbs/system/validation-specialist-agent.json
docker compose restart agent-runner  # Reload agent
```

**Update tool:**
```bash
node scripts/update-breadcrumb.js bootstrap-breadcrumbs/tools-self-contained/openrouter.json
# If approved, tools-runner auto-reloads via SSE (no restart needed!)
```

**Update knowledge:**
```bash
node scripts/update-breadcrumb.js bootstrap-breadcrumbs/knowledge/validation-rules-v1.json
# context-builder will use updated knowledge immediately
```

## What It Does

1. Reads JSON file
2. Gets JWT token from rcrt-server
3. Searches for existing breadcrumb (by agent_id, tool name, or title)
4. If found: PATCH update (preserves ID, increments version)
5. If not found: POST create (new breadcrumb)
6. Shows result with ID and version

## Environment Variables

```bash
RCRT_URL=http://localhost:8081  # RCRT server URL
OWNER_ID=00000000-0000-0000-0000-000000000001  # Owner UUID
AGENT_ID=00000000-0000-0000-0000-000000000001  # Agent UUID for auth
```

## After Updating

**Agent definitions**: Restart agent-runner to reload
```bash
docker compose restart agent-runner
```

**Tools**: Auto-reload via SSE (if approved tag present)

**Knowledge**: Used immediately by context-builder

**Other breadcrumbs**: Depends on schema - check component docs

## Quick Workflow

Edit file → Run script → Restart if needed → Test!

**Much faster than full docker compose down/up cycle!**

