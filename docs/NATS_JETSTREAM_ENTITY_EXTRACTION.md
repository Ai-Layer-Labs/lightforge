# ~~NATS JetStream~~ → SSE Entity Extraction

**Status**: ⚠️ **DEPRECATED - Migrated to SSE**  
**Date**: November 2, 2025  
**Migration Date**: November 3, 2025

> **IMPORTANT**: This document describes the original NATS JetStream implementation, which has been **replaced with SSE** to fix event consumption conflicts. The entity extraction worker now subscribes to the same SSE stream as other services (fan-out pattern) instead of using JetStream work queues. This ensures all services receive all events without interference.
>
> See `docs/CONTEXT_BUILDER_RUST.md` for the current SSE-based implementation.

---

## Overview (Historical - NATS JetStream)

Entity extraction for hybrid search has been migrated from an inline SSE-based approach to a **production-ready NATS JetStream work queue**. This provides:

- ✅ **Durability**: Events survive service restarts
- ✅ **Scalability**: Multiple workers can share load
- ✅ **Reliability**: Automatic retries with exponential backoff
- ✅ **Idempotency**: Skips already-processed breadcrumbs
- ✅ **Decoupling**: Entity extraction is independent of context assembly
- ✅ **Observable**: NATS metrics show queue depth and processing rate

## Architecture

```
┌─────────────────────────────────────────┐
│    NATS JetStream (nats:4222)          │
│    - Single instance, JetStream enabled │
│    - Stream: BREADCRUMB_EVENTS          │
│    - Subject: bc.*.created              │
│    - Retention: WorkQueue (24h)         │
└────────┬────────────────────────────────┘
         │
    ┌────┴────┬───────────────┐
    │         │               │
    ▼         ▼               ▼
  RCRT    context-      future workers
  server   builder       (scalable)
  
  RCRT publishes:        context-builder consumes:
  bc.*.created ────────→ BREADCRUMB_EVENTS stream
  bc.*.updated           (entity extraction queue)
```

## Components

### 1. RCRT Server (`crates/rcrt-server/src/main.rs`)

**JetStream Stream Setup**:
```rust
fn setup_jetstream_streams(conn: &nats::Connection) -> Result<()> {
    let js = nats::jetstream::new(conn.clone());
    
    let stream_config = nats::jetstream::StreamConfig {
        name: "BREADCRUMB_EVENTS".to_string(),
        subjects: vec!["bc.*.created".to_string()],
        retention: nats::jetstream::RetentionPolicy::WorkQueue,
        max_age: Duration::from_secs(86400), // 24 hours
        storage: nats::jetstream::StorageType::File,
        ..Default::default()
    };
    
    js.add_stream(&stream_config)?;
    Ok(())
}
```

**Publishes to**: `bc.{breadcrumb_id}.created` whenever a breadcrumb is created

### 2. Context Builder (`crates/rcrt-context-builder/`)

**New Module**: `entity_worker.rs`

**Entity Extraction Worker**:
```rust
pub struct EntityWorker {
    vector_store: Arc<VectorStore>,
    entity_extractor: Arc<EntityExtractor>,
    consumer_name: String,
}

impl EntityWorker {
    pub async fn start(&self, nats_url: &str) -> Result<()> {
        // Connect to NATS
        let nats_conn = nats::connect(nats_url)?;
        let js = nats::jetstream::new(nats_conn.clone());
        
        // Create durable consumer
        let consumer_config = nats::jetstream::ConsumerConfig {
            durable_name: Some(self.consumer_name.clone()),
            deliver_policy: nats::jetstream::DeliverPolicy::All,
            ack_policy: nats::jetstream::AckPolicy::Explicit,
            ack_wait: Duration::from_secs(30),
            max_deliver: 3,  // Retry up to 3 times
            ..Default::default()
        };
        
        js.add_consumer("BREADCRUMB_EVENTS", &consumer_config)?;
        
        // Subscribe as queue group for load balancing
        let sub = nats_conn.queue_subscribe("bc.*.created", &self.consumer_name)?;
        
        // Process messages
        for msg in sub.messages() {
            match self.process_message(&msg).await {
                Ok(true) => msg.ack()?,  // Success
                Ok(false) => msg.ack()?, // Skipped (already has entities)
                Err(_) => {}, // Don't ack - will retry
            }
        }
        Ok(())
    }
}
```

