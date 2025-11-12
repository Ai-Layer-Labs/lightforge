# Testing Tool Lifecycle End-to-End

## Quick Start

### Automated Test

```bash
# Run the complete automated test
node scripts/test-tool-lifecycle.js
```

This will:
1. Create a test tool with intentional timeout field error
2. Wait for validation-specialist approval
3. Execute the tool (will timeout)
4. Verify tool.error.v1 creation
5. Wait for tool-debugger to fix it
6. Verify fix was applied

### Expected Output

```
✅ Tool created with ID: uuid
✅ Tool approved by validation-specialist!
✅ Tool request created: uuid
✅ tool.error.v1 breadcrumb created!
✅ tool-debugger created response!
✅ Tool FIXED! limits.timeout → limits.timeout_ms
🎉 ALL TESTS PASSED! Complete lifecycle working end-to-end!
```

---

## Manual Testing Steps

### 1. Update Bootstrap Files

If you've made changes to agent definitions, reload them:

```bash
# Update tool-creator agent
node scripts/update-breadcrumb.js bootstrap-breadcrumbs/system/tool-creator-agent.json

# Update tool-debugger agent
node scripts/update-breadcrumb.js bootstrap-breadcrumbs/system/tool-debugger-agent.json

# Update validation-specialist agent
node scripts/update-breadcrumb.js bootstrap-breadcrumbs/system/validation-specialist-agent.json

# Restart agent-runner to pick up changes
docker compose restart agent-runner
```

### 2. Watch Service Logs

Open 4 terminal windows:

**Terminal 1 - Context Builder:**
```bash
docker compose logs context-builder -f | grep -E "tool|validation|debugger"
```

**Terminal 2 - Agent Runner:**
```bash
docker compose logs agent-runner -f | grep -E "tool|validation|debugger"
```

**Terminal 3 - Tools Runner:**
```bash
docker compose logs tools-runner -f | grep -E "timeout|error"
```

**Terminal 4 - RCRT Server:**
```bash
docker compose logs rcrt -f | grep -E "tool\.code|tool\.error"
```

### 3. Create Test Tool

```bash
# Using the automated script (recommended)
node scripts/test-tool-lifecycle.js

# OR manually via API
curl -X POST http://localhost:8081/breadcrumbs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schema_name": "tool.code.v1",
    "title": "Test Tool",
    "tags": ["tool", "workspace:tools", "tool:test", "test"],
    "context": {
      "name": "test-tool",
      "code": {"language": "typescript", "source": "export async function execute(input, context) { return {success: true}; }"},
      "input_schema": {"type": "object", "properties": {}},
      "output_schema": {"type": "object", "properties": {"success": {"type": "boolean"}}},
      "limits": {
        "timeout": 5000,
        "memory_mb": 128,
        "cpu_percent": 50
      },
      "permissions": {"net": false, "ffi": false, "hrtime": true},
      "required_secrets": [],
      "ui_schema": {"configurable": false}
    }
  }'
```

### 4. Verify Validation Flow

**Expected logs:**

**context-builder:**
```
🎯 1 agent(s) want context for tool.code.v1
🔄 Assembling context for validation-specialist
✅ Context published with 5 breadcrumbs
```

**agent-runner:**
```
🎯 [validation-specialist] agent.context.v1 is TRIGGER
📤 Creating agent response with tool_requests...
✅ Response created
```

**Check tool tags:**
```bash
curl http://localhost:8081/breadcrumbs/$TOOL_ID/full | jq '.tags'
# Should include: "approved", "validated"
```

### 5. Execute Tool to Trigger Error

```bash
curl -X POST http://localhost:8081/breadcrumbs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schema_name": "tool.request.v1",
    "tags": ["tool:request", "workspace:tools"],
    "context": {
      "tool": "test-tool",
      "input": {},
      "requestId": "test-'$(date +%s)'",
      "requestedBy": "test-script"
    }
  }'
```

### 6. Verify Error Creation

**Expected logs (tools-runner):**
```
🎯 Executing tool: test-tool
❌ Tool execution error: timeout
✅ Created error breadcrumbs (response + debug)
```

**Check error breadcrumb:**
```bash
curl http://localhost:8081/breadcrumbs?schema_name=tool.error.v1&tag=tool:test | jq '.'
```

### 7. Verify Auto-Debugging

**Expected logs:**

**context-builder:**
```
🎯 1 agent(s) want context for tool.error.v1
🔄 Assembling context for tool-debugger
✅ Context published with error diagnostics
```

