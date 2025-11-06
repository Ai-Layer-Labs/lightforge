# Note Agents - Fix Guide

**Problem:** Note agents trigger but don't process notes correctly  
**Root Cause:** Simple agents can't orchestrate tool calls  
**Solution:** Use workflow pattern (recommended) or create orchestrator agent

---

## 🔍 Current Problem

### What Happens Now

```
1. User saves page → note.v1 breadcrumb created
2. 4 note agents see event → all trigger
3. Agents try to assemble context:
   🔍 [note-tagger] Assembling context from subscriptions...
   ✅ [note-tagger] Context assembled with 0 sources  ← EMPTY!
4. Agents execute with no data:
   🔍 [note-tagger] Final context keys: [ 'creator', 'trigger_event_id', 'timestamp' ]
5. Agents create wrong breadcrumb:
   📤 [note-tagger] Response created with tags: [ 'agent:response', 'chat:output' ]
   ❌ Should be: note.tags.v1, not agent.response.v1!
```

### Why Context is Empty

**The subscription:**
```json
{
  "schema_name": "note.v1",
  "role": "trigger",
  "key": "note",
  "fetch": {"method": "latest", "limit": 1}
}
```

**What should happen:**
- Agent-runner calls `searchBreadcrumbs({schema_name: "note.v1"})`
- Gets latest note.v1 breadcrumb
- Fetches with `GET /breadcrumbs/{id}` (llm_hints applied)
- Returns transformed note content

**What's actually happening:**
- Search returns nothing or agent doesn't wait
- Context empty
- Agent has no note content to process

### Why They Don't Call LLM

**These simple agents:**
- Have system_prompt with instructions
- Try to execute directly
- Don't create `tool.request.v1` breadcrumbs
- Don't subscribe to `tool.response.v1`
- Can't orchestrate tools like default-chat-assistant does

**Compare to default-chat-assistant:**
- Subscribes to `tool.response.v1` (waits for LLM)
- Creates `tool.request.v1` to call openrouter
- Has complex orchestration logic
- Uses EventBridge for request/response correlation

---

## ✅ Solution 1: Workflow Pattern (RECOMMENDED)

**Why workflows?**
- ✅ Declarative (pure JSON, no code)
- ✅ Built-in parallel execution
- ✅ Tool orchestration handled automatically
- ✅ Most RCRT-native approach
- ✅ Easiest to maintain

### Implementation

**Delete the 4 note agents, create one workflow:**

**File:** `bootstrap-breadcrumbs/workflows/note-processing.json`

```json
{
  "schema_name": "workflow.def.v1",
  "title": "Note Processing Workflow",
  "tags": ["workflow:def", "workflow:note-processing", "workspace:workflows", "system:bootstrap"],
  "context": {
    "workflow_id": "note-processing",
    "description": "Automatically processes saved notes with 4 AI operations in parallel",
    
    "trigger": {
      "schema_name": "note.v1",
      "any_tags": ["note", "saved-page"]
    },
    
    "steps": [
      {
        "id": "generate_tags",
        "description": "Generate 7 relevant tags for the note",
        "tool": "openrouter",
        "parallel_group": "note_processing",
        "input": {
          "messages": [
            {
              "role": "system",
              "content": "Generate exactly 7 relevant tags for this article. Tags should vary in granularity. Output as JSON: {\"tags\": [\"tag1\", \"tag2\", ...]}"
            },
            {
              "role": "user",
              "content": "Title: ${trigger.title}\n\nContent: ${trigger.context.content}"
            }
          ]
        },
        "output": {
          "schema_name": "note.tags.v1",
          "title": "Note Tags",
          "tags": ["ai-generated", "note:${trigger.id}"],
          "context": {
            "note_id": "${trigger.id}",
            "tags": "${parse_json(result.content).tags}"
          }
        }
      },
      {
        "id": "generate_summary",
        "description": "Create 2-3 sentence summary",
        "tool": "openrouter",
        "parallel_group": "note_processing",
        "input": {
          "messages": [
            {
              "role": "system",
              "content": "Create a concise 2-3 sentence summary. Output as JSON: {\"summary\": \"...\"}"
            },
            {
              "role": "user",
              "content": "Title: ${trigger.title}\n\nContent: ${trigger.context.content}"
            }
          ]
        },
        "output": {
          "schema_name": "note.summary.v1",
          "title": "Note Summary",
          "tags": ["ai-generated", "note:${trigger.id}"],
          "context": {
            "note_id": "${trigger.id}",
            "summary": "${parse_json(result.content).summary}"
          }
        }
      },
      {
        "id": "extract_insights",
        "description": "Extract 3-5 key insights",
        "tool": "openrouter",
        "parallel_group": "note_processing",
        "input": {
          "messages": [
            {
              "role": "system",
              "content": "Extract 3-5 key insights. Output as JSON: {\"insights\": [\"insight1\", ...]}"
            },
            {
              "role": "user",
              "content": "Title: ${trigger.title}\n\nContent: ${trigger.context.content}"
            }
          ]
        },
        "output": {
          "schema_name": "note.insights.v1",
          "title": "Note Insights",
          "tags": ["ai-generated", "note:${trigger.id}"],
          "context": {
            "note_id": "${trigger.id}",
            "insights": "${parse_json(result.content).insights}"
          }
        }
      },
      {
        "id": "generate_eli5",
        "description": "Create ELI5 explanation",
        "tool": "openrouter",
        "parallel_group": "note_processing",
        "input": {
          "messages": [
            {
              "role": "system",
              "content": "Explain like I'm 5. Simple language, short sentences. Output as JSON: {\"eli5\": \"...\"}"
            },
            {
              "role": "user",
              "content": "Title: ${trigger.title}\n\nContent: ${trigger.context.content}"
            }
          ]
        },
        "output": {
          "schema_name": "note.eli5.v1",
          "title": "Note ELI5",
          "tags": ["ai-generated", "note:${trigger.id}"],
          "context": {
            "note_id": "${trigger.id}",
            "eli5": "${parse_json(result.content).eli5}"
          }
        }
      }
    ]
  }
}
```

