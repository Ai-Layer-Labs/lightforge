<!-- be8d5d4d-e534-424a-a6b6-2e0db3fb00a6 b3a52b86-a617-4ab4-be6a-097e91434292 -->
# Pointer-Tag Unification: Complete Implementation

## 🎯 Goal

**ONE primitive powers everything:**

```
Tags = Routing + Pointers + State
Pointers → Seeds → Graph → Context
```

Zero hardcoding. Zero fallbacks. Zero backward compatibility cruft.

---

## Phase 1: Tag Taxonomy Cleanup

### Remove Tag Chaos

**Files to update**: All `bootstrap-breadcrumbs/**/*.json`

**Standardize to three types**:

1. **ROUTING** (namespace:identifier)

                                                - `workspace:tools`, `workspace:agents`, `workspace:knowledge`
                                                - `agent:{id}`, `tool:{name}`, `session:{id}`
                                                - `consumer:{agent-id}`, `request:{id}`

2. **POINTER** (semantic keywords, no colon)

                                                - Domain: `browser-automation`, `validation`, `security`
                                                - Tech: `typescript`, `deno`, `playwright`, `postgresql`
                                                - Concept: `llm-integration`, `code-analysis`, `testing`

3. **STATE** (lifecycle, single word)

                                                - `approved`, `validated`, `bootstrap`
                                                - `deprecated`, `draft`, `archived`
                                                - `ephemeral`, `error`

**Remove**:

- ❌ `self-contained` (all tool.code.v1 are self-contained)
- ❌ Inconsistent prefixes (`guide:`, `specialist:`, `defines:`)
- ❌ Templates with `{{state.X}}` (replace with actual values)

**Add pointer tags everywhere**:

- knowledge.v1: 5-10 pointers (semantic keywords)
- tool.code.v1: 3-5 pointers (domain/tech)
- agent.def.v1: 2-3 pointers (role/domain)

---

## Phase 2: rcrt-server Pointer Extraction

### Enable Hybrid Pointers on Write

**File**: `crates/rcrt-server/src/main.rs`

**In create_breadcrumb** (around line 630-650):

**Current**:

```rust
let bc = state.db.create_breadcrumb_with_embedding_for(
    owner_id, agent_id, agent_id, breadcrumb_create, emb
).await?;
```

**Add before creation**:

```rust
// Extract hybrid pointers (tags + content)
let tag_pointers: Vec<String> = req.tags.iter()
    .filter(|t| !t.contains(':'))  // No namespace
    .filter(|t| !is_state_tag(t))  // Not lifecycle state
    .cloned()
    .collect();

// Extract from llm_hints-transformed text (what LLM sees)
let llm_text = if let Some(emb_text) = &emb.text {
    emb_text.clone()
} else {
    format!("{}\n{}", req.title, req.context.to_string())
};

// Use entity extractor (if available) or simple keyword extraction
let extracted_pointers = extract_keywords_simple(&llm_text);

// Combine
let mut all_pointers = tag_pointers;
all_pointers.extend(extracted_pointers);
all_pointers.sort();
all_pointers.dedup();

// Store in entity_keywords column
breadcrumb_create.entity_keywords = Some(all_pointers);
```

**Add helper function**:

```rust
fn extract_keywords_simple(text: &str) -> Vec<String> {
    // Simple regex-based extraction (match context-builder's entity_extractor)
    let text_lower = text.to_lowercase();
    
    // Extract words 4+ chars, alphanumeric + hyphen
    let re = regex::Regex::new(r"\b[a-z][a-z0-9-]{3,}\b").unwrap();
    
    let keywords: Vec<String> = re.find_iter(&text_lower)
        .map(|m| m.as_str().to_string())
        .filter(|w| is_domain_term(w))  // Filter to relevant terms
        .collect();
    
    keywords
}

fn is_domain_term(word: &str) -> bool {
    // RCRT domain vocabulary (sync with entity_extractor.rs)
    matches!(word, 
        "breadcrumb" | "breadcrumbs" | "agent" | "agents" | "tool" | "tools" |
        "context" | "embedding" | "semantic" | "vector" | "schema" | "secret" |
        "create" | "search" | "execute" | "configure" | "update" | "delete" |
        "deno" | "typescript" | "rust" | "postgresql" | "browser" | "playwright" |
        "permission" | "workflow" | "catalog" | "validation" | "security" |
        // Add more as needed
    )
}

fn is_state_tag(tag: &str) -> bool {
    matches!(tag,
        "approved" | "validated" | "bootstrap" | "deprecated" |
        "draft" | "archived" | "ephemeral" | "error" | "warning" | "info"
    )
}
```

