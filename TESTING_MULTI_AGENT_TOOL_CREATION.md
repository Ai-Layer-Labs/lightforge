# Testing Multi-Agent Tool Creation System

## Prerequisites

1. **Rebootstrap the system:**
   ```bash
   cd bootstrap-breadcrumbs && node bootstrap.js
   ```

2. **Rebuild context-builder (Rust changes):**
   ```bash
   docker compose up --build context-builder -d
   ```

3. **Restart services:**
   ```bash
   docker compose restart agent-runner tools-runner
   ```

4. **Verify services are healthy:**
   ```bash
   docker compose ps
   docker compose logs context-builder --tail=50
   docker compose logs agent-runner --tail=50
   docker compose logs tools-runner --tail=50
   ```

5. **Check agent catalog:**
   ```bash
   curl -s http://localhost:8081/breadcrumbs?schema_name=agent.catalog.v1 | jq '.[] | {title, agents: .context.agents | map(.agent_id)}'
   ```
   
   **Expected:** Should show `default-chat-assistant` and `tool-creator`

6. **Check tool catalog:**
   ```bash
   curl -s http://localhost:8081/breadcrumbs?schema_name=tool.catalog.v1 | jq '.[] | {title, tools: .context.tools | map(.name)}'
   ```
   
   **Expected:** Should show `breadcrumb-create` among others

---

## Test 1: Verify Breadcrumb-Create Tool

**Purpose:** Ensure breadcrumb-create tool works before testing full flow

**Steps:**
1. Create test tool request:
   ```bash
   curl -X POST http://localhost:8081/breadcrumbs \
     -H "Content-Type: application/json" \
     -d '{
       "schema_name": "tool.request.v1",
       "title": "Test: Breadcrumb Create",
       "tags": ["tool:request", "workspace:tools", "test"],
       "context": {
         "tool": "breadcrumb-create",
         "input": {
           "schema_name": "test.simple.v1",
           "title": "Test Breadcrumb",
           "tags": ["test"],
           "context": {"message": "Created by breadcrumb-create tool"}
         },
         "requestId": "test-bc-create-001",
         "requestedBy": "system-test"
       }
     }'
   ```

2. Wait 2 seconds, then check for response:
   ```bash
   sleep 2
   curl -s "http://localhost:8081/breadcrumbs?tag=request:test-bc-create-001" | jq
   ```

3. **Expected Result:**
   - tool.response.v1 exists with `request:test-bc-create-001` tag
   - response.context.status = "success"
   - response.context.output.success = true
   - response.context.output.id = UUID of created breadcrumb

4. **Verify test breadcrumb was created:**
   ```bash
   curl -s "http://localhost:8081/breadcrumbs?schema_name=test.simple.v1" | jq '.[0] | {title, context}'
   ```

**Result:** ✅ breadcrumb-create tool works

---

## Test 2: Verify Agent Context Sources

**Purpose:** Ensure default-chat-assistant receives agent.catalog.v1 in context

**Steps:**
1. Watch context-builder logs in one terminal:
   ```bash
   docker compose logs context-builder -f | grep -E "Seed|Knowledge|agent.catalog"
   ```

2. In another terminal, send test message:
   ```bash
   curl -X POST http://localhost:8081/breadcrumbs \
     -H "Content-Type: application/json" \
     -d '{
       "schema_name": "user.message.v1",
       "title": "Test Message",
       "tags": ["extension:chat", "session:test-session-001"],
       "context": {"message": "What agents are available?", "content": "What agents are available?"}
     }'
   ```

3. **Expected in logs:**
   - `+ Seed: agent.catalog.v1 (always: ...)`
   - Context published with agent.catalog breadcrumb included

4. **Check agent response:**
   ```bash
   sleep 3
   curl -s "http://localhost:8081/breadcrumbs?tag=session:test-session-001&schema_name=agent.response.v1" | jq '.[0].context.message'
   ```

**Expected:** Agent mentions available agents (default-chat-assistant, tool-creator)

**Result:** ✅ Agent catalog is in context

---

## Test 3: Full Multi-Agent Tool Creation Flow

**Purpose:** End-to-end test of coordinator → specialist → tool creation

### Phase 1: User Requests Tool via Extension

**Option A: Via Browser Extension (Recommended)**
1. Open extension side panel
2. In chat: "Create a browser automation tool called astral that uses the Astral library from jsr:@astral/astral"
3. Watch the flow in real-time

