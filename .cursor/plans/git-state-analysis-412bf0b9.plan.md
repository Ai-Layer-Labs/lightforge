<!-- 412bf0b9-ca31-4b15-ab88-2a6045a9ad40 761d5aac-4b1c-415a-807b-9effbf03acff -->
# Rust Context Builder Service - Implementation Plan

## Overview

Build `rcrt-context-builder` as a Rust microservice that replaces the Node.js context-builder tool while maintaining 100% compatibility with existing breadcrumb I/O patterns. **CRITICAL PREREQUISITE**: Fix agent.response.v1 schema issues first.

## Phase 0: Schema Standardization (Days 1-2 - BLOCKING)

### 0.1 Fix Agent Response Duplication

**Problem**: Agent-runner emits TWO `agent.response.v1` breadcrumbs per response (old and new format)

**Investigation**:

- Search `rcrt-visual-builder/packages/runtime/` for agent response creation
- Identify duplicate emission points
- Check why both formats are being created

**Fix**:

Standardize on SINGLE format with all required fields:

```typescript
{
  schema_name: "agent.response.v1",
  tags: ["agent:response", "chat:output", "session:session-XXX"],
  context: {
    message: string,              // Actual response text
    creator: {
      type: "agent",
      agent_id: string
    },
    trigger_event_id: string,     // Standardized name
    timestamp: string             // ISO 8601
  }
}
```

Files likely needing changes:

- `rcrt-visual-builder/packages/runtime/src/` - Agent executor
- Search for `agent.response.v1` creation

**Remove** duplicate emission logic

### 0.2 Add Session Tags to Agent Responses

**Problem**: `agent.response.v1` missing `session:XXX` tag, breaking session isolation

**Fix**:

- Extract session ID from trigger event (`user.message.v1` or `agent.context.v1` tags)
- Add `session:XXX` to agent.response.v1 tags array
- Ensure session propagates from user message → context → agent response

**Validation**:

```sql
-- Should return 0 after fix
SELECT COUNT(*) FROM breadcrumbs 
WHERE schema_name = 'agent.response.v1' 
AND NOT EXISTS (
  SELECT 1 FROM unnest(tags) t WHERE t LIKE 'session:%'
);
```

### 0.3 Standardize Field Names

**Problem**: Inconsistent naming (`trigger_id` vs `trigger_event_id`)

**Changes**:

- Use `trigger_event_id` everywhere (consistent with context-builder)
- Use `session_id` in context fields (not `sessionId`)
- Use `agent_id` in creator (not `agentId`)

**Files to update**:

- Agent runtime response creation
- Any breadcrumb creation with trigger references

### 0.4 Test Standardization

**Test cases**:

1. Send user message → verify SINGLE agent.response.v1 created
2. Check agent.response.v1 has `session:XXX` tag
3. Verify `trigger_event_id` field exists and references user message
4. Query by session tag → verify agent responses appear

**Success criteria**:

- Zero duplicate responses
- 100% responses have session tags  
- Consistent field naming
- Context-builder can retrieve session-scoped responses

## Phase 1: Foundation & Drop-in Replacement (Days 3-7)

### 1.1 Project Setup

Create `rcrt-services/context-builder/` with Cargo workspace

Dependencies:

- `tokio` - Async runtime
- `sqlx` - PostgreSQL with pgvector
- `serde`, `serde_json` - Serialization
- `reqwest` - RCRT API client
- `tracing` - Logging (matches rcrt-server)
- `uuid` - ID generation

### 1.2 RCRT Integration (`src/rcrt_client.rs`)

- SSE connection to `http://rcrt:8080/events/stream`
- JWT authentication
- Breadcrumb CRUD via REST API
- Event filtering and parsing

Subscribe to:

- `user.message.v1` (tags: `user:message`, `extension:chat`)
- `context.config.v1` (any)

### 1.3 Configuration Manager (`src/config_manager.rs`)

- Load `context.config.v1` breadcrumbs on startup
- Cache in memory
- React to config updates via SSE
- Parse sources, output, formatting options

### 1.4 PostgreSQL Integration (`src/vector_store.rs`)

Direct database connection for:

- Vector similarity: `SELECT * FROM breadcrumbs ORDER BY embedding <-> $1 LIMIT $2`
- Session-scoped: `WHERE tags @> ARRAY['session:xxx'] ORDER BY created_at DESC`
- Latest: `WHERE schema_name = $1 ORDER BY created_at DESC LIMIT 1`

## Phase 2: Graph-Based Retrieval (Days 8-14)

### 2.1 Session Graph Cache (`src/graph/session_cache.rs`)

- LRU cache (100 sessions max, 10MB each)
- Nodes: breadcrumbs (id, embedding, tags, created_at, trigger_event_id)
- Edges: causal (trigger_event_id), temporal, tag-based
- Update on SSE events

### 2.2 Path Finder (`src/retrieval/path_finder.rs`)

Constrained shortest paths algorithm:

1. Seed discovery (20-30ms): pgvector + session graph
2. Path expansion (5-10ms): Dijkstra-style with early termination
3. Diversity sampling (2-5ms): cluster + representative selection

### 2.3 Context Assembler (`src/retrieval/assembler.rs`)

- Parallel multi-source retrieval
- Deduplication (similarity threshold)
- Format for LLM
- Generate `llm_hints`

## Phase 3: Event Processing & Output (Days 15-21)

### 3.1 Event Handler (`src/event_handler.rs`)

Main event loop:

1. Receive `user.message.v1` from SSE
2. Extract session ID from tags
3. Load all `context.config.v1` configs
4. For each config: assemble + publish context
5. Error recovery and retry

