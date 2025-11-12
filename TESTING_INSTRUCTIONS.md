# Testing Instructions - After Server Rebuild

**Purpose:** Verify direct tool discovery and ultra-compact context  
**Expected:** 74% context reduction (11K-15K → 3.9K-5.1K tokens)

---

## Prerequisites

```bash
# Rebuild services with updated code
docker-compose down -v  # Full purge
docker-compose up --build -d

# Or rebuild specific services:
cd crates/rcrt-context-builder && cargo build --release
cd rcrt-visual-builder/packages/tools && npm run build
```

---

## Test 1: Verify Agent Context Sources ✅

**Check agent definition loaded correctly:**

```bash
# Get default-chat-assistant definition
AGENT_ID=$(curl -s "http://localhost:8081/breadcrumbs?schema_name=agent.def.v1&tag=agent:default-chat-assistant" | jq -r '.[0].id')

# Check context_sources
curl -s "http://localhost:8081/breadcrumbs/$AGENT_ID/full" | jq '.context.context_sources.always[0]'
```

**Expected output:**
```json
{
  "type": "schema",
  "schema_name": "tool.code.v1",
  "method": "all",
  "limit": 50,
  "optional": false,
  "reason": "Direct tool discovery - each tool.code.v1 has llm_hints from schema..."
}
```

**NOT:**
```json
{
  "schema_name": "tool.catalog.v1"  // ← This would be OLD way
}
```

---

## Test 2: Send Hello Message 📨

```bash
# Create user message
curl -X POST http://localhost:8081/breadcrumbs \
  -H 'Content-Type: application/json' \
  -d '{
    "schema_name": "user.message.v1",
    "title": "Test Hello",
    "tags": ["user:message", "session:test-direct-discovery"],
    "context": {
      "content": "hello",
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "session_id": "session-test-direct-discovery",
      "source": "test"
    }
  }'

# Wait 2-3 seconds for context assembly

# Check agent.context.v1 was created
curl -s "http://localhost:8081/breadcrumbs?schema_name=agent.context.v1&tag=consumer:default-chat-assistant" | jq -r '.[0].id'
```

---

## Test 3: Verify Direct Tool Discovery ✅

**Check what breadcrumbs are in the assembled context:**

```bash
# Get latest agent.context.v1
CONTEXT_ID=$(curl -s "http://localhost:8081/breadcrumbs?schema_name=agent.context.v1&tag=consumer:default-chat-assistant" | jq -r '.[0].id')

# Get full context (unformatted)
curl -s "http://localhost:8081/breadcrumbs/$CONTEXT_ID/full" | jq '.context' > context.json

# Check what schemas are included
cat context.json | jq -r '.breadcrumbs[].schema_name' | sort | uniq -c
```

**Expected output:**
```
14 tool.code.v1           ← Direct tool discovery! ✅
1 agent.catalog.v1
1 user.message.v1
2-3 knowledge.v1
```

**NOT expected:**
```
1 tool.catalog.v1         ← OLD aggregation pattern ❌
```

---

## Test 4: Check Tool Content ✅

**Verify tools have llm_hints applied (code excluded):**

```bash
# Extract one tool from context
cat context.json | jq '.breadcrumbs[] | select(.schema_name == "tool.code.v1") | select(.name == "calculator")'
```

**Expected (llm_hints applied):**
```json
{
  "name": "calculator",
  "description": "Perform mathematical calculations",
  "input_schema": {/* full schema */},
  "output_schema": {/* full schema */},
  "examples": [{/* example */}]
  // NO "code" field ← excluded by llm_hints ✅
  // NO "permissions" field ← excluded by llm_hints ✅
  // NO "limits" field ← excluded by llm_hints ✅
}
```

**NOT expected:**
```json
{
  "code": {
    "source": "..." ← This should be EXCLUDED
  }
}
```

---

## Test 5: Measure Token Count 📊

```bash
# Check formatted_context token estimate
CONTEXT_ID=$(curl -s "http://localhost:8081/breadcrumbs?schema_name=agent.context.v1&tag=consumer:default-chat-assistant" | jq -r '.[0].id')

curl -s "http://localhost:8081/breadcrumbs/$CONTEXT_ID/full" | jq '.context.token_estimate'
```

**Expected:** 3,900-5,100 tokens

**Before:** 11,000-15,000 tokens

**Improvement:** 66-74% reduction ✅

---

## Test 6: Verify Catalog (Optional)

**The catalog still exists (for Dashboard), but now uses schema llm_hints:**

```bash
# Get catalog
CATALOG_ID=$(curl -s "http://localhost:8081/breadcrumbs?schema_name=tool.catalog.v1" | jq -r '.[0].id')

# Check it has NO embedded llm_hints
curl -s "http://localhost:8081/breadcrumbs/$CATALOG_ID/full" | jq '.context.llm_hints'
```

**Expected:** `null` (no hardcoded llm_hints)