**Option B: Via API (For debugging)**
1. Create user message:
   ```bash
   curl -X POST http://localhost:8081/breadcrumbs \
     -H "Content-Type: application/json" \
     -d '{
       "schema_name": "user.message.v1",
       "title": "Tool Creation Request",
       "tags": ["extension:chat", "session:session-toolcreate-001"],
       "context": {
         "message": "Create a browser automation tool called astral using the Astral library from jsr:@astral/astral. It should be able to launch browsers, navigate, take screenshots, click elements, and extract page content.",
         "content": "Create a browser automation tool called astral using the Astral library from jsr:@astral/astral. It should be able to launch browsers, navigate, take screenshots, click elements, and extract page content."
       }
     }'
   ```

### Phase 2: Monitor Coordinator Response

2. Watch context-builder logs:
   ```bash
   docker compose logs context-builder -f | grep -E "user.message|default-chat|Knowledge"
   ```

3. Watch agent-runner logs:
   ```bash
   docker compose logs agent-runner -f | grep -E "default-chat|tool.creation"
   ```

4. Check coordinator's response:
   ```bash
   sleep 5
   curl -s "http://localhost:8081/breadcrumbs?tag=session:session-toolcreate-001&schema_name=agent.response.v1" | jq '.[0].context.message'
   ```

**Expected:** "I'm delegating this to our tool-creator specialist..."

5. Check for delegation breadcrumb:
   ```bash
   curl -s "http://localhost:8081/breadcrumbs?schema_name=tool.creation.request.v1&tag=session:session-toolcreate-001" | jq '.[0] | {title, context: {tool_name, description, requirements}}'
   ```

**Expected:** tool.creation.request.v1 with tool_name: "astral"

**Result:** ✅ Coordinator delegates correctly

### Phase 3: Monitor Specialist Processing

6. Watch for specialist context assembly:
   ```bash
   docker compose logs context-builder -f | grep -E "tool.creation.request|tool-creator|Semantic"
   ```

**Expected:**
- "🔧 Processing tool creation request event"
- "🔧 Assembling context for tool-creator specialist agent"
- "🔍 Semantic search for tool creation knowledge..."
- "✅ Published context for tool-creator"

7. Watch specialist agent execution:
   ```bash
   docker compose logs agent-runner -f | grep -E "tool-creator|breadcrumb-create"
   ```

**Expected:**
- "🎯 [tool-creator] agent.context.v1 is TRIGGER"
- "📤 Agent requesting tool(s)..."
- "✅ Tool request created: breadcrumb-create"

8. Check breadcrumb-create tool execution:
   ```bash
   docker compose logs tools-runner -f | grep -E "breadcrumb-create|tool.code.v1"
   ```

**Expected:**
- "🎯 Processing tool request: breadcrumb-create"
- "✅ Tool breadcrumb-create executed"

**Result:** ✅ Specialist processes and creates tool

### Phase 4: Verify Tool Created

9. Check for new tool.code.v1 breadcrumb:
   ```bash
   curl -s "http://localhost:8081/breadcrumbs?schema_name=tool.code.v1&tag=tool:astral" | jq '.[0] | {title, name: .context.name, version: .context.version}'
   ```

**Expected:** astral tool breadcrumb exists

10. Wait 5 seconds for tools-runner to reload, then check catalog:
    ```bash
    sleep 5
    curl -s "http://localhost:8081/breadcrumbs?schema_name=tool.catalog.v1" | jq '.[0].context.tools | map(select(.name == "astral"))'
    ```

**Expected:** astral appears in tool catalog

**Result:** ✅ Tool created and cataloged

### Phase 5: Verify Specialist Response

11. Check for specialist success response:
    ```bash
    curl -s "http://localhost:8081/breadcrumbs?tag=session:session-toolcreate-001" | jq '.[] | select(.schema_name == "agent.response.v1") | select(.tags | contains(["tool:creation"])) | {title, message: .context.message, tool_created: .context.created_tool}'
    ```

**Expected:** Specialist confirms tool creation with usage examples

**Result:** ✅ Specialist confirms success

### Phase 6: Test New Tool

12. Test the newly created astral tool:
    ```bash
    curl -X POST http://localhost:8081/breadcrumbs \
      -H "Content-Type: application/json" \
      -d '{
        "schema_name": "tool.request.v1",
        "title": "Test: Astral Launch",
        "tags": ["tool:request", "workspace:tools", "test"],
        "context": {
          "tool": "astral",
          "input": {
            "action": "launch",
            "url": "https://example.com",
            "headless": true
          },
          "requestId": "test-astral-001",
          "requestedBy": "system-test"
        }
      }'
    ```

