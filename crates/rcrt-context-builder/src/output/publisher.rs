/*!
 * Context breadcrumb publisher
 */

use crate::{
    rcrt_client::RcrtClient,
    retrieval::AssembledContext,
};
use anyhow::Result;
use std::sync::Arc;
use uuid::Uuid;

pub struct ContextPublisher {
    rcrt_client: Arc<RcrtClient>,
}

impl ContextPublisher {
    pub fn new(rcrt_client: Arc<RcrtClient>) -> Self {
        ContextPublisher { rcrt_client }
    }
    
    /// Extract LLM-optimized content from a breadcrumb using server-side llm_hints
    async fn extract_llm_content(&self, breadcrumb_id: Uuid) -> Result<serde_json::Value> {
        // Fetch breadcrumb context from server (applies llm_hints automatically)
        match self.rcrt_client.get_breadcrumb(breadcrumb_id).await {
            Ok(bc) => Ok(bc.context),
            Err(e) => {
                tracing::warn!("Failed to fetch LLM content for {}: {}", breadcrumb_id, e);
                // Fallback to empty object
                Ok(serde_json::json!({}))
            }
        }
    }
    
    pub async fn publish_context(
        &self,
        consumer_id: &str,
        session_tag: &str,
        trigger_id: Option<Uuid>,
        context: &AssembledContext,
    ) -> Result<()> {
        // Extract lightweight LLM-optimized content from each breadcrumb
        // The server applies llm_hints transforms automatically
        let mut formatted_breadcrumbs = Vec::new();
        
        for bc in &context.breadcrumbs {
            let llm_content = self.extract_llm_content(bc.id).await?;
            
            // Build lightweight breadcrumb with transformed content
            formatted_breadcrumbs.push(serde_json::json!({
                "id": bc.id,
                "schema_name": bc.schema_name,
                "created_at": bc.created_at,
                "content": llm_content,  // Transformed by llm_hints
            }));
        }
        
        // Recalculate token estimate based on actual formatted content
        let formatted_json = serde_json::to_string(&formatted_breadcrumbs)?;
        let token_estimate = formatted_json.len() / 3; // ~3 chars per token
        
        // Build context payload
        let context_payload = serde_json::json!({
            "consumer_id": consumer_id,
            "trigger_event_id": trigger_id,
            "assembled_at": chrono::Utc::now().to_rfc3339(),
            "token_estimate": token_estimate,
            "sources_assembled": context.sources_count,
            "breadcrumbs": formatted_breadcrumbs,
        });
        
        // Check for existing context breadcrumb
        let consumer_tag = format!("consumer:{}", consumer_id);
        let existing = self.rcrt_client.search_breadcrumbs(
            "agent.context.v1",
            Some(vec![session_tag.to_string(), consumer_tag.clone()]),
        ).await?;
        
        if let Some(existing_bc) = existing.first() {
            // Update existing
            self.rcrt_client.update_breadcrumb(
                existing_bc.id,
                existing_bc.version,
                context_payload,
            ).await?;
        } else {
            // Create new
            self.rcrt_client.create_breadcrumb(
                "agent.context.v1",
                &format!("Context for {}", consumer_id),
                vec![
                    "agent:context".to_string(),
                    consumer_tag,
                    session_tag.to_string(),
                ],
                context_payload,
            ).await?;
        }
        
        tracing::info!("✅ Published context with {} breadcrumbs (~{} tokens)", 
            formatted_breadcrumbs.len(), token_estimate);
        
        Ok(())
    }
}

