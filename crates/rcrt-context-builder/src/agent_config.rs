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
    pub llm_config_id: Option<String>,
    pub context_trigger: Option<ContextTrigger>,  // NEW: Declares what triggers context assembly
    pub context_sources: Option<ContextSources>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextTrigger {
    pub schema_name: String,
    pub all_tags: Option<Vec<String>>,
    pub any_tags: Option<Vec<String>>,
    pub comment: Option<String>,
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
        // No agent found - fail fast
        anyhow::bail!("Agent {} not found", agent_id);
    };
    
    // Parse full agent definition from context
    // Includes: agent_id, llm_config_id, context_trigger, context_sources
    let agent_def: AgentDefinition = serde_json::from_value(context)?;
    
    Ok(agent_def)
}

/// Load ALL agent definitions that declare context_trigger
/// Used by context-builder to find which agents want context for a given trigger
pub async fn load_all_agent_definitions_with_triggers(
    db_pool: &PgPool,
) -> Result<Vec<AgentDefinition>> {
    let rows = sqlx::query_as::<_, (serde_json::Value,)>(
        "SELECT context 
         FROM breadcrumbs 
         WHERE schema_name = 'agent.def.v1'
           AND tags @> ARRAY['workspace:agents']
           AND context ? 'context_trigger'
         ORDER BY updated_at DESC"
    )
    .fetch_all(db_pool)
    .await?;
    
    let mut agents = Vec::new();
    for (context,) in rows {
        if let Ok(agent_def) = serde_json::from_value::<AgentDefinition>(context) {
            agents.push(agent_def);
        }
    }
    
    Ok(agents)
}

