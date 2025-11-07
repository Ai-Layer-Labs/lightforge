# Note Agents - Architectural Solution

**Problem:** Note processing agents fail because they don't follow RCRT patterns  
**Root Cause:** Trying to use agents for deterministic automation  
**Solution:** Single intelligent agent with context-builder support

---

## Current vs Correct Architecture

### Current (Broken) Pattern

```
note.v1 created
  ↓
4 note agents trigger directly
  ├─ note-tagger (subscribes to note.v1)
  ├─ note-summarizer (subscribes to note.v1)
  ├─ note-insights (subscribes to note.v1)
  └─ note-eli5 (subscribes to note.v1)
  ↓
❌ assembleContextFromSubscriptions() returns EMPTY
   (only fetches role:"context" subscriptions, but note is role:"trigger")
  ↓
❌ Agents have no note content
  ↓
❌ Agents create generic agent.response.v1 (wrong schema!)
```

**Why it fails:**
1. **No context assembly** - Agents bypass context-builder
2. **No tool orchestration** - Agents can't call LLM themselves
3. **Wrong pattern** - Agents used for automation, not reasoning

---

### Correct Pattern (Following default-chat-assistant)

```
note.v1 created
  ↓
context-builder sees it
  ↓
Assembles rich context:
  ├─ Vector search: Similar notes (semantic)
  ├─ Recent: Last 100 note.tags.v1 (for consistency)
  ├─ Latest: tool.catalog.v1
  └─ Fetch note.v1 with llm_hints (title + content only)
  ↓
Creates agent.context.v1:
  {
    "tags": ["agent:context", "consumer:note-processor", "note:{note_id}"],
    "context": {
      "breadcrumbs": [
        {"schema_name": "note.v1", "content": "Title: ...\nContent: ..."},
        {"schema_name": "note.v1", "content": "Similar article: ..."},
        {"schema_name": "note.tags.v1", "content": "Existing tags: ..."}
      ],
      "token_estimate": 2000
    }
  }
  ↓
note-processor-agent triggers (subscribes to agent.context.v1)
  ↓
Reasons about note:
  - Sees similar notes with similar tags
  - Decides on tag consistency
  - Understands content type (technical vs casual)
  ↓
Creates 4 tool.request.v1 breadcrumbs (parallel):
  ├─ tool:openrouter for tags
  ├─ tool:openrouter for summary
  ├─ tool:openrouter for insights
  └─ tool:openrouter for eli5
  ↓
EXIT (fire-and-forget)

(4 separate invocations - one per tool.response.v1)

tool.response.v1 (tags) arrives
  ↓
note-processor-agent triggers
  ↓
Creates note.tags.v1 breadcrumb
  ↓
EXIT

(Repeat for summary, insights, eli5)
```

**Why it works:**
1. ✅ **Rich context** - Vector search finds similar notes
2. ✅ **Agent reasoning** - Can adapt based on content
3. ✅ **Tool orchestration** - Like default-chat-assistant pattern
4. ✅ **Proper schemas** - Creates note.tags.v1, not agent.response.v1

---

## Implementation Plan

### Step 1: Extend context-builder (Rust)

**File:** `crates/rcrt-context-builder/src/event_handler.rs`

**Add note.v1 handling:**

