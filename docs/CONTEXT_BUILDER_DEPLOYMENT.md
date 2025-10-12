# Context-Builder Deployment Guide

## 📋 **What Changed**

### **Files Updated:**
1. ✅ `crates/rcrt-server/src/main.rs` - Added schema_name filter to vector search
2. ✅ `crates/rcrt-server/src/embedding_policy.rs` - Formalized embedding policy
3. ✅ `rcrt-visual-builder/packages/tools/src/context-tools/` - New context-builder tool
4. ✅ `rcrt-visual-builder/packages/runtime/src/agent/agent-executor.ts` - Refactored to RCRT way
5. ✅ `rcrt-visual-builder/packages/sdk/src/index.ts` - Added schema_name filter support
6. ✅ `rcrt-visual-builder/apps/context-builder/` - New service
7. ✅ `bootstrap-breadcrumbs/system/default-chat-agent.json` - Updated subscriptions
8. ✅ `scripts/default-chat-agent.json` - Updated subscriptions
9. ✅ `docker-compose.yml` - Added context-builder service

### **What This Enables:**

**Before:**
```
Agent → Fetches ALL breadcrumbs → Builds context manually → Sends to LLM
(300 events)  (110 breadcrumbs)    (8000 tokens)
```

**After:**
```
context-builder → Fetches relevant breadcrumbs → Updates agent.context.v1
(pgvector)        (8 breadcrumbs)               (1500 tokens)
                                                      ↓
Agent → Receives pre-built context → Sends to LLM
(2 events)
```

## 🚀 **Deployment Steps**

### **Step 1: Rebuild RCRT Server** (Rust changes)

```bash
# Rebuild with embedding policy + schema filter
docker-compose up -d --build rcrt

# Wait for health check
curl http://localhost:8081/health
# Should return: ok

# Test vector search with schema filter
curl "http://localhost:8081/breadcrumbs/search?q=test&nn=1&schema_name=user.message.v1"
# Should return: JSON array (may be empty if no matches)
```

### **Step 2: Build Tools Package** (TypeScript changes)

```bash
cd rcrt-visual-builder

# Build SDK first (dependency)
pnpm --filter @rcrt-builder/sdk build

# Build tools package (includes context-builder)
pnpm --filter @rcrt-builder/tools build

cd ..
```

### **Step 3: Deploy Context-Builder Service**

```bash
# Build and start context-builder-runner
docker-compose up -d --build context-builder

# Check logs
docker-compose logs -f context-builder

# Should show:
# "🏗️ Context-Builder Runner starting..."
# "🔐 Obtained JWT token"
# "✅ Connected to RCRT"
# "🔍 Discovering existing context configurations..."
# "📡 Starting SSE dispatcher..."
```

### **Step 4: Rebuild Agent-Runner** (Updated agent-executor)

```bash
# Rebuild runtime package
cd rcrt-visual-builder
pnpm --filter @rcrt-builder/runtime build

# Rebuild agent-runner
cd ..
docker-compose up -d --build agent-runner

# Check logs
docker-compose logs -f agent-runner

# Should show:
# "🤖 RCRT Agent Runner (Modern) starting..."
# "🔐 Obtained JWT token"
# "✅ Connected to RCRT"
# "📋 Found N agent definitions"
```

### **Step 5: Bootstrap Context Config**

Create the context.config.v1 breadcrumb for default-chat-assistant:

```bash
# Option A: Via curl
curl -X POST http://localhost:8081/breadcrumbs \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: context-config-default-chat' \
  -d @- << 'EOF'
{
  "schema_name": "context.config.v1",
  "title": "Context Config for default-chat-assistant",
  "tags": ["context:config", "consumer:default-chat-assistant", "workspace:agents"],
  "context": {
    "consumer_id": "default-chat-assistant",
    "consumer_type": "agent",
    "sources": [
      {
        "schema_name": "user.message.v1",
        "method": "vector",
        "nn": 5,
        "filters": {"tag": "workspace:agents"}
      },
      {
        "schema_name": "tool.response.v1",
        "method": "recent",
        "limit": 3,
        "filters": {
          "context_match": [{
            "path": "$.requestedBy",
            "op": "eq",
            "value": "default-chat-assistant"
          }]
        }
      },
      {
        "schema_name": "tool.catalog.v1",
        "method": "latest",
        "filters": {"tag": "workspace:tools"}
      }
    ],
    "update_triggers": [
      {"schema_name": "user.message.v1", "any_tags": ["workspace:agents"]},
      {"schema_name": "tool.response.v1", "context_match": [{
        "path": "$.requestedBy",
        "op": "eq",
        "value": "default-chat-assistant"
      }]}
    ],
    "output": {
      "schema_name": "agent.context.v1",
      "tags": ["agent:context", "consumer:default-chat-assistant"],
      "ttl_seconds": 3600
    },
    "formatting": {
      "max_tokens": 4000,
      "deduplication_threshold": 0.95
    }
  }
}
EOF

# Option B: Via script (create this)
node scripts/bootstrap-context-builder.js
```