**Startup Backfill**:
```rust
pub async fn startup_backfill(
    vector_store: Arc<VectorStore>,
    entity_extractor: Arc<EntityExtractor>,
    db_pool: &sqlx::PgPool,
) -> Result<()> {
    // Query breadcrumbs without entity_keywords
    let rows: Vec<BackfillRow> = sqlx::query_as(
        "SELECT id, title, context, schema_name
         FROM breadcrumbs 
         WHERE entity_keywords IS NULL 
         AND embedding IS NOT NULL
         ORDER BY created_at DESC
         LIMIT 10000"
    ).fetch_all(db_pool).await?;
    
    // Process each row
    for row in rows {
        let entities = entity_extractor.extract(&text)?;
        if !entities.keywords.is_empty() {
            vector_store.update_entities(row.id, &entities_json, &entities.keywords).await?;
        }
    }
    
    Ok(())
}
```

### 3. Docker Configuration (`docker-compose.yml`)

**Context Builder Service**:
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
    nats:
      condition: service_started
  environment:
    RCRT_API_URL: http://rcrt:8080
    DATABASE_URL: postgresql://postgres:postgres@db:5432/rcrt
    NATS_URL: nats://nats:4222  # ← NEW: Connect to NATS
    OWNER_ID: 00000000-0000-0000-0000-000000000001
    AGENT_ID: 00000000-0000-0000-0000-0000000000cb
    CACHE_SIZE_MB: "1024"
    MAX_DB_CONNECTIONS: "10"
  restart: unless-stopped
```

## Deployment Log

**Date**: November 2, 2025 22:53:34 UTC

### RCRT Server Startup
```
INFO rcrt_server: 🔧 Setting up JetStream streams...
INFO rcrt_server: ✅ JetStream stream 'BREADCRUMB_EVENTS' created/updated
INFO rcrt_server: ✅ JetStream streams configured
INFO rcrt_server: listening on 0.0.0.0:8080
```

### Context Builder Startup
```
INFO 🚀 RCRT Context Builder starting...
INFO ✅ Configuration loaded
INFO ✅ Database connected
INFO ✅ pgvector extension verified
INFO ✅ Entity extractor initialized
INFO 🔄 Running startup backfill...
INFO 📊 Found 38 breadcrumbs to backfill
INFO ✅ Startup backfill complete: 16/38 breadcrumbs processed, 22 skipped
INFO 🔧 Starting entity extraction worker...
INFO ✅ Connected to NATS
INFO ✅ Found JetStream stream 'BREADCRUMB_EVENTS' with 0 messages
INFO ✅ Consumer 'entity-extractor' ready
INFO 📡 Entity worker started, listening for breadcrumb creation events...
INFO ✅ Subscribed to bc.*.created with queue group 'entity-extractor'
INFO 💚 Context Builder is running
    - Entity extraction: NATS JetStream consumer
    - Context assembly: SSE stream
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NATS_URL` | `nats://nats:4222` | NATS server connection URL |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `RCRT_API_URL` | - | RCRT API base URL |
| `OWNER_ID` | - | Default owner UUID |
| `AGENT_ID` | - | Context builder agent UUID |

### JetStream Configuration

| Setting | Value | Purpose |
|---------|-------|---------|
| Stream Name | `BREADCRUMB_EVENTS` | Logical name for the event stream |
| Subject | `bc.*.created` | Wildcard pattern matching all creation events |
| Retention Policy | `WorkQueue` | Messages deleted after acknowledgment |
| Max Age | `86400s` (24h) | Maximum message retention time |
| Storage Type | `File` | Persist to disk (survives restarts) |
| Consumer Name | `entity-extractor` | Durable consumer name |
| Ack Policy | `Explicit` | Manual acknowledgment required |
| Ack Wait | `30s` | Time before message is redelivered |
| Max Deliver | `3` | Maximum retry attempts |

## Features

### 1. Durability

- **JetStream** persists messages to disk
- Messages survive NATS server restarts
- Durable consumers maintain position in stream

### 2. Scalability

- **Queue Groups**: Multiple workers share load automatically
- **Horizontal Scaling**: Add more context-builder instances
- **Load Balancing**: NATS distributes messages evenly

### 3. Reliability

- **Automatic Retries**: Up to 3 attempts per message
- **Ack Wait**: 30-second timeout before redelivery
- **Error Handling**: Failed extractions don't lose messages

### 4. Idempotency

- Checks if breadcrumb already has entities
- Skips processing if `entity_keywords` already exists
- Safe to retry without duplicates

### 5. Observable

```bash
# Check JetStream stream status
nats stream info BREADCRUMB_EVENTS

# Check consumer status
nats consumer info BREADCRUMB_EVENTS entity-extractor

# Monitor queue depth
nats stream view BREADCRUMB_EVENTS

# View consumer pending messages
docker compose logs context-builder | grep "📨 Processing breadcrumb"
```