```rust
async fn handle_event(&self, event: BreadcrumbEvent) -> Result<()> {
    if let Some(schema) = &event.schema_name {
        match schema.as_str() {
            "user.message.v1" => {
                info!("📨 Processing user message event");
                let session_tag = extract_session_tag(&event);
                if let Some(session) = session_tag {
                    self.assemble_and_publish(&session, event.breadcrumb_id, "default-chat-assistant").await?;
                }
            }
            "note.v1" => {
                info!("📝 Processing note event");
                self.assemble_note_context(event.breadcrumb_id).await?;
            }
            _ => {}
        }
    }
    Ok(())
}

async fn assemble_note_context(&self, note_id: Option<Uuid>) -> Result<()> {
    use crate::retrieval::{ContextConfig, SourceConfig, SourceMethod};
    
    let Some(note_uuid) = note_id else { return Ok(()); };
    
    // Fetch the note for vector search
    let note_bc = self.vector_store.get_by_id(note_uuid).await?
        .ok_or_else(|| anyhow::anyhow!("Note not found"))?;
    
    // Build sources for note processing
    let mut sources = vec![
        // The note itself (already fetched, will be in context)
        SourceConfig {
            method: SourceMethod::Latest {
                schema_name: "note.v1".to_string(),
            },
            limit: 1,
        },
        // Recent tags for consistency
        SourceConfig {
            method: SourceMethod::Recent {
                schema_name: Some("note.tags.v1".to_string()),
            },
            limit: 100,
        },
        // Tool catalog
        SourceConfig {
            method: SourceMethod::Latest {
                schema_name: "tool.catalog.v1".to_string(),
            },
            limit: 1,
        },
    ];
    
    // Vector search for similar notes
    if let Some(embedding) = note_bc.embedding {
        let entities = self.entity_extractor.extract(
            &note_bc.context.to_string()
        )?;
        
        sources.push(SourceConfig {
            method: SourceMethod::HybridGlobal {
                query_embedding: embedding,
                query_keywords: entities.keywords,
            },
            limit: 5,
        });
    }
    
    let config = ContextConfig {
        consumer_id: "note-processor".to_string(),
        sources,
    };
    
    // Assemble context (no session filter for notes)
    let context = self.assembler.assemble(&config, None, None).await?;
    
    info!("✅ Note context assembled: {} breadcrumbs", context.breadcrumbs.len());
    
    // Publish with note-specific tag
    let note_tag = format!("note:{}", note_uuid);
    self.publisher.publish_context(
        &config.consumer_id,
        &note_tag,  // Tag for correlation
        Some(note_uuid),
        &context,
    ).await?;
    
    info!("✅ Context published for note-processor");
    
    Ok(())
}
```

---

### Step 2: Create Single note-processor Agent

**File:** `bootstrap-breadcrumbs/system/note-processor-agent.json`

