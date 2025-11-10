/*!
 * Agent Configuration Loader
 * 
 * Loads agent definitions from database and parses context_sources
 */

use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentDefinition {
    pub agent_id: String,
    pub context_sources: Option<ContextSources>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSources {
    pub always: Option<Vec<ContextSource>>,
    pub semantic: Option<SemanticConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSource {
    #[serde(rename = "type")]
    pub source_type: String,  // "schema", "tag", "specific"
    pub schema_name: Option<String>,
    pub tag: Option<String>,
    pub method: Option<String>,  // "latest", "recent", "all"
    pub limit: Option<usize>,
    pub optional: Option<bool>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticConfig {
    pub enabled: bool,
    pub schemas: Vec<String>,
    pub limit: Option<usize>,
    pub min_similarity: Option<f32>,
}

/// Load agent definition from database
pub async fn load_agent_definition(
    agent_id: &str,
    db_pool: &PgPool,
) -> Result<AgentDefinition> {
    let row = sqlx::query_as::<_, (serde_json::Value,)>(
        "SELECT context 
         FROM breadcrumbs 
         WHERE schema_name = 'agent.def.v1'
           AND context->>'agent_id' = $1
         LIMIT 1"
    )
    .bind(agent_id)
    .fetch_optional(db_pool)
    .await?;
    
    let Some((context,)) = row else {
        // No agent found - return empty definition
        tracing::warn!("Agent {} not found, using empty context_sources", agent_id);
        return Ok(AgentDefinition {
            agent_id: agent_id.to_string(),
            context_sources: None,
        });
    };
    
    // Parse context_sources if present
    let context_sources = context
        .get("context_sources")
        .and_then(|v| serde_json::from_value(v.clone()).ok());
    
    Ok(AgentDefinition {
        agent_id: agent_id.to_string(),
        context_sources,
    })
}

