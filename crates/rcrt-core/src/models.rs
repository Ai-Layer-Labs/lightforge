use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde_json::Value as JsonValue;
use pgvector::Vector;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Visibility { Public, Team, Private }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Sensitivity { Low, Pii, Secret }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreadcrumbCreate {
    pub title: String,
    pub description: Option<String>,        // NEW: Detailed description (moved from context)
    pub semantic_version: Option<String>,   // NEW: Semantic version like "2.0.0" (moved from context.version)
    pub context: JsonValue,
    pub tags: Vec<String>,
    pub schema_name: Option<String>,
    pub llm_hints: Option<JsonValue>,       // NEW: Instance-level LLM hints (moved from context.llm_hints)
    pub visibility: Option<Visibility>,
    pub sensitivity: Option<Sensitivity>,
    pub ttl: Option<DateTime<Utc>>,
    pub ttl_type: Option<String>,        // 'never', 'datetime', 'duration', 'usage', 'hybrid'
    pub ttl_config: Option<JsonValue>,   // Duration spec, max_reads, etc
    pub ttl_source: Option<String>,      // 'manual', 'schema-default', 'auto-applied', 'explicit'
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreadcrumbUpdate {
    pub title: Option<String>,
    pub description: Option<String>,        // NEW: Update description
    pub semantic_version: Option<String>,   // NEW: Update semantic version
    pub context: Option<JsonValue>,
    pub tags: Option<Vec<String>>,
    pub schema_name: Option<String>,
    pub llm_hints: Option<JsonValue>,       // NEW: Update LLM hints
    pub visibility: Option<Visibility>,
    pub sensitivity: Option<Sensitivity>,
    pub ttl: Option<DateTime<Utc>>,
    pub ttl_type: Option<String>,
    pub ttl_config: Option<JsonValue>,
    pub ttl_source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Breadcrumb {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub title: String,
    pub description: Option<String>,        // NEW: Detailed description
    pub semantic_version: Option<String>,   // NEW: Semantic version
    pub context: JsonValue,
    pub tags: Vec<String>,
    pub schema_name: Option<String>,
    pub llm_hints: Option<JsonValue>,       // NEW: Instance-level LLM hints
    pub visibility: Visibility,
    pub sensitivity: Sensitivity,
    pub version: i32,
    pub checksum: String,
    pub ttl: Option<DateTime<Utc>>,
    pub ttl_type: Option<String>,
    pub ttl_config: Option<JsonValue>,
    pub read_count: Option<i32>,
    pub ttl_source: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
    pub updated_by: Option<Uuid>,
    pub size_bytes: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreadcrumbContextView {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,        // NEW: Include in context view
    pub semantic_version: Option<String>,   // NEW: Include in context view
    pub context: JsonValue,
    pub tags: Vec<String>,
    pub schema_name: Option<String>,
    pub llm_hints: Option<JsonValue>,       // NEW: Include in context view
    pub version: i32,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreadcrumbFull {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub title: String,
    pub description: Option<String>,        // NEW: Detailed description
    pub semantic_version: Option<String>,   // NEW: Semantic version
    pub context: JsonValue,
    pub tags: Vec<String>,
    pub schema_name: Option<String>,
    pub llm_hints: Option<JsonValue>,       // NEW: Instance-level LLM hints
    pub visibility: Visibility,
    pub sensitivity: Sensitivity,
    pub version: i32,
    pub checksum: String,
    pub ttl: Option<DateTime<Utc>>,
    pub ttl_type: Option<String>,
    pub ttl_config: Option<JsonValue>,
    pub read_count: Option<i32>,
    pub ttl_source: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
    pub updated_by: Option<Uuid>,
    pub size_bytes: i32,
    pub embedding: Option<Vector>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Selector {
    pub any_tags: Option<Vec<String>>,   // match if overlap
    pub all_tags: Option<Vec<String>>,   // match if all contained
    pub schema_name: Option<String>,
    pub context_match: Option<Vec<ContextMatch>>, // simple ops on JSON paths
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectorSubscription {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub agent_id: Uuid,
    pub selector: Selector,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextMatch {
    pub path: String,              // e.g. $.timezone or $.allergens
    pub op: String,                // eq | contains_any | gt | lt
    pub value: serde_json::Value,  // comparison value
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AclGrantAgent {
    pub breadcrumb_id: Uuid,
    pub grantee_agent_id: Uuid,
    pub action: String,
}