```json
{
  "schema_name": "agent.def.v1",
  "title": "Note Processor Agent",
  "tags": ["agent:def", "agent:note-processor", "workspace:agents", "system:bootstrap"],
  "context": {
    "agent_id": "note-processor",
    
    "llm_config_id": null,
    "llm_config_comment": "Set to tool.config.v1 breadcrumb ID via Dashboard UI",
    
    "system_prompt": "You are a note processing specialist that generates structured metadata for saved articles.\n\n🔴 CRITICAL: Respond with valid JSON for EVERY response!\n\nWhen you receive a note via agent.context.v1:\n\n1. ANALYZE THE CONTEXT:\n   - The trigger note (title, content)\n   - Similar notes (learn from existing patterns)\n   - Existing tags (maintain consistency)\n\n2. GENERATE 4 PROCESSING TASKS in parallel:\n   a) Tags: 7 relevant tags (reuse existing when appropriate)\n   b) Summary: 2-3 sentence concise summary\n   c) Insights: 3-5 key actionable insights\n   d) ELI5: Simple explanation for a 5-year-old\n\n3. CREATE 4 TOOL REQUESTS:\n{\n  \"action\": \"create\",\n  \"breadcrumb\": {\n    \"schema_name\": \"agent.response.v1\",\n    \"title\": \"Note Processing Started\",\n    \"tags\": [\"agent:response\", \"note:processing\"],\n    \"context\": {\n      \"message\": \"Processing note with 4 parallel tasks...\",\n      \"tool_requests\": [\n        {\n          \"tool\": \"openrouter\",\n          \"requestId\": \"tags-{note_id}\",\n          \"input\": {\n            \"messages\": [\n              {\n                \"role\": \"system\",\n                \"content\": \"Generate exactly 7 relevant tags. Use existing tags when relevant for consistency. Output as JSON: {\\\"tags\\\": [\\\"tag1\\\", \\\"tag2\\\", ...]}\"\n              },\n              {\n                \"role\": \"user\",\n                \"content\": \"{note_content}\\n\\nExisting tags: {existing_tags}\"\n              }\n            ]\n          },\n          \"return_to_llm\": true\n        },\n        {\n          \"tool\": \"openrouter\",\n          \"requestId\": \"summary-{note_id}\",\n          \"input\": {\n            \"messages\": [\n              {\n                \"role\": \"system\",\n                \"content\": \"Create a concise 2-3 sentence summary. Output as JSON: {\\\"summary\\\": \\\"...\\\"}\"\n              },\n              {\n                \"role\": \"user\",\n                \"content\": \"{note_content}\"\n              }\n            ]\n          },\n          \"return_to_llm\": true\n        },\n        {\n          \"tool\": \"openrouter\",\n          \"requestId\": \"insights-{note_id}\",\n          \"input\": {\n            \"messages\": [\n              {\n                \"role\": \"system\",\n                \"content\": \"Extract 3-5 key insights. Output as JSON: {\\\"insights\\\": [\\\"insight1\\\", ...]}\"\n              },\n              {\n                \"role\": \"user\",\n                \"content\": \"{note_content}\"\n              }\n            ]\n          },\n          \"return_to_llm\": true\n        },\n        {\n          \"tool\": \"openrouter\",\n          \"requestId\": \"eli5-{note_id}\",\n          \"input\": {\n            \"messages\": [\n              {\n                \"role\": \"system\",\n                \"content\": \"Explain like I'm 5. Simple words, short sentences. Output as JSON: {\\\"eli5\\\": \\\"...\\\"}\"\n              },\n              {\n                \"role\": \"user\",\n                \"content\": \"{note_content}\"\n              }\n            ]\n          },\n          \"return_to_llm\": true\n        }\n      ]\n    }\n  }\n}\n\n4. WHEN TOOL RESPONSES ARRIVE:\n   You will receive 4 separate tool.response.v1 events.\n   For each, create the appropriate result breadcrumb:\n   \n   Tags response → create note.tags.v1:\n   {\n     \"action\": \"create\",\n     \"breadcrumb\": {\n       \"schema_name\": \"note.tags.v1\",\n       \"title\": \"Note Tags\",\n       \"tags\": [\"ai-generated\", \"note:{note_id}\"],\n       \"context\": {\n         \"note_id\": \"{note_id}\",\n         \"tags\": {parsed_tags_from_llm}\n       }\n     }\n   }\n   \n   (Similar for summary → note.summary.v1, insights → note.insights.v1, eli5 → note.eli5.v1)\n\nREMEMBER:\n- You receive pre-assembled context with similar notes and existing tags\n- Use this context to maintain consistency\n- Each tool response arrives separately - handle one at a time\n- Always output valid JSON",
    
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
          "comment": "Pre-assembled context from context-builder with similar notes and existing tags",
          "schema_name": "agent.context.v1",
          "all_tags": ["consumer:note-processor"],
          "role": "trigger",
          "key": "assembled_context",
          "fetch": {"method": "event_data"}
        },
        {
          "comment": "Tool responses for our parallel requests",
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
    },
    
    "metadata": {
      "version": "1.0.0",
      "architecture": "context-builder-backed",
      "purpose": "Intelligent note processing with semantic context awareness",
      "features": [
        "Vector search for similar notes",
        "Tag consistency via existing tag analysis",
        "Parallel LLM processing (4 concurrent)",
        "Adaptive prompts based on content type",
        "Context-builder integration"
      ]
    }
  }
}
```

---

### Step 3: Delete Old Note Agents

**Remove:**
- `bootstrap-breadcrumbs/system/note-tagger-agent.json`
- `bootstrap-breadcrumbs/system/note-summarizer-agent.json`
- `bootstrap-breadcrumbs/system/note-insights-agent.json`
- `bootstrap-breadcrumbs/system/note-eli5-agent.json`

**Keep:**
- `bootstrap-breadcrumbs/schemas/note-v1.json` (llm_hints still needed)

