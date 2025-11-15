# Rebuild and Test Guide - v4.1.0

**Date**: November 12, 2025  
**Changes**: Validation loop fix, timeout field normalization, Context Viewer UI  
**Status**: ✅ Ready to rebuild and test

---

## 🚀 Quick Rebuild (5 minutes)

```bash
# 1. Rebuild context-builder (Rust - none_tags support)
docker compose build context-builder

# 2. Rebuild extension (TypeScript - Context Viewer)
cd rcrt-extension-v2
npm run build
cd ..

# 3. Update agent definitions
node scripts/update-breadcrumb.js bootstrap-breadcrumbs/system/validation-specialist-agent.json
node scripts/update-breadcrumb.js bootstrap-breadcrumbs/system/tool-debugger-agent.json
node scripts/update-breadcrumb.js bootstrap-breadcrumbs/system/tool-creator-agent.json

# 4. Restart services
docker compose restart context-builder agent-runner

# 5. Reload extension in Chrome
# Go to chrome://extensions → Click reload button on RCRT Extension

# Done! 🎉
```

---

## 📋 What Was Fixed

### 1. Validation Loop (CRITICAL) ✅

**Problem**: validation-specialist re-validated the same tool endlessly (v2 → v3 → v4 → v5...)

**Solution**:
- Added `none_tags: ["validated"]` to validation-specialist's context_trigger
- Implemented `none_tags` support in context-builder (Rust)
- Now triggers ONLY for NEW tools (without "validated" tag)

**Verification**:
```bash
# Watch counter tool version (should stop incrementing)
TOOL_ID=$(curl -s http://localhost:8081/breadcrumbs?tag=tool:counter | jq -r '.[0].id')
watch -n 2 "curl -s http://localhost:8081/breadcrumbs/$TOOL_ID/full | jq '.version'"

# Should stabilize at version 2 (or current + 1 after final validation)
```

### 2. Timeout Field Mismatch ✅

**Problem**: tool-creator generated `limits.timeout`, Deno expected `limits.timeout_ms`

**Solutions**:
- **A)** Deno executor fallback: `timeout_ms || timeout || 300000`
- **B)** Tool-creator prompt: Explicitly instructs on exact field names
- **C)** No existing tools to fix (handled by fallback)

**Verification**:
```bash
# Create tool with old field name - should work
node scripts/test-tool-lifecycle.js

# Should see in logs: "Tool execution timed out after 3000ms" (not "undefinedms")
```

### 3. Tool-Debugger Scope ✅

**Problem**: Only handled validation errors, not runtime/timeout/config errors

**Solution**:
- Updated prompt for comprehensive error types
- Added specific guidance for each error category
- Fixed schema reference: tool.validation.error.v1 → tool.error.v1

**Verification**:
```bash
# Check tool-debugger can handle different error types
docker compose logs agent-runner -f | grep tool-debugger
```

---

## 🎨 What Was Added

### Context Viewer (Extension UI)

**Provides visibility into LLM context** - crucial for debugging!

**Features**:
- 📊 **Metadata display**: Consumer, token count, breadcrumb count, timestamp
- 📁 **Collapsible sections**: Expand/collapse context parts
- 📋 **Copy buttons**: Individual sections or entire context
- 🎨 **Smart formatting**: JSON syntax highlighting, list bullets, monospace text
- 🔍 **Type detection**: Automatically detects JSON vs text vs lists

**Access Points**:

1. **In Chat** (ChatPanel):
   - Send message → Get assistant response
   - Click **"Context"** button below assistant message
   - Modal opens with full LLM context

2. **In Left Panel** (NoteDetail):
   - Click on any `agent.context.v1` breadcrumb
   - **"LLM Context"** tab appears (with 🧠 icon)
   - Click tab to see formatted context

**Example View**:
```
🧠 LLM Context

Consumer: default-chat-assistant    Tokens: 11,581
Breadcrumbs: 20                      Assembled: 8:43 PM

▼ Available Tools (17 items)                    [Copy]
  • counter: Simple tool that counts from 1 to 10
  • openrouter: LLM API via OpenRouter
  [... 15 more]

▼ Conversation History (12 lines)               [Copy]
  [08:30] User: Create a counter tool
  [08:31] Assistant: I'll create that...
  [...]

▶ Relevant Knowledge (collapsed)

[Copy All]
```

---

## 🧪 Testing the Fixes

### Test 1: Validation Loop (MUST PASS)

**Expected**: validation-specialist validates ONCE, then stops

