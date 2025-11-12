<!-- 412bf0b9-ca31-4b15-ab88-2a6045a9ad40 761d5aac-4b1c-415a-807b-9effbf03acff -->
# GLiNER Hybrid Search Implementation

## Overview

Implement hybrid search combining vector similarity, entity matching, and keyword matching using GLiNER (Generalist and Lightweight NER) to improve semantic search accuracy from ~70% (distance 0.7) to ~95% (hybrid score 0.95).

## Phase 1: Database Schema Migration

### 1.1 Create Migration File

Create `migrations/0006_entity_metadata.sql`:

```sql
-- Add entity extraction metadata to breadcrumbs
ALTER TABLE breadcrumbs 
  ADD COLUMN IF NOT EXISTS entities JSONB,
  ADD COLUMN IF NOT EXISTS entity_keywords TEXT[];

-- Full-text search index for keywords
CREATE INDEX IF NOT EXISTS idx_breadcrumbs_entity_keywords 
  ON breadcrumbs USING GIN (entity_keywords);

-- GIN index for entity JSONB queries
CREATE INDEX IF NOT EXISTS idx_breadcrumbs_entities 
  ON breadcrumbs USING GIN (entities);

-- Composite index for hybrid search
CREATE INDEX IF NOT EXISTS idx_breadcrumbs_hybrid 
  ON breadcrumbs (schema_name, updated_at) 
  WHERE embedding IS NOT NULL;
```

### 1.2 Apply Migration

Run migration via Docker or `psql`:

```bash
docker compose exec db psql -U postgres -d rcrt -f /path/to/0006_entity_metadata.sql
```

## Phase 2: Add GLiNER to Context-Builder

### 2.1 Update Cargo.toml

Add to `crates/rcrt-context-builder/Cargo.toml`:

```toml
[dependencies]
# Existing dependencies...
gliner = "0.9"
ort = "2.0.0-rc.9"  # ONNX Runtime
```

### 2.2 Download GLiNER Model

Add model download to Dockerfile or setup script:

```dockerfile
# In crates/rcrt-context-builder/Dockerfile, after builder stage:
FROM debian:bookworm-slim
# ... existing setup ...

# Download GLiNER model
WORKDIR /app/models
RUN apt-get update && apt-get install -y wget unzip && \
    wget https://huggingface.co/urchade/gliner_small-v2.1/resolve/main/onnx/model.onnx -O gliner_small.onnx && \
    wget https://huggingface.co/urchade/gliner_small-v2.1/resolve/main/tokenizer.json -O tokenizer.json && \
    apt-get remove -y wget unzip && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app
```

Or add to `setup.sh` to download locally and mount as volume.

### 2.3 Create Entity Extractor Module

Create `crates/rcrt-context-builder/src/entity_extractor.rs`:

```rust
use anyhow::Result;
use gliner::{GLiNER, Parameters, RuntimeParameters, TextInput, SpanMode};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub struct EntityExtractor {
    model: GLiNER<SpanMode>,
}

impl EntityExtractor {
    pub fn new(model_path: &str, tokenizer_path: &str) -> Result<Self> {
        let model = GLiNER::<SpanMode>::new(
            Parameters::default(),
            RuntimeParameters::default(),
            tokenizer_path,
            model_path,
        )?;
        
        Ok(Self { model })
    }
    
    pub fn extract(&self, text: &str) -> Result<ExtractedEntities> {
        if text.is_empty() {
            return Ok(ExtractedEntities::default());
        }
        
        // Entity types relevant to RCRT breadcrumbs
        let entity_types = vec![
            "tool", "action", "technology", "schema", 
            "concept", "feature", "method", "component"
        ];
        
        let input = TextInput::from_str(&[text], &entity_types)?;
        let results = self.model.inference(input)?;
        
        // Group by type
        let mut entities: HashMap<String, Vec<String>> = HashMap::new();
        let mut keywords = Vec::new();
        
        for entity in results {
            // Add to grouped entities
            entities
                .entry(entity.label.clone())
                .or_default()
                .push(entity.text.clone());
            
            // High-confidence entities become keywords
            if entity.score > 0.85 {
                keywords.push(entity.text.to_lowercase());
            }
        }
        
        // Deduplicate keywords
        keywords.sort();
        keywords.dedup();
        
        Ok(ExtractedEntities { entities, keywords })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExtractedEntities {
    pub entities: HashMap<String, Vec<String>>,
    pub keywords: Vec<String>,
}
```

