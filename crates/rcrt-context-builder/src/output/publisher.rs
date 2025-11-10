/*!
 * Context breadcrumb publisher
 */

use crate::{
    rcrt_client::RcrtClient,
    retrieval::AssembledContext,
    graph::BreadcrumbNode,
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
        let bc = self.rcrt_client.get_breadcrumb(breadcrumb_id).await
            .map_err(|e| anyhow::anyhow!("Failed to fetch LLM content for {}: {}", breadcrumb_id, e))?;
        Ok(bc.context)
    }
    
    pub async fn publish_context(
        &self,
        consumer_id: &str,
        session_tag: &str,
        trigger_id: Option<Uuid>,
        context: &AssembledContext,
    ) -> Result<()> {
        // THE RCRT WAY: Just format breadcrumbs in order
        // llm_hints templates include their own headers (self-describing)
        // No hardcoded sections, no schema matching, no gatekeepers
        let mut formatted_text = String::new();
        
        for bc in &context.breadcrumbs {
            let llm_content = self.extract_llm_content(bc.id).await?;
            formatted_text.push_str(&llm_content.to_string());
            formatted_text.push_str("\n\n---\n\n");
        }
        
        // Recalculate token estimate based on formatted text
        let token_estimate = formatted_text.len() / 3; // ~3 chars per token
        
        // Build context payload with formatted text
        let context_payload = serde_json::json!({
            "consumer_id": consumer_id,
            "trigger_event_id": trigger_id,
            "assembled_at": chrono::Utc::now().to_rfc3339(),
            "token_estimate": token_estimate,
            "sources_assembled": context.sources_count,
            "formatted_context": formatted_text,  // NEW: Pre-formatted for LLM
            "breadcrumb_count": context.breadcrumbs.len(),
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
            context.breadcrumbs.len(), token_estimate);
        
        Ok(())
    }
}

// REMOVED: categorize_schema() - No longer needed
// Breadcrumbs self-describe their formatting via llm_hints templates