**Ensure rcrt-core models have entity_keywords**:

**File**: `crates/rcrt-core/src/models.rs` (verify field exists)

---

## Phase 3: context-builder Generic Implementation

### Remove ALL Hardcoding

**File**: `crates/rcrt-context-builder/src/event_handler.rs`

**REMOVE entirely** (lines 72-122):

```rust
// DELETE THIS:
if schema == "user.message.v1" {
    self.assemble_and_publish(&session, event.breadcrumb_id).await?;
} else if schema == "tool.creation.request.v1" {
    self.assemble_and_publish_for_tool_creator(&session, event.breadcrumb_id).await?;
} else if schema == "tool.validation.error.v1" {
    self.assemble_and_publish_for_tool_debugger(&session, event.breadcrumb_id).await?;
}
```

**REPLACE WITH**:

```rust
async fn handle_event(&self, event: BreadcrumbEvent) -> Result<()> {
    let Some(schema) = &event.schema_name else { return Ok(()); };
    
    info!("📨 Event received: {} (id: {:?})", schema, event.breadcrumb_id);
    
    // UNIVERSAL: Find ALL agents that want context for this trigger
    let interested_agents = self.find_agents_for_trigger(
        schema, 
        event.tags.as_ref()
    ).await?;
    
    if interested_agents.is_empty() {
        // No agents need context assembly for this schema
        // This is normal - tools handle requests directly without context-builder
        return Ok(());
    }
    
    info!("🎯 {} agent(s) want context for {}", interested_agents.len(), schema);
    
    // Extract session tag (universal across all schemas)
    let session_tag = event.tags.as_ref()
        .and_then(|tags| tags.iter().find(|t| t.starts_with("session:")))
        .cloned();
    
    // Assemble context for EACH interested agent
    for agent_def in interested_agents {
        info!("🔄 Assembling context for {}", agent_def.agent_id);
        
        // UNIVERSAL assembly with pointers
        self.assemble_with_pointers(
            &agent_def.agent_id,
            event.breadcrumb_id,
            &agent_def.context_sources,
            session_tag.as_deref()
        ).await?;
    }
    
    Ok(())
}
```

**ADD new method**:

```rust
async fn find_agents_for_trigger(
    &self,
    trigger_schema: &str,
    trigger_tags: Option<&Vec<String>>
) -> Result<Vec<AgentDefinition>> {
    // Load ALL agent definitions that declare a context_trigger
    let all_agents = load_all_agent_definitions_with_triggers(self.vector_store.pool()).await?;
    
    let matching: Vec<AgentDefinition> = all_agents.into_iter()
        .filter(|agent| {
            if let Some(trigger_config) = &agent.context_trigger {
                // Schema must match
                if trigger_config.schema_name != trigger_schema {
                    return false;
                }
                
                // Tags must match (if specified)
                if let Some(required_tags) = &trigger_config.all_tags {
                    if let Some(event_tags) = trigger_tags {
                        return required_tags.iter().all(|t| event_tags.contains(t));
                    }
                    return false;
                }
                
                true
            } else {
                false
            }
        })
        .collect();
    
    Ok(matching)
}
```

**ADD universal assembly**:

```rust
async fn assemble_with_pointers(
    &self,
    consumer_id: &str,
    trigger_id: Option<Uuid>,
    context_sources: &ContextSources,
    session_tag: Option<&str>
) -> Result<()> {
    let Some(trigger) = trigger_id else { return Ok(()); };
    
    // STEP 1: GET TRIGGER BREADCRUMB
    let trigger_bc = self.vector_store.get_by_id(trigger).await?
        .ok_or_else(|| anyhow!("Trigger breadcrumb not found"))?;
    
    info!("🌱 Extracting pointers from trigger...");
    
    // STEP 2: EXTRACT HYBRID POINTERS
    let mut pointers = Vec::new();
    
    // From tags (explicit)
    for tag in &trigger_bc.tags {
        if !tag.contains(':') && !is_state_tag(tag) {
            pointers.push(tag.clone());
        }
    }
    
    // From cached entity_keywords (dynamic, pre-computed)
    if let Some(keywords) = &trigger_bc.entity_keywords {
        pointers.extend(keywords.clone());
    }
    
    // Deduplicate
    pointers.sort();
    pointers.dedup();
    
    info!("📍 Extracted {} pointers: {:?}", pointers.len(), &pointers[..pointers.len().min(5)]);
    
    // STEP 3: COLLECT SEEDS
    let mut seed_ids = vec![trigger];
    
    // Always sources (from agent.def.v1.context_sources.always)
    if let Some(always) = &context_sources.always {
        for source in always {
            match source.source_type.as_str() {
                "schema" => {
                    if let Some(schema_name) = &source.schema_name {
                        let nodes = self.fetch_by_schema(schema_name, 
                            source.method.as_deref(), 
                            source.limit.unwrap_or(1)).await?;
                        seed_ids.extend(nodes.iter().map(|n| n.id));
                        info!("  + Seed: {} (always source)", schema_name);
                    }
                },
                "tag" => {
                    if let Some(tag) = &source.tag {
                        let nodes = self.fetch_by_tag(tag, source.limit.unwrap_or(1)).await?;
                        seed_ids.extend(nodes.iter().map(|n| n.id));
                        info!("  + Seed: tag:{} (always source)", tag);
                    }
                },
                _ => {}
            }
        }
    }
    
    // Semantic sources (using pointers!)
    if let Some(semantic_config) = &context_sources.semantic {
        if semantic_config.enabled && !pointers.is_empty() {
            info!("🔍 Semantic search with {} pointers", pointers.len());
            
            for schema in &semantic_config.schemas {
                let semantic_seeds = self.vector_store.find_similar_hybrid(
                    &trigger_bc.embedding.unwrap(),
                    &pointers,  // ← Hybrid pointers!
                    semantic_config.limit.unwrap_or(3),
                    None  // Global search for knowledge
                ).await?;
                
                seed_ids.extend(semantic_seeds.iter().map(|s| s.id));
                info!("  + Seeds: {} via semantic+pointers", semantic_seeds.len());
            }
        }
    }
    
    // Session messages (temporal context)
    if let Some(session) = session_tag {
        let recent = self.vector_store.get_recent(
            None,  // All schemas
            Some(session),
            20  // Last 20 in session
        ).await?;
        seed_ids.extend(recent.iter().map(|r| r.id));
        info!("  + Seeds: {} from session", recent.len());
    }
    
    // STEP 4: LOAD GRAPH around seeds
    let graph = self.load_graph_for_seeds(&seed_ids).await?;
    
    // STEP 5: PATHFINDER with token budget
    let llm_config = load_llm_config(
        agent_def.llm_config_id.clone(),
        self.vector_store.pool()
    ).await?;
    
    let token_budget = calculate_context_budget(&llm_config).await?.tokens;
    
    let relevant_ids = self.path_finder.find_paths_token_aware(
        &graph,
        seed_ids,
        token_budget
    );
    
    info!("✅ PathFinder selected {} nodes within {} token budget", 
        relevant_ids.len(), token_budget);
    
    // STEP 6: FORMAT and PUBLISH
    self.publisher.publish_context(
        consumer_id,
        session_tag.unwrap_or(""),
        Some(trigger),
        &assembled_context
    ).await?;
    
    Ok(())
}
```

**DELETE these methods entirely**:

- `assemble_and_publish()` - Line 124-359 (hardcoded for default-chat-assistant)
- `assemble_and_publish_for_tool_creator()` - Line 362-520
- `assemble_and_publish_for_tool_debugger()` - Similar pattern
- Any other agent-specific methods

**Replace with**: ONE generic `assemble_with_pointers()` method

---

## Phase 2: Agent Definition Structure

### Add context_trigger to ALL Agents

**File**: `bootstrap-breadcrumbs/system/validation-specialist-agent.json`

**ADD field** (after llm_config_id):

```json
{
  "agent_id": "validation-specialist",
  "llm_config_id": null,
  
  "context_trigger": {
    "schema_name": "tool.code.v1",
    "all_tags": ["workspace:tools"],
    "comment": "Trigger context assembly when tools are created"
  },
  
  "context_sources": {
    "always": [
      {
        "type": "schema",
        "schema_name": "validation-rules-v1",
        "method": "latest",
        "limit": 1
      }
    ],
    "semantic": {
      "enabled": true,
      "schemas": ["knowledge.v1"],
      "limit": 3,
      "use_trigger_pointers": true
    }
  },
  
  "subscriptions": {
    "selectors": [{
      "schema_name": "agent.context.v1",
      "all_tags": ["consumer:validation-specialist"],
      "role": "trigger"
    }]
  }
}
```

**CHANGE**: Subscription from `tool.code.v1` → `agent.context.v1`

**Apply same pattern to**:

- `tool-creator-agent.json`
- `tool-debugger-agent.json`
- `default-chat-agent.json` (verify it's already correct)

---

## Phase 3: Bootstrap Tag Cleanup

### Update ALL Bootstrap Files

**knowledge.v1 files** - Add workspace + pointers:

**validation-rules-v1.json**:

```json
{
  "tags": [
    "workspace:knowledge",
    "validation",
    "security", 
    "code-analysis",
    "pattern-matching",
    "deno",
    "typescript"
  ]
}
```

**astral-browser-automation.json**:

```json
{
  "tags": [
    "workspace:knowledge",
    "browser-automation",
    "playwright",
    "puppeteer",
    "web-scraping",
    "testing",
    "security"
  ]
}
```

**Apply to ALL knowledge/*.json** (17 files):

- Add `workspace:knowledge` 
- Add 5-10 semantic pointer tags
- Remove inconsistent prefixes

**tool.code.v1 files** - Add pointers:

**openrouter.json**:

```json
{
  "tags": [
    "workspace:tools",
    "tool:openrouter",
    "approved", "validated", "bootstrap",
    "llm-integration",
    "api-calling",
    "openai",
    "anthropic"
  ]
}
```

**breadcrumb-update.json**:

```json
{
  "tags": [
    "workspace:tools",
    "tool:breadcrumb-update",
    "approved", "validated", "bootstrap",
    "rcrt-api",
    "crud-operations",
    "database"
  ]
}
```

**Apply to ALL tools-self-contained/*.json** (remove `self-contained` tag, add domain pointers)

---

## Phase 4: Agent Config Loading

### Support context_trigger Field

**File**: `crates/rcrt-context-builder/src/agent_config.rs`

**ADD to AgentDefinition struct**:

```rust
#[derive(Debug, Clone, Deserialize)]
pub struct AgentDefinition {
    pub agent_id: String,
    pub llm_config_id: Option<String>,
    
    // NEW: Declares what triggers context assembly
    pub context_trigger: Option<ContextTrigger>,
    
    pub context_sources: Option<ContextSources>,
    // ... existing fields
}

#[derive(Debug, Clone, Deserialize)]
pub struct ContextTrigger {
    pub schema_name: String,
    pub all_tags: Option<Vec<String>>,
    pub any_tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ContextSources {
    pub always: Option<Vec<AlwaysSource>>,
    pub semantic: Option<SemanticConfig>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AlwaysSource {
    #[serde(rename = "type")]
    pub source_type: String,  // "schema" | "tag"
    pub schema_name: Option<String>,
    pub tag: Option<String>,
    pub method: Option<String>,  // "latest" | "recent"
    pub limit: Option<usize>,
    pub optional: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SemanticConfig {
    pub enabled: bool,
    pub schemas: Vec<String>,
    pub limit: Option<usize>,
    pub min_similarity: Option<f32>,
    pub use_trigger_pointers: Option<bool>,
}
```

**ADD new loader**:

```rust
pub async fn load_all_agent_definitions_with_triggers(pool: &PgPool) -> Result<Vec<AgentDefinition>> {
    let rows = sqlx::query_as::<_, BreadcrumbRow>(
        r#"
        SELECT id, schema_name, title, tags, context, embedding, 
               entities, entity_keywords, created_at, updated_at
        FROM breadcrumbs
        WHERE schema_name = 'agent.def.v1'
          AND tags @> ARRAY['workspace:agents']
          AND context ? 'context_trigger'
        "#
    )
    .fetch_all(pool)
    .await?;
    
    let mut agents = Vec::new();
    for row in rows {
        if let Ok(agent_def) = serde_json::from_value::<AgentDefinition>(row.context) {
            agents.push(agent_def);
        }
    }
    
    Ok(agents)
}
```

---

## Phase 5: Remove Old Code Paths

### Delete Hardcoded Assembly Methods

**File**: `crates/rcrt-context-builder/src/event_handler.rs`

**DELETE entirely**:

- `assemble_and_publish()` (lines ~124-359)
- `assemble_and_publish_for_tool_creator()` (lines ~362-520)  
- `assemble_and_publish_for_tool_debugger()` (similar)
- `fetch_by_schema()`, `fetch_by_tag()` (move to shared helpers if needed)

**KEEP**:

- `handle_event()` (but replace implementation)
- `load_graph_for_seeds()` (generic helper)
- `extract_pointer_tags()` (new helper)

### Remove Fallback Logic

**No "try X, fallback to Y" patterns**:

**DELETE** patterns like:

```rust
if let Ok(result) = complex_method() {
    result
} else {
    fallback_method()  // ❌ NO FALLBACKS
}
```

**REPLACE WITH**:

```rust
let result = complex_method()?;  // Fail fast!
result
```

### Remove Backward Compatibility

**No schema version checking**:

**DELETE**:

```rust
if schema_name.ends_with(".v1") { ... }
else if schema_name.ends_with(".v2") { ... }
```

**ASSUME**: All breadcrumbs use current schema version. Old versions don't exist.

---

## Phase 6: Rust Core Models Update

### Ensure Fields Exist

**File**: `crates/rcrt-core/src/models.rs`

**Verify BreadcrumbCreate has**:

```rust
pub struct BreadcrumbCreate {
    pub title: String,
    pub context: Value,
    pub tags: Vec<String>,
    pub schema_name: Option<String>,
    pub embedding: Option<Vector>,
    pub entity_keywords: Option<Vec<String>>,  // ← Verify this exists
    // ... other fields
}
```

**Verify Breadcrumb has**:

```rust
pub struct Breadcrumb {
    pub id: Uuid,
    pub tags: Vec<String>,
    pub entity_keywords: Option<Vec<String>>,  // ← Verify this exists
    // ... other fields
}
```

**If missing**: Add the field

---

## Phase 7: Database Schema Verification

### Ensure entity_keywords Column Exists

**Check**: `migrations/0006_entity_metadata.sql`

**Should have**:

```sql
ALTER TABLE breadcrumbs 
  ADD COLUMN IF NOT EXISTS entity_keywords TEXT[];

CREATE INDEX IF NOT EXISTS idx_breadcrumbs_entity_keywords 
  ON breadcrumbs USING GIN (entity_keywords);
```

**Verify this migration ran**:

- Fresh deploy runs all migrations automatically
- entity_keywords column exists
- GIN index exists for efficient keyword matching

---

## Phase 8: Documentation

### Create TAG_TAXONOMY.md

**File**: `docs/TAG_TAXONOMY.md`

**Content**:

```markdown
# RCRT Tag Taxonomy

## The Unified Primitive

Tags = Routing + Pointers + State

ONE tag system powers:
- Event routing (subscription matching)
- Semantic search (hybrid pointers)
- State management (lifecycle)

## Three Tag Types

### 1. ROUTING TAGS (namespace:identifier)

Format: `{namespace}:{lowercase-hyphenated-id}`

Namespaces:
- `workspace:` - Routing domain (tools, agents, knowledge)
- `agent:` - Agent identity
- `tool:` - Tool identity
- `session:` - Conversation correlation
- `consumer:` - Context routing (who gets this context)
- `request:` - Request correlation
- `browser:` - Browser state

Examples:
- `workspace:tools` - Routes to tools-runner
- `agent:validation-specialist` - Agent unique ID
- `session:1762904026642` - Conversation scope
- `consumer:default-chat-assistant` - Context consumer

### 2. POINTER TAGS (semantic keywords)

Format: `{keyword}` or `{multi-word-keyword}`

NO namespace prefix, NO colons

Categories:
- Domain: browser-automation, validation, security
- Technology: typescript, deno, playwright, postgresql
- Concept: llm-integration, code-analysis, testing

Purpose: Seed vector search for context assembly

Examples:
- `browser-automation` - Finds browser-related knowledge
- `validation` - Finds validation guides
- `security` - Finds security patterns
- `llm-integration` - Finds LLM docs

### 3. STATE TAGS (lifecycle)

Format: `{state}` (single word)

Allowed values:
- approved, validated, bootstrap
- deprecated, draft, archived
- ephemeral, error, warning, info

Purpose: Permissions, filtering, lifecycle

## How Pointers Work

### Write Side (Breadcrumb Creation)

rcrt-server extracts pointers when creating breadcrumb:

```

1. Extract from tags (explicit)

tags: ["browser-automation", "playwright"]

2. Extract from content (dynamic)

entity_extractor.extract(llm_hints_text)

→ ["page", "click", "selector", "browser"]

3. Combine and store

entity_keywords: ["browser-automation", "playwright",

"page", "click", "selector", "browser"]

```

### Read Side (Context Assembly)

context-builder uses pointers for semantic search:

```

1. Get trigger breadcrumb
2. Extract pointers:

                                                - From trigger.tags (explicit)
                                                - From trigger.entity_keywords (cached)

3. Hybrid search:

find_similar_hybrid(

trigger.embedding,    // 60%: Semantic similarity

pointers              // 40%: Keyword matching

)

4. Result: Seeds for graph exploration
````

### Symmetric Design

BOTH sides have hybrid pointers:
- Query: trigger.tags + trigger.entity_keywords
- Database: breadcrumb.tags + breadcrumb.entity_keywords
- Matching: Keyword overlap + vector similarity

## Examples

### Knowledge Article

```json
{
  "schema_name": "knowledge.v1",
  "title": "Browser Automation Security Guide",
  "tags": [
    "workspace:knowledge",
    "browser-automation",
    "playwright",
    "puppeteer",
    "security",
    "validation",
    "web-scraping"
  ]
}
````


When extracted:

- entity_keywords: ["browser", "automation", "security", "page", 

"eval", "dangerous", "safe", "patterns", ...]

When queried with pointers: ["browser-automation", "security"]

- Tag match: ✓ (explicit overlap)
- Keyword match: ✓ (many shared keywords)
- Vector match: ✓ (semantic similarity)

→ HIGH RELEVANCE SCORE

### Tool Definition

```json
{
  "schema_name": "tool.code.v1",
  "title": "Astral Browser Tool",
  "tags": [
    "workspace:tools",
    "tool:astral",
    "approved", "validated",
    "browser-automation",
    "playwright",
    "testing"
  ]
}
```

When validation-specialist needs context:

- Pointers: ["browser-automation", "testing", "validation"]
- Finds above tool as similar example
- Finds browser security guide
- Finds validation patterns

## Tag Requirements by Schema

### tool.code.v1

REQUIRED:

- `workspace:tools`
- `tool:{name}`
- `approved`, `validated` (to load)

RECOMMENDED:

- 3-5 domain pointer tags
- `bootstrap` (if system tool)

### agent.def.v1

REQUIRED:

- `workspace:agents`
- `agent:{agent-id}`

RECOMMENDED:

- 2-3 role pointer tags
- `bootstrap` (if system agent)

### knowledge.v1

REQUIRED:

- `workspace:knowledge`
- 5-10 semantic pointer tags

OPTIONAL:

- `guide:{category}` (deprecated, use pointers instead)

### user.message.v1

REQUIRED:

- `user:message`
- `session:{id}`

OPTIONAL:

- Pointer tags (extracted from content)

## Migration Guide

### Step 1: Add workspace prefix

All knowledge.v1: Add `workspace:knowledge`

### Step 2: Add pointer tags

- knowledge.v1: Add 5-10 domain keywords
- tool.code.v1: Add 3-5 tech/domain keywords
- agent.def.v1: Add 2-3 role keywords

### Step 3: Remove cruft

- Delete `self-contained` (redundant)
- Delete inconsistent prefixes
- Standardize naming (lowercase-hyphenated)

### Step 4: Test

Create breadcrumb, verify entity_keywords populated

Query with pointers, verify matches found

```

**Update**: `docs/RCRT_PRINCIPLES.md` - Add section on pointer-tag unification

---

## Phase 9: Testing & Validation

### Test Scenarios

**1. Tool Validation Flow**:
```

Create tool.code.v1 with tags: ["workspace:tools", "browser-automation"]

↓

context-builder finds: validation-specialist wants context for tool.code.v1

↓

Extracts pointers: ["browser-automation"] + code keywords

↓

Seeds: trigger + validation-rules-v1 + browser security guides

↓

Graph walk: Expands to related patterns

↓

Publishes agent.context.v1 for validation-specialist

↓

validation-specialist triggers with RICH context

↓

Validates and approves

```

**2. Chat Flow**:
```

User: "How do I use playwright?"

↓

Pointers extracted: ["playwright", "browser", "automation"]

↓

Seeds: message + tool.catalog.v1 + playwright guides (via pointers)

↓

Agent receives context with playwright documentation

↓

Answers accurately

```

**3. Tool Creation**:
```

User: "Create browser scraper"

↓

Pointers: ["browser", "scraper", "automation"]

↓

tool-creator gets: similar tools + browser guides + scraping patterns

↓

Creates tool with appropriate pointer tags

````

### Success Criteria

- [ ] Zero hardcoded schemas in context-builder
- [ ] ALL agents use agent.context.v1 subscription
- [ ] entity_keywords populated on ALL breadcrumbs
- [ ] Hybrid search returns relevant results
- [ ] validation-specialist validates with rich context
- [ ] Chat works (unchanged user experience)
- [ ] Tool creation works (better context)

---

## Phase 10: Remove Dead Code

### Search and Destroy

**Files to clean**:

1. **crates/rcrt-context-builder/src/event_handler.rs**
   - DELETE: All agent-specific assembly methods
   - DELETE: Schema-specific if/else blocks
   - KEEP: Generic handle_event with find_agents_for_trigger

2. **crates/rcrt-context-builder/src/retrieval/assembler.rs**
   - VERIFY: execute_source handles all SourceMethod types
   - REMOVE: Any deprecated methods

3. **crates/rcrt-server/src/main.rs**
   - REMOVE: Any schema-specific logic in create_breadcrumb
   - ADD: Pointer extraction before storing

4. **bootstrap-breadcrumbs/**
   - REMOVE: Template tags with {{variables}}
   - REMOVE: Inconsistent tag prefixes
   - STANDARDIZE: All tags follow taxonomy

### Verify No Fallbacks

**Grep for**:
```bash
grep -r "unwrap_or\|unwrap_or_else\|unwrap_or_default" crates/rcrt-context-builder/src/ | grep -v "// OK:"
````

Each fallback needs review:

- If configuration: Fail fast, no default
- If optional feature: Document why optional
- If error handling: Return error, don't hide

---

## Files to Modify (Complete List)

### Rust Code (crates/)

1. `crates/rcrt-server/src/main.rs`

                                                - Add pointer extraction in create_breadcrumb
                                                - Add helper functions (extract_keywords_simple, is_state_tag)

2. `crates/rcrt-core/src/models.rs`

                                                - Verify entity_keywords field exists in BreadcrumbCreate
                                                - Verify entity_keywords field exists in Breadcrumb

3. `crates/rcrt-context-builder/src/event_handler.rs`

                                                - Replace handle_event with generic implementation
                                                - Add find_agents_for_trigger method
                                                - Add assemble_with_pointers method
                                                - DELETE all agent-specific methods

4. `crates/rcrt-context-builder/src/agent_config.rs`

                                                - Add ContextTrigger struct
                                                - Add context_trigger field to AgentDefinition
                                                - Add load_all_agent_definitions_with_triggers function

### Agent Definitions (bootstrap-breadcrumbs/system/)

5. `validation-specialist-agent.json`

                                                - Add context_trigger field
                                                - Change subscription to agent.context.v1
                                                - Add pointer tags

6. `tool-creator-agent.json`

                                                - Add context_trigger field (if not present)
                                                - Verify subscription is agent.context.v1
                                                - Add pointer tags

7. `tool-debugger-agent.json`

                                                - Add context_trigger field (if not present)
                                                - Verify subscription is agent.context.v1
                                                - Add pointer tags

8. `default-chat-agent.json`

                                                - Add context_trigger field (if not present)
                                                - Verify everything correct

### Bootstrap Files (bootstrap-breadcrumbs/)

9. **knowledge/*.json** (17 files)

                                                - Add `workspace:knowledge` tag
                                                - Add 5-10 pointer tags per file
                                                - Remove `guide:` prefix tags
                                                - Remove inconsistent tags

10. **tools-self-contained/*.json** (14 files)

                                                                - Add 3-5 pointer tags per tool
                                                                - Remove `self-contained` tag
                                                                - Ensure `approved`, `validated` present

### Documentation

11. `docs/TAG_TAXONOMY.md` (NEW)

                                                                - Complete tag specification
                                                                - Three tag types
                                                                - Examples
                                                                - Migration guide

12. `docs/SYSTEM_ARCHITECTURE.md`

                                                                - Update "Event-Driven Communication" section
                                                                - Add "Pointer-Based Context Assembly" section
                                                                - Update context-builder description

13. `docs/RCRT_PRINCIPLES.md`

                                                                - Add "Tags as Universal Primitive" section
                                                                - Explain pointer system

14. `docs/BOOTSTRAP_SYSTEM.md`

                                                                - Update tag examples
                                                                - Explain pointer tags

---

## Rollout Strategy

### Step 1: Enable Pointer Extraction (rcrt-server)

- Add entity_keywords population
- Deploy, verify column populates

### Step 2: Add Pointer Tags (bootstrap files)

- Update all JSON files with pointer tags
- Rebootstrap system

### Step 3: Generic context-builder (Rust)

- Implement find_agents_for_trigger
- Implement assemble_with_pointers
- Remove old methods
- Deploy

### Step 4: Update Agent Subscriptions

- Add context_trigger to all agents
- Change subscriptions to agent.context.v1
- Rebootstrap

### Step 5: Test & Verify

- Create new tool → validation works
- Chat → works as before
- Tool creation → better context
- All flows validated

### Step 6: Documentation

- Write TAG_TAXONOMY.md
- Update other docs
- Commit changes

---

## Success Metrics

**Code Metrics**:

- Lines removed from context-builder: ~400 lines
- Hardcoded schema checks: 0
- Agent-specific methods: 0
- Fallback code paths: 0

**Functional Metrics**:

- validation-specialist validates with rich context: ✅
- tool-creator creates with relevant examples: ✅
- default-chat-assistant works unchanged: ✅
- New agents can be added without code changes: ✅

**Tag Metrics**:

- Consistent tag format: 100%
- Pointer tags on knowledge.v1: 100% (all have 5-10)
- Pointer tags on tool.code.v1: 100% (all have 3-5)
- entity_keywords populated: 100%

---

**This is the complete transformation. No half measures. Clean, bulletproof architecture.**