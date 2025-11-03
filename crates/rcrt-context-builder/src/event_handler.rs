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
    entity_extractor::EntityExtractor,  // NEW
};
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{info, warn, error};

pub struct EventHandler {
    rcrt_client: Arc<RcrtClient>,
    vector_store: Arc<VectorStore>,
    graph_cache: Arc<SessionGraphCache>,
    assembler: ContextAssembler,
    publisher: ContextPublisher,
    entity_extractor: Arc<EntityExtractor>,  // NEW: GLiNER for hybrid search
    config: Config,
}

impl EventHandler {
    pub fn new(
        rcrt_client: Arc<RcrtClient>,
        vector_store: Arc<VectorStore>,
        graph_cache: Arc<SessionGraphCache>,
        entity_extractor: Arc<EntityExtractor>,  // NEW
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
            entity_extractor,  // NEW
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
        
        // Build sources list
        let mut sources = vec![
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
        ];
        
        // 🔍 HYBRID SEARCH: Extract entities from query and search with vector + keywords
        if let Some(trigger) = trigger_id {
            if let Ok(Some(trigger_bc)) = self.vector_store.get_by_id(trigger).await {
                // Extract query text from trigger breadcrumb
                let query_text = trigger_bc.context
                    .get("content")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                
                // Extract entities from query using GLiNER
                let query_entities = self.entity_extractor.extract(query_text)?;
                
                if let Some(embedding) = trigger_bc.embedding {
                    info!("🔍 Hybrid search with keywords: {:?}", query_entities.keywords);
                    sources.push(SourceConfig {
                        method: SourceMethod::HybridGlobal {
                            query_embedding: embedding,
                            query_keywords: query_entities.keywords,
                        },
                        limit: 10,  // Can use lower limit with better accuracy!
                    });
                } else {
                    warn!("⚠️  Trigger breadcrumb {} has no embedding, skipping hybrid search", trigger);
                }
            }
        }
        
        let config = ContextConfig {
            consumer_id: "default-chat-assistant".to_string(),
            sources,
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
        
        // NOTE: Entity extraction is now handled by dedicated NATS JetStream worker
        // (see entity_worker.rs). This ensures all breadcrumbs get entities automatically
        // via durable work queue, with retries and horizontal scalability.
        
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

