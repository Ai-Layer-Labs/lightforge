# Pure Agent Validation Deployment Guide

## 🎯 What Changed

**MASSIVE architectural improvement:** Validation is now 100% agent-based with zero hardcoded rules.

### Removed Hardcoded Validation
- ❌ `CodeValidator.validate()` - Was hardcoded regex
- ❌ `SchemaValidator.validate()` - Was hardcoded type checks
- ❌ `validateTool()` method - Was synchronous validation
- ✅ Now: validation-specialist agent with evolving knowledge

### Pure Subscription Architecture
```
tool.code.v1 (subscription) → validation-specialist
    ↓ (validates)
breadcrumb-update (adds "approved" tag)
    ↓ (subscription)
tool.code.v1 with "approved" (subscription) → tools-runner
    ↓ (loads)
Tool available!
```

---

## ⚠️ BOOTSTRAP ISSUE

**Problem:** Existing bootstrap tools don't have "approved" tags yet!

**Result:** Tools-runner will say "0 approved tools" on first deploy.

**Solution:** One-time bootstrap approval needed.

---

## 🚀 Deployment Steps

### Option A: Manual Approval (Quick)

```bash
# 1. Rebootstrap
cd bootstrap-breadcrumbs && node bootstrap.js && cd ..

# 2. Rebuild
docker compose build context-builder
cd rcrt-visual-builder && pnpm --filter @rcrt-builder/tools build && cd ..

# 3. Deploy
docker compose up -d

# 4. Manually tag working bootstrap tools as "approved"
# List of good tools: echo, timer, random, breadcrumb-create, breadcrumb-update, breadcrumb-search, openrouter, venice

for tool in echo timer random breadcrumb-create breadcrumb-update breadcrumb-search openrouter venice; do
  TOOL_ID=$(curl -s "http://localhost:8080/breadcrumbs?schema_name=tool.code.v1&tag=tool:$tool" | jq -r '.[0].id')
  TOOL_VERSION=$(curl -s "http://localhost:8080/breadcrumbs/$TOOL_ID" | jq -r '.version')
  TOOL_TAGS=$(curl -s "http://localhost:8080/breadcrumbs/$TOOL_ID" | jq -r '.tags')
  
  curl -X PATCH "http://localhost:8080/breadcrumbs/$TOOL_ID" \
    -H "Content-Type: application/json" \
    -H "If-Match: $TOOL_VERSION" \
    -d "{\"tags\": $(echo $TOOL_TAGS | jq '. + ["approved", "validated"]')}"
done

# 5. Restart tools-runner
docker compose restart tools-runner

# 6. Verify
docker compose logs tools-runner --tail=30 | grep "approved tool"
# Should see: 8-9 approved tools loaded
```

### Option B: Let validation-specialist Approve (Proper)

```bash
# 1-3. Same as Option A

# 4. Wait for validation-specialist to approve tools
# validation-specialist will see all tool.code.v1 breadcrumbs
# Will validate each and add "approved" tag
# This may take 2-3 minutes for all tools

# 5. Watch logs
docker compose logs -f | grep -E "validation-specialist|approved"

# 6. After ~3 minutes, restart tools-runner
docker compose restart tools-runner
```

---

## 🧪 Testing Pure Agent Validation

### Test 1: New Tool Auto-Approval
```
User: "Create a simple greeting tool"
    ↓
tool-creator creates tool.code.v1
    ↓
validation-specialist sees it → validates → adds "approved"
    ↓
tools-runner sees "approved" → loads tool
    ↓
User can immediately use tool!
```

### Test 2: Validation Rejection → Fix Loop
```
User: "Create a tool with eval()"
    ↓
tool-creator creates tool (with eval)
    ↓
validation-specialist → tool.validation.error.v1
    ↓
tool-debugger → fixes → breadcrumb-update
    ↓
validation-specialist → re-validates → adds "approved"
    ↓
tools-runner → loads tool
```

### Test 3: System Learning
```
Tool uses page.$eval()
    ↓
validation-specialist blocks (matches eval pattern)
    ↓
tool-debugger: "False positive - $eval is safe"
    ↓
breadcrumb-update validation-rules-v1.json (add exception)
    ↓
Next tool with $eval → validation-specialist approves instantly!
```

---

## 📊 System Capabilities

**Before:**
- ❌ Hardcoded validation in TypeScript
- ❌ Requires code changes to update rules
- ❌ No learning from mistakes
- ❌ No audit trail

**After:**
- ✅ validation-specialist agent
- ✅ Rules in validation-rules-v1.json (evolvable)
- ✅ Learns via breadcrumb-update
- ✅ Full version history audit trail
- ✅ Pure subscriptions
- ✅ Fire-and-forget

---

## 🎯 Files Changed (Summary)

**Created (5):**
1. `validation-rules-v1.json` - Evolving validation knowledge
2. `validation-specialist-agent.json` - Validation agent
3. `tool-debugger-agent.json` - Debugging agent
4. `breadcrumb-update.json` - Update tool
5. `tool-validation-error-v1.json` - Error schema

**Modified (7):**
1. `deno-runtime.ts` - Removed hardcoded validation
2. `tools-runner/index.ts` - Subscribe to approved tools
3. `code-validator.ts` - Fixed regex (keep as reference)
4. `event_handler.rs` - Added tool-debugger handler
5. `validation-specialist-agent.json` - Direct subscriptions
6. Knowledge guides - Optimized
7. `tool-creator-agent.json` - Streamlined

---

## 🎉 Achievement Unlocked

**RCRT is now FULLY DATA-DRIVEN:**
- Configuration: breadcrumbs
- Security policies: breadcrumbs
- Validation rules: breadcrumbs
- Agent behavior: breadcrumbs
- Learning: breadcrumb updates

**ZERO hardcoded business logic in code!**

Everything configurable, everything evolvable, everything auditable.

**This is the ultimate RCRT architecture.** 🚀

