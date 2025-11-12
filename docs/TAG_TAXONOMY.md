# RCRT Tag Taxonomy

**Version:** 1.0  
**Last Updated:** November 12, 2025  
**Status:** Universal standard for all breadcrumbs

---

## The Unified Primitive

**Tags = Routing + Pointers + State**

In RCRT, tags are not just metadata - they ARE the routing system, the semantic search seeds, and the lifecycle state. **ONE primitive powers everything.**

```
Tags power:
├─ Event routing (subscription matching)
├─ Semantic search (hybrid pointers)
├─ Context assembly (pointer → seeds → graph)
├─ Permissions (state filtering)
└─ Identity (unique IDs)
```

---

## Three Tag Types

### 1. ROUTING TAGS (Namespaced)

**Format**: `{namespace}:{identifier}`

**Rules**:
- MUST contain exactly one colon `:`
- MUST be lowercase
- MUST use hyphens for multi-word (not underscore, not camelCase)
- Identifier MUST be alphanumeric + hyphens only

**Examples**:
```
✅ workspace:tools
✅ workspace:agents  
✅ agent:validation-specialist
✅ tool:openrouter
✅ session:1762904026642
✅ consumer:default-chat-assistant

❌ Workspace:Tools (capitals)
❌ workspace_tools (underscore instead of colon)
❌ workspaceTools (camelCase)
```

**Standard Namespaces**:

| Namespace | Purpose | Examples |
|-----------|---------|----------|
| `workspace` | Routing domain | `workspace:tools`, `workspace:agents`, `workspace:knowledge` |
| `agent` | Agent identity | `agent:default-chat-assistant`, `agent:validation-specialist` |
| `tool` | Tool identity | `tool:openrouter`, `tool:astral` |
| `session` | Conversation correlation | `session:1762904026642` |
| `consumer` | Context routing | `consumer:validation-specialist` |
| `request` | Request correlation | `request:llm-123` |
| `specialist` | Agent role | `specialist:validation`, `specialist:tool-creation` |
| `browser` | Browser state | `browser:active-tab` |

---

### 2. POINTER TAGS (Semantic Keywords)

**Format**: `{keyword}` or `{multi-word-keyword}`

**Rules**:
- MUST NOT contain colon `:`
- MUST be lowercase
- MUST use hyphens for multi-word
- Should be descriptive of semantic meaning
- NOT state words (see State Tags)

**Examples**:
```
✅ browser-automation
✅ validation
✅ security
✅ llm-integration
✅ web-scraping
✅ typescript

❌ browser:automation (has namespace)
❌ BrowserAutomation (camelCase)
❌ approved (this is a state tag)
```

**Categories**:

**Domain**:
- `browser-automation`, `validation`, `security`, `testing`
- `code-analysis`, `pattern-matching`, `workflow`
- `llm-integration`, `api-calling`

**Technology**:
- `typescript`, `deno`, `rust`, `postgresql`
- `playwright`, `puppeteer`, `astral`
- `openai`, `anthropic`, `claude`

**Concept**:
- `semantic-search`, `vector`, `embeddings`
- `async`, `scheduling`, `automation`
- `crud-operations`, `database`, `query`

---

### 3. STATE TAGS (Lifecycle)

**Format**: `{state}` (single word)

**Rules**:
- MUST be from allowed list
- MUST be lowercase
- Single word only (no hyphens for state tags)

**Allowed States**:
```
approved      - Tool/agent approved for use
validated     - Passed validation
bootstrap     - Loaded at system startup
deprecated    - Scheduled for removal
draft         - Work in progress
archived      - Historical record
ephemeral     - Auto-delete after use
error         - Error state
warning       - Warning state
info          - Informational
```

---

## How Pointer Tags Work

### The Hybrid Pointer System

**WRITE SIDE** (breadcrumb creation):
```rust
// 1. Extract explicit pointers from tags
let tag_pointers = tags.filter(|t| !t.contains(':') && !is_state_tag(t));
// Example: ["browser-automation", "playwright"]

// 2. Extract dynamic keywords from content
let extracted = entity_extractor.extract(llm_hints_text);
// Example: ["page", "click", "selector", "navigate"]

// 3. Combine and store
entity_keywords = [tag_pointers, extracted].concat();
// Result: ["browser-automation", "playwright", "page", "click", "selector", "navigate"]
```

**READ SIDE** (context assembly):
```rust
// 1. Get trigger breadcrumb
let trigger = get_breadcrumb(trigger_id);

// 2. Extract pointers
let pointers = [
  ...trigger.tags (filtered for pointers),
  ...trigger.entity_keywords
];

// 3. Hybrid search
find_similar_hybrid(
  trigger.embedding,    // 60%: Semantic similarity
  pointers              // 40%: Keyword matching
);

// Matches breadcrumbs with:
// - Similar embeddings (semantic)
// - Overlapping entity_keywords (explicit)
```

**The symmetry**: Both sides have hybrid pointers!

---

## Tag Requirements by Schema

### tool.code.v1