### 3.2 Context Publisher (`src/output/context_publisher.rs`)

- Search for existing `agent.context.v1` by session tag
- Create new or update existing (with version check)
- Maintain session tags

Output format (must match existing):

```rust
{
  schema_name: "agent.context.v1",
  tags: ["agent:context", "consumer:X", "session:Y"],
  context: {
    consumer_id, trigger_event_id, assembled_at,
    token_estimate, sources_assembled,
    tool_catalog, user_messages, agent_responses, tool_results,
    llm_hints
  }
}
```

## Phase 4: Evolutionary Optimization (Days 22-28)

### 4.1 Genome System (`src/evolution/genome.rs`)

```rust
struct ContextGenome {
  semantic_weight: f32,
  recency_decay: f32,
  tag_importance: HashMap<String, f32>,
  schema_preference: HashMap<String, f32>,
  path_depth: usize,
  diversity_threshold: f32,
}
```

Mutation and crossover operators

### 4.2 Fitness Evaluation (`src/evolution/fitness.rs`)

- Sample recent interactions (last hour, 50 samples)
- Retrieve context using genome
- Score via LLM API (batched, async)
- Bonus for successful agent completions

### 4.3 Evolution Loop (`src/evolution/optimizer.rs`)

Background task (every 30 minutes):

1. Evaluate population (20 genomes)
2. Select elite (top 5)
3. Generate offspring (crossover + mutation)
4. Deploy best genome (atomic swap)

## Phase 5: Testing & Migration (Days 29-35)

### 5.1 Integration Tests

- SSE connection
- pgvector queries
- Graph construction
- Context assembly
- Breadcrumb creation/update

### 5.2 Benchmarking

Target performance:

- Latency: <50ms p95
- Memory: <1GB
- Throughput: 1000+ req/s
- Sessions: 100+ concurrent

### 5.3 A/B Testing

1. Deploy Rust service (parallel to Node.js)
2. Route 10% traffic → measure quality/latency
3. Increase to 50%
4. Full cutover at 100%

### 5.4 Cutover

- Disable Node.js context-builder subscription
- Remove from tools-runner
- Delete `packages/tools/src/context-tools/context-builder-tool.ts`

## Phase 6: Monitoring (Ongoing)

- Prometheus metrics
- Latency histograms
- Cache hit rates
- Evolution progress
- Error rates

## Docker Integration

**Dockerfile**:

```dockerfile
FROM rust:1.75 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /app/target/release/rcrt-context-builder /usr/local/bin/
CMD ["rcrt-context-builder"]
```

**docker-compose.yml**:

```yaml
context-builder:
  build: ./rcrt-services/context-builder
  environment:
    - RCRT_API_URL=http://rcrt:8080
    - DATABASE_URL=postgresql://postgres:password@db:5432/rcrt
    - OWNER_ID=00000000-0000-0000-0000-000000000001
    - AGENT_ID=context-builder-service
    - RUST_LOG=info
  depends_on:
    - rcrt
    - db
```

## Files to Create

```
rcrt-services/context-builder/
├── Cargo.toml
├── Dockerfile
├── src/
│   ├── main.rs
│   ├── rcrt_client.rs
│   ├── config_manager.rs
│   ├── vector_store.rs
│   ├── graph/
│   │   ├── mod.rs
│   │   ├── session_cache.rs
│   │   └── types.rs
│   ├── retrieval/
│   │   ├── mod.rs
│   │   ├── path_finder.rs
│   │   └── assembler.rs
│   ├── output/
│   │   └── context_publisher.rs
│   ├── evolution/
│   │   ├── mod.rs
│   │   ├── genome.rs
│   │   ├── fitness.rs
│   │   └── optimizer.rs
│   └── event_handler.rs
└── tests/
```

## Success Criteria

**Performance**:

- P95 latency < 50ms
- Memory < 1GB for 100 sessions
- 1000+ req/s throughput

**Quality**:

- Context relevance ≥ baseline
- Session isolation preserved
- All source methods supported

**Evolution**:

- 5-10% improvement in 1 week
- Adapts to new patterns in 24 hours
- No manual tuning required

### To-dos

- [ ] Phase 0.1: Find where agent.response.v1 duplication occurs in agent-runner
- [ ] Phase 0.1: Remove duplicate agent.response.v1 emission, standardize on single format
- [ ] Phase 0.2: Add session tags to agent.response.v1 breadcrumbs
- [ ] Phase 0.3: Standardize field names (trigger_event_id, agent_id, session_id)
- [ ] Phase 0.4: Test schema standardization with real chat interactions
- [ ] Phase 1.1: Create Rust project and Cargo workspace
- [ ] Phase 1.2: Implement RCRT SSE client and API wrapper
- [ ] Phase 1.3: Build configuration manager
- [ ] Phase 1.4: Integrate PostgreSQL with pgvector
- [ ] Phase 2.1: Implement session graph cache
- [ ] Phase 2.2: Build path finder algorithm
- [ ] Phase 2.3: Create context assembler
- [ ] Phase 3.1: Implement event handler
- [ ] Phase 3.2: Build context publisher
- [ ] Phase 4.1: Define genome system
- [ ] Phase 4.2: Implement fitness evaluation
- [ ] Phase 4.3: Build evolution loop
- [ ] Phase 5.1: Write integration tests
- [ ] Phase 5.2: Performance benchmarking
- [ ] Phase 5.3: A/B testing deployment
- [ ] Phase 5.4: Complete cutover
- [ ] Phase 6: Set up monitoring and metrics