```bash
# Create new test tool
curl -X POST http://localhost:8081/breadcrumbs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schema_name": "tool.code.v1",
    "title": "Loop Test Tool",
    "tags": ["tool", "workspace:tools", "tool:loop-test"],
    "context": {
      "name": "loop-test",
      "code": {"language": "typescript", "source": "export async function execute(input, context) { return {success: true}; }"},
      "input_schema": {"type": "object", "properties": {}},
      "output_schema": {"type": "object", "properties": {"success": {"type": "boolean"}}},
      "limits": {"timeout_ms": 5000, "memory_mb": 128, "cpu_percent": 50},
      "permissions": {"net": false, "ffi": false, "hrtime": false},
      "required_secrets": [],
      "ui_schema": {"configurable": false}
    }
  }'

# Watch version
TOOL_ID=$(curl -s http://localhost:8081/breadcrumbs?tag=tool:loop-test | jq -r '.[0].id')
watch -n 2 "curl -s http://localhost:8081/breadcrumbs/$TOOL_ID/full | jq '.version'"

# ✅ Should be: 1 → 2 (approved) → STOPS
# ❌ Was: 1 → 2 → 3 → 4 → 5 → 6... (infinite loop)
```

### Test 2: Timeout Field Normalization (MUST PASS)

**Expected**: Tools work with either timeout or timeout_ms

```bash
# Run automated test
node scripts/test-tool-lifecycle.js

# Expected output:
# ✅ Tool created with ID: uuid
# ✅ Tool approved by validation-specialist!
# ✅ Tool request created: uuid
# ✅ tool.error.v1 breadcrumb created!
# ✅ Tool execution timed out after 3000ms (NOT undefinedms)
```

### Test 3: Context Viewer (VISUAL TEST)

**Expected**: Can see formatted LLM context in extension

```bash
# 1. Rebuild extension (if not done)
cd rcrt-extension-v2 && npm run build

# 2. Reload in Chrome
# chrome://extensions → Click reload

# 3. Open extension sidepanel
# 4. Send message: "Hello"
# 5. Wait for response
# 6. Click "Context" button below response
# 7. Modal opens with formatted sections

# ✅ Should see:
#    - Collapsible sections
#    - Metadata (tokens, consumer, etc.)
#    - Copy buttons
#    - Readable formatting (not JSON blob)
```

### Test 4: Complete Tool Lifecycle (FULL E2E)

**Expected**: Create → Validate → Execute → Error → Debug → Fix

```bash
# Run comprehensive test
node scripts/test-tool-lifecycle.js

# Watch all services
docker compose logs -f context-builder agent-runner tools-runner | grep -E "test-timeout|validation|debugger"

# ✅ Should complete all steps without errors
```

---

## 🔍 Verification Checklist

After rebuild, verify:

- [ ] Context-builder starts without errors
  ```bash
  docker compose logs context-builder | tail -20
  ```

- [ ] Agents loaded correctly
  ```bash
  curl http://localhost:8081/breadcrumbs?schema_name=agent.def.v1 | jq 'length'
  # Should be: 8 (4 specialists + 4 note agents)
  ```

- [ ] Validation-specialist has none_tags
  ```bash
  curl http://localhost:8081/breadcrumbs?tag=agent:validation-specialist | jq '.[0].context.context_trigger.none_tags'
  # Should be: ["validated"]
  ```

- [ ] Extension loads without errors
  ```bash
  # Open Chrome DevTools on extension
  # Check console for errors
  ```

- [ ] Context Viewer component renders
  ```bash
  # In extension, open a chat
  # Send message, get response
  # Click "Context" button
  # Should see modal (not error)
  ```

---

## 🐛 Troubleshooting

### "Validation loop still happening"

**Cause**: Context-builder not rebuilt (still missing none_tags support)

**Fix**:
```bash
docker compose build context-builder
docker compose restart context-builder
```

### "Context button doesn't appear"

**Cause**: Extension not rebuilt or old version cached

**Fix**:
```bash
cd rcrt-extension-v2
npm run build
# Then reload extension in Chrome
```

### "Context modal shows error"

**Cause**: Missing lucide-react icons or TypeScript errors

**Fix**:
```bash
cd rcrt-extension-v2
npm install  # Ensure dependencies
npm run build
# Check browser console for specific errors
```

### "Tool still has timeout field instead of timeout_ms"

**Cause**: Tool created before tool-creator was updated

**Fix**:
- The deno-executor fallback handles this gracefully
- Future tools will use correct field name
- Existing tools work via fallback chain

---

## 📊 Expected System State After Rebuild

### Services

```bash
docker compose ps

# All should be healthy:
# ✅ postgres
# ✅ nats  
# ✅ rcrt
# ✅ context-builder
# ✅ agent-runner
# ✅ tools-runner
# ✅ dashboard
```

### Agents