**Then:**
1. Delete: note-tagger-agent.json, note-summarizer-agent.json, note-insights-agent.json, note-eli5-agent.json
2. Run: Full Reset & Rebootstrap (dashboard Settings panel)
3. Workflow loads automatically
4. Save a page → workflow triggers
5. 4 LLM calls in parallel
6. 4 result breadcrumbs created
7. Done!

---

## ✅ Solution 2: Orchestrator Agent

**Create one agent that manages all note processing:**

**File:** `bootstrap-breadcrumbs/system/note-processor-agent.json`

```json
{
  "schema_name": "agent.def.v1",
  "title": "Note Processor Agent",
  "tags": ["agent:def", "agent:note-processor", "workspace:agents", "system:bootstrap"],
  "context": {
    "agent_id": "note-processor",
    
    "llm_config_id": null,
    
    "system_prompt": "You process saved notes by calling the openrouter tool 4 times with different prompts.\n\nWhen you receive a note.v1 trigger:\n1. Extract note ID, title, and content\n2. Create 4 tool requests in parallel:\n   - Tags: Generate 7 relevant tags\n   - Summary: Create 2-3 sentence summary\n   - Insights: Extract 3-5 key insights\n   - ELI5: Simple explanation\n3. For each tool response, create the appropriate breadcrumb (note.tags.v1, note.summary.v1, etc.)\n\nOutput tool requests as:\n{\n  \"action\": \"create\",\n  \"breadcrumbs\": [\n    {\n      \"schema_name\": \"tool.request.v1\",\n      \"tags\": [\"tool:request\", \"workspace:tools\"],\n      \"context\": {\n        \"tool\": \"openrouter\",\n        \"requestId\": \"tags-${note_id}\",\n        \"requestedBy\": \"note-processor\",\n        \"input\": {...}\n      }\n    },\n    // ... 3 more tool requests\n  ]\n}",
    
    "capabilities": {
      "can_create_breadcrumbs": true,
      "can_use_tools": true,
      "can_update_own": false,
      "can_delete_own": false,
      "can_spawn_agents": false
    },
    
    "subscriptions": {
      "selectors": [
        {
          "comment": "Trigger on new notes",
          "schema_name": "note.v1",
          "role": "trigger",
          "key": "note",
          "fetch": {"method": "latest", "limit": 1}
        },
        {
          "comment": "Tool responses for our requests",
          "schema_name": "tool.response.v1",
          "all_tags": ["workspace:tools"],
          "context_match": [
            {"path": "$.requestedBy", "op": "eq", "value": "note-processor"}
          ],
          "role": "trigger",
          "key": "tool_response",
          "fetch": {"method": "event_data"}
        }
      ]
    }
  }
}
```

**Then:**
1. Delete the 4 simple note agents
2. Full Reset & Rebootstrap
3. One orchestrator handles all note processing

---

## ✅ Solution 3: Convert to Tools

**Make note processing code-based tools:**

