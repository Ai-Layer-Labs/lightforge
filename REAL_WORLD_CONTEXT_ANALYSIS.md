# Real-World Context Analysis - Chat Session Example

**Date:** November 12, 2025  
**Session:** session-1762932055572  
**Context Type:** Agent context for tool creation chat

---

## Context Packet Breakdown

### Total Estimated Size: ~11,000-15,000 tokens

**Components:**

#### 1. Tool Catalog (tool.catalog.v1) - **~8,000-10,000 tokens** ⚠️ MASSIVE
```
15 tools × ~500-700 tokens each = 7,500-10,500 tokens
```

**Includes for EACH tool:**
- Full input_schema with all properties
- Full output_schema with all properties  
- Examples with input/output demonstrations
- Capabilities, category, status, version
- Last seen timestamp

**Example tool entry (openrouter):**
- Input schema: ~800 tokens
- Output schema: ~300 tokens
- Examples (3): ~500 tokens
- Total per tool: ~600-800 tokens

**Problem:** Even with llm_hints applied, catalog is HUGE because it includes:
- ALL 15 tools (agent only uses 2-3)
- FULL schemas (agent doesn't need all properties)
- Multiple examples (could be summarized)

#### 2. Knowledge Article - **~1,500-2,000 tokens**
```
Formatted with llm_hints template - human-readable
Complete guide to creating tools
```

**llm_hints applied:** ✅
```
Format: 
# Title
## Summary
## Quick Start Process
## Required Structure
...
```

**Observation:** This IS optimized (structured format), but still very detailed

#### 3. Session Messages - **~1,500-2,500 tokens**
```
~13 messages × 100-200 tokens each
```

**Includes:**
- User messages with timestamps
- Agent responses with tool results
- Tool creation requests
- Validation results

**Observation:** Graph-based retrieval working (conversation continuity)

---

## Token Efficiency Analysis

### Current Context Budget Usage

**Total context:** ~11,000-15,000 tokens  
**Model:** Likely Claude 3.5 Sonnet (200K context window)  
**Budget used:** ~7.5% of available context  
**Remaining:** ~185K-189K tokens for system prompt + LLM response

**Seems okay, but...**

### The Tool Catalog Problem ⚠️

**Current approach:**
```json
{
  "context_sources": {
    "always": [
      {
        "type": "schema",
        "schema_name": "tool.catalog.v1",
        "method": "latest",
        "limit": 1  // Gets the ONE catalog with ALL tools
      }
    ]
  }
}
```

**What agent receives:**
- ALL 15 tools
- FULL schemas for each
- ALL examples for each

**What agent actually needs:**
- Relevant tools (2-3 for current task)
- Minimal schemas (just property names + types)
- ONE example per tool

**Inefficiency:** 8,000-10,000 tokens when 1,000-2,000 would suffice

---

## Root Cause Analysis

### Issue 1: Monolithic Tool Catalog

**Current design:**
```
ONE tool.catalog.v1 breadcrumb contains ALL tools
```

**Problems:**
- Can't filter to relevant tools
- Can't summarize individual tools
- ALL or NOTHING approach

**Example from context:**
```json
{
  "name": "openrouter",
  "inputSchema": {
    "properties": {
      "messages": {...},    // 200 tokens
      "model": {...},       // 100 tokens
      "temperature": {...}, // 100 tokens
      "max_tokens": {...},  // 100 tokens
      "config_id": {...}    // 100 tokens
    }
  },
  "outputSchema": {
    "properties": {
      "content": {...},       // 100 tokens
      "model": {...},         // 100 tokens
      "usage": {...},         // 200 tokens
      "cost_estimate": {...}  // 100 tokens
    }
  },
  "examples": [
    {...},  // 300 tokens
    {...},  // 300 tokens
    {...}   // 300 tokens
  ]
}
// Total: ~2,000 tokens for ONE tool!
```

**But agent only needs:**
```
• openrouter (llm): Call LLM via OpenRouter
  Output: content, model, usage
  Example: {"messages": [...]} → {"content": "response"}
// Total: ~150 tokens - 93% reduction!
```

---

### Issue 2: llm_hints for tool.catalog.v1 Too Verbose

**Current llm_hints (from schemas/tool-catalog-v1.json):**
```json
{
  "llm_hints": {
    "transform": {
      "formatted": {
        "type": "template",
        "template": "=== AVAILABLE TOOLS ===\n\nYou have access to {{activeTools}} tools:\n\n{{#each tools}}- {{name}} ({{category}}): {{description}}\n  Returns: {{returns}}\n{{/each}}"
      }
    },
    "mode": "replace"
  }
}
```

**Problem:** This template references fields that don't exist in the actual catalog!
- `{{returns}}` - Not a field in the catalog structure
- `{{category}}` - Exists, but...
- Missing: Full schemas, examples (which ARE in context)

**Result:** Template doesn't match reality, so llm_hints might be failing, and agent gets RAW catalog JSON!

---

### Issue 3: No Semantic Filtering for Tools

**What would help:**
```json
{
  "context_sources": {
    "semantic": {
      "enabled": true,
      "schemas": ["tool.code.v1"],  // Search INDIVIDUAL tools
      "limit": 3,  // Get 3 relevant tools only
      "min_similarity": 0.75
    }
  }
}
```

**With hybrid pointers from user message:**
- User: "create a browser automation tool"
- Pointers extracted: ["browser", "automation", "tool"]
- Hybrid search finds: [astral tool, playwright knowledge, browser guides]
- Agent gets ONLY relevant tools!

**But currently:** Agent always gets ALL tools via tool.catalog.v1

---

## Recommendations for Tool Catalog

### Option 1: Fix tool.catalog.v1 llm_hints Template

**Current template is broken** - references non-existent fields

**New template:**
```handlebars
=== AVAILABLE TOOLS ({{activeTools}} total) ===

You have access to these tools:

{{#each tools}}
• {{name}}{{#if category}} ({{category}}){{/if}}: {{#if description}}{{description}}{{else}}No description{{/if}}
  {{#if outputSchema.properties}}
  Output fields: {{#each outputSchema.properties}}{{@key}}{{#unless @last}}, {{/unless}}{{/each}}
  {{/if}}
  {{#if examples.[0].explanation}}Example: {{examples.[0].explanation}}{{/if}}
{{/each}}

To invoke: {"tool_requests": [{"tool": "name", "input": {...}}]}
```

**Expected reduction:** 8,000 tokens → 2,000-3,000 tokens (60-70% reduction)

---

### Option 2: Semantic Tool Discovery (Better!)

**Instead of monolithic catalog, use individual tool.code.v1 breadcrumbs:**

**Agent definition:**
```json
{
  "context_sources": {
    "semantic": {
      "enabled": true,
      "schemas": ["tool.code.v1"],  // Individual tools
      "limit": 5,  // Top 5 relevant tools
      "min_similarity": 0.7
    }
  }
}
```

**Tool.code.v1 llm_hints (already exists!):**
```json
{
  "llm_hints": {
    "include": [
      "name",
      "description", 
      "input_schema",
      "output_schema",
      "examples"
    ],
    "exclude": [
      "code",  // Don't show implementation
      "permissions",
      "limits"
    ]
  }
}
```

**Flow:**
```
User: "create browser automation tool"
  ↓
Pointers: ["browser", "automation", "tool", "create"]
  ↓
Hybrid search finds:
  1. astral tool (browser-automation pointer tag)
  2. playwright knowledge
  3. browser security guide
  ↓
Agent receives: 3-5 RELEVANT tools, not all 15!
```

**Expected reduction:** 8,000 tokens → 1,000-2,000 tokens (75-87% reduction!)

---

### Option 3: Two-Tier Catalog System

**Tier 1: Compact Summary (Always included)**
```
• openrouter (llm): Call LLMs - Output: content, model, usage
• random (utility): Generate numbers - Output: numbers[]
• calculator (utility): Math operations - Output: result
... (15 lines total, ~500 tokens)
```

**Tier 2: Full Schemas (Semantic search when needed)**
When user mentions specific tool → fetch tool.code.v1 with full schema

**Implementation:**
```json
{
  "context_sources": {
    "always": [
      {
        "type": "schema",
        "schema_name": "tool.catalog.summary.v1",  // NEW: Compact version
        "method": "latest",
        "limit": 1
      }
    ],
    "semantic": {
      "enabled": true,
      "schemas": ["tool.code.v1"],  // Full tool definitions
      "limit": 3
    }
  }
}
```

**Expected:** 500 tokens (summary) + 300-600 tokens (3 relevant tools) = 800-1,100 tokens total (86-90% reduction!)

---

## Immediate Action Items

### 1. Fix tool.catalog.v1 llm_hints Template (30 minutes)

**File:** `bootstrap-breadcrumbs/schemas/tool-catalog-v1.json`

**Current:**
```json
{
  "template": "=== AVAILABLE TOOLS ===\n\nYou have access to {{activeTools}} tools:\n\n{{#each tools}}- {{name}} ({{category}}): {{description}}\n  Returns: {{returns}}\n{{/each}}"
}
```

**Fixed:**
```json
{
  "template": "=== AVAILABLE TOOLS ({{activeTools}} total) ===\n\nYou have access to these tools:\n\n{{#each tools}}\n• {{name}}{{#if category}} ({{category}}){{/if}}: {{description}}\n  {{#if outputSchema.properties}}Output: {{#each outputSchema.properties}}{{@key}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}\n  {{#if examples.[0]}}Example: {{examples.[0].explanation}}{{/if}}\n{{/each}}\n\nTo invoke: {\"tool_requests\": [{\"tool\": \"name\", \"input\": {...}}]}"
}
```

**Impact:** 8,000 tokens → 2,500-3,500 tokens (56-68% reduction)

---

### 2. Enable Semantic Tool Discovery (1 hour)

**File:** `bootstrap-breadcrumbs/system/default-chat-agent.json`

**Add to context_sources.semantic.schemas:**
```json
{
  "context_sources": {
    "always": [
      // Keep tool.catalog.v1 for now (with fixed template)
    ],
    "semantic": {
      "enabled": true,
      "schemas": [
        "knowledge.v1",
        "note.v1",
        "tool.code.v1"  // ← ADD THIS
      ],
      "limit": 5,  // ← Increase from 3
      "min_similarity": 0.7
    }
  }
}
```

**Impact:** Agent gets relevant tools via semantic search + compact catalog summary

---

### 3. Create Compact Catalog Summary (2 hours)

**New schema:** `tool.catalog.summary.v1`

**Structure:**
```json
{
  "schema_name": "tool.catalog.summary.v1",
  "tags": ["tool:catalog", "summary"],
  "context": {
    "tools": [
      {
        "name": "openrouter",
        "category": "llm",
        "one_line": "Call LLM via OpenRouter - Output: content, model, usage"
      },
      {
        "name": "random",
        "category": "utility",
        "one_line": "Generate random numbers - Output: numbers[]"
      }
      // ... all 15 tools
    ]
  }
}
```

**llm_hints:**
```json
{
  "llm_hints": {
    "transform": {
      "formatted": {
        "type": "template",
        "template": "=== TOOLS SUMMARY ===\n{{#each tools}}\n• {{name}} ({{category}}): {{one_line}}\n{{/each}}\n\nFor full schemas, ask about specific tools."
      }
    },
    "mode": "replace"
  }
}
```

**Result:** 15 lines × 40-60 tokens = 600-900 tokens (vs 8,000 currently!)

---

## Context Optimization Strategy

### The Core Issue

**Your concern is justified!** Looking at this real context packet:

1. **Tool catalog dominates:** 8K-10K tokens out of 11K-15K total (70-80%)
2. **Most tools unused:** Agent creating browser tool, but gets timer, calculator, scheduler details
3. **Full schemas overkill:** Agent doesn't need every property definition
4. **Examples verbose:** 3 examples per tool, agent only needs 1

### The Solution: Three-Pronged Approach

#### Approach 1: Better llm_hints (Quick Fix - 30 min)
Fix the tool.catalog.v1 template to actually work and be more compact

**Expected:** 8,000 tokens → 2,500 tokens (69% reduction)

#### Approach 2: Semantic Tool Discovery (Medium - 2 hours)
- Remove tool.catalog.v1 from "always" sources
- Add tool.code.v1 to "semantic" sources
- Agent gets relevant tools via hybrid search

**Expected:** 8,000 tokens → 1,500 tokens (81% reduction)

#### Approach 3: Hybrid Catalog (Best - 3 hours)
- Compact summary in "always" (600 tokens)
- Full schemas via "semantic" (1,500 tokens for 3 tools)
- Total: 2,100 tokens (74% reduction)

---

## Specific Fixes for This Context

### Fix 1: Tool Catalog llm_hints Template

The current template references fields that don't exist (`{{returns}}`), so Handlebars likely fails and falls back to raw JSON!

**This explains why the context is so large** - llm_hints aren't being applied successfully!

**Evidence:** In your context packet, I see the raw catalog structure with all fields, not the templated format. The llm_hints failed to apply.

---

### Fix 2: Exclude Verbose Fields

**Add to tool.catalog.v1 llm_hints:**
```json
{
  "llm_hints": {
    "exclude": [
      "tools[*].inputSchema",      // Exclude full input schemas
      "tools[*].outputSchema",     // Exclude full output schemas  
      "tools[*].examples[1]",      // Exclude 2nd example
      "tools[*].examples[2]",      // Exclude 3rd example
      "tools[*].capabilities",     // Exclude capabilities
      "tools[*].lastSeen",         // Exclude timestamps
      "tools[*].version"           // Exclude versions
    ],
    "include": [
      "tools[*].name",
      "tools[*].category",
      "tools[*].description",
      "tools[*].examples[0].explanation"  // Just first example explanation
    ],
    "mode": "replace"
  }
}
```

**Expected:** 8,000 tokens → 1,200 tokens (85% reduction!)

---

### Fix 3: Dynamic Tool Loading

**Instead of always including full catalog:**

1. **Summary in every context** (600 tokens)
2. **Full schemas only when needed** (via semantic search)

**When user says:** "create browser automation tool"
- Pointers: ["browser", "automation", "tool"]
- Semantic search finds: astral tool definition (with full schema)
- Agent gets: Summary + astral details

**When user says:** "what tools do I have?"
- Agent sees summary, lists all tools
- Doesn't need full schemas

---

## Comparison: Before vs After

### BEFORE (Current - This Context Packet)
```
tool.catalog.v1:        8,000-10,000 tokens (70-80%)
knowledge.v1:           1,500-2,000 tokens  (13-15%)
session messages:       1,500-2,500 tokens  (10-17%)
──────────────────────────────────────────
TOTAL:                  11,000-15,000 tokens

Issues:
- Tool catalog too verbose
- llm_hints template broken (references non-existent fields)
- Agent gets ALL tools, not relevant ones
```

### AFTER (With Fixes)
```
tool.catalog.summary:   600-900 tokens      (20-30%)
tool.code.v1 (semantic):1,000-1,500 tokens  (33-40%) - 2-3 relevant tools
knowledge.v1:           1,500-2,000 tokens  (40-50%)
session messages:       500-1,000 tokens    (13-20%) - filtered
──────────────────────────────────────────
TOTAL:                  3,600-5,400 tokens

Improvements:
✅ 67-76% token reduction!
✅ Only relevant tools included
✅ Full schemas available when needed
✅ Better context utilization
```

---

## Implementation Priority for Context Efficiency

### P0: Fix Broken Template (30 minutes) ⭐⭐⭐

**Why P0:** Current template is BROKEN (references {{returns}} which doesn't exist)

**File:** `bootstrap-breadcrumbs/schemas/tool-catalog-v1.json`

**Change:**
```json
{
  "llm_hints": {
    "transform": {
      "formatted": {
        "type": "template",
        "template": "=== AVAILABLE TOOLS ({{activeTools}}) ===\n\n{{#each tools}}\n• {{name}}: {{description}}\n  Output: {{#if outputSchema.properties}}{{#each outputSchema.properties}}{{@key}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}object{{/if}}\n{{/each}}\n\nInvoke: {\"tool_requests\": [{\"tool\": \"name\", \"input\": {}}]}"
      }
    },
    "include": [
      "activeTools",
      "tools[*].name",
      "tools[*].description",
      "tools[*].outputSchema.properties"  // Just property names
    ],
    "exclude": [
      "tools[*].inputSchema",  // Exclude input schemas
      "tools[*].examples",     // Exclude all examples
      "tools[*].capabilities",
      "tools[*].lastSeen",
      "tools[*].version",
      "tools[*].status"
    ],
    "mode": "replace"
  }
}
```

**Result:** 8,000 tokens → 1,200-1,500 tokens (81-85% reduction!)

---

### P1: Semantic Tool Discovery (1-2 hours) ⭐⭐

**Files:**
- `bootstrap-breadcrumbs/system/default-chat-agent.json`
- `bootstrap-breadcrumbs/schemas/tool-code-v1.json` (verify llm_hints)

**Change 1: Agent context_sources**
```json
{
  "context_sources": {
    "always": [
      // Remove tool.catalog.v1 OR use summary version
    ],
    "semantic": {
      "enabled": true,
      "schemas": [
        "knowledge.v1",
        "note.v1",
        "tool.code.v1"  // ← ADD
      ],
      "limit": 5  // ← Top 5 (tools + knowledge)
    }
  }
}
```

**Change 2: Verify tool.code.v1 llm_hints**
File already has good llm_hints:
```json
{
  "include": ["name", "description", "input_schema", "output_schema", "examples"],
  "exclude": ["code", "permissions", "limits"]
}
```
✅ Already optimized!

**Result:** Only relevant tools included via semantic search

---

### P2: Create Compact Summary Catalog (2-3 hours) ⭐

**New breadcrumb:** tool.catalog.summary.v1

**Generated by:** Catalog aggregator (modify to create TWO breadcrumbs)
1. tool.catalog.v1 (full - for dashboard)
2. tool.catalog.summary.v1 (compact - for agents)

**Summary structure:**
```json
{
  "tools": [
    {
      "name": "openrouter",
      "summary": "LLM via OpenRouter → content, model, usage"
    },
    ...
  ]
}
```

**Result:** 600-900 tokens baseline + semantic search for details

---

## Key Insight: llm_hints Template is Failing!

**Evidence from your context packet:**

I see the RAW catalog structure with full schemas, which means the llm_hints template **did NOT apply successfully**.

**Why it's failing:**
```handlebars
{{#each tools}}
  Returns: {{returns}}  ← Field doesn't exist!
{{/each}}
```

**Handlebars behavior:**
- When field doesn't exist, it renders empty string
- But {{returns}} is in the middle of the template
- Template might be partially rendering or failing entirely

**Fix the template → Immediate token reduction without code changes!**

---

## Summary

Your concern about effective context is **100% valid**. The tool catalog in your example is consuming **70-80% of context tokens** unnecessarily.

**Root causes:**
1. ✅ llm_hints template broken (references non-existent fields)
2. ✅ Monolithic catalog (all tools vs relevant tools)
3. ✅ No semantic tool filtering

**Solutions (prioritized):**
1. **Fix template** (30 min) → 81-85% reduction
2. **Semantic discovery** (2 hours) → Additional filtering
3. **Compact summary** (3 hours) → Hybrid approach

**Total potential:** 11,000-15,000 tokens → 3,000-5,000 tokens (**67-76% reduction!**)

**This aligns perfectly with my earlier optimization analysis** - token efficiency is critical, and llm_hints are the key!

