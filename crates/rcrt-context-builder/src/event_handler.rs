/*!
 * Event Handler
 * 
 * Main event loop that processes SSE events and triggers context assembly
 */

use crate::{
    config::Config,
    rcrt_client::{RcrtClient, BreadcrumbEvent},
    vector_store::VectorStore,
    graph::SessionGraphCache,
    retrieval::ContextAssembler,
    output::ContextPublisher,
};
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{info, error};

pub struct EventHandler {
    rcrt_client: Arc<RcrtClient>,
    vector_store: Arc<VectorStore>,
    graph_cache: Arc<SessionGraphCache>,
    assembler: ContextAssembler,
    publisher: ContextPublisher,
    config: Config,
}

impl EventHandler {
    pub fn new(
        rcrt_client: Arc<RcrtClient>,
        vector_store: Arc<VectorStore>,
        graph_cache: Arc<SessionGraphCache>,
        config: Config,
    ) -> Self {
        let assembler = ContextAssembler::new(vector_store.clone());
        let publisher = ContextPublisher::new(rcrt_client.clone());
        
        EventHandler {
            rcrt_client,
            vector_store,
            graph_cache,
            assembler,
            publisher,
            config,
        }
    }
    
    pub async fn start(&self) -> Result<()> {
        let (tx, mut rx) = mpsc::unbounded_channel();
        
        // Start SSE stream
        self.rcrt_client.start_sse_stream(tx).await?;
        
        info!("✅ Event handler started, listening for events...");
        
        // Process events
        while let Some(event) = rx.recv().await {
            if let Err(e) = self.handle_event(event).await {
                error!("Error handling event: {}", e);
            }
        }
        
        Ok(())
    }
    
    async fn handle_event(&self, event: BreadcrumbEvent) -> Result<()> {
        // For MVP, we only process user.message.v1 events
        if let Some(schema) = &event.schema_name {
            if schema == "user.message.v1" {
                info!("📨 Processing user message event");
                
                // Extract session from tags
                let session_tag = event.tags
                    .as_ref()
                    .and_then(|tags| tags.iter().find(|t| t.starts_with("session:")))
                    .map(|s| s.to_string());
                
                if let Some(session) = session_tag {
                    // For MVP, use simple recent retrieval
                    // TODO: Load context.config.v1 and use dynamic retrieval
                    self.assemble_and_publish(&session, event.breadcrumb_id).await?;
                }
            }
        }
        
        Ok(())
    }
    
    async fn assemble_and_publish(
        &self,
        session_tag: &str,
        trigger_id: Option<uuid::Uuid>,
    ) -> Result<()> {
        use crate::retrieval::{ContextConfig, SourceConfig, SourceMethod};
        
        // THE RCRT WAY: Get ALL breadcrumbs from session (no whitelist!)
        // Session filter naturally scopes to conversation
        // Future: Add blacklist for system internals if needed
        let config = ContextConfig {
            consumer_id: "default-chat-assistant".to_string(),
            sources: vec![
                SourceConfig {
                    method: SourceMethod::Recent {
                        schema_name: None,  // ✅ Get EVERYTHING in session!
                    },
                    limit: 20,  // Increased limit since we're getting all types
                },
                // Always include tool catalog (not session-specific)
                SourceConfig {
                    method: SourceMethod::Latest {
                        schema_name: "tool.catalog.v1".to_string(),
                    },
                    limit: 1,
                },
            ],
        };
        
        // Assemble context
        let context = self.assembler.assemble(
            &config,
            Some(session_tag),
            None, // TODO: Use session graph
        ).await?;
        
        info!("✅ Context assembled: {} breadcrumbs, ~{} tokens", 
            context.breadcrumbs.len(),
            context.token_estimate
        );
        
        // Publish context breadcrumb
        self.publisher.publish_context(
            &config.consumer_id,
            session_tag,
            trigger_id,
            &context,
        ).await?;
        
        info!("✅ Context published for {}", config.consumer_id);
        
        Ok(())
    }
}