### 2.4 Update Main and Config

Add to `crates/rcrt-context-builder/src/main.rs`:

```rust
mod entity_extractor;
use entity_extractor::EntityExtractor;

async fn main() -> Result<()> {
    // ... existing setup ...
    
    // Initialize entity extractor
    let entity_extractor = Arc::new(EntityExtractor::new(
        &env::var("GLINER_MODEL_PATH").unwrap_or_else(|_| "/app/models/gliner_small.onnx".to_string()),
        &env::var("GLINER_TOKENIZER_PATH").unwrap_or_else(|_| "/app/models/tokenizer.json".to_string()),
    )?);
    info!("✅ Entity extractor initialized");
    
    // Pass to event handler
    let event_handler = EventHandler::new(
        rcrt_client.clone(),
        vector_store.clone(),
        graph_cache,
        entity_extractor.clone(),  // NEW
    )?;
    
    // ...
}
```

## Phase 3: Update Vector Store for Hybrid Search

### 3.1 Add Entities to BreadcrumbRow

Update `crates/rcrt-context-builder/src/vector_store.rs`:

```rust
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct BreadcrumbRow {
    pub id: Uuid,
    pub schema_name: Option<String>,
    pub title: String,
    pub tags: Vec<String>,
    pub context: serde_json::Value,
    pub embedding: Option<Vector>,
    pub entities: Option<serde_json::Value>,  // NEW
    pub entity_keywords: Option<Vec<String>>, // NEW
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}
```

### 3.2 Implement Hybrid Search Method

Add to `VectorStore` impl in `crates/rcrt-context-builder/src/vector_store.rs`:

```rust
pub async fn find_similar_hybrid(
    &self,
    query_embedding: &Vector,
    query_keywords: &[String],
    limit: usize,
    session_filter: Option<&str>,
) -> Result<Vec<BreadcrumbRow>> {
    let keyword_count = query_keywords.len() as f32;
    
    let sql = if let Some(session) = session_filter {
        r#"
        WITH scored AS (
            SELECT 
                id, schema_name, title, tags, context, embedding, 
                entities, entity_keywords, created_at, updated_at,
                -- Vector similarity (0-1, higher is better)
                CASE WHEN embedding IS NOT NULL 
                    THEN 1.0 / (1.0 + (embedding <=> $1))
                    ELSE 0.0 
                END as vec_score,
                -- Entity keyword matches (0-1)
                CASE WHEN entity_keywords IS NOT NULL AND $3 > 0
                    THEN (
                        SELECT COUNT(DISTINCT kw)::float / $3
                        FROM unnest(entity_keywords) kw
                        WHERE kw = ANY($2)
                    )
                    ELSE 0.0
                END as keyword_score
            FROM breadcrumbs
            WHERE $4 = ANY(tags)
        )
        SELECT 
            id, schema_name, title, tags, context, embedding,
            entities, entity_keywords, created_at, updated_at,
            (vec_score * 0.6 + keyword_score * 0.4) as hybrid_score
        FROM scored
        WHERE vec_score > 0 OR keyword_score > 0
        ORDER BY hybrid_score DESC
        LIMIT $5
        "#
    } else {
        r#"
        WITH scored AS (
            SELECT 
                id, schema_name, title, tags, context, embedding,
                entities, entity_keywords, created_at, updated_at,
                -- Vector similarity (0-1, higher is better)
                CASE WHEN embedding IS NOT NULL 
                    THEN 1.0 / (1.0 + (embedding <=> $1))
                    ELSE 0.0 
                END as vec_score,
                -- Entity keyword matches (0-1)
                CASE WHEN entity_keywords IS NOT NULL AND $3 > 0
                    THEN (
                        SELECT COUNT(DISTINCT kw)::float / $3
                        FROM unnest(entity_keywords) kw
                        WHERE kw = ANY($2)
                    )
                    ELSE 0.0
                END as keyword_score
            FROM breadcrumbs
        )
        SELECT 
            id, schema_name, title, tags, context, embedding,
            entities, entity_keywords, created_at, updated_at,
            (vec_score * 0.6 + keyword_score * 0.4) as hybrid_score
        FROM scored
        WHERE vec_score > 0 OR keyword_score > 0
        ORDER BY hybrid_score DESC
        LIMIT $4
        "#
    };
    
    let query = if let Some(session) = session_filter {
        sqlx::query_as::<_, BreadcrumbRow>(sql)
            .bind(query_embedding)
            .bind(query_keywords)
            .bind(keyword_count)
            .bind(session)
            .bind(limit as i64)
    } else {
        sqlx::query_as::<_, BreadcrumbRow>(sql)
            .bind(query_embedding)
            .bind(query_keywords)
            .bind(keyword_count)
            .bind(limit as i64)
    };
    
    let results = query.fetch_all(&self.pool).await?;
    Ok(results)
}
```