**Then check transformed view:**
```bash
curl -s "http://localhost:8081/breadcrumbs/$CATALOG_ID" | jq -r '.context'
```

**Expected: Ultra-compact format from schema.def.v1:**
```
=== TOOLS (14 available) ===

• workflow: Execute multi-step workflows → results, executionOrder, errors
• venice: Privacy-focused LLM via Venice AI → content, model, usage
... (14 tools)

INVOCATION: Use the Universal Tool Invocation Standard defined in your system prompt above.
```

---

## Test 7: Agent Chat End-to-End 🤖

**Test various tool invocation patterns:**

### Simple Tool Call
```
User: "Calculate 25 times 4"
Expected: Agent uses calculator tool with return_to_llm: false
```

### LLM Call
```
User: "Explain quantum computing"
Expected: Agent uses openrouter with return_to_llm: true, processes result
```

### Multi-Step
```
User: "Generate 2 random numbers and add them"
Expected: Agent uses workflow tool OR multi-step pattern
```

### Delegation
```
User: "Create a web search tool"
Expected: Agent delegates to tool-creator specialist
```

**Verify for each:**
- ✅ Agent sees 14 individual tools (not catalog)
- ✅ Uses universal invocation format
- ✅ Correct return_to_llm decisions
- ✅ Tools execute successfully

---

## Success Metrics

### Context Size
- **Target:** ≤ 5,100 tokens (vs 11,000-15,000 before)
- **Reduction:** ≥ 66%
- **Measure:** `token_estimate` field in agent.context.v1

### Tool Discovery
- **Pattern:** Direct tool.code.v1 queries (not catalog)
- **Count:** 14 individual tool breadcrumbs in context
- **Optimization:** Each has llm_hints applied (code excluded)

### No Hardcoded llm_hints
- **Catalog:** `llm_hints` field should be `null`
- **Tools-runner:** No llm_hints in catalogData object
- **Source of truth:** Only schema.def.v1 has llm_hints

### Architectural Purity
- **No aggregation:** Agents query breadcrumbs directly
- **No fallbacks:** Schema missing? Error immediately
- **Single source:** llm_hints only in schema definitions

---

## Troubleshooting

### If context still has tool.catalog.v1

**Problem:** Old catalog breadcrumb still exists

**Fix:**
```bash
# Delete old catalog
CATALOG_ID=$(curl -s "http://localhost:8081/breadcrumbs?schema_name=tool.catalog.v1" | jq -r '.[0].id')
curl -X DELETE "http://localhost:8081/breadcrumbs/$CATALOG_ID"

# Restart agent-runner to reload agent definitions
docker-compose restart agent-runner
```

### If tools still have code in context

**Problem:** llm_hints not being applied

**Check:**
```bash
# Verify schema.def.v1 for tool.code.v1 exists
curl -s "http://localhost:8081/breadcrumbs?schema_name=schema.def.v1&tag=defines:tool.code.v1" | jq '.[0].id'

# If missing, run bootstrap
cd bootstrap-breadcrumbs && node bootstrap.js
```

### If context size not reduced

**Check what's in the context:**
```bash
CONTEXT_ID=$(curl -s "http://localhost:8081/breadcrumbs?schema_name=agent.context.v1" | jq -r '.[0].id')

curl -s "http://localhost:8081/breadcrumbs/$CONTEXT_ID/full" | jq '.context.breadcrumbs[].schema_name' | sort | uniq -c
```

**Look for:**
- Large knowledge articles (might need llm_hints)
- Many session messages (should be ~5-10, not 20+)
- Unexpected schemas

---

## Quick Verification Command

**One-liner to check everything:**

```bash
echo "=== VERIFICATION ===" && \
CONTEXT_ID=$(curl -s "http://localhost:8081/breadcrumbs?schema_name=agent.context.v1&tag=consumer:default-chat-assistant" | jq -r '.[0].id') && \
echo "Context ID: $CONTEXT_ID" && \
echo -e "\nSchemas in context:" && \
curl -s "http://localhost:8081/breadcrumbs/$CONTEXT_ID/full" | jq -r '.context.breadcrumbs[].schema_name' | sort | uniq -c && \
echo -e "\nToken estimate:" && \
curl -s "http://localhost:8081/breadcrumbs/$CONTEXT_ID/full" | jq '.context.token_estimate' && \
echo -e "\n✅ If you see 14 tool.code.v1 and token_estimate < 5100, SUCCESS!"
```

**Expected output:**
```
=== VERIFICATION ===
Context ID: abc-123-def-456

Schemas in context:
  1 agent.catalog.v1
 14 tool.code.v1          ← SUCCESS!
  1 user.message.v1
  2 knowledge.v1

Token estimate:
4200                      ← SUCCESS! (vs 11,000-15,000 before)

✅ If you see 14 tool.code.v1 and token_estimate < 5100, SUCCESS!
```

---

**Ready to rebuild and test!** 🚀