**Required**:
- `workspace:tools` - Routes to tools-runner
- `tool:{name}` - Unique identity (lowercase-hyphenated)
- `approved` - Permission to load
- `validated` - Passed validation

**Recommended**:
- 3-5 pointer tags (domain/technology)
- `bootstrap` (if system tool)

**Example**:
```json
{
  "tags": [
    "tool",
    "workspace:tools",
    "tool:astral",
    "approved",
    "validated",
    "bootstrap",
    "browser-automation",
    "playwright",
    "testing"
  ]
}
```

---

### agent.def.v1

**Required**:
- `workspace:agents` - Routes to agent-runner
- `agent:{agent-id}` - Unique identity

**Recommended**:
- 2-3 pointer tags (role/domain)
- `specialist:{role}` - Role identifier
- `bootstrap` (if system agent)

**Example**:
```json
{
  "tags": [
    "agent:def",
    "workspace:agents",
    "agent:validation-specialist",
    "specialist:validation",
    "bootstrap",
    "security",
    "code-analysis",
    "validation"
  ]
}
```

---

### knowledge.v1

**Required**:
- `workspace:knowledge` - Routes to knowledge system
- 5-10 pointer tags - Semantic keywords for search

**Recommended**:
- Broad pointer tags (domain categories)
- Specific pointer tags (technologies, tools)
- Cross-cutting concerns (security, testing)

**Example**:
```json
{
  "tags": [
    "workspace:knowledge",
    "browser-automation",
    "playwright",
    "puppeteer",
    "web-scraping",
    "security",
    "testing",
    "validation"
  ]
}
```

---

### user.message.v1

**Required**:
- `user:message` - Identity
- `session:{id}` - Conversation correlation

**Optional**:
- Pointer tags (extracted from message content)

**Example**:
```json
{
  "tags": [
    "user:message",
    "extension:chat",
    "session:session-1762904026642",
    "browser",
    "automation"
  ]
}
```

---

## Complete Example: Tool Validation Flow

### 1. Tool Created

```json
{
  "schema_name": "tool.code.v1",
  "title": "Astral Browser Tool",
  "tags": [
    "workspace:tools",      // ROUTING: Tools workspace
    "tool:astral",          // ROUTING: Unique ID
    "browser-automation",   // POINTER: Semantic domain
    "playwright",           // POINTER: Technology
    "web-scraping",         // POINTER: Use case
    "testing"               // POINTER: Related concept
  ]
}
```

At creation, rcrt-server extracts:
```
entity_keywords: [
  "browser-automation", "playwright", "web-scraping", "testing",  // From tags
  "page", "click", "navigate", "selector", "screenshot"           // From code
]
```

### 2. Context-Builder Triggered

**Finds**: validation-specialist has `context_trigger.schema_name = "tool.code.v1"`

**Extracts pointers**:
```
["browser-automation", "playwright", "web-scraping", "testing",
 "page", "click", "navigate", "selector", "screenshot"]
```

**Collects seeds**:
```
├─ Trigger: tool.code.v1 (astral tool)
├─ Always: validation-rules-v1.json
└─ Semantic: Hybrid search with pointers
    → Finds knowledge.v1 with "browser-automation" pointer
    → Finds knowledge.v1 with "playwright" pointer  
    → Finds knowledge.v1 with "security" pointer
    → Finds other tool.code.v1 with similar pointers
```

**Result**: 6 seed breadcrumbs

### 3. Graph Walk & Publish

PathFinder expands from seeds → 15 relevant breadcrumbs

Publishes:
```json
{
  "schema_name": "agent.context.v1",
  "tags": ["agent:context", "consumer:validation-specialist"],
  "context": {
    "formatted_context": "
      === VALIDATION RULES ===
      {validation-rules-v1.json}
      
      === BROWSER AUTOMATION KNOWLEDGE ===
      {browser security guide}
      
      === SIMILAR TOOLS ===
      {other browser tools}
      
      === TOOL TO VALIDATE ===
      {astral tool code}
    "
  }
}
```

### 4. Validation-Specialist Triggers

Subscription matches: `agent.context.v1` + `consumer:validation-specialist`

Receives RICH context with:
- Validation rules (always source)
- Browser security knowledge (via pointers!)
- Similar tools (via pointers!)
- The tool to validate (trigger)

Validates correctly!

---

## Migration Guide

### From Old System

**Old tags** (wild west):
```json
{
  "tags": ["tool", "tool:calculator", "workspace:tools", 
           "self-contained", "math", "utility", "guide:tools"]
}
```

**New tags** (unified):
```json
{
  "tags": ["tool", "workspace:tools", "tool:calculator",
           "approved", "validated", "math", "utility"]
}
```

**Changes**:
- ❌ Removed `self-contained` (redundant for tool.code.v1)
- ❌ Removed `guide:` prefix (inconsistent)
- ✅ Kept pointer tags: `math`, `utility`
- ✅ Kept routing tags: `workspace:tools`, `tool:calculator`
- ✅ Kept state tags: `approved`, `validated`

