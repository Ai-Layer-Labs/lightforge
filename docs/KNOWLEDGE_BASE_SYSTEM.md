# Knowledge Base System

**Date**: 2025-11-02  
**Status**: ✅ **IMPLEMENTED**

## Overview

The Knowledge Base system allows you to teach LLMs about RCRT by storing `knowledge.v1` breadcrumbs that are automatically included in agent context via **semantic search**.

## Quick Answer to Your Questions

### Q: "Will the context builder pick this up in semantic search?"

**YES! ✅** When you ask the chat agent "How do I create a tool?", here's what happens:

1. **User sends message** → `user.message.v1` breadcrumb created
2. **Context builder triggers** (Rust service)
3. **Semantic search runs** using pgvector:
   - Searches for breadcrumbs similar to "How do I create a tool?"
   - Finds `how-to-create-tools.json` with high similarity score
   - Includes it in the assembled context
4. **Agent receives context** including the knowledge breadcrumb
5. **Agent responds** using the comprehensive guide

The knowledge breadcrumb **will definitely be picked up** because:
- ✅ `knowledge.v1` is **NOT in the blacklist**
- ✅ Semantic search uses **pgvector embeddings** (finds by meaning, not exact text)
- ✅ Context builder uses **blacklist approach** (includes everything except system internals)

## How It Works

### Architecture

```
User Question
     ↓
Context Builder (Rust)
     ↓
Semantic Search (pgvector)
     ↓
Knowledge Breadcrumbs ← how-to-create-tools.json
     ↓
Agent Context
     ↓
LLM Response
```

### Semantic Search Flow

1. **Embedding Generation**
   - When knowledge breadcrumb is created, PostgreSQL generates embedding
   - Uses ONNX models (local, fast, no API calls)
   - Stored in `breadcrumbs.embedding` column (pgvector)

2. **Query Embedding**
   - User question is converted to embedding
   - Uses same ONNX model for consistency

3. **Similarity Search**
   - pgvector finds breadcrumbs with similar embeddings
   - Sorts by cosine similarity score
   - Returns top N most relevant breadcrumbs

4. **Context Assembly**
   - Recent conversation messages
   - Tool catalog
   - **Knowledge breadcrumbs** ← Your knowledge appears here!
   - Combined into agent context

### What Gets Included?

The context builder uses a **blacklist approach**:

**✅ INCLUDED (Everything except...)**
- `user.message.v1` - User messages
- `agent.response.v1` - Agent responses
- `tool.response.v1` - Tool outputs
- `tool.catalog.v1` - Available tools
- **`knowledge.v1`** - Knowledge base ← YOUR KNOWLEDGE!
- Any other schema not in blacklist

**❌ EXCLUDED (Blacklist)**
- `system.health.v1` - System health
- `system.metric.v1` - Performance metrics
- `tool.config.v1` - Tool settings
- `secret.v1` - Secrets (never exposed)
- `system.startup.v1` - System events

## Implementation Details

### Bootstrap Integration

**File**: `bootstrap-breadcrumbs/bootstrap.js`

Added Step 5:
```javascript
// 5. Load knowledge base breadcrumbs
console.log('\n5️⃣ Loading knowledge base...');
const knowledgeDir = path.join(__dirname, 'knowledge');
if (fs.existsSync(knowledgeDir)) {
  const knowledgeFiles = fs.readdirSync(knowledgeDir).filter(f => f.endsWith('.json'));
  
  for (const file of knowledgeFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(knowledgeDir, file), 'utf-8'));
    
    // Check if knowledge already exists
    const existing = await searchBreadcrumbs({
      schema_name: data.schema_name,
      tag: 'knowledge'
    });
    
    const existingItem = existing.find(item => item.title === data.title);
    
    if (existingItem) {
      console.log(`   ⏭️  ${data.title} already exists`);
      continue;
    }
    
    // Upload to RCRT
    const resp = await api('POST', '/breadcrumbs', data);
    // ...
  }
}
```

