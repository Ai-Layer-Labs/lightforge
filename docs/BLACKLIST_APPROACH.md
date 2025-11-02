# Context Builder: Blacklist Approach

## Philosophy Shift: From Whitelist to Blacklist

**Date**: 2025-11-02  
**Rationale**: RCRT systems should be maximally flexible and not make assumptions about what's relevant.

## The Problem with Whitelisting

**Before** (❌ Hardcoded):
```rust
sources: vec![
    Recent { schema_name: Some("user.message.v1") },      // Explicit whitelist
    Recent { schema_name: Some("agent.response.v1") },    // Explicit whitelist
    Latest { schema_name: "tool.catalog.v1" },            // Explicit whitelist
]
```

**Issues**:
- ❌ Requires code changes for new breadcrumb types
- ❌ Knowledge base articles would be invisible
- ❌ Custom breadcrumbs need manual registration
- ❌ Not RCRT-compliant (hardcoded schemas)

## The Blacklist Solution

**After** (✅ RCRT Way):
```rust
// event_handler.rs
sources: vec![
    SourceConfig {
        method: SourceMethod::Recent {
            schema_name: None,  // ✅ Get EVERYTHING in session!
        },
        limit: 20,
    },
]
```

**SQL Implementation** (vector_store.rs):
```sql
SELECT * FROM breadcrumbs
WHERE 'session:XXX' = ANY(tags)
  AND schema_name NOT IN (
    'system.health.v1',
    'system.metric.v1',
    'tool.config.v1',
    'secret.v1',
    'system.startup.v1'
  )
ORDER BY created_at DESC
LIMIT 20
```

## What Gets Included Now

✅ **Automatically Included**:
- `user.message.v1` - User messages
- `agent.response.v1` - Agent responses
- `tool.response.v1` - Tool outputs
- `knowledge.article.v1` - Knowledge base articles (future)
- `code.snippet.v1` - Code references (future)
- `web.bookmark.v1` - Saved web pages (future)
- **ANY custom breadcrumb type** tagged with the session

❌ **Blacklisted (System Internals)**:
- `system.health.v1` - Health check pings
- `system.metric.v1` - Internal metrics
- `tool.config.v1` - Tool settings (not conversational)
- `secret.v1` - Never expose secrets
- `system.startup.v1` - System lifecycle events

## Benefits

### 1. Zero Configuration
Add a new breadcrumb type? Just tag it with the session:
```json
{
  "schema_name": "knowledge.kubernetes.v1",
  "tags": ["knowledge:k8s", "session:abc123"],
  "context": {
    "topic": "Kubernetes best practices",
    "content": "..."
  }
}
```
✅ Automatically included in context!

### 2. Natural Scoping
The `session:UUID` tag naturally scopes context to the current conversation:
- Same session = included
- Different session = excluded
- No schema-specific logic needed

### 3. Future-Proof
New features work immediately:
- Knowledge base system → Just tag with session
- Code indexing → Just tag with session
- Web scraping → Just tag with session
- Document uploads → Just tag with session

### 4. RCRT Compliance
- **No hardcoded schemas** in the code
- **Data-driven** behavior (blacklist from config in future)
- **Observable** via breadcrumbs
- **Traceable** through session tags

## Implementation Details

### Files Modified
1. **`crates/rcrt-context-builder/src/event_handler.rs`**
   - Changed `schema_name: Some("...")` to `schema_name: None`
   - Increased limit from 10 → 20 (more diverse breadcrumbs)

2. **`crates/rcrt-context-builder/src/vector_store.rs`**
   - Added SQL `NOT IN` clause for blacklisted schemas
   - Documented blacklist rationale in comments

3. **`docs/CONTEXT_BUILDER_RUST.md`**
   - Added "Philosophy: Blacklist over Whitelist" section
   - Documented why this matters

### Testing
```bash
# Rebuild and restart
docker compose build context-builder
docker compose restart context-builder

# Monitor logs
docker compose logs context-builder --tail=30 --follow
```

**Observed Results**:
- ✅ Context assembly still works
- ✅ User messages included
- ✅ Agent responses included
- ✅ Tool catalog included
- ✅ System breadcrumbs excluded

## Future: Dynamic Blacklist

**Phase 4+**: Load blacklist from `context.config.v1` breadcrumbs:
```json
{
  "schema_name": "context.config.v1",
  "tags": ["consumer:default-chat-assistant"],
  "context": {
    "blacklist": [
      "system.health.v1",
      "system.metric.v1",
      "tool.config.v1",
      "secret.v1"
    ],
    "sources": [
      {"method": "recent", "schema_name": null, "limit": 20},
      {"method": "vector", "limit": 5}
    ]
  }
}
```

This will make the entire system **fully dynamic** and RCRT-compliant.

## Comparison Table

| Aspect | Whitelist (Old) | Blacklist (New) |
|--------|----------------|-----------------|
| **New schemas** | Code change required | Works immediately |
| **Knowledge base** | Won't work | Works immediately |
| **Custom types** | Must register | Works immediately |
| **Maintenance** | High (hardcoded) | Low (data-driven) |
| **RCRT compliance** | ❌ Hardcoded | ✅ Flexible |
| **Future-proof** | ❌ Breaks often | ✅ Scales naturally |

## Conclusion

**The blacklist approach aligns with RCRT philosophy**:
- Everything is a breadcrumb
- UI reads, tools write
- All data observable, cacheable, traceable
- **No assumptions about what's relevant**
- Session filtering provides natural scoping
- System internals are explicitly excluded

This makes the context-builder **maximally flexible** and **future-proof** for any breadcrumb type we might add in the future.