**agent-runner:**
```
🎯 [tool-debugger] agent.context.v1 is TRIGGER
📤 Creating agent response with tool_requests...
✅ Fix applied via breadcrumb-update
```

**Check tool fixed:**
```bash
curl http://localhost:8081/breadcrumbs/$TOOL_ID/full | jq '.context.limits'
# Should have: "timeout_ms": 5000 (not "timeout")
```

---

## Troubleshooting

### Validation Not Triggering

**Check:**
1. Does tool have `workspace:tools` tag?
2. Is validation-specialist loaded?
   ```bash
   curl http://localhost:8081/breadcrumbs?schema_name=agent.def.v1 | jq '.[] | select(.context.agent_id=="validation-specialist")'
   ```
3. Is context-builder running?
   ```bash
   docker compose ps context-builder
   ```

**Fix:**
```bash
# Reload validation-specialist
node scripts/update-breadcrumb.js bootstrap-breadcrumbs/system/validation-specialist-agent.json
docker compose restart agent-runner
```

### Error Not Created

**Check:**
1. Is tools-runner creating dual breadcrumbs?
   ```bash
   docker compose logs tools-runner | grep "Created error breadcrumbs"
   ```
2. Was tool approved (has `approved` tag)?

**Fix:**
Check tools-runner code at `rcrt-visual-builder/apps/tools-runner/src/index.ts`

### Debugger Not Triggering

**Check:**
1. Is tool.error.v1 created?
   ```bash
   curl http://localhost:8081/breadcrumbs?schema_name=tool.error.v1 | jq 'length'
   ```
2. Is tool-debugger loaded?
   ```bash
   curl http://localhost:8081/breadcrumbs?schema_name=agent.def.v1 | jq '.[] | select(.context.agent_id=="tool-debugger")'
   ```
3. Is context-builder finding tool-debugger?
   ```bash
   docker compose logs context-builder | grep tool-debugger
   ```

**Fix:**
```bash
# Reload tool-debugger
node scripts/update-breadcrumb.js bootstrap-breadcrumbs/system/tool-debugger-agent.json
docker compose restart agent-runner
```

### Fix Not Applied

**Check:**
1. Did tool-debugger create response?
   ```bash
   curl http://localhost:8081/breadcrumbs?schema_name=agent.response.v1&tag=tool:debugging | jq '.'
   ```
2. Are there tool_requests in the response?
3. Was breadcrumb-update successful?
   ```bash
   docker compose logs tools-runner | grep breadcrumb-update
   ```

---

## Success Criteria

✅ **Validation Flow:**
- tool.code.v1 created → context-builder assembles → validation-specialist approves → tool has `approved` tag

✅ **Error Flow:**
- tool.request.v1 → tools-runner executes → error occurs → tool.error.v1 created

✅ **Auto-Debugging:**
- tool.error.v1 created → context-builder assembles → tool-debugger fixes → tool updated

✅ **Complete Lifecycle:**
- Create → Validate → Execute → Error → Debug → Fix (all working end-to-end)

---

## Key Files

**Agent Definitions:**
- `bootstrap-breadcrumbs/system/validation-specialist-agent.json`
- `bootstrap-breadcrumbs/system/tool-debugger-agent.json`
- `bootstrap-breadcrumbs/system/tool-creator-agent.json`

**Service Code:**
- Context Builder: `crates/rcrt-context-builder/src/event_handler.rs`
- Agent Runner: `rcrt-visual-builder/packages/runtime/src/executor/universal-executor.ts`
- Tools Runner: `rcrt-visual-builder/apps/tools-runner/src/index.ts`
- Deno Executor: `rcrt-visual-builder/packages/tools/src/deno-executor.ts`

**Test Scripts:**
- Automated: `scripts/test-tool-lifecycle.js`
- Update Agent: `scripts/update-breadcrumb.js`

---

## Next Steps After Success

1. **Test Complex Tools:**
   - Create tools with browser automation
   - Test with external API calls
   - Verify all permission types

2. **Test Error Patterns:**
   - Permission errors
   - Runtime errors
   - Validation errors
   - Configuration errors

3. **Performance Testing:**
   - Multiple concurrent tool creations
   - Stress test validation pipeline
   - Verify no bottlenecks

4. **Knowledge Creation:**
   - Verify tool-debugger creates knowledge.v1 for new patterns
   - Check knowledge is used in future fixes