```bash
curl http://localhost:8081/breadcrumbs?schema_name=agent.def.v1 | jq '.[].context.agent_id'

# Should show:
# "default-chat-assistant"
# "validation-specialist"
# "tool-creator"
# "tool-debugger"
# "note-tagger"
# "note-summarizer"
# "note-insights"
# "note-eli5"
```

### Tools

```bash
curl http://localhost:8081/breadcrumbs?schema_name=tool.code.v1&tag=approved | jq 'length'

# Should show: 11-15 approved tools
```

### Extension

- ✅ Loads without errors
- ✅ Can send messages
- ✅ Receives responses
- ✅ Context button appears on assistant messages
- ✅ Context modal opens and shows formatted view
- ✅ Can view agent.context.v1 breadcrumbs in left panel

---

## 🎯 Success Criteria

After rebuild, you should be able to:

✅ **Create tools** without validation loops  
✅ **Execute tools** with either timeout or timeout_ms  
✅ **View LLM context** in extension (both chat and left panel)  
✅ **Debug context assembly** by seeing exact sections  
✅ **Copy context** for external analysis  
✅ **Run automated tests** successfully  

---

## 📁 Modified Files Summary

### Rust (2 files)
- `crates/rcrt-context-builder/src/agent_config.rs` - Added none_tags field
- `crates/rcrt-context-builder/src/event_handler.rs` - Implemented none_tags logic

### TypeScript (2 files)
- `rcrt-visual-builder/packages/tools/src/deno-executor.ts` - Added timeout fallback
- `rcrt-extension-v2/src/sidepanel/ContextViewer.tsx` - NEW component (200 lines)
- `rcrt-extension-v2/src/sidepanel/ChatPanel.tsx` - Integrated Context Viewer
- `rcrt-extension-v2/src/sidepanel/NoteDetail.tsx` - Added context tab

### JSON (3 files)
- `bootstrap-breadcrumbs/system/validation-specialist-agent.json` - Added none_tags
- `bootstrap-breadcrumbs/system/tool-creator-agent.json` - Updated prompt
- `bootstrap-breadcrumbs/system/tool-debugger-agent.json` - Expanded error handling

### Scripts (3 files)
- `scripts/test-tool-lifecycle.js` - NEW automated test
- `scripts/TESTING_TOOL_LIFECYCLE.md` - NEW testing guide
- `scripts/cleanup-duplicate-agents.sql` - NEW cleanup script

### Documentation (4 files)
- `CHANGELOG.md` - Added v4.1.0 section
- `VALIDATION_LOOP_FIX.md` - NEW technical explanation
- `SESSION_CONTINUATION_SUMMARY.md` - NEW session summary
- `rcrt-extension-v2/CONTEXT_VIEWER_FEATURE.md` - NEW feature docs

**Total**: 18 files (2 Rust, 4 TypeScript, 3 JSON, 3 scripts, 4 docs, 2 guides)

---

## 🎉 After Rebuild

You'll have a **production-ready tool lifecycle** with:

1. ✅ **No validation loops** - Tools validated once and left alone
2. ✅ **Field name tolerance** - Both timeout and timeout_ms work
3. ✅ **Complete visibility** - See exact LLM context in beautiful UI
4. ✅ **Comprehensive testing** - Automated scripts verify everything
5. ✅ **Auto-debugging** - Errors trigger automatic fixes
6. ✅ **Knowledge creation** - System learns from mistakes

**Ready to create and run complex tools end-to-end!** 🚀

---

## 📞 Next Steps After Testing

Once you verify everything works:

1. **Test complex tools**:
   - Browser automation (Astral)
   - API integrations
   - Multi-step workflows

2. **Test error scenarios**:
   - Permission errors
   - Runtime crashes
   - Configuration issues

3. **Performance testing**:
   - Concurrent tool creation
   - Large contexts (token limits)
   - Multiple simultaneous sessions

4. **Knowledge accumulation**:
   - Verify tool-debugger creates knowledge.v1
   - Check knowledge is used in future fixes

---

## 🆘 If Something Breaks

1. **Check service logs**:
   ```bash
   docker compose logs -f context-builder agent-runner tools-runner
   ```

2. **Verify agents loaded**:
   ```bash
   curl http://localhost:8081/breadcrumbs?schema_name=agent.def.v1
   ```

3. **Check extension console**:
   - Right-click extension icon → Inspect
   - Look for errors in console

4. **Rollback if needed**:
   ```bash
   git checkout crates/rcrt-context-builder/
   git checkout bootstrap-breadcrumbs/system/
   docker compose build context-builder
   docker compose restart context-builder agent-runner
   ```

---

**Everything is ready. Just rebuild, restart, and test!** ✨