---

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER SAVES PAGE (Browser Extension)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 2. CREATE note.v1 Breadcrumb                                │
│    {                                                        │
│      "schema_name": "note.v1",                             │
│      "tags": ["note", "saved-page"],                       │
│      "context": {                                          │
│        "url": "https://example.com/ml-article",           │
│        "title": "Introduction to Machine Learning",       │
│        "content": "# ML Basics\n\nMachine learning is..." │
│      }                                                     │
│    }                                                       │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 3. NATS EVENT: bc.{id}.updated                             │
│    → Fanout to agents.{context-builder}.events            │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 4. CONTEXT-BUILDER Triggered (event_handler.rs)           │
│    ├─ Sees note.v1 schema                                 │
│    ├─ Extracts note ID                                    │
│    ├─ Fetches note breadcrumb                             │
│    ├─ Extracts entities: ["machine learning", "ML"]       │
│    └─ Assembles context:                                  │
│        ├─ note.v1 (llm_hints: title + content only)       │
│        ├─ Vector search: 5 similar notes about ML         │
│        ├─ Recent: 100 note.tags.v1 (existing tags)        │
│        └─ Latest: tool.catalog.v1                         │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 5. CREATE agent.context.v1                                 │
│    {                                                       │
│      "schema_name": "agent.context.v1",                   │
│      "tags": ["agent:context", "consumer:note-processor", │
│               "note:{note_id}"],                          │
│      "context": {                                         │
│        "consumer_id": "note-processor",                   │
│        "trigger_event_id": "{note_id}",                   │
│        "breadcrumbs": [                                   │
│          {                                                │
│            "schema_name": "note.v1",                      │
│            "content": "Title: ML Article\n\nContent: ..." │
│          },                                               │
│          {                                                │
│            "schema_name": "note.v1",                      │
│            "content": "Similar: Neural Networks..."       │
│          },                                               │
│          {                                                │
│            "schema_name": "note.tags.v1",                 │
│            "content": "Existing tags: [ml, ai, ...]"     │
│          }                                                │
│        ],                                                 │
│        "token_estimate": 2000                             │
│      }                                                    │
│    }                                                      │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 6. NATS EVENT: agents.{note-processor}.events              │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 7. NOTE-PROCESSOR-AGENT Triggered (First Invocation)      │
│    ├─ Subscription matches: consumer:note-processor       │
│    ├─ Receives rich context (similar notes, existing tags)│
│    ├─ Reasons: "I see ML is commonly tagged with 'ai',   │
│    │           'neural-networks'. I'll maintain pattern"  │
│    ├─ Formats 4 prompts (adapts based on content)        │
│    └─ Creates 4 tool.request.v1 breadcrumbs:             │
│        ├─ tags-{note_id}                                 │
│        ├─ summary-{note_id}                              │
│        ├─ insights-{note_id}                             │
│        └─ eli5-{note_id}                                 │
│    EXIT (async: true)                                    │
└─────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 8. TOOLS-RUNNER Executes (4 Parallel Invocations)         │
│    ├─ Receives 4 tool.request.v1 breadcrumbs              │
│    ├─ Executes openrouter tool 4 times (parallel)         │
│    └─ Creates 4 tool.response.v1 breadcrumbs:             │
│        ├─ request:tags-{note_id}                          │
│        ├─ request:summary-{note_id}                       │
│        ├─ request:insights-{note_id}                      │
│        └─ request:eli5-{note_id}                          │
└─────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 9. NOTE-PROCESSOR-AGENT Triggered (4 More Invocations)    │
│    Each tool.response.v1 triggers agent separately:       │
│                                                            │
│    Invocation 1: tags response                            │
│    ├─ Parse JSON: {"tags": ["ml", "ai", ...]}            │
│    └─ Create note.tags.v1                                 │
│                                                            │
│    Invocation 2: summary response                         │
│    ├─ Parse JSON: {"summary": "..."}                     │
│    └─ Create note.summary.v1                              │
│                                                            │
│    Invocation 3: insights response                        │
│    ├─ Parse JSON: {"insights": [...]}                    │
│    └─ Create note.insights.v1                             │
│                                                            │
│    Invocation 4: eli5 response                            │
│    ├─ Parse JSON: {"eli5": "..."}                        │
│    └─ Create note.eli5.v1                                 │
└─────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 10. EXTENSION UI UPDATES (SSE)                             │
│     ├─ Subscribes to note:{note_id} tag                   │
│     ├─ Receives 4 result breadcrumbs                      │
│     └─ Updates NoteDetail component:                      │
│         ├─ Tags tab: Shows generated tags                │
│         ├─ Summary tab: Shows summary                    │
│         ├─ Insights tab: Shows insights                  │
│         └─ ELI5 tab: Shows simple explanation            │
└─────────────────────────────────────────────────────────────┘
```

**Total time:** ~3-4 seconds (4 parallel LLM calls)  
**Total invocations:** 7 (context-builder + agent + 4 tool executions + agent 4x)  
**Total breadcrumbs:** 10 (note + context + 4 requests + 4 results)

---

## Benefits of This Approach

### 1. True Agent Reasoning

**The agent can:**
- See similar notes and learn patterns
- Maintain tag consistency across content
- Adapt prompts based on content type (technical vs casual)
- Make intelligent decisions

**Example reasoning:**
```
Agent sees context:
  - Current note: "Introduction to React Hooks"
  - Similar notes: 3 other React articles tagged: "react", "javascript", "frontend"
  - Existing tags include: "react-hooks", "useEffect", "useState"
  