### **Step 6: Verify Everything Works**

```bash
# 1. Check all services are running
docker-compose ps

# Should show:
# rcrt              - Up
# context-builder   - Up
# tools-runner      - Up
# agent-runner      - Up
# dashboard         - Up

# 2. Send test message via browser extension or curl
curl -X POST http://localhost:8081/breadcrumbs \
  -H 'Content-Type: application/json' \
  -d '{
    "schema_name": "user.message.v1",
    "title": "Test Message",
    "tags": ["user:message", "workspace:agents"],
    "context": {"content": "What tools are available?"}
  }'

# 3. Watch context-builder logs
docker-compose logs -f context-builder

# Should show:
# "🔄 Event matches trigger for default-chat-assistant"
# "🔍 Assembling context..."
# "📊 Vector search for user.message.v1: 5 results"
# "✅ Updated context for default-chat-assistant (1500 tokens)"

# 4. Watch agent-runner logs
docker-compose logs -f agent-runner

# Should show:
# "🎯 Received pre-built context from context-builder"
# "📊 Context stats: 1500 tokens, 3 sources"
# "📝 Formatted context: 1200 chars, ~300 tokens"
# "🔧 Created LLM request with pre-built context"
```

## 🔍 **Troubleshooting**

### **Issue: context-builder not updating agent.context.v1**

**Check:**
```bash
# 1. Verify context.config.v1 exists
curl "http://localhost:8081/breadcrumbs?schema_name=context.config.v1"

# 2. Check context-builder logs for errors
docker-compose logs context-builder | grep "ERROR\|Failed"

# 3. Verify NATS is working
docker-compose logs rcrt | grep "NATS"
```

**Fix:**
- Ensure context.config.v1 was created (Step 5)
- Restart context-builder: `docker-compose restart context-builder`

### **Issue: Agent not receiving agent.context.v1**

**Check:**
```bash
# 1. Verify agent.context.v1 breadcrumb exists
curl "http://localhost:8081/breadcrumbs?schema_name=agent.context.v1&tag=consumer:default-chat-assistant"

# 2. Check agent subscriptions
docker-compose logs agent-runner | grep "subscription\|selector"
```

**Fix:**
- Verify agent definition was updated (bootstrap-breadcrumbs/system/default-chat-agent.json)
- Restart agent-runner: `docker-compose restart agent-runner`

### **Issue: Agent still using old buildContext()**

**Check logs:**
```bash
docker-compose logs agent-runner | grep "buildContext\|deprecated"
```

**If you see "Using deprecated buildContext":**
- Agent is in fallback mode (no context-builder detected)
- Verify context.config.v1 exists
- Verify context-builder service is running

### **Issue: Vector search not working**

**Test directly:**
```bash
curl "http://localhost:8081/breadcrumbs/search?q=test&nn=1"
```

**Expected:** JSON array (may be empty)
**Error:** Check ONNX model is loaded:
```bash
docker-compose logs rcrt | grep "embed\|ONNX"
```

## 📊 **Verification Checklist**

After deployment, verify:

- [ ] **RCRT server** responds to health check
- [ ] **Vector search** works with schema_name filter
- [ ] **context-builder service** starts and discovers configs
- [ ] **tools-runner** has context-builder tool registered
- [ ] **agent-runner** loads updated agent definition
- [ ] **context.config.v1** breadcrumb exists
- [ ] **agent.context.v1** gets created/updated
- [ ] **Agent receives** agent.context.v1 events
- [ ] **LLM requests** have ~1500 tokens (not 8000)
- [ ] **OpenRouter costs** reduced by ~80%

## 🎯 **Expected Behavior**

### **When User Sends Message:**

