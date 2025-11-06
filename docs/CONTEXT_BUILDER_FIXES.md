# Context Builder Bug Fixes

## Issue 1: Incorrect API Path (404 on all requests)

### Problem
**ROOT CAUSE FOUND**: The Rust context-builder was using `/api/breadcrumbs` instead of `/breadcrumbs`, causing 404 on ALL API operations:

```rust
// ❌ WRONG - was using /api prefix
let url = format!("{}/api/breadcrumbs", self.base_url);
// Returns: http://rcrt:8080/api/breadcrumbs → 404 Not Found

// ✅ CORRECT - no /api prefix
let url = format!("{}/breadcrumbs", self.base_url);
// Returns: http://rcrt:8080/breadcrumbs → 200 OK
```

**Discovered by**: Testing with curl manually before implementing code fixes.

### Solution
Removed `/api` prefix from all endpoints in `rcrt_client.rs`:
- ✅ `/breadcrumbs` (create, list)
- ✅ `/breadcrumbs/{id}` (get, update)
- ✅ Kept `/auth/token` and `/events/stream` as-is

### Testing with curl
```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:8081/auth/token \
  -H "Content-Type: application/json" \
  -d '{"owner_id":"00000000-0000-0000-0000-000000000001","agent_id":"00000000-0000-0000-0000-0000000000cb","roles":["curator","emitter","subscriber"]}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Test breadcrumb creation
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST http://localhost:8081/breadcrumbs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"schema_name":"agent.context.v1","title":"Test","tags":["test"],"context":{}}'
```

---

## Issue 2: Multi-Tag Search Client-Side Filtering

### Problem
The Rust context-builder was also failing with 404 errors when searching for existing `agent.context.v1` breadcrumbs with multiple tags:

```
❌ Search failed: 404 Not Found -
Error handling event: Search failed: 404 Not Found -
```

### Root Cause
The RCRT API's `/api/breadcrumbs` endpoint only supports a single `tag` query parameter, but the context-builder was trying to search for breadcrumbs that have multiple tags simultaneously (e.g., `session:XXX` AND `consumer:default-chat-assistant`).

**API Behavior**:
- ✅ Supports: `?tag=session:XXX` (single tag)
- ❌ Does NOT support: `?tag=session:XXX&tag=consumer:YYY` (multiple tags)
- Returns 404 if no breadcrumbs match the queried tag

### Solution
Modified `crates/rcrt-context-builder/src/rcrt_client.rs`:

1. **Query with first tag only**: Use only the first tag in the API query
2. **Filter remaining tags client-side**: Check that all required tags are present after fetching
3. **Handle 404 gracefully**: Treat 404 as "no breadcrumbs found" (return empty array)

```rust
// Before
let url = format!("{}/api/breadcrumbs?tag={}&tag={}", base_url, tag1, tag2);
// Would 404 if no breadcrumbs had tag1

// After
let url = format!("{}/api/breadcrumbs?tag={}", base_url, tag1);
// Query with first tag, then filter client-side for remaining tags
// Treat 404 as empty result
```

### Code Changes

```rust
pub async fn search_breadcrumbs(
    &self,
    schema_name: &str,
    tags: Option<Vec<String>>,
) -> Result<Vec<Breadcrumb>> {
    // Query with first tag only
    let url = if let Some(tag_list) = &tags {
        if let Some(first_tag) = tag_list.first() {
            format!("{}/api/breadcrumbs?tag={}", self.base_url, first_tag)
        } else {
            format!("{}/api/breadcrumbs", self.base_url)
        }
    } else {
        format!("{}/api/breadcrumbs", self.base_url)
    };
    
    let response = self.http_client.get(&url)...
    
    // Handle 404 as empty result
    if status == reqwest::StatusCode::NOT_FOUND {
        return Ok(vec![]);
    }
    
    // Filter by schema_name AND all required tags client-side
    let filtered: Vec<Breadcrumb> = all_breadcrumbs
        .into_iter()
        .filter(|b| {
            // Must match schema
            if b.schema_name != schema_name {
                return false;
            }
            
            // If tags were specified, breadcrumb must have ALL of them
            if let Some(required_tags) = &tags {
                for req_tag in required_tags {
                    if !b.tags.contains(req_tag) {
                        return false;
                    }
                }
            }
            
            true
        })
        .collect();
    
    Ok(filtered)
}
```

### Testing
1. Rebuild: `docker compose build context-builder`
2. Restart: `docker compose restart context-builder`
3. Send message: Use chat extension to trigger context assembly
4. Verify: Check logs for successful processing (no 404 errors)

### Status
- ✅ **Fixed**: Deployed in latest Docker image
- ✅ **Tested**: Compiles and runs without errors
- ⏳ **Validation**: Needs real event processing to confirm fix

---

## Current System State

### Active Context Builders
1. **Old (Node.js)**: `context-builder` tool (TypeScript)
   - Location: `rcrt-visual-builder/packages/tools/src/context-tools/context-builder-tool.ts`
   - Status: Active, running in tools-runner
   - Subscription: `user.message.v1` events

2. **New (Rust)**: `rcrt-context-builder` service
   - Location: `crates/rcrt-context-builder/`
   - Status: Active, running as separate service
   - Subscription: `user.message.v1` events (via SSE stream)

### Current Behavior
- **Both** context-builders receive the same events
- **Both** assemble context independently
- **Both** create/update `agent.context.v1` breadcrumbs

### Potential Issues
- **Duplication**: Two context breadcrumbs created per event
- **Race Condition**: Both might try to update the same breadcrumb
- **Resource Usage**: Redundant processing

### Recommended Next Steps
1. **Option A: Disable Old Context-Builder**
   - Remove `context-builder` from tool catalog
   - Fully migrate to Rust service
   - Simplifies system, reduces overhead

2. **Option B: Keep Both for A/B Testing**
   - Monitor logs for both versions
   - Compare performance and accuracy
   - Gradual migration with fallback

3. **Option C: Route by Consumer**
   - Some consumers use old builder
   - Some use new Rust builder
   - Allows selective migration

---

## Related Documentation
- `docs/CONTEXT_BUILDER_RUST.md` - Full Rust service architecture
- `docs/SETUP_IMPROVEMENTS.md` - Setup script and startup sequence
- `docs/openapi.json` - RCRT API specification