### Setup Script Integration

**File**: `setup.sh`

The `setup.sh` already calls `bootstrap.js`, so no changes needed! When you run:

```bash
./setup.sh
```

The knowledge breadcrumbs are **automatically loaded** as part of step 5.

### Context Builder Integration

**File**: `crates/rcrt-context-builder/src/vector_store.rs`

The blacklist does **NOT** include `knowledge.v1`:

```rust
let blacklist = vec![
    "system.health.v1",
    "system.metric.v1",
    "tool.config.v1",        // Tool settings, not context
    "secret.v1",             // Never include secrets
    "system.startup.v1",     // System events, not conversational
];
// NOTE: knowledge.v1 is NOT in this list!
```

This means knowledge breadcrumbs are **always available** for semantic search.

## Usage Example

### Scenario: User Asks About Creating Tools

**User Message (Chat Extension):**
```
"How do I create a new tool for calling an external API?"
```

**Context Builder (Rust) - Semantic Search:**
```rust
// Searches for breadcrumbs semantically similar to:
// "How do I create a new tool for calling an external API?"

// Finds (with similarity scores):
// 1. how-to-create-tools.json (0.89) ← High similarity!
// 2. openrouter.json (0.67) - API example
// 3. tool.catalog.v1 (0.45) - Available tools
```

**Agent Context Includes:**
```json
{
  "messages": [
    {"schema": "user.message.v1", "content": "How do I create a new tool..."},
    {"schema": "agent.response.v1", "content": "Previous response..."}
  ],
  "knowledge": [
    {
      "schema": "knowledge.v1",
      "title": "Complete Guide: Creating Self-Contained Tools in RCRT",
      "content": {
        "quick_start": {...},
        "required_structure": {...},
        "secrets_management": {...},
        "examples": {...}
      }
    }
  ],
  "tools": [
    {"name": "breadcrumb-create", "description": "..."},
    {"name": "openrouter", "description": "..."}
  ]
}
```

**Agent Response:**
```
To create a new tool for calling an external API, follow these steps:

1. Structure: Use tool.code.v1 schema with this exact structure:
   - schema_name: "tool.code.v1"
   - tags: ["tool", "tool:yourname", "workspace:tools", "self-contained"]
   - context.code.source: Your Deno TypeScript code

2. API Integration: For external APIs, you'll need:
   - permissions: { net: true } or { net: ["api.example.com"] }
   - Secret management: Store API keys as secrets, reference by ID
   - Use fetch() in your Deno code

3. Example: Check openrouter.json as a reference for API integration

4. Upload: Use the breadcrumb-create tool to upload your definition:
   {
     "tool": "breadcrumb-create",
     "input": { ... your tool definition ... }
   }

[... detailed explanation using the knowledge breadcrumb content ...]
```

**Result:** The agent provides **accurate, comprehensive instructions** because it has access to the entire knowledge base!

## Current Knowledge Breadcrumbs

### 1. How to Create Tools

**File**: `bootstrap-breadcrumbs/knowledge/how-to-create-tools.json`

**Content Sections:**
- Quick start guide
- Required structure (with common mistakes highlighted)
- Code section (execute function, context API)
- Input/output schemas
- Permissions (Deno sandbox)
- Secrets management (THE RCRT WAY)
- UI schema (dynamic configuration)
- Complete working examples
- Upload instructions
- Testing procedures
- Best practices checklist

**Size**: ~15KB of comprehensive documentation

**Topics Covered:**
- ✅ Tool structure and schema
- ✅ Code wrapper requirements
- ✅ Secrets management (load by ID, not name)
- ✅ Permissions and limits
- ✅ Dynamic UI generation
- ✅ Common mistakes and how to avoid them
- ✅ Complete working examples
- ✅ Upload and testing procedures

## Testing the System