```
1. Browser extension creates user.message.v1
   Logs: extension → "Message sent"
   
2. context-builder-runner receives event
   Logs: context-builder → "Event matches trigger for default-chat-assistant"
   Logs: context-builder → "🔍 Assembling context for default-chat-assistant using 3 sources"
   Logs: context-builder → "📊 Vector search for user.message.v1: 5 results"
   Logs: context-builder → "✅ Updated context for default-chat-assistant (1500 tokens)"
   
3. agent-runner receives agent.context.v1 update
   Logs: agent-runner → "🎯 Received pre-built context from context-builder"
   Logs: agent-runner → "📊 Context stats: 1500 tokens, 3 sources"
   Logs: agent-runner → "📝 Formatted context: 1200 chars, ~300 tokens"
   Logs: agent-runner → "🔧 Created LLM request with pre-built context: req-..."
   
4. tools-runner receives tool.request.v1 for openrouter
   Logs: tools-runner → "🔍 Loading tool openrouter from breadcrumbs..."
   Logs: tools-runner → "🛠️  Executing tool: openrouter"
   Logs: tools-runner → "✅ Tool openrouter executed successfully in 2000ms"
   
5. Agent receives tool.response.v1
   Logs: agent-runner → "🔨 Tool response received"
   Logs: agent-runner → "📝 Creating agent.response.v1"
```

**Total time:** ~2.5 seconds
**Total tokens:** ~1900 (system prompt + context)
**Cost:** ~$0.009

### **Comparison to Old Behavior:**

```
OLD:
1. Agent receives user.message.v1
2. Agent fetches 110 breadcrumbs (150ms)
3. Agent builds context manually
4. Agent sends 8400 tokens to LLM
5. Cost: ~$0.042

NEW:
1. context-builder receives user.message.v1
2. context-builder does vector search (60ms)
3. context-builder updates agent.context.v1
4. Agent receives agent.context.v1 (pre-built!)
5. Agent sends 1900 tokens to LLM
6. Cost: ~$0.009

Improvement: 77% cost reduction, agent does less work!
```

## 🎓 **Post-Deployment Monitoring**

### **Monitor context-builder performance:**
```bash
# Check context update frequency
docker-compose logs context-builder | grep "Updated context" | wc -l

# Check token estimates
docker-compose logs context-builder | grep "token_estimate"

# Check for errors
docker-compose logs context-builder | grep "ERROR\|Failed"
```

### **Monitor agent performance:**
```bash
# Check how many events agent receives
docker-compose logs agent-runner | grep "Processing event"

# Should be ~2-3 per user message (not 300!)

# Check if using pre-built context
docker-compose logs agent-runner | grep "pre-built context"

# Should see: "Received pre-built context from context-builder"
```

### **Monitor costs:**
```bash
# Check OpenRouter usage
docker-compose logs tools-runner | grep "prompt_tokens"

# Before: 5171 tokens per message
# After: ~1500 tokens per message
```

## ✅ **Success Criteria**

After deployment, you should see:

✅ **Events reduced** from ~300 to ~2 per conversation
✅ **Tokens reduced** from ~8000 to ~1500 per message  
✅ **Costs reduced** by ~80%
✅ **Relevance improved** - vector search finds related messages
✅ **Formatting improved** - Clean Markdown, not JSON
✅ **Agent simplified** - No manual context building

## 🔄 **Rollback Plan**

If something goes wrong:

```bash
# 1. Revert agent definition to old version
git checkout HEAD~1 bootstrap-breadcrumbs/system/default-chat-agent.json
git checkout HEAD~1 scripts/default-chat-agent.json

# 2. Rebuild agent-runner
docker-compose up -d --build agent-runner

# 3. Stop context-builder (optional)
docker-compose stop context-builder

# Agent will fall back to old behavior automatically
```

**Fallback is safe** because new agent-executor has `handleChatMessageDirect()` that works without context-builder!

## 🎯 **Next Steps After Deployment**

1. **Monitor for 24 hours** - Check logs, costs, performance
2. **Tune vector search** - Adjust `nn` parameter if needed (5 → 3 or 5 → 7)
3. **Add more consumers** - Create context configs for other agents/workflows
4. **Optimize embedding** - Consider GPU acceleration for faster searches
5. **Add analytics** - Track token savings, relevance scores

---

**You're ready to deploy the RCRT way!** 🚀