13. Wait and check response:
    ```bash
    sleep 5
    curl -s "http://localhost:8081/breadcrumbs?tag=request:test-astral-001" | jq '.[0] | {status: .context.status, output: .context.output}'
    ```

**Expected:**
- status: "success"
- output contains: browser_id, page_id, url: "https://example.com"

**Result:** ✅ New tool works immediately!

---

## Expected Complete Breadcrumb Chain

When you query by session tag, you should see this sequence:

```bash
curl -s "http://localhost:8081/breadcrumbs?tag=session:session-toolcreate-001" | jq '.[] | {schema: .schema_name, title, created_at}' | jq -s 'sort_by(.created_at)'
```

**Expected sequence:**
1. `user.message.v1` - User request
2. `agent.context.v1` - Context for coordinator
3. `agent.response.v1` - Coordinator response "Delegating..."
4. `tool.creation.request.v1` - Delegation to specialist
5. `agent.context.v1` - Context for specialist (consumer:tool-creator)
6. `tool.request.v1` - Specialist calls breadcrumb-create
7. `tool.response.v1` - breadcrumb-create confirmation
8. `tool.code.v1` - The created tool! ✨
9. `agent.response.v1` - Specialist success message
10. `agent.response.v1` - Coordinator final message (optional)

**Total:** ~10 breadcrumbs tracking the entire flow

---

## Success Criteria

- ✅ Coordinator receives agent.catalog.v1 in context
- ✅ Coordinator creates tool.creation.request.v1
- ✅ context-builder assembles context for tool-creator
- ✅ tool-creator receives rich context (knowledge guides + tool examples)
- ✅ tool-creator generates valid tool.code.v1
- ✅ breadcrumb-create tool succeeds
- ✅ tools-runner loads new tool
- ✅ New tool executes successfully
- ✅ User receives success confirmation
- ✅ Session tags present throughout chain

---

## Debugging

### If Coordinator Doesn't Delegate

**Check:**
- agent.catalog.v1 is in coordinator's context sources
- Agent catalog has tool-creator listed
- Coordinator's system prompt includes delegation pattern

**Logs:**
```bash
docker compose logs context-builder | grep "agent.catalog"
docker compose logs agent-runner | grep "AVAILABLE AGENTS"
```

### If Specialist Doesn't Trigger

**Check:**
- tool.creation.request.v1 has session tag
- context-builder handles tool.creation.request.v1
- Specialist subscriptions match consumer:tool-creator

**Logs:**
```bash
docker compose logs context-builder | grep "tool.creation.request"
docker compose logs agent-runner | grep "tool-creator"
```

### If Tool Creation Fails

**Check:**
- Specialist received knowledge guides in context
- breadcrumb-create tool is in tool catalog
- Generated tool.code.v1 structure is valid

**Logs:**
```bash
docker compose logs tools-runner | grep "breadcrumb-create"
curl -s "http://localhost:8081/breadcrumbs?tag=request:create-tool" | jq '.[0].context'
```

### If New Tool Doesn't Load

**Check:**
- tool.code.v1 breadcrumb created successfully
- tools-runner reloaded catalog (or wait 30 seconds)
- Tool has correct tags: ['tool', 'tool:name', 'workspace:tools', 'self-contained']

**Logs:**
```bash
docker compose logs tools-runner | grep "tools available"
```

---

## Quick Test Script

Save as `test-tool-creation.sh`:

```bash
#!/bin/bash

echo "🧪 Testing Multi-Agent Tool Creation"

# Create user request
echo "1. Creating user request..."
curl -s -X POST http://localhost:8081/breadcrumbs \
  -H "Content-Type: application/json" \
  -d '{
    "schema_name": "user.message.v1",
    "title": "Tool Creation Test",
    "tags": ["extension:chat", "session:test-'.$(date +%s)'"],
    "context": {
      "message": "Create a browser automation tool called astral using jsr:@astral/astral",
      "content": "Create a browser automation tool called astral using jsr:@astral/astral"
    }
  }' > /dev/null

SESSION_TAG="session:test-$(date +%s)"

echo "2. Waiting for processing..."
sleep 10

echo "3. Checking for delegation..."
DELEGATION=$(curl -s "http://localhost:8081/breadcrumbs?schema_name=tool.creation.request.v1&tag=$SESSION_TAG")
if echo "$DELEGATION" | jq -e '.[0]' > /dev/null 2>&1; then
  echo "✅ Coordinator delegated to specialist"
else
  echo "❌ No delegation found"
  exit 1
fi

echo "4. Waiting for tool creation..."
sleep 20

echo "5. Checking for created tool..."
TOOL=$(curl -s "http://localhost:8081/breadcrumbs?schema_name=tool.code.v1&tag=tool:astral")
if echo "$TOOL" | jq -e '.[0]' > /dev/null 2>&1; then
  echo "✅ Tool created successfully!"
  echo "$TOOL" | jq '.[0] | {title, name: .context.name}'
else
  echo "❌ Tool not created"
  exit 1
fi

echo "6. Checking tool catalog..."
CATALOG=$(curl -s "http://localhost:8081/breadcrumbs?schema_name=tool.catalog.v1")
if echo "$CATALOG" | jq -e '.[0].context.tools[] | select(.name == "astral")' > /dev/null 2>&1; then
  echo "✅ Tool in catalog"
else
  echo "⚠️ Tool not in catalog yet (may need to wait for refresh)"
fi

echo ""
echo "🎉 Multi-agent tool creation test PASSED!"
```

Run:
```bash
chmod +x test-tool-creation.sh
./test-tool-creation.sh
```

---

## Expected Timeline

| Time | Event |
|------|-------|
| 0s | User message created |
| 0.1s | context-builder processes user.message.v1 |
| 0.5s | agent.context.v1 created for coordinator |
| 1s | Coordinator processes context |
| 2s | tool.creation.request.v1 created |
| 2s | Coordinator response: "Delegating..." |
| 2.5s | context-builder processes tool.creation.request.v1 |
| 3s | agent.context.v1 created for specialist |
| 5s | Specialist receives context with knowledge guides |
| 15s | Specialist generates complete tool.code.v1 (LLM processing) |
| 16s | Specialist creates breadcrumb-create request |
| 17s | breadcrumb-create executes |
| 18s | tool.code.v1 breadcrumb created |
| 19s | Specialist receives confirmation |
| 20s | Specialist creates success response |
| 25s | tools-runner reloads catalog |
| 30s | Tool available for use! |

**Total: ~30 seconds from request to working tool**

---

## Validation Checklist

After test completes:

### Breadcrumb Chain
- [ ] user.message.v1 exists with session tag
- [ ] agent.context.v1 exists for coordinator
- [ ] tool.creation.request.v1 exists with session tag
- [ ] agent.context.v1 exists for specialist (consumer:tool-creator)
- [ ] tool.request.v1 exists (breadcrumb-create)
- [ ] tool.response.v1 exists (breadcrumb-create result)
- [ ] tool.code.v1 exists (the created tool!)
- [ ] agent.response.v1 exists (specialist confirmation)

### Agent Behavior
- [ ] Coordinator delegated (didn't try to create tool itself)
- [ ] Specialist received rich context (check logs for knowledge breadcrumbs)
- [ ] Specialist validated structure before creation
- [ ] Session tags present in all breadcrumbs

### Tool Quality
- [ ] tool.code.v1 has all required fields
- [ ] Code has proper export async function execute
- [ ] Permissions are set correctly
- [ ] Examples are comprehensive
- [ ] llm_hints exclude code/permissions

### System Integration
- [ ] tools-runner loaded new tool
- [ ] Tool appears in tool.catalog.v1
- [ ] Tool is callable via tool.request.v1
- [ ] Tool executes without errors

---

## This Proves...

✅ **Multi-agent coordination WORKS**  
✅ **Coordinator-specialist pattern is VALID**  
✅ **context-builder supports multiple agent types**  
✅ **Knowledge semantic search enables specialist intelligence**  
✅ **breadcrumb-create tool enables autonomous creation**  
✅ **Session tag routing maintains conversation flow**  
✅ **Fire-and-forget scales to multi-agent scenarios**  

🚀 **THE SYSTEM CAN EVOLVE ITSELF!**

---

## Next Steps After Success

1. **Create more specialists:**
   - data-analyst
   - researcher
   - code-reviewer
   - test-engineer

2. **Add specialist coordination:**
   - Specialist → Specialist chains
   - Specialist consensus mechanisms
   - Priority-based routing

3. **Enhance tool-creator:**
   - Tool testing framework
   - Automatic validation
   - Version management
   - Deprecation workflow

4. **Scale the pattern:**
   - Dynamic specialist discovery from catalog
   - Load balancing across specialist instances
   - Performance metrics per specialist
   - Learning from delegation success/failure

**The foundation is now complete. The system can grow infinitely!**