**File:** `bootstrap-breadcrumbs/tools-self-contained/note-tagger.json`

```json
{
  "schema_name": "tool.code.v1",
  "title": "Note Tagger Tool",
  "tags": ["tool:code", "tool:note-tagger", "workspace:tools", "system:bootstrap"],
  "context": {
    "name": "note-tagger",
    "description": "Generates tags for notes by calling LLM",
    
    "subscriptions": {
      "selectors": [
        {"schema_name": "note.v1", "any_tags": ["note", "saved-page"]}
      ]
    },
    
    "code": `
async function noteT agger(input, context) {
  const { rcrtClient, tools } = context;
  const noteId = input.trigger_event_id;
  const note = await rcrtClient.getBreadcrumb(noteId, true);
  
  // Call openrouter
  const response = await tools.openrouter.execute({
    messages: [
      {role: "system", content: "Generate 7 tags. Output JSON: {\\"tags\\": [...]}"},
      {role: "user", content: note.context.content}
    ]
  });
  
  // Create result breadcrumb
  await rcrtClient.createBreadcrumb({
    schema_name: "note.tags.v1",
    title: "Note Tags",
    tags: ["ai-generated", \`note:\${noteId}\`],
    context: {
      note_id: noteId,
      tags: JSON.parse(response.content).tags
    }
  });
  
  return { success: true };
}
`
  }
}
```

**Repeat for:** note-summarizer, note-insights, note-eli5

**Then:** Bootstrap loads them as tools, tools-runner executes them

---

## 🎯 Recommendation

**Use Workflow Pattern (Solution 1)**

**Why:**
1. ✅ No code - pure JSON
2. ✅ Parallel execution built-in
3. ✅ Tool orchestration automatic
4. ✅ Easy to modify (just edit JSON)
5. ✅ Most RCRT-native
6. ✅ Declarative and maintainable

**vs Orchestrator Agent:**
- ❌ Complex system prompt
- ❌ Has to handle tool coordination
- ❌ More prone to LLM errors

**vs Tools:**
- ❌ Requires code
- ❌ Less declarative
- ❌ Harder to modify

---

## 📝 Implementation Steps

### Step 1: Create Workflow

```bash
# Create workflow definition
cat > bootstrap-breadcrumbs/workflows/note-processing.json << 'EOF'
{
  "schema_name": "workflow.def.v1",
  ...
}
EOF
```

### Step 2: Delete Old Agents

```bash
rm bootstrap-breadcrumbs/system/note-tagger-agent.json
rm bootstrap-breadcrumbs/system/note-summarizer-agent.json
rm bootstrap-breadcrumbs/system/note-insights-agent.json
rm bootstrap-breadcrumbs/system/note-eli5-agent.json
```

### Step 3: Create Workflows Directory in Bootstrap

```javascript
// In bootstrap.js, add after step 9 (states):

// 10. Load workflows
console.log('\n🔟 Loading workflows...');
const workflowsDir = path.join(__dirname, 'workflows');
if (fs.existsSync(workflowsDir)) {
  const workflowFiles = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.json'));
  
  for (const file of workflowFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(workflowsDir, file), 'utf-8'));
    
    const existing = await searchBreadcrumbs({
      schema_name: 'workflow.def.v1',
      tag: data.context.workflow_id ? `workflow:${data.context.workflow_id}` : 'workflow'
    });
    
    if (existing.length > 0) {
      console.log(`   ⏭️  ${data.title} already exists`);
      continue;
    }
    
    const resp = await api('POST', '/breadcrumbs', data);
    if (resp.ok) {
      console.log(`   ✅ Created: ${data.title}`);
    }
  }
}
```

### Step 4: Full Reset

**Via Dashboard:**
1. http://localhost:8082
2. Left panel → ⚙️ Settings
3. Click "🔥 Full Reset & Rebootstrap"
4. Confirm
5. Wait for reload

**Via Script:**
```bash
./scripts/reset-database-docker.sh
```

### Step 5: Verify

```bash
# Check workflow loaded
curl http://localhost:8081/breadcrumbs?schema_name=workflow.def.v1

# Save a test note
curl -X POST http://localhost:8081/breadcrumbs \
  -H "Content-Type: application/json" \
  -d '{
    "schema_name": "note.v1",
    "title": "Test Article",
    "tags": ["note", "saved-page"],
    "context": {
      "content": "# Machine Learning\n\nML is a subset of AI...",
      "url": "https://test.com/ml",
      "domain": "test.com"
    }
  }'

# Watch logs
docker compose logs -f agent-runner