Agent decides:
  - Reuse "react", "javascript", "frontend" for consistency
  - Add specific "react-hooks" since content mentions them
  - Include version tag "react-18" based on content
```

**This is reasoning, not just execution!**

---

### 2. Parallel Processing

**4 LLM calls execute simultaneously:**
```
tool.request.v1 (tags)     ─┐
tool.request.v1 (summary)  ─┼─→ tools-runner processes all 4 in parallel
tool.request.v1 (insights) ─┤
tool.request.v1 (eli5)     ─┘

Result: 3-4 seconds total (not 11-12 seconds sequential)
```

---

### 3. Semantic Context

**Vector search finds relevant knowledge:**
```
User saves article about "Neural Networks"
  ↓
Context-builder vector search finds:
  ├─ Previous article: "Introduction to Deep Learning"
  ├─ Previous article: "CNN Architectures"
  └─ Previous article: "Backpropagation Explained"
  ↓
Agent sees pattern:
  - These are all tagged: "deep-learning", "neural-networks", "ai"
  - Agent maintains consistency
```

**Without context-builder:** Agent processes in isolation, inconsistent tags

---

### 4. Follows RCRT Patterns

**Same pattern as default-chat-assistant:**
- ✅ Context-builder assembles context
- ✅ Agent receives agent.context.v1
- ✅ Agent orchestrates tools
- ✅ Fire-and-forget execution
- ✅ Proper breadcrumb schemas

---

## Implementation Checklist

- [ ] **Modify context-builder** (Rust)
  - Add note.v1 handling in event_handler.rs
  - Add assemble_note_context() method
  - Test context assembly

- [ ] **Create note-processor-agent.json**
  - Single agent definition
  - Subscribes to agent.context.v1 (consumer:note-processor)
  - Orchestrates 4 tool requests
  - Handles 4 tool responses

- [ ] **Delete old note agents**
  - Remove 4 simple agents
  - Clean up system

- [ ] **Test complete flow**
  - Save a test note
  - Verify context assembly
  - Verify 4 parallel tool calls
  - Verify 4 result breadcrumbs

- [ ] **Update bootstrap.js** (if needed)
  - Ensure note-processor loads

- [ ] **Full Reset & Rebootstrap**
  - Reset database
  - Load new agent
  - Test end-to-end

---

## Expected Results

**After implementation:**

```bash
# Save a note via extension
# Watch logs:

# context-builder
📝 Processing note event
🔍 Hybrid search with keywords: ["machine learning", "ML"]
✅ Note context assembled: 7 breadcrumbs
✅ Context published for note-processor

