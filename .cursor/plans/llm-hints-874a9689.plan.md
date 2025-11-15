<!-- 874a9689-e433-4d62-9c61-adf091f6c12d b05f656c-c39b-4b1c-b8d3-cf2f7dc71484 -->
# Build Poker AI Decision System with RCRT

## Overview

Create a production-ready poker AI that retrieves GTO-optimal decisions from a 10k scenario knowledge base using RCRT's hybrid vector search. The agent will provide real-time recommendations while playing on stake.com.

## Architecture Summary

**Data Flow:**

1. User downloads 10k poker scenarios from HuggingFace
2. Upload script converts to `poker.decision.v1` breadcrumbs with embeddings
3. Browser extension captures game state → creates `poker.query.v1`
4. Context-builder performs hybrid search (vector + keywords) → finds top 10 similar scenarios
5. Poker agent receives context → recommends optimal action
6. Extension displays recommendation overlay

**Key Files:**

- `scripts/seed-poker-dataset.js` - Bulk upload 10k scenarios
- `bootstrap-breadcrumbs/schemas/poker-decision-schema.json` - Schema definition
- `bootstrap-breadcrumbs/system/poker-specialist-agent.json` - Agent definition
- `scripts/test-poker-agent.js` - Testing script

## Implementation Details

### 1. Schema Definition (`poker-decision-schema.json`)

Based on research:

- Embeddings auto-generated from `title + description + llm_hints-transformed context` (see `crates/rcrt-server/src/main.rs:315`)
- Default embedding policy: embed all schemas unless explicitly excluded (see `embedding_policy.rs:27`)
- pgvector uses ivfflat index with cosine similarity (see `migrations/0001_init.sql:56`)
```json
{
  "schema_name": "schema.def.v1",
  "title": "Poker Decision Schema",
  "tags": ["schema:def", "poker"],
  "context": {
    "schema_name": "poker.decision.v1",
    "description": "GTO solver optimal poker decisions for 6-handed NLHE",
    "llm_hints": {
      "transform": {
        "formatted": {
          "type": "template",
          "template": "**Poker Scenario**\nPosition: {{position}} | Hand: {{holding}}\nStreet: {{street}} | Pot: {{pot_size}}bb\nBoard: {{board}}\nAction History: {{action_history}}\n\n**GTO Optimal:** {{optimal_decision}}"
        }
      },
      "mode": "replace"
    }
  }
}
```


### 2. Upload Script (`seed-poker-dataset.js`)

**Performance Targets** (based on codebase research):

- Current DB: Handles 100K+ breadcrumbs easily (see `docs/SYSTEM_ARCHITECTURE.md:1987`)
- Upload rate: 100-500 breadcrumbs/sec with batch operations
- 10k scenarios = ~1-2 minutes upload time

**Pointer Extraction Strategy:**

- Extract from tags (position, street, action)
- Extract from llm_hints-transformed text (see `crates/rcrt-server/src/main.rs:624-643`)
- Stored in `entity_keywords` column for hybrid search

Key implementation from `bootstrap-breadcrumbs/bootstrap.js:157`:

- Check for existing scenarios (avoid duplicates)
- Use SDK's `createBreadcrumb()` method
- Batch with idempotency keys
```javascript
const sdk = new RcrtClientEnhanced(baseUrl, token);

for (let i = 0; i < scenarios.length; i++) {
  const scenario = scenarios[i];
  const parsed = parsePokerScenario(scenario);
  
  await sdk.createBreadcrumb({
    schema_name: 'poker.decision.v1',
    title: `Poker: ${parsed.position} ${parsed.holding} ${parsed.street}`,
    description: scenario.instruction.substring(0, 300),
    semantic_version: '1.0.0',
    tags: [
      'poker',
      'decision',
      `position:${parsed.position}`,
      `street:${parsed.street}`,
      `action:${parsed.output}`,
      `pot:${categorizePotSize(parsed.pot_size)}`
    ],
    llm_hints: {
      "exclude": ["raw_scenario", "csv_data"]
    },
    context: {
      position: parsed.position,
      holding: parsed.holding,
      board: parsed.board,
      pot_size: parsed.pot_size,
      street: parsed.street,
      action_history: parsed.action_history,
      optimal_decision: parsed.output,
      raw_scenario: scenario.instruction
    }
  }, `poker-${i}`); // Idempotency key
  
  if (i % 100 === 0) {
    console.log(`Uploaded ${i}/10000...`);
  }
}
```


### 3. Agent Definition (`poker-specialist-agent.json`)

**Context Assembly Strategy** (based on `default-chat-agent.json:26-58`):

