# RCRT Vector Search: Complete Implementation

## 🔍 **The Full Flow**

```
User Query: "What was that API key?"
    ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. HTTP Request                                             │
│    GET /breadcrumbs/search?q=What+was+that+API+key&nn=5    │
└────────────┬────────────────────────────────────────────────┘
             │ Query params
             ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Endpoint Handler (main.rs:176-248)                      │
│    async fn vector_search(Query(q): Query<SearchQuery>)    │
│                                                             │
│    Parameters:                                              │
│    • q: Option<String>           "What was that API key?"  │
│    • qvec: Option<String>        None (will embed q)       │
│    • nn: Option<i64>             5 (neighbors)             │
│    • tag: Option<String>         None                      │
│    • include_context: bool       false (default)           │
└────────────┬────────────────────────────────────────────────┘
             │ Process query
             ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Text Embedding (main.rs:266-328)                        │
│    fn embed_text(text: String) -> Result<Vec<f32>>         │
│                                                             │
│    Step 1: Load ONNX model (lazy, cached)                  │
│      TOKENIZER: models/tokenizer.json (MiniLM)            │
│      SESSION: models/model.onnx (384d output)             │
│                                                             │
│    Step 2: Tokenize input                                  │
│      "What was that API key?"                              │
│      → [101, 2054, 2001, 2008, 3927, 3145, 102]          │
│        (BERT WordPiece tokens)                             │
│                                                             │
│    Step 3: Run ONNX inference                              │
│      Inputs:                                                │
│        input_ids: [101, 2054, 2001, ...]                  │
│        attention_mask: [1, 1, 1, ...]                     │
│        token_type_ids: [0, 0, 0, ...]                     │
│                                                             │
│      Output: Tensor<f32> [1, 384]                          │
│        [0.012, -0.043, 0.091, ..., 0.023]                 │
│                                                             │
│    Step 4: Mean pooling (if output > 384)                  │
│      Average token embeddings → sentence embedding         │
│                                                             │
│    Step 5: L2 Normalization                                │
│      norm = sqrt(sum(x²)) = 1.0                            │
│      vec = vec / norm                                       │
│      → Unit vector for cosine similarity                   │
│                                                             │
│    Result: Vec<f32> (384 dimensions, L2-normalized)        │
│      [0.031, -0.112, 0.237, ..., 0.059]                   │
└────────────┬────────────────────────────────────────────────┘
             │ Query vector ready
             ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Build SQL Query (main.rs:194-197 or 224-227)           │
│                                                             │
│    let sql = "                                              │
│      SELECT id, title, context, tags, schema_name,         │
│             version, updated_at                             │
│      FROM breadcrumbs                                       │
│      WHERE owner_id = $1                                    │
│      ORDER BY embedding <#> $2                             │
│      LIMIT $3                                               │
│    ";                                                       │
│                                                             │
│    Operator: <#>                                            │
│      = Cosine distance (pgvector operator)                 │
│      = 1 - cosine_similarity(a, b)                         │
│      = Lower is better (0 = identical)                     │
│                                                             │
│    Bind parameters:                                         │
│      $1: owner_id (tenant isolation via RLS)               │
│      $2: qvec (query embedding vector)                     │
│      $3: limit (nn parameter)                              │
└────────────┬────────────────────────────────────────────────┘
             │ Execute SQL
             ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. PostgreSQL + pgvector Extension                         │
│                                                             │
│    Index: ivfflat (migration 0001_init.sql:56)             │
│      CREATE INDEX idx_breadcrumbs_embedding                │
│      ON breadcrumbs                                         │
│      USING ivfflat (embedding vector_cosine_ops);          │
│                                                             │
│    Query execution:                                         │
│      1. Filter: owner_id = $1 (RLS isolation)             │
│      2. Index scan: ivfflat approximate nearest neighbor   │
│      3. Distance calc: cosine_distance(embedding, $2)      │
│      4. Sort by distance (ascending = closest first)       │
│      5. Limit to nn results                                │
│                                                             │
│    Example results (with distances):                       │
│      Row 1: "I mentioned OPENROUTER_API_KEY..." (0.08)     │
│      Row 2: "Set your API key in secrets" (0.11)           │
│      Row 3: "The key format is sk-or-..." (0.13)           │
│      Row 4: "You can find your key at..." (0.15)           │
│      Row 5: "Store keys in .env" (0.17)                    │
│                                                             │
│    Note: Distances NOT returned to client (just ordering)  │
└────────────┬────────────────────────────────────────────────┘
             │ Results ready
             ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Return to Client (main.rs:216-221)                      │
│    Json<SearchResult::Context>                              │
│                                                             │
│    [                                                        │
│      {                                                      │
│        id: "abc...",                                        │
│        title: "Extension Chat Message",                    │
│        context: { content: "I mentioned OPENROUTER..." },  │
│        tags: ["user:message"],                             │
│        schema_name: "user.message.v1",                     │
│        version: 1,                                          │
│        updated_at: "2025-10-03T..."                        │
│      },                                                     │
│      ... (4 more results)                                  │
│    ]                                                        │
└─────────────────────────────────────────────────────────────┘
```

## 🔢 **The pgvector Operators**

RCRT uses **cosine distance** (`<#>`) - here's why:

```sql
-- Available pgvector operators:
<->   L2 distance (Euclidean)
<#>   Cosine distance (1 - cosine similarity)  ← RCRT uses this
<=>   Inner product distance

-- Why cosine?
-- L2-normalized embeddings + cosine distance = optimal for semantic similarity
```