## Monitoring

### Key Metrics

1. **Stream Messages**: Current queue depth
2. **Consumer Pending**: Unprocessed messages
3. **Processing Rate**: Messages/second
4. **Retry Count**: Failed extractions
5. **Backfill Stats**: Processed vs. skipped

### Log Patterns

```bash
# Entity extraction success
"✨ Extracted entities for {id}: {keywords}"

# Breadcrumb already processed (idempotent)
"⏭️  Breadcrumb {id} already has entities, skipping"

# Breadcrumb not found
"⚠️  Breadcrumb {id} not found in database, skipping"

# Extraction failure (will retry)
"❌ Entity extraction failed: {error}. Will retry after ack_wait."
```

## Testing

### Manual Test

1. **Create a new knowledge breadcrumb**:
   ```bash
   docker compose exec db psql -U postgres -d rcrt -c \
     "INSERT INTO breadcrumbs (schema_name, title, context, embedding) 
      VALUES ('knowledge.v1', 'Test', '{}', '[0.1, 0.2, ...]');"
   ```

2. **Watch for entity extraction**:
   ```bash
   docker compose logs context-builder -f | grep "Processing breadcrumb"
   ```

3. **Verify entities were extracted**:
   ```bash
   docker compose exec db psql -U postgres -d rcrt -c \
     "SELECT id, title, entity_keywords FROM breadcrumbs WHERE title='Test';"
   ```

### Expected Behavior

1. RCRT publishes `bc.{id}.created` to NATS
2. Context-builder receives message from JetStream
3. Worker fetches breadcrumb from database
4. Entity extractor processes text
5. Entities saved to `entity_keywords` column
6. Message acknowledged (removed from queue)

## Migration Notes

### Removed Code

- ❌ **Inline SSE-based entity extraction** from `event_handler.rs`
- ❌ **Async tokio::spawn backfill** in `assemble_and_publish`

### Added Code

- ✅ **`entity_worker.rs`**: Dedicated NATS JetStream consumer
- ✅ **`startup_backfill`**: On-boot entity extraction for existing breadcrumbs
- ✅ **JetStream stream setup** in RCRT server
- ✅ **NATS_URL** environment variable configuration

### Breaking Changes

**None**. This is a drop-in replacement that maintains the same functionality with improved reliability.

## Future Enhancements

1. **Multiple Workers**: Scale horizontally by running multiple context-builder instances
2. **Priority Queue**: Separate streams for high-priority entity extraction
3. **Dead Letter Queue**: Move failed messages after max retries
4. **Metrics Export**: Publish queue metrics to Prometheus
5. **Adaptive Backfill**: Throttle backfill rate based on system load
6. **Schema-Specific Extractors**: Different entity extraction strategies per breadcrumb type

## Troubleshooting

### Issue: Messages not being processed

**Check**:
1. Is NATS running? `docker compose ps nats`
2. Is JetStream enabled? `docker compose logs nats | grep JetStream`
3. Does stream exist? `nats stream ls`
4. Is consumer active? `nats consumer ls BREADCRUMB_EVENTS`

**Fix**:
```bash
# Restart NATS
docker compose restart nats

# Restart context-builder
docker compose restart context-builder

# Check logs
docker compose logs context-builder --tail=50
```

### Issue: Duplicate entity extraction

**Symptom**: Same breadcrumb processed multiple times

**Cause**: Multiple context-builder instances without queue groups

**Fix**: Ensure all workers use the same `consumer_name` ("entity-extractor")

### Issue: Messages piling up

**Symptom**: Stream has growing message count

**Cause**: Worker can't keep up with creation rate

**Fix**:
1. Scale horizontally: Add more context-builder instances
2. Increase `max_deliver` for more retries
3. Check for extraction errors in logs

## References

- [NATS JetStream Documentation](https://docs.nats.io/jetstream)
- [NATS.rs Client Library](https://github.com/nats-io/nats.rs)
- [Hybrid Search Implementation](./HYBRID_SEARCH_IMPLEMENTATION.md)
- [Context Builder Architecture](./CONTEXT_BUILDER_RUST.md)

## Conclusion

The migration to NATS JetStream provides a **production-ready, scalable, and reliable** entity extraction system that:

- ✅ Survives service restarts (durable)
- ✅ Handles high throughput (scalable)
- ✅ Automatically retries failures (reliable)
- ✅ Prevents duplicate processing (idempotent)
- ✅ Works across deployments (dynamic configuration)

This is a **stable, long-term solution** that follows RCRT principles and industry best practices for distributed systems.