```json
{
  "schema_name": "agent.def.v1",
  "title": "Poker Strategy Specialist",
  "tags": ["agent:def", "workspace:agents", "poker"],
  "context": {
    "agent_id": "poker-specialist",
    "llm_config_id": "OPENROUTER_CONFIG_UUID",
    
    "system_prompt": "You are a GTO poker specialist. When you receive a poker scenario:\n\n1. Analyze the 10 most similar scenarios in your context\n2. Identify patterns: position, pot odds, hand strength, opponent actions\n3. Recommend the optimal decision with confidence level\n4. Explain reasoning based on GTO principles\n\nResponse format:\n{\n  \"action\": \"create\",\n  \"breadcrumb\": {\n    \"schema_name\": \"agent.response.v1\",\n    \"tags\": [\"agent:response\", \"poker:recommendation\", \"session:SESSION_ID\"],\n    \"context\": {\n      \"recommendation\": \"bet 18\",\n      \"confidence\": 0.95,\n      \"reasoning\": \"In 8/10 similar river two-pair spots, GTO bets 75% pot for value\",\n      \"similar_scenarios\": 10,\n      \"pattern\": \"two-pair river value bet\"\n    }\n  }\n}",
    
    "context_sources": {
      "semantic": {
        "enabled": true,
        "schemas": ["poker.decision.v1"],
        "limit": 10,
        "min_similarity": 0.70,
        "comment": "Retrieve 10 most similar poker scenarios using hybrid search (vector 60% + keywords 40%)"
      }
    },
    
    "subscriptions": {
      "selectors": [{
        "schema_name": "agent.context.v1",
        "all_tags": ["consumer:poker-specialist"],
        "role": "trigger",
        "fetch": {"method": "event_data"}
      }]
    }
  }
}
```

**Why min_similarity: 0.70?**

- Based on `validation-specialist-agent.json:52` and `tool-debugger-agent.json:50`
- Lower threshold allows learning from "similar but not identical" scenarios
- Hybrid search compensates with keyword matching

### 4. Browser Integration Strategy

**Current Browser Extension** (`rcrt-extension-v2/src/lib/`):

- Already has page capture (`content.ts`)
- Already has RCRT client (`rcrt-client.ts`)
- Already has UI overlay system

**New Poker Module:**

Create `rcrt-extension-v2/src/lib/poker-capture.ts`:

- Detect stake.com poker interface
- Parse DOM for: position, cards, pot size, board, opponent actions
- Create `poker.query.v1` breadcrumb with tag `poker:query-needed`
- Triggers poker-specialist agent
- Display recommendation overlay

### 5. Testing Script (`test-poker-agent.js`)

Test queries:

```javascript
// Test 1: Exact match scenario (should be >0.95 similarity)
const testQuery1 = {
  position: "HJ",
  holding: ["Kd", "Js"],
  board: ["Ks", "7h", "2d", "Jc", "7c"],
  pot_size: 24,
  street: "river",
  action_history: "HJ raise 2, BB call, flop check-check, turn HJ bet 3 BB raise 10 HJ call, river BB check"
};

// Test 2: Similar scenario (should be 0.75-0.90 similarity)
const testQuery2 = {
  position: "CO",
  holding: ["Qh", "Jh"],
  board: ["Qs", "8c", "3d", "Jd", "8s"],
  pot_size: 28,
  street: "river",
  action_history: "CO raise 2.5, BB call, flop check-check, turn CO bet 5 BB raise 12 CO call, river BB check"
};

// Create query breadcrumb
const query = await sdk.createBreadcrumb({
  schema_name: 'poker.query.v1',
  title: 'Poker Query: River Decision',
  tags: ['poker:query-needed', 'consumer:poker-specialist'],
  context: testQuery1
});

// Wait for agent response
await waitForResponse(query.id);
```

## Performance Expectations

**Database Performance** (from `docs/SYSTEM_ARCHITECTURE.md:1987`):

- Vector search: <100ms for 100K breadcrumbs
- 10k scenarios: <50ms query time
- Hybrid search: <80ms total

**Context Assembly** (from `crates/rcrt-context-builder/src/event_handler.rs:263`):

- Semantic search with pointers: ~50-100ms
- Graph loading: ~50ms
- Total context assembly: ~200ms

**Target Latency for Real-Time Play:**

- Query → Recommendation: <500ms
- Browser capture → Display: <1s total

## File Structure

```
scripts/
  ├─ seed-poker-dataset.js          (NEW: Bulk upload)
  ├─ test-poker-agent.js             (NEW: Testing)
  └─ parse-poker-dataset.js          (NEW: Parser utilities)

bootstrap-breadcrumbs/
  ├─ schemas/
  │   └─ poker-decision-schema.json  (NEW: Schema def)
  └─ system/
      └─ poker-specialist-agent.json (NEW: Agent def)

rcrt-extension-v2/src/lib/
  └─ poker-capture.ts                (NEW: Browser integration)
```

## Success Criteria

1. **Upload Performance**: 10k scenarios uploaded in <3 minutes
2. **Query Performance**: Vector search returns results in <100ms
3. **Decision Quality**: Recommendations match GTO solver >90% of time
4. **Real-Time Usability**: Total latency <1s from capture to display
5. **Browser Integration**: Automatic detection and overlay on stake.com

### To-dos

- [ ] Remove `include` field from LlmHints struct, make `exclude` required (can be empty vec)
- [ ] Remove include filtering logic from apply_llm_hints(), keep only exclude filtering
- [ ] Delete schema cache lookup in GET /breadcrumbs/{id}, use ONLY instance llm_hints
- [ ] Remove SchemaDefinitionCache struct, preload logic, and AppState field
- [ ] Update all 14 tool files to exclude-only llm_hints format
- [ ] Remove llm_hints from all 19 schema.def.v1 files (no longer used)