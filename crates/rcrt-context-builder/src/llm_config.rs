/*!
 * LLM Configuration Loader
 * 
 * Loads LLM config and calculates context budget based on model capabilities
 */

use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmConfig {
    pub default_model: Option<String>,
    pub max_tokens: Option<usize>,
    pub temperature: Option<f32>,
    pub context_budget: Option<usize>,  // Explicit context budget
}

#[derive(Debug, Clone)]
pub struct ContextBudget {
    pub tokens: usize,
    pub source: String,  // Where the budget came from
}

/// Load LLM config from tool.config.v1 breadcrumb
pub async fn load_llm_config(
    config_id: Option<String>,
    db_pool: &PgPool,
) -> Result<Option<LlmConfig>> {
    let Some(config_uuid_str) = config_id else {
        return Ok(None);
    };
    
    // Try to parse as UUID, return None if not valid
    let Ok(config_uuid) = Uuid::parse_str(&config_uuid_str) else {
        tracing::warn!("Invalid UUID for llm_config_id: {}", config_uuid_str);
        return Ok(None);
    };
    
    let row = sqlx::query_as::<_, (serde_json::Value,)>(
        "SELECT context->'config' as config
         FROM breadcrumbs
         WHERE id = $1
           AND schema_name = 'tool.config.v1'
         LIMIT 1"
    )
    .bind(config_uuid)
    .fetch_optional(db_pool)
    .await?;
    
    let Some((config_json,)) = row else {
        return Ok(None);
    };
    
    let llm_config: LlmConfig = serde_json::from_value(config_json)?;
    Ok(Some(llm_config))
}

/// Calculate context budget based on model capabilities
pub async fn calculate_context_budget(
    llm_config: &Option<LlmConfig>,
    db_pool: &PgPool,
) -> Result<ContextBudget> {
    // Check for explicit budget in config
    if let Some(config) = llm_config {
        if let Some(budget) = config.context_budget {
            return Ok(ContextBudget {
                tokens: budget,
                source: "explicit config".to_string(),
            });
        }
        
        // Try to get model info from catalog
        if let Some(model) = &config.default_model {
            if let Ok(Some(model_info)) = get_model_info(model, db_pool).await {
                // Use 75% of model's context_length as budget
                let budget = (model_info.context_length as f32 * 0.75) as usize;
                return Ok(ContextBudget {
                    tokens: budget,
                    source: format!("model catalog ({})", model),
                });
            }
        }
    }
    
    // Default: Conservative 50K tokens (works for most models)
    Ok(ContextBudget {
        tokens: 50000,
        source: "default fallback".to_string(),
    })
}

#[derive(Debug, Clone)]
struct ModelInfo {
    context_length: usize,
}

/// Get model info from openrouter.models.catalog.v1
async fn get_model_info(
    model: &str,
    db_pool: &PgPool,
) -> Result<Option<ModelInfo>> {
    let row = sqlx::query_as::<_, (serde_json::Value,)>(
        "SELECT context
         FROM breadcrumbs
         WHERE schema_name = 'openrouter.models.catalog.v1'
           AND tags @> ARRAY['openrouter:models']::text[]
         ORDER BY updated_at DESC
         LIMIT 1"
    )
    .fetch_optional(db_pool)
    .await?;
    
    let Some((context,)) = row else {
        return Ok(None);
    };
    
    // Find model in catalog
    if let Some(models) = context.get("models").and_then(|m| m.as_array()) {
        for model_obj in models {
            if let Some(id) = model_obj.get("id").and_then(|i| i.as_str()) {
                if id == model {
                    // Found the model
                    if let Some(context_len) = model_obj.get("context_length").and_then(|c| c.as_u64()) {
                        return Ok(Some(ModelInfo {
                            context_length: context_len as usize,
                        }));
                    }
                }
            }
        }
    }
    
    Ok(None)
}