### Adding Pointer Tags

**For knowledge.v1**: Think "what would someone search for?"
```json
{
  "title": "Browser Automation Best Practices",
  "tags": [
    "workspace:knowledge",
    "browser-automation",   // Primary domain
    "playwright",           // Technology 1
    "puppeteer",            // Technology 2
    "web-scraping",         // Use case
    "security",             // Cross-cutting
    "testing",              // Related concept
    "validation"            // Related concept
  ]
}
```

**For tool.code.v1**: Think "what domain/tech does this use?"
```json
{
  "title": "OpenRouter LLM Tool",
  "tags": [
    "workspace:tools",
    "tool:openrouter",
    "approved", "validated",
    "llm-integration",      // Domain
    "api-calling",          // Pattern
    "openai",               // Provider 1
    "anthropic"             // Provider 2
  ]
}
```

---

## Best Practices

### DO ✅

- Use 3-10 pointer tags per breadcrumb
- Choose tags users would naturally search for
- Include both broad (domain) and specific (technology) pointers
- Keep routing tags minimal (only what's needed for subscription matching)
- Use state tags only from allowed list

### DON'T ❌

- Create new namespace prefixes without documenting
- Use underscores or camelCase
- Mix pointer tags with routing tags
- Add pointer tags that are too generic ("data", "system")
- Forget `workspace:{domain}` on schema definitions

---

## Tag Categories Reference

### Routing Namespaces

```
workspace:    - Domain routing (tools, agents, knowledge)
agent:        - Agent unique ID
tool:         - Tool unique ID
session:      - Conversation scope
consumer:     - Context routing target
request:      - Request correlation
specialist:   - Agent specialization
browser:      - Browser context state
```

### Common Pointer Tags

**Domains**:
```
browser-automation, validation, security, testing
code-analysis, pattern-matching, workflow, automation
llm-integration, api-calling, web-scraping
semantic-search, crud-operations, scheduling
```

**Technologies**:
```
typescript, deno, rust, postgresql
playwright, puppeteer, astral
openai, anthropic, claude, venice
database, postgres, vector, embeddings
```

**Concepts**:
```
async, real-time, streaming, batching
architecture, patterns, best-practices
documentation, guide, quickstart, tutorial
troubleshooting, debugging, error-handling
```

### State Tags

```
approved, validated, bootstrap
deprecated, draft, archived
ephemeral, error, warning, info
```

---

## FAQ

**Q: Should I use `workspace:knowledge` or just `knowledge`?**  
A: `workspace:knowledge` (routing tag). Plain `knowledge` would be ignored as it's not in the domain vocabulary.

**Q: How many pointer tags should I add?**  
A: Knowledge: 5-10, Tools: 3-5, Agents: 2-3. More is better for discoverability!

**Q: Can I create new namespaces?**  
A: Only if absolutely necessary. Document it in this file first.

**Q: What if my content doesn't fit existing pointer tags?**  
A: Add new pointer tags! They're just semantic keywords. Add to is_domain_term() in rcrt-server if core RCRT vocabulary.

**Q: Why remove `self-contained`?**  
A: ALL tool.code.v1 are self-contained by definition. Redundant tag adds no value.

---

## Implementation Notes

### entity_keywords Column

**Database**: `breadcrumbs.entity_keywords TEXT[]`  
**Purpose**: Store hybrid pointers (tag pointers + extracted keywords)  
**Populated**: Automatically at breadcrumb creation  
**Used for**: Hybrid search (40% weight) + vector similarity (60% weight)

### Extraction Process

**rcrt-server** at creation:
```rust
// Tag pointers
let tag_pointers = tags.filter(|t| !t.contains(':') && !is_state_tag(t));

// Extracted keywords
let extracted = extract_keywords_simple(llm_hints_text);

// Store combined
entity_keywords = [tag_pointers, extracted].deduplicated();
```

**context-builder** at query:
```rust
// Get trigger
let trigger = get_breadcrumb(trigger_id);

// Extract pointers
let pointers = [
  ...trigger.tags (filtered for pointers),
  ...trigger.entity_keywords
];

// Hybrid search
find_similar_hybrid(trigger.embedding, pointers);
```

### Symmetric Design

**Both sides extract pointers** → Better matching accuracy

---

## Summary

**Simple rules**:
1. `namespace:id` → Routing & identity
2. `keyword` → Semantic pointer
3. `state` → Lifecycle

**Powerful results**:
- ✅ Universal event routing (tags match subscriptions)
- ✅ Intelligent context (pointers find knowledge)
- ✅ Clean permissions (state filtering)
- ✅ Zero hardcoding (data-driven everywhere)

**Tags ARE pointers. Pointers ARE tags. ONE primitive powers RCRT.**

---

**For more details**:
- System Architecture: [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)
- RCRT Principles: [RCRT_PRINCIPLES.md](./RCRT_PRINCIPLES.md)
- Bootstrap System: [BOOTSTRAP_SYSTEM.md](./BOOTSTRAP_SYSTEM.md)

