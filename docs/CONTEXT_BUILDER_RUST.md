# RCRT Context Builder (Rust Service)

## Overview

The Context Builder is a high-performance Rust service for assembling agent context using graph-based breadcrumb flow networks. It replaces the Node.js context-builder tool with a scalable, production-ready microservice.

## Architecture

### Core Components

1. **RCRT Client** (`rcrt_client.rs`)
   - JWT authentication with auto-refresh
   - SSE event stream subscription
   - Breadcrumb CRUD operations
   - Non-blocking async HTTP client

2. **Vector Store** (`vector_store.rs`)
   - Direct PostgreSQL/pgvector queries
   - Cosine similarity search
   - Session-scoped filtering
   - Recent/latest/tagged breadcrumb retrieval

3. **Session Graph Cache** (`graph/`)
   - LRU cache for session-local graphs
   - ~10MB per session, 100 sessions capacity
   - Causal chain traversal
   - Edge-weighted graph representation

4. **Context Retrieval** (`retrieval/`)
   - Multiple source methods:
     - Vector similarity
     - Recent breadcrumbs
     - Latest by schema
     - Tag-based queries
     - Causal chain following
   - Path-finding algorithm (Dijkstra-style)
   - Deduplication and sorting

5. **Event Handler** (`event_handler.rs`)
   - SSE event routing
   - `user.message.v1` trigger detection
   - Session extraction from tags
   - Context assembly orchestration

6. **Output Publisher** (`output/publisher.rs`)
   - Creates/updates `agent.context.v1` breadcrumbs
   - Optimistic concurrency control (version checking)
   - Session tagging

## Configuration

### Environment Variables

```bash
RCRT_API_URL=http://rcrt:8080           # RCRT API endpoint
DATABASE_URL=postgresql://...            # PostgreSQL connection string
OWNER_ID=00000000-0000-0000-0000-000000000001  # Owner UUID
AGENT_ID=00000000-0000-0000-0000-0000000000cb  # Agent UUID
CACHE_SIZE_MB=1024                       # Session graph cache size
MAX_SESSIONS=100                         # Maximum cached sessions
MAX_DB_CONNECTIONS=10                    # PostgreSQL pool size
RUST_LOG=rcrt_context_builder=info      # Logging level
```

## Deployment

### Docker Compose

The service is integrated into the RCRT stack:

```yaml
context-builder:
  build:
    context: .
    dockerfile: crates/rcrt-context-builder/Dockerfile
  depends_on:
    db:
      condition: service_healthy
    rcrt:
      condition: service_started
  environment:
    # ... see Configuration above
  restart: unless-stopped
```

### Build & Run

```bash
# Build the service
docker compose build context-builder

# Start the service
docker compose up -d context-builder

# View logs
docker compose logs -f context-builder
```

## MVP Features

### Current Capabilities

- ✅ SSE event stream listening
- ✅ JWT authentication
- ✅ PostgreSQL/pgvector integration
- ✅ Session graph caching (LRU)
- ✅ Context assembly with multiple sources:
  - Recent user messages (last 10)
  - Recent agent responses (last 10)
  - Latest tool catalog
- ✅ `agent.context.v1` breadcrumb creation/update
- ✅ Session-aware context isolation

### Startup Sequence

```
🚀 RCRT Context Builder starting...
✅ Configuration loaded
   RCRT API: http://rcrt:8080
   Database: postgresql://...
   Cache size: 1024MB
✅ Database connected
✅ pgvector extension verified
✅ Vector store initialized
📊 Session graph cache capacity: 102 sessions (~1024MB)
✅ Session graph cache initialized
🔐 JWT token refreshed successfully
✅ RCRT client connected
✅ Event handler initialized
📡 Starting SSE event stream...
✅ Event handler started, listening for events...
✅ SSE stream connected
💚 Context Builder is running
```

## Performance Characteristics

### Targets
- **Throughput**: ~1000+ req/s
- **Latency**: <10ms context assembly (cached)
- **Memory**: ~1GB for session graphs + Rust overhead
- **CPU**: Single-threaded event loop + multi-threaded Tokio runtime

### Optimizations
- Direct pgvector queries (bypasses RCRT API for vectors)
- LRU session graph cache (avoids repeated DB queries)
- Async/await for non-blocking I/O
- Connection pooling for PostgreSQL

## Future Enhancements

### Phase 4: Evolutionary Optimization
- Genome system for retrieval strategy tuning
- LLM-based fitness evaluation
- Continuous improvement loop
- A/B testing framework

### Phase 5: Advanced Features
- Dynamic `context.config.v1` loading
- Full graph construction from breadcrumbs
- Edge creation (causal, temporal, semantic)
- Graph-based path retrieval
- Attention-based context weighting

### Phase 6: Monitoring
- Prometheus metrics export
- Context quality tracking
- Performance profiling
- Alert integration

## API Compatibility

The Rust context-builder is a **plug-in replacement** for the existing Node.js tool:

### Input
- Listens for: `user.message.v1` breadcrumbs
- Extracts: Session tags (`session:XXX`)

### Output
- Creates/updates: `agent.context.v1` breadcrumbs
- Tags: `agent:context`, `consumer:XXX`, `session:XXX`
- Context payload:
  ```json
  {
    "consumer_id": "default-chat-assistant",
    "trigger_event_id": "uuid",
    "assembled_at": "2025-10-31T09:00:00Z",
    "token_estimate": 5432,
    "sources_assembled": 3,
    "breadcrumbs": [...]
  }
  ```

## Testing

### Integration Test
```bash
# Send a test user message
curl -X POST http://localhost:8081/api/breadcrumbs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "schema_name": "user.message.v1",
    "title": "Test message",
    "tags": ["session:test-123", "extension:chat"],
    "context": {"message": "Hello, world!"}
  }'

# Check context-builder logs
docker compose logs context-builder --tail=20

# Verify agent.context.v1 was created
curl http://localhost:8081/api/breadcrumbs?schema=agent.context.v1 \
  -H "Authorization: Bearer $TOKEN"
```

## Maintenance

### Restart Service
```bash
docker compose restart context-builder
```

### View Real-time Logs
```bash
docker compose logs -f context-builder
```

### Update Configuration
1. Edit `docker-compose.yml`
2. Run `docker compose up -d context-builder`

## Troubleshooting

### JWT Auth Failures
- Ensure `AGENT_ID` is a valid UUID
- Verify `OWNER_ID` matches RCRT configuration
- Check RCRT logs for token endpoint errors

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running and healthy
- Check pgvector extension is installed

### SSE Stream Disconnects
- Service auto-reconnects with exponential backoff
- Check network connectivity to RCRT
- Verify RCRT is publishing events

## Development

### Local Build
```bash
cd /d/ThinkOS-1
cargo check -p rcrt-context-builder
cargo build -p rcrt-context-builder --release
```

### Run Locally
```bash
export RCRT_API_URL=http://localhost:8081
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rcrt
export OWNER_ID=00000000-0000-0000-0000-000000000001
export AGENT_ID=00000000-0000-0000-0000-0000000000cb
export RUST_LOG=rcrt_context_builder=debug

./target/release/rcrt-context-builder
```

## Status

**Production Ready**: ✅ MVP Complete

The Rust context-builder service is deployed, tested, and operational. It successfully:
- Authenticates with RCRT via JWT
- Subscribes to SSE event stream
- Assembles context from multiple sources
- Publishes `agent.context.v1` breadcrumbs
- Maintains session isolation

**Next Steps**: Phase 4 (Evolutionary Optimization) when ready for advanced features.