# agent-runner
🎯 [note-processor] agent.context.v1 is TRIGGER
📤 Agent requesting 4 tool(s)...
✅ Tool request created: openrouter (tags)
✅ Tool request created: openrouter (summary)
✅ Tool request created: openrouter (insights)
✅ Tool request created: openrouter (eli5)

# tools-runner (4 parallel)
🎯 Processing tool request: tags-{id}
🦕 Executing openrouter via Deno runtime
✅ Tool openrouter executed in 2500ms
(Repeat 3 more times in parallel)

# agent-runner (4 separate invocations)
🎯 [note-processor] tool.response.v1 is TRIGGER (tags)
📤 Response created: note.tags.v1
(Repeat for summary, insights, eli5)
```

**Extension UI:**
```
SavePage tab:
  ✅ Creating breadcrumb... Done (500ms)
  ⏳ Generating tags... ✅ Done (3s)
  ⏳ Creating summary... ✅ Done (3s)
  ⏳ Extracting insights... ✅ Done (3s)
  ⏳ ELI5 explanation... ✅ Done (3s)

Total: ~3.5 seconds (parallel execution)
```

---

## Architectural Alignment

This solution follows all RCRT principles:

✅ **Agents = Context + Reasoning**
- note-processor receives rich context from context-builder
- Makes intelligent decisions about tag consistency
- Reasons about content type and adapts behavior

✅ **Tools = Data + Code**
- openrouter tool executes LLM API calls
- Deterministic function execution
- No reasoning, pure execution

✅ **Event-Driven**
- Fire-and-forget throughout
- Separate invocations for each event
- No waiting, only triggers

✅ **Breadcrumbs for Everything**
- Context stored in agent.context.v1
- Results in typed breadcrumbs (note.tags.v1, etc.)
- Observable, searchable, versionable

✅ **Context-Builder Pattern**
- Same pattern as chat messages
- Vector search for semantic context
- Pre-assembled, LLM-optimized

---

## Comparison: Old vs New

| Aspect | Old (4 Simple Agents) | New (Single Intelligent Agent) |
|--------|----------------------|-------------------------------|
| Context Assembly | ❌ None | ✅ context-builder (vector search) |
| Context Received | ❌ Empty (0 sources) | ✅ Rich (similar notes, tags, catalog) |
| Reasoning | ❌ Hardcoded prompts | ✅ Adaptive based on context |
| Tool Orchestration | ❌ Can't call LLM | ✅ Creates tool.request.v1 |
| Execution | ❌ Direct (wrong) | ✅ Fire-and-forget (correct) |
| Result Schemas | ❌ agent.response.v1 | ✅ note.tags.v1, note.summary.v1, etc. |
| Pattern Alignment | ❌ Custom broken pattern | ✅ Follows default-chat-assistant |
| Processing Time | ❌ N/A (doesn't work) | ✅ 3-4s (parallel) |
| Tag Consistency | ❌ No context | ✅ Sees existing tags |
| Semantic Understanding | ❌ Isolated | ✅ Sees similar notes |

---

## Why This is the RCRT Way

**The pattern matches the system philosophy:**

1. **Context First**: Agent receives pre-assembled context (not raw note)
2. **Reasoning Layer**: Agent decides how to process (not hardcoded)
3. **Tool Orchestration**: Agent creates tool requests (doesn't execute)
4. **Fire-and-Forget**: Each step is separate invocation
5. **Observable**: Full breadcrumb trail for debugging
6. **Scalable**: Stateless, can run multiple instances

**This is not just "making notes work" - it's making notes work THE RIGHT WAY.**

---

## Next Steps

1. **Review this design** - Ensure alignment with your vision
2. **Implement context-builder changes** - Add note.v1 handling
3. **Create note-processor agent** - Single intelligent agent
4. **Test thoroughly** - Verify all 10 breadcrumbs created correctly
5. **Document learnings** - Update SYSTEM_ARCHITECTURE.md

**Ready to implement?** 🚀