### 3.3 Add Backfill Method

Add entity backfill method to `VectorStore`:

```rust
pub async fn update_entities(
    &self,
    breadcrumb_id: Uuid,
    entities: &ExtractedEntities,
) -> Result<()> {
    sqlx::query(
        r#"
        UPDATE breadcrumbs 
        SET entities = $2, entity_keywords = $3
        WHERE id = $1
        "#
    )
    .bind(breadcrumb_id)
    .bind(serde_json::to_value(entities)?)
    .bind(&entities.keywords)
    .execute(&self.pool)
    .await?;
    
    Ok(())
}
```

## Phase 4: Update Retrieval Layer

### 4.1 Add HybridGlobal Source Method

Update `crates/rcrt-context-builder/src/retrieval/assembler.rs`:

```rust
#[derive(Debug, Clone)]
pub enum SourceMethod {
    Vector { query_embedding: Vector },
    VectorGlobal { query_embedding: Vector },
    HybridGlobal { 
        query_embedding: Vector, 
        query_keywords: Vec<String>,
    },  // NEW
    Recent { schema_name: Option<String> },
    Latest { schema_name: String },
    Tagged { tag: String },
    Causal { seed_ids: Vec<Uuid> },
}
```

### 4.2 Implement HybridGlobal Execution

Add to `execute_source` in `assembler.rs`:

```rust
SourceMethod::HybridGlobal { query_embedding, query_keywords } => {
    let rows = self.vector_store.find_similar_hybrid(
        query_embedding,
        query_keywords,
        source.limit,
        None,  // Global: no session filter
    ).await?;
    
    Ok(rows.into_iter().map(breadcrumb_row_to_node).collect())
}
```

## Phase 5: Update Event Handler

### 5.1 Add Entity Extractor to EventHandler

Update `crates/rcrt-context-builder/src/event_handler.rs`:

```rust
pub struct EventHandler {
    rcrt_client: Arc<RcrtClient>,
    vector_store: Arc<VectorStore>,
    graph_cache: Arc<SessionGraphCache>,
    assembler: ContextAssembler,
    publisher: ContextPublisher,
    entity_extractor: Arc<EntityExtractor>,  // NEW
}

impl EventHandler {
    pub fn new(
        rcrt_client: Arc<RcrtClient>,
        vector_store: Arc<VectorStore>,
        graph_cache: Arc<SessionGraphCache>,
        entity_extractor: Arc<EntityExtractor>,  // NEW
    ) -> Result<Self> {
        // ...
        Ok(Self {
            rcrt_client,
            vector_store: vector_store.clone(),
            graph_cache,
            assembler,
            publisher,
            entity_extractor,  // NEW
        })
    }
}
```

### 5.2 Extract Query Entities and Use Hybrid Search

Update `assemble_and_publish` in `event_handler.rs`:

