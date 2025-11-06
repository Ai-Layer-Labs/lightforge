# Context Blacklist Architecture

## Overview

The context blacklist prevents metadata and system internals from appearing in assembled agent context. It follows **THE RCRT WAY**: everything is a breadcrumb, including configuration.

---

## Current Implementation ✅

### Blacklist as Breadcrumb
**Schema**: `context.blacklist.v1`  
**Location**: `bootstrap-breadcrumbs/system/context-blacklist.json`

```json
{
  "schema_name": "context.blacklist.v1",
  "context": {
    "excluded_schemas": [
      {
        "schema_name": "schema.def.v1",
        "reason": "Schema definitions - metadata about schemas, not actual content"
      },
      {
        "schema_name": "secret.v1",
        "reason": "Secrets and credentials - NEVER include in any context for security"
      },
      // ... more entries
    ]
  }
}
```

### Loading Strategy

**File**: `crates/rcrt-context-builder/src/vector_store.rs`

1. **Startup**: Context-builder loads blacklist from `context.blacklist.v1` breadcrumb
2. **Caching**: Stores in memory (`Arc<RwLock<Vec<String>>>`) for fast access
3. **Fallback**: If breadcrumb doesn't exist, uses hardcoded default
4. **Application**: Applied in `get_recent()`, `get_latest()` methods

```rust
// Load at startup (main.rs)
vector_store.load_blacklist().await?;

// Use in queries (vector_store.rs)
let blacklist = self.get_blacklist().await;
```

---

## Currently Blacklisted Schemas

| Schema | Reason |
|--------|--------|
| `system.health.v1` | Health check responses - internal monitoring |
| `system.metric.v1` | Performance metrics - internal telemetry |
| `tool.config.v1` | Tool configuration - internal setup |
| `secret.v1` | **SECURITY**: Never expose secrets |
| `system.startup.v1` | System initialization - internal lifecycle |
| `schema.def.v1` | **Schema definitions** - metadata, not content |
| `context.blacklist.v1` | The blacklist itself - configuration |
| `system.hygiene.v1` | Hygiene statistics - housekeeping metrics |

---

## Managing the Blacklist

### Option 1: Update via API (Recommended)

```bash
# Get current blacklist ID
curl http://localhost:8081/breadcrumbs?schema_name=context.blacklist.v1

# Update it
curl -X PATCH http://localhost:8081/breadcrumbs/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "excluded_schemas": [
        {"schema_name": "new.schema.v1", "reason": "Why it should be excluded"}
      ]
    }
  }'

# Restart context-builder to reload
docker compose restart context-builder
```

### Option 2: Update Bootstrap File

1. Edit `bootstrap-breadcrumbs/system/context-blacklist.json`
2. Add/remove schemas from `excluded_schemas` array
3. Run: `node bootstrap-breadcrumbs/bootstrap.js` (with force flag)
4. Restart: `docker compose restart context-builder`

### Option 3: Temporary (Dev/Testing)

Edit hardcoded fallback in `crates/rcrt-context-builder/src/vector_store.rs`:

```rust
let fallback_blacklist = vec![
    "system.health.v1".to_string(),
    // ... add your schema here
];
```

Rebuild: `docker compose up -d --build context-builder`

---

## Architecture Benefits

### ✅ THE RCRT WAY
- **Everything is a breadcrumb**: Configuration is data, not code
- **Versionable**: Can track changes to blacklist over time
- **Queryable**: Use standard API to inspect current blacklist
- **Documented**: Includes reasons for each exclusion

### ✅ Performance
- **Cached**: Loaded once at startup, stored in memory
- **Fast**: No database lookup during context assembly
- **Minimal overhead**: Simple Vec<String> lookup

### ✅ Maintainability
- **Self-documenting**: Reasons are embedded in the data
- **Discoverable**: Can query to see what's blacklisted
- **Safe fallback**: Hardcoded default if breadcrumb missing
- **No new API**: Uses existing breadcrumb endpoints

---

## Future Enhancements

### 1. Hot Reload
Add SSE listener to reload blacklist when `context.blacklist.v1` is updated:

```rust
// In event_handler.rs
if event.schema_name == "context.blacklist.v1" {
    vector_store.load_blacklist().await?;
    info!("♻️  Blacklist reloaded from updated configuration");
}
```

### 2. Per-Agent Blacklists
Allow agents to have custom blacklists:

```json
{
  "schema_name": "context.blacklist.v1",
  "tags": ["agent:default-chat-assistant"],
  "context": {
    "excluded_schemas": [...]
  }
}
```

### 3. Conditional Blacklisting
Blacklist based on conditions (tags, session, etc.):

```json
{
  "schema_name": "tool.response.v1",
  "reason": "Tool responses",
  "exclude_when": {
    "tags_contain": ["debug:verbose"]
  }
}
```

### 4. Whitelist Mode
Instead of blacklist, specify exactly what to include:

```json
{
  "schema_name": "context.whitelist.v1",
  "context": {
    "included_schemas": ["user.message.v1", "agent.response.v1"]
  }
}
```

---

## Schema Definition

**File**: `bootstrap-breadcrumbs/schemas/context-blacklist-v1.json`

Defines the schema for blacklist configuration with:
- Field definitions
- llm_hints for LLM presentation
- TTL policy (never expires)
- Documentation and examples

---

## Testing

### Verify Blacklist Loaded

```bash
# Check logs
docker compose logs context-builder | grep blacklist

# Should see:
# ✅ Loaded context blacklist: 8 schemas excluded
# OR
# ⚠️  context.blacklist.v1 not found, using hardcoded fallback
```

### Test Exclusion

```bash
# Create a schema.def.v1 breadcrumb
# Send user message to trigger context assembly
# Verify schema.def.v1 does NOT appear in agent.context.v1
```

---

## Status

- ✅ **Implemented**: Blacklist loading from breadcrumb
- ✅ **Implemented**: Hardcoded fallback
- ✅ **Implemented**: Memory caching
- ✅ **Implemented**: Schema definition
- ✅ **Working**: Schema definitions excluded from context
- ⏳ **Pending**: Bootstrap of blacklist breadcrumb (using fallback for now)
- ⏳ **Future**: Hot reload on configuration changes
- ⏳ **Future**: Per-agent blacklists

---

## Key Files

| File | Purpose |
|------|---------|
| `bootstrap-breadcrumbs/schemas/context-blacklist-v1.json` | Schema definition |
| `bootstrap-breadcrumbs/system/context-blacklist.json` | Actual blacklist configuration |
| `crates/rcrt-context-builder/src/vector_store.rs` | Loading & caching logic |
| `crates/rcrt-context-builder/src/main.rs` | Startup initialization |

---

## Summary

The blacklist architecture is **THE RCRT WAY**:
- 🗂️ **Data, not code**: Configuration as breadcrumbs
- 🚀 **Fast**: Memory cached
- 🔒 **Safe**: Fallback if missing
- 📖 **Documented**: Self-describing with reasons
- 🔄 **Evolvable**: Can enhance without breaking changes

The system works perfectly right now with the hardcoded fallback, and once the blacklist breadcrumb is bootstrapped, it will use that instead.