### 1. Verify Knowledge Upload

```bash
# Run bootstrap
cd bootstrap-breadcrumbs && node bootstrap.js

# Expected output:
# 5️⃣ Loading knowledge base...
#    ✅ Created: Complete Guide: Creating Self-Contained Tools in RCRT (uuid)

# Verify in database
docker compose exec db psql -U postgres -d rcrt \
  -c "SELECT id, title, schema_name FROM breadcrumbs WHERE schema_name = 'knowledge.v1';"
```

### 2. Test Semantic Search

```bash
# Open chat extension (or use dashboard)
# Ask: "How do I create a tool?"

# Watch context-builder logs:
docker compose logs context-builder -f

# You should see:
# 📨 Processing user message event
# 🔍 Assembling context from subscriptions...
# ✅ Context assembled with X breadcrumbs
# (Including knowledge.v1 breadcrumbs)
```

### 3. Verify Agent Response

The agent should:
- ✅ Provide detailed, accurate instructions
- ✅ Reference specific examples
- ✅ Explain common mistakes
- ✅ Show correct code structure
- ✅ Include upload instructions

If the agent's response includes detailed information about:
- Code wrapper structure (`code.source`)
- Secrets management (load by ID)
- Common mistakes (like putting `source` at wrong level)

**Then the knowledge breadcrumb was successfully included!**

## Future Enhancements

### Planned Features

1. **Confidence Scoring**
   - Rate how well knowledge matches queries
   - Prefer high-confidence knowledge in context

2. **Usage Tracking**
   - Track which knowledge is accessed most
   - Identify gaps in documentation

3. **Feedback Loops**
   - Let agents rate knowledge helpfulness
   - Evolve knowledge based on usage patterns

4. **Knowledge Graphs**
   - Link related knowledge breadcrumbs
   - Build semantic relationships

5. **Multi-modal Knowledge**
   - Support diagrams and images
   - Include code snippets with syntax highlighting

## Related Files

### Core Implementation
- `bootstrap-breadcrumbs/bootstrap.js` - Loads knowledge on startup
- `bootstrap-breadcrumbs/knowledge/` - Knowledge directory
- `crates/rcrt-context-builder/src/vector_store.rs` - Blacklist configuration
- `crates/rcrt-context-builder/src/event_handler.rs` - Context assembly

### Documentation
- `bootstrap-breadcrumbs/knowledge/README.md` - Knowledge usage guide
- `docs/BLACKLIST_APPROACH.md` - Context builder philosophy
- `docs/CONTEXT_BUILDER_RUST.md` - Technical details
- `bootstrap-breadcrumbs/knowledge/how-to-create-tools.json` - First knowledge breadcrumb

### Examples
- `bootstrap-breadcrumbs/knowledge/how-to-create-tools.json` - Comprehensive tool guide

## Summary

### ✅ What's Implemented

1. **Bootstrap Integration** - Knowledge directory loaded on startup
2. **Semantic Search** - pgvector finds relevant knowledge automatically  
3. **Context Assembly** - Knowledge included in agent context
4. **Example Knowledge** - Comprehensive tool creation guide
5. **Documentation** - README and guides for adding knowledge

### 🎯 How to Use

1. **Create knowledge**: Add `*.json` files to `bootstrap-breadcrumbs/knowledge/`
2. **Run bootstrap**: `cd bootstrap-breadcrumbs && node bootstrap.js`
3. **Ask agent**: Chat agent automatically gets relevant knowledge
4. **Verify**: Check logs to confirm knowledge is included

### 🚀 Result

When you ask the chat agent:
- ✅ "How do I create a tool?" → Gets full guide automatically
- ✅ "What's the RCRT way to handle secrets?" → Finds secrets section
- ✅ "Show me an example tool" → Includes working examples
- ✅ "How do I upload my tool?" → Gets upload instructions

**The agent knows what you've taught it!** 🎉