# Should see:
# 🎯 [workflow:note-processing] note.v1 triggered
# 📤 Creating 4 tool requests...
# ✅ All 4 breadcrumbs created
```

---

## 🔧 Alternative: Quick Fix (Keep Current Agents)

If you want to keep the agent pattern, here's a minimal fix:

### Problem: Agents Don't Get Note Content

**Issue:** The `fetch: {method: "latest"}` isn't working

**Quick fix:** Change to explicit search in system_prompt

```json
{
  "system_prompt": "When triggered by note.v1:\n1. The trigger event has breadcrumb_id\n2. Call tools.breadcrumb-crud to fetch: GET /breadcrumbs/{breadcrumb_id}\n3. Extract title and content\n4. Call tools.openrouter with content\n5. Create result breadcrumb with proper schema\n\nYou MUST create tool requests, not directly respond!"
}
```

**But this is hacky** - workflows are cleaner.

---

## 📊 Comparison

| Approach | Complexity | Maintainability | RCRT-Native | Parallel |
|----------|-----------|-----------------|-------------|----------|
| **Workflow** | Low | High | ✅ Yes | ✅ Built-in |
| Orchestrator Agent | Medium | Medium | ⚠️ Partial | Manual |
| Tools | Medium | Low | ⚠️ Partial | Manual |
| Current Agents | High | Low | ❌ No | ❌ No |

**Winner:** Workflow pattern

---

## 🎓 Key Lessons

### Why Simple Agents Fail

**Agents in RCRT are for:**
- Complex reasoning
- Multi-step orchestration  
- Tool coordination
- Decision-making

**NOT for:**
- Simple LLM calls
- Single-purpose tasks
- Direct execution

### What Works Better

**For simple automation:**
- ✅ Workflows (declarative)
- ✅ Tools (code-based functions)

**For complex reasoning:**
- ✅ Agents (like default-chat-assistant)

### The RCRT Pattern

```
User Action
  ↓
note.v1 breadcrumb
  ↓
Workflow triggered
  ↓
4 parallel steps:
  ├─→ tool.request.v1 (tags)
  ├─→ tool.request.v1 (summary)
  ├─→ tool.request.v1 (insights)
  └─→ tool.request.v1 (eli5)
  ↓
Tools-runner executes
  ↓
4 parallel responses:
  ├─→ tool.response.v1 (tags)
  ├─→ tool.response.v1 (summary)
  ├─→ tool.response.v1 (insights)
  └─→ tool.response.v1 (eli5)
  ↓
Workflow creates results:
  ├─→ note.tags.v1
  ├─→ note.summary.v1
  ├─→ note.insights.v1
  └─→ note.eli5.v1
  ↓
Extension UI updates (SSE)
```

**Clean, declarative, parallel, RCRT-native!**

---

## 📁 Files to Modify

### Create:
- `bootstrap-breadcrumbs/workflows/` (new directory)
- `bootstrap-breadcrumbs/workflows/note-processing.json` (new file)

### Modify:
- `bootstrap-breadcrumbs/bootstrap.js` (add workflows loading step)

### Delete:
- `bootstrap-breadcrumbs/system/note-tagger-agent.json`
- `bootstrap-breadcrumbs/system/note-summarizer-agent.json`
- `bootstrap-breadcrumbs/system/note-insights-agent.json`
- `bootstrap-breadcrumbs/system/note-eli5-agent.json`

### Keep:
- `bootstrap-breadcrumbs/schemas/note-v1.json` (for llm_hints)
- `bootstrap-breadcrumbs/system/default-chat-agent.json` (works fine)

---

## ✅ Expected Result

**After workflow implementation:**

```
User saves page
  ↓
note.v1 created
  ↓
Workflow triggers (1ms)
  ↓
4 parallel openrouter calls (2-3s each)
  ↓
4 result breadcrumbs created (50ms)
  ↓
Total: 3-4 seconds ✅
```

**Extension UI:**
```
SavePage tab:
  ✅ Creating breadcrumb... Done
  ⏳ Generating tags... ✅ Done
  ⏳ Creating summary... ✅ Done
  ⏳ Extracting insights... ✅ Done
  ⏳ ELI5 explanation... ✅ Done

All complete in 3-4 seconds!
```

---

## 🎯 Status

**What's Built:** Complete extension, all infrastructure  
**What Works:** Session management, multi-tab tracking, settings  
**What's Blocked:** Note processing (agents too simple)  
**Solution:** Switch to workflow pattern  
**Effort:** 30 minutes (create workflow JSON, update bootstrap, reset)

**Ready to implement!** 🚀

