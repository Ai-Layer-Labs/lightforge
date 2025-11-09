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
        use std::collections::HashMap;
        
        // Group breadcrumbs by category for structured formatting
        let mut sections: HashMap<&str, Vec<&BreadcrumbNode>> = HashMap::new();
        
        for bc in &context.breadcrumbs {
            let category = categorize_schema(&bc.schema_name);
            sections.entry(category).or_insert_with(Vec::new).push(bc);
        }
        
        // Build formatted context with sections and separators
        let mut formatted_text = String::new();
        
        // Section 1: Available Tools
        if let Some(tools) = sections.get("tools") {
            formatted_text.push_str("=== AVAILABLE TOOLS ===\n\n");
            for bc in tools {
                let llm_content = self.extract_llm_content(bc.id).await?;
                formatted_text.push_str(&llm_content.to_string());
                formatted_text.push_str("\n");
            }
            formatted_text.push_str("\n---\n\n");
        }
        
        // Section 2: Browser Context
        if let Some(browser) = sections.get("browser") {
            formatted_text.push_str("=== BROWSER CONTEXT ===\n\n");
            for bc in browser {
                let llm_content = self.extract_llm_content(bc.id).await?;
                formatted_text.push_str(&llm_content.to_string());
                formatted_text.push_str("\n");
            }
            formatted_text.push_str("\n---\n\n");
        }
        
        // Section 3: Conversation History
        if let Some(conversation) = sections.get("conversation") {
            formatted_text.push_str("=== CONVERSATION HISTORY ===\n\n");
            for bc in conversation {
                let llm_content = self.extract_llm_content(bc.id).await?;
                formatted_text.push_str(&llm_content.to_string());
                formatted_text.push_str("\n\n");
            }
            formatted_text.push_str("---\n\n");
        }
        
        // Section 4: Relevant Knowledge
        if let Some(knowledge) = sections.get("knowledge") {
            formatted_text.push_str("=== RELEVANT KNOWLEDGE ===\n\n");
            for bc in knowledge {
                let llm_content = self.extract_llm_content(bc.id).await?;
                formatted_text.push_str(&llm_content.to_string());
                formatted_text.push_str("\n\n");
            }
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

/// Categorize breadcrumb schema for section grouping
fn categorize_schema(schema: &str) -> &str {
    match schema {
        "tool.catalog.v1" => "tools",
        "browser.page.context.v1" | "browser.tab.context.v1" => "browser",
        "user.message.v1" | "agent.response.v1" => "conversation",
        "tool.response.v1" => "conversation",  // Tool results in conversation
        "knowledge.v1" | "note.v1" => "knowledge",
        _ => "other",
    }
}

