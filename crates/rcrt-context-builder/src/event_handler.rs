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
use petgraph::visit::EdgeRef;

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
        use crate::graph::load_graph_around_trigger;
        use crate::retrieval::AssembledContext;
        use crate::agent_config::load_agent_definition;
        
        let Some(trigger) = trigger_id else {
            warn!("No trigger ID provided, skipping context assembly");
            return Ok(());
        };
        
        // 🎯 UNIFIED APPROACH: Graph + Agent-Declared Sources
        // Single source of truth: context_sources in agent.def.v1
        
        // 1. Load agent definition to get context_sources
        let consumer_id = "default-chat-assistant";  // Hardcoded for now
        let agent_def = load_agent_definition(consumer_id, self.vector_store.pool()).await?;
        
        info!("📋 Loaded agent definition for {}", consumer_id);
        if agent_def.context_sources.is_some() {
            info!("  ✓ Has context_sources configuration");
        }
        
        // 2. Load graph around trigger (3 hops)
        let loaded_graph = match load_graph_around_trigger(
            trigger,
            3,  // radius: 3 hops
            &self.vector_store.pool(),
        ).await {
            Ok(graph) => graph,
            Err(e) => {
                error!("Failed to load graph: {}, falling back", e);
                return self.assemble_fallback(session_tag, trigger).await;
            }
        };
        
        info!("📊 Loaded graph: {} nodes, {} edges", 
            loaded_graph.graph.node_count(),
            loaded_graph.graph.edge_count());
        
        // 3. Convert petgraph to SessionGraph for PathFinder
        let mut session_graph = crate::graph::SessionGraph::new(session_tag.to_string());
        
        for node_idx in loaded_graph.graph.node_indices() {
            let node = &loaded_graph.graph[node_idx];
            session_graph.add_node(node.clone());
        }
        
        for edge_ref in loaded_graph.graph.edge_references() {
            let from_uuid = loaded_graph.graph[edge_ref.source()].id;
            let to_uuid = loaded_graph.graph[edge_ref.target()].id;
            let edge_features = edge_ref.weight();
            
            // Convert edge_type (i16) to EdgeType enum
            let edge_type = match edge_features.edge_type {
                0 => crate::graph::EdgeType::Causal,
                1 => crate::graph::EdgeType::Temporal,
                2 => crate::graph::EdgeType::TagRelated,
                3 => crate::graph::EdgeType::Semantic,
                _ => crate::graph::EdgeType::Semantic,
            };
            
            session_graph.add_edge(crate::graph::Edge {
                from: from_uuid,
                to: to_uuid,
                edge_type,
                weight: edge_features.weight,
            });
        }
        
        // 4. AUGMENT graph with agent-declared context_sources
        if let Some(context_sources) = &agent_def.context_sources {
            info!("🔧 Augmenting graph with agent context_sources...");
            
            // 4a. Always-include sources
            if let Some(always) = &context_sources.always {
                for source in always {
                    let optional = source.optional.unwrap_or(false);
                    
                    let nodes_result = match source.source_type.as_str() {
                        "schema" => {
                            if let Some(schema_name) = &source.schema_name {
                                self.fetch_by_schema(schema_name, source.method.as_deref(), source.limit).await
                            } else {
                                warn!("  ⚠️  Schema source missing schema_name");
                                continue;
                            }
                        },
                        "tag" => {
                            if let Some(tag) = &source.tag {
                                self.fetch_by_tag(tag, source.limit.unwrap_or(1)).await
                            } else {
                                warn!("  ⚠️  Tag source missing tag");
                                continue;
                            }
                        },
                        _ => {
                            warn!("  ⚠️  Unknown source type: {}", source.source_type);
                            continue;
                        }
                    };
                    
                    match nodes_result {
                        Ok(nodes) => {
                            for node_row in nodes {
                                let node_id = node_row.id;
                                if !session_graph.nodes.contains_key(&node_id) {
                                    let node = breadcrumb_row_to_node(node_row);
                                    session_graph.add_node(node);
                                    info!("  + Augmented: {} ({})", 
                                        source.schema_name.as_deref().or(source.tag.as_deref()).unwrap_or("unknown"),
                                        source.reason.as_deref().unwrap_or(""));
                                }
                            }
                        },
                        Err(e) if !optional => {
                            warn!("  ⚠️  Required source failed: {}", e);
                        },
                        Err(_) => {
                            // Optional source, ignore failure
                        }
                    }
                }
            }
            
            // 4b. Semantic search (if enabled)
            if let Some(semantic) = &context_sources.semantic {
                if semantic.enabled {
                    info!("  🔍 Semantic search enabled");
                    
                    // Get trigger breadcrumb for semantic search
                    if let Ok(Some(trigger_bc)) = self.vector_store.get_by_id(trigger).await {
                        let query_text = trigger_bc.context
                            .get("content")
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        
                        let entities = self.entity_extractor.extract(query_text)?;
                        
                        if !entities.keywords.is_empty() {
                            if let Some(ref embedding) = trigger_bc.embedding {
                                let limit = semantic.limit.unwrap_or(3);
                                let min_sim = semantic.min_similarity.unwrap_or(0.75);
                                
                                // Hybrid search on specified schemas
                                let knowledge = self.vector_store.find_similar_hybrid(
                                    &embedding,
                                    &entities.keywords,
                                    limit,
                                    None,  // Global search
                                ).await?;
                                
                                let mut added_count = 0;
                                for k in knowledge {
                                    // Filter by allowed schemas
                                    if semantic.schemas.contains(&k.schema_name) {
                                        // Check similarity threshold
                                        let similarity = k.embedding.as_ref()
                                            .and_then(|e| trigger_bc.embedding.as_ref().map(|te| {
                                                // Rough cosine similarity
                                                1.0 / (1.0 + vector_distance(te, e))
                                            }))
                                            .unwrap_or(0.0);
                                        
                                        if similarity >= min_sim {
                                            if !session_graph.nodes.contains_key(&k.id) {
                                                let node = breadcrumb_row_to_node(k);
                                                session_graph.add_node(node);
                                                added_count += 1;
                                            }
                                        }
                                    }
                                }
                                
                                if added_count > 0 {
                                    info!("  + Augmented: {} knowledge breadcrumbs", added_count);
                                }
                            }
                        } else {
                            info!("  ⏭️  No keywords extracted, skipping semantic search");
                        }
                    }
                }
            }
        }
        
        // 5. Use PathFinder with token awareness
        let path_finder = crate::retrieval::PathFinder::new(5, 50);
        let relevant_node_ids = path_finder.find_paths_token_aware(
            &session_graph,
            vec![trigger],
            4000,  // Target: 4000 tokens
        );
        
        info!("🎯 PathFinder selected {} nodes from graph (augmented from {} total)", 
            relevant_node_ids.len(), session_graph.nodes.len());
        
        // 6. Fetch breadcrumbs (they're already in session_graph)
        let mut breadcrumbs = Vec::new();
        for node_id in relevant_node_ids {
            if let Some(node) = session_graph.nodes.get(&node_id) {
                breadcrumbs.push(node.clone());
            }
        }
        
        // Sort by priority (causal first, then temporal, then by created_at)
        breadcrumbs.sort_by(|a, b| {
            // Priority: messages > tools > knowledge
            let a_priority = schema_priority(&a.schema_name);
            let b_priority = schema_priority(&b.schema_name);
            
            if a_priority != b_priority {
                a_priority.cmp(&b_priority)
            } else {
                b.created_at.cmp(&a.created_at)  // Most recent first within same priority
            }
        });
        
        // 5. Estimate tokens
        let token_estimate: usize = breadcrumbs.iter()
            .map(|bc| bc.context.to_string().len() / 3)
            .sum();
        
        info!("✅ Context assembled: {} breadcrumbs, ~{} tokens", 
            breadcrumbs.len(),
            token_estimate
        );
        
        let context = AssembledContext {
            breadcrumbs,
            token_estimate,
            sources_count: 1,  // Single source: graph traversal!
        };
        
        // Publish context breadcrumb
        self.publisher.publish_context(
            "default-chat-assistant",
            session_tag,
            Some(trigger),
            &context,
        ).await?;
        
        info!("✅ Context published for default-chat-assistant");
        
        Ok(())
    }
    
    /// Fallback assembly if graph loading fails
    async fn assemble_fallback(
        &self,
        session_tag: &str,
        trigger_id: uuid::Uuid,
    ) -> Result<()> {
        use crate::retrieval::AssembledContext;
        
        warn!("Using fallback context assembly (graph not available)");
        
        // Simple fallback: just get recent messages in session
        let recent = self.vector_store.get_recent(
            Some("user.message.v1"),
            Some(session_tag),
            10,
        ).await?;
        
        let breadcrumbs: Vec<_> = recent.into_iter()
            .map(|row| {
                crate::graph::BreadcrumbNode {
                    id: row.id,
                    schema_name: row.schema_name,
                    tags: row.tags,
                    context: row.context,
                    embedding: row.embedding,
                    created_at: row.created_at,
                    trigger_event_id: None,
                }
            })
            .collect();
        
        let token_estimate = breadcrumbs.iter()
            .map(|bc| bc.context.to_string().len() / 3)
            .sum();
        
        let context = AssembledContext {
            breadcrumbs,
            token_estimate,
            sources_count: 1,
        };
        
        self.publisher.publish_context(
            "default-chat-assistant",
            session_tag,
            Some(trigger_id),
            &context,
        ).await?;
        
        Ok(())
    }
    
    /// Fetch breadcrumbs by schema
    async fn fetch_by_schema(
        &self,
        schema_name: &str,
        method: Option<&str>,
        limit: Option<usize>,
    ) -> Result<Vec<crate::vector_store::BreadcrumbRow>> {
        let limit = limit.unwrap_or(1);
        
        match method.unwrap_or("latest") {
            "latest" => {
                if let Some(row) = self.vector_store.get_latest(schema_name, None).await? {
                    Ok(vec![row])
                } else {
                    Ok(vec![])
                }
            },
            "recent" | "all" => {
                self.vector_store.get_recent(Some(schema_name), None, limit).await
            },
            _ => Ok(vec![])
        }
    }
    
    /// Fetch breadcrumbs by tag
    async fn fetch_by_tag(
        &self,
        tag: &str,
        limit: usize,
    ) -> Result<Vec<crate::vector_store::BreadcrumbRow>> {
        self.vector_store.get_by_tag(tag, limit).await
    }
}