**Mathematical detail:**
```
cosine_similarity(a, b) = (a · b) / (||a|| × ||b||)

Since RCRT L2-normalizes embeddings (main.rs:326-327):
  ||a|| = 1, ||b|| = 1

Therefore:
  cosine_similarity(a, b) = a · b
  cosine_distance(a, b) = 1 - (a · b)

Range: [0, 2] where:
  0.0 = identical vectors (perfect match)
  1.0 = orthogonal (no similarity)
  2.0 = opposite directions (anti-similar)
```

## 🧠 **ONNX Embedding Model**

**Model:** `sentence-transformers/all-MiniLM-L6-v2`

**Specs:**
- **Dimensions:** 384
- **Input:** Text (up to 512 tokens)
- **Output:** Dense vector [f32; 384]
- **Speed:** ~50ms per embedding (CPU)
- **Quality:** 0.68 on STS benchmark

**How it works:**

```rust
// 1. Tokenization (main.rs:277)
let encoding = tokenizer.encode(text, true)?;
let ids = encoding.get_ids();
// "What was that API key?"
// → [101, 2054, 2001, 2008, 3927, 3145, 102]
//    [CLS] What  was  that  API   key   [SEP]

// 2. Create BERT inputs (main.rs:279-282)
input_ids:      [101, 2054, 2001, 2008, 3927, 3145, 102]
attention_mask: [  1,    1,    1,    1,    1,    1,   1]
token_type_ids: [  0,    0,    0,    0,    0,    0,   0]

// 3. ONNX forward pass (main.rs:288-299)
let outputs = session.run(inputs)?;
// Shape: [1, 7, 384] (batch=1, tokens=7, hidden=384)

// 4. Mean pooling (main.rs:304-315)
for each token embedding:
    acc[i] += token_embedding[i]
acc = acc / num_tokens
// Result: [1, 384]

// 5. L2 normalization (main.rs:326-327)
norm = sqrt(sum(vec[i]²))
vec = vec / norm
// Result: Unit vector with ||vec|| = 1.0
```

## 📊 **Index Strategy: ivfflat**

**What is ivfflat?**
- **IVF:** Inverted File index (clusters vectors into buckets)
- **Flat:** Flat vectors within each bucket
- **Tradeoff:** Speed vs accuracy

```sql
-- Index definition (migrations/0001_init.sql:56)
CREATE INDEX idx_breadcrumbs_embedding 
ON breadcrumbs 
USING ivfflat (embedding vector_cosine_ops);
```

**How it works:**

```
Database has 1000 breadcrumbs with embeddings:
  ↓
ivfflat creates ~100 clusters (automatic)
  Cluster 1: Breadcrumbs about "API keys" [10 vectors]
  Cluster 2: Breadcrumbs about "docker" [12 vectors]
  Cluster 3: Breadcrumbs about "agents" [15 vectors]
  ...
  Cluster 100: Breadcrumbs about "errors" [8 vectors]
  ↓
Query: "What was that API key?" (embedded)
  ↓
1. Find closest cluster centroid (fast)
   → Cluster 1: "API keys" (distance: 0.12)
  ↓
2. Search within that cluster (exact)
   → Top 5 results from Cluster 1
  ↓
Return results (very fast for 1M+ vectors)
```

**Performance:**
```
Without index (full scan):
  O(N) where N = total breadcrumbs
  1000 breadcrumbs = 1000 distance calculations
  
With ivfflat:
  O(K + L) where K = clusters, L = cluster size
  1000 breadcrumbs = 100 clusters + 10 per cluster
  ~100x faster!
```

## 🎯 **SDK API Usage**

### **Option 1: Text Query (Automatic Embedding)**

```typescript
const results = await client.vectorSearch({
  q: "What was that API key?",  // Server embeds this
  nn: 5,
  filters: { tag: 'workspace:agents' }
});
```

**Flow:**
```
Client sends: q=text
  ↓
Server: embed_text(q) → Vec<f32>
  ↓
PostgreSQL: ORDER BY embedding <#> vec
  ↓
Returns: Top 5 results
```

### **Option 2: Pre-Computed Vector**

```typescript
// If you already have an embedding
const queryVec = await embedText("What was that API key?");

const results = await client.vectorSearch({
  qvec: queryVec,  // Skip server-side embedding
  nn: 5
});
```

**Use case:** Batch queries with same embedding

### **Option 3: Combined with Filters**

```typescript
const results = await client.vectorSearch({
  q: "API key",
  nn: 10,
  filters: {
    tag: 'workspace:agents',
    schema_name: 'user.message.v1',
    // Only search in user messages
  }
});
```

**SQL Generated:**
```sql
SELECT ...
FROM breadcrumbs
WHERE owner_id = $1
  AND $3 = ANY(tags)              -- Tag filter
  AND schema_name = 'user.message.v1'  -- Schema filter (NOT IN CURRENT CODE!)
ORDER BY embedding <#> $2
LIMIT 10;
```

## ✅ **Now Supports: schema_name Filter** (Fixed!)

```rust
// main.rs:194-204 (updated)
let mut sql = String::from("... WHERE owner_id = $1");
let mut bind_idx = 3;

if q.tag.is_some() { 
    sql.push_str(&format!(" and ${} = any(tags)", bind_idx)); 
    bind_idx += 1;
}

if q.schema_name.is_some() { 
    sql.push_str(&format!(" and schema_name = ${}", bind_idx)); 
}

sql.push_str(" order by embedding <#> $2 limit ...");
```

**Now works:**
```typescript
await vectorSearch({
  q: "API key",
  filters: { schema_name: 'user.message.v1' }  // ✅ Filters to only user messages!
});
```

See [VECTOR_SEARCH_IMPLEMENTATION.md](./VECTOR_SEARCH_IMPLEMENTATION.md) for performance details and optimization strategies.