```rust
async fn assemble_and_publish(
    &self,
    session_tag: &str,
    trigger_id: Option<uuid::Uuid>,
) -> Result<()> {
    // ... existing sources setup ...
    
    // HYBRID SEARCH: Extract entities from query and search
    if let Some(trigger) = trigger_id {
        if let Ok(Some(trigger_bc)) = self.vector_store.get_by_id(trigger).await {
            // Extract query text
            let query_text = trigger_bc.context
                .get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            
            // Extract entities from query
            let query_entities = self.entity_extractor.extract(query_text).await?;
            
            if let Some(embedding) = trigger_bc.embedding {
                info!("🔍 Hybrid search with keywords: {:?}", query_entities.keywords);
                
                sources.push(SourceConfig {
                    method: SourceMethod::HybridGlobal {
                        query_embedding: embedding,
                        query_keywords: query_entities.keywords,
                    },
                    limit: 10,  // Can use lower limit with better accuracy!
                });
            }
        }
    }
    
    // ... rest of method ...
}
```

### 5.3 Asynchronous Entity Backfill

Add backfill task after context assembly:

```rust
async fn assemble_and_publish(...) -> Result<()> {
    // ... existing assembly ...
    
    let context = self.assembler.assemble(...).await?;
    
    // BACKFILL: Extract entities for breadcrumbs without them (async, don't block)
    let extractor = self.entity_extractor.clone();
    let store = self.vector_store.clone();
    let breadcrumbs_to_backfill = context.breadcrumbs.clone();
    
    tokio::spawn(async move {
        for bc in breadcrumbs_to_backfill {
            // Skip if already has entities
            if bc.entities.is_some() {
                continue;
            }
            
            // Extract text from breadcrumb
            let text = format!(
                "{} {} {}",
                bc.title,
                bc.context.get("content").and_then(|v| v.as_str()).unwrap_or(""),
                bc.context.get("description").and_then(|v| v.as_str()).unwrap_or("")
            );
            
            // Extract entities
            if let Ok(entities) = extractor.extract(&text).await {
                if !entities.keywords.is_empty() {
                    let _ = store.update_entities(bc.id, &entities).await;
                    info!("✨ Backfilled entities for breadcrumb {}: {:?}", bc.id, entities.keywords);
                }
            }
        }
    });
    
    // Publish context
    self.publisher.publish_context(...).await?;
    
    Ok(())
}
```

## Phase 6: Update Docker Configuration

### 6.1 Add Environment Variables

Update `docker-compose.yml`:

```yaml
context-builder:
  build: ./crates/rcrt-context-builder
  enviroment:
    - RCRT_API_URL=http://rcrt:8080
    - DATABASE_URL=postgresql://postgres:password@db:5432/rcrt
    - OWNER_ID=00000000-0000-0000-0000-000000000001
    - AGENT_ID=00000000-0000-0000-0000-0000000000cb
    - RUST_LOG=info
    - GLINER_MODEL_PATH=/app/models/gliner_small.onnx  # NEW
    - GLINER_TOKENIZER_PATH=/app/models/tokenizer.json # NEW
  volumes:
    - ./models:/app/models  # Mount models directory
  depends_on:
    - rcrt
    - db
```

### 6.2 Update Dockerfile

Update `crates/rcrt-context-builder/Dockerfile`:

```dockerfile
# Multi-stage build
FROM rust:1.75 as builder

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates/rcrt-context-builder ./crates/rcrt-context-builder

# Build with release optimizations
RUN cargo build --release --manifest-path crates/rcrt-context-builder/Cargo.toml

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies + wget for model download
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/rcrt-context-builder /app/rcrt-context-builder

# Download GLiNER model at build time
RUN mkdir -p /app/models && \
    cd /app/models && \
    wget -q https://huggingface.co/urchade/gliner_small-v2.1/resolve/main/onnx/model.onnx -O gliner_small.onnx && \
    wget -q https://huggingface.co/urchade/gliner_small-v2.1/resolve/main/tokenizer.json -O tokenizer.json

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

CMD ["./rcrt-context-builder"]
```

## Phase 7: Testing and Validation

### 7.1 Manual Testing

Test query: "How do I create a tool?"

Expected logs:

```
🔍 Hybrid search with keywords: ["tool", "create", "creation", "deno"]
✅ Context assembled: 10+ breadcrumbs, ~5000+ tokens
✨ Backfilled entities for breadcrumb ec84457a-...: ["tool", "breadcrumb", "schema", "deno"]
```