/// Convert BreadcrumbRow to BreadcrumbNode
fn breadcrumb_row_to_node(row: crate::vector_store::BreadcrumbRow) -> crate::graph::BreadcrumbNode {
    let trigger_event_id = row.context
        .get("trigger_event_id")
        .and_then(|v| v.as_str())
        .and_then(|s| uuid::Uuid::parse_str(s).ok());
    
    crate::graph::BreadcrumbNode {
        id: row.id,
        schema_name: row.schema_name,
        tags: row.tags,
        context: row.context,
        embedding: row.embedding,
        created_at: row.created_at,
        trigger_event_id,
    }
}

/// Determine priority order for schemas in context
/// Lower number = higher priority (shown first)
fn schema_priority(schema: &str) -> u8 {
    match schema {
        "tool.catalog.v1" => 0,               // Tools first
        "browser.page.context.v1" => 1,       // Current page second
        "browser.tab.context.v1" => 1,
        "user.message.v1" => 2,               // Conversation
        "agent.response.v1" => 2,
        "tool.response.v1" => 3,              // Tool results
        "knowledge.v1" => 4,                  // Knowledge base
        "note.v1" => 4,
        _ => 5,                                // Everything else last
    }
}

/// Rough vector distance (not precise, just for filtering)
fn vector_distance(_v1: &pgvector::Vector, _v2: &pgvector::Vector) -> f32 {
    // Simplified - actual distance would be computed properly
    0.2  // Placeholder
}

