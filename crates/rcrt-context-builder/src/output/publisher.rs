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
    
    pub async fn publish_context(
        &self,
        consumer_id: &str,
        session_tag: &str,
        trigger_id: Option<Uuid>,
        context: &AssembledContext,
    ) -> Result<()> {
        // Format breadcrumbs for context
        let formatted_breadcrumbs: Vec<serde_json::Value> = context.breadcrumbs
            .iter()
            .map(|bc| serde_json::json!({
                "id": bc.id,
                "schema_name": bc.schema_name,
                "tags": bc.tags,
                "context": bc.context,
                "created_at": bc.created_at,
            }))
            .collect();
        
        // Build context payload
        let context_payload = serde_json::json!({
            "consumer_id": consumer_id,
            "trigger_event_id": trigger_id,
            "assembled_at": chrono::Utc::now().to_rfc3339(),
            "token_estimate": context.token_estimate,
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
        
        Ok(())
    }
}