Expected result ranking:

1. Knowledge breadcrumb (hybrid score ~0.95)
2. Tool catalog
3. Recent user messages

### 7.2 Validation Queries

```sql
-- Check entity extraction coverage
SELECT 
    schema_name,
    COUNT(*) as total,
    SUM(CASE WHEN entities IS NOT NULL THEN 1 ELSE 0 END) as with_entities,
    SUM(CASE WHEN entity_keywords IS NOT NULL THEN 1 ELSE 0 END) as with_keywords
FROM breadcrumbs
GROUP BY schema_name;

-- Check entity keyword distribution
SELECT 
    keyword,
    COUNT(*) as frequency
FROM breadcrumbs, unnest(entity_keywords) as keyword
GROUP BY keyword
ORDER BY frequency DESC
LIMIT 20;

-- Test hybrid search directly
SELECT 
    id, schema_name, title,
    CASE WHEN embedding IS NOT NULL 
        THEN 1.0 / (1.0 + (embedding <=> (SELECT embedding FROM breadcrumbs WHERE id = 'query_id')))
        ELSE 0.0 
    END as vec_score,
    CASE WHEN entity_keywords IS NOT NULL
        THEN (SELECT COUNT(*) FROM unnest(entity_keywords) kw WHERE kw = ANY(ARRAY['tool', 'create']))::float / 2
        ELSE 0.0
    END as keyword_score
FROM breadcrumbs
WHERE embedding IS NOT NULL OR entity_keywords IS NOT NULL
ORDER BY (vec_score * 0.6 + keyword_score * 0.4) DESC
LIMIT 10;
```

## Phase 8: Documentation

### 8.1 Update SEMANTIC_SEARCH_IMPLEMENTATION.md

Add section on hybrid search:

```markdown
## Hybrid Search (GLiNER-Enhanced)

Combines three signals for optimal relevance:
- Vector similarity (60%): Semantic meaning
- Entity keywords (40%): Exact entity matches

### Entity Types Extracted
- tool, action, technology, schema, concept, feature, method, component

### Performance
- Entity extraction: ~5-15ms per breadcrumb (GLiNER small model)
- Hybrid search: ~10-20ms (slightly slower than pure vector)
- Accuracy improvement: 70% → 95% for knowledge retrieval
```

### 8.2 Create HYBRID_SEARCH_ARCHITECTURE.md

Document the full architecture, entity schema, scoring formula, and backfill strategy.

## Success Metrics

- Knowledge breadcrumb ranks #1 for "how to create a tool?" query (currently #14)
- Hybrid score > 0.9 for exact entity matches
- Entity extraction coverage > 80% within 24 hours of deployment
- Search latency remains < 50ms p95
- Context assembly includes relevant knowledge in top 10 results

### To-dos

- [x] Phase 0.1: Find where agent.response.v1 duplication occurs in agent-runner
- [x] Phase 0.1: Remove duplicate agent.response.v1 emission, standardize on single format
- [x] Phase 0.2: Add session tags to agent.response.v1 breadcrumbs
- [x] Phase 0.3: Standardize field names (trigger_event_id, agent_id, session_id)
- [x] Phase 0.4: Test schema standardization with real chat interactions
- [x] Phase 1.1: Create Rust project and Cargo workspace
- [x] Phase 1.2: Implement RCRT SSE client and API wrapper
- [x] Phase 1.3: Build configuration manager
- [x] Phase 1.4: Integrate PostgreSQL with pgvector
- [x] Phase 2.1: Implement session graph cache
- [x] Phase 2.2: Build path finder algorithm
- [x] Phase 2.3: Create context assembler
- [x] Phase 3.1: Implement event handler
- [x] Phase 3.2: Build context publisher
- [ ] Phase 4.1: Define genome system
- [ ] Phase 4.2: Implement fitness evaluation
- [ ] Phase 4.3: Build evolution loop
- [ ] Phase 5.1: Write integration tests
- [ ] Phase 5.2: Performance benchmarking
- [ ] Phase 5.3: A/B testing deployment
- [ ] Phase 5.4: Complete cutover
- [ ] Phase 6: Set up monitoring and metrics