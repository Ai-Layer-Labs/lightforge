/*!
 * Context assembly
 * 
 * Combines multiple retrieval strategies and formats context for LLMs
 */

use crate::graph::{SessionGraph, BreadcrumbNode};
use crate::vector_store::{VectorStore, BreadcrumbRow};
use crate::retrieval::PathFinder;
use anyhow::Result;
use pgvector::Vector;
use std::collections::HashSet;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct ContextConfig {
    pub consumer_id: String,
    pub sources: Vec<SourceConfig>,
}

#[derive(Debug, Clone)]
pub struct SourceConfig {
    pub method: SourceMethod,
    pub limit: usize,
}

#[derive(Debug, Clone)]
pub enum SourceMethod {
    Vector { query_embedding: Vector },
    Recent { schema_name: Option<String> },
    Latest { schema_name: String },
    Tagged { tag: String },
    Causal { seed_ids: Vec<Uuid> },
}

pub struct AssembledContext {
    pub breadcrumbs: Vec<BreadcrumbNode>,
    pub token_estimate: usize,
    pub sources_count: usize,
}

pub struct ContextAssembler {
    vector_store: Arc<VectorStore>,
    path_finder: PathFinder,
}

impl ContextAssembler {
    pub fn new(vector_store: Arc<VectorStore>) -> Self {
        ContextAssembler {
            vector_store,
            path_finder: PathFinder::new(5, 50), // max_depth=5, max_results=50
        }
    }
    
    pub async fn assemble(
        &self,
        config: &ContextConfig,
        session_id: Option<&str>,
        graph: Option<&SessionGraph>,
    ) -> Result<AssembledContext> {
        let mut all_ids = HashSet::new();
        let mut all_breadcrumbs = Vec::new();
        
        // Execute each source
        for source in &config.sources {
            let breadcrumbs = self.execute_source(source, session_id, graph).await?;
            
            for bc in breadcrumbs {
                if !all_ids.contains(&bc.id) {
                    all_ids.insert(bc.id);
                    all_breadcrumbs.push(bc);
                }
            }
        }
        
        // Sort by created_at (most recent first)
        all_breadcrumbs.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        
        // Estimate token count (rough: 4 chars per token)
        let token_estimate = all_breadcrumbs.iter()
            .map(|bc| bc.context.to_string().len() / 4)
            .sum();
        
        Ok(AssembledContext {
            breadcrumbs: all_breadcrumbs,
            token_estimate,
            sources_count: config.sources.len(),
        })
    }
    
    async fn execute_source(
        &self,
        source: &SourceConfig,
        session_id: Option<&str>,
        graph: Option<&SessionGraph>,
    ) -> Result<Vec<BreadcrumbNode>> {
        match &source.method {
            SourceMethod::Vector { query_embedding } => {
                let rows = self.vector_store.find_similar(
                    query_embedding,
                    source.limit,
                    session_id,
                ).await?;
                
                Ok(rows.into_iter().map(breadcrumb_row_to_node).collect())
            }
            
            SourceMethod::Recent { schema_name } => {
                let rows = self.vector_store.get_recent(
                    schema_name.as_deref(),
                    session_id,
                    source.limit,
                ).await?;
                
                Ok(rows.into_iter().map(breadcrumb_row_to_node).collect())
            }
            
            SourceMethod::Latest { schema_name } => {
                if let Some(row) = self.vector_store.get_latest(
                    schema_name,
                    session_id,
                ).await? {
                    Ok(vec![breadcrumb_row_to_node(row)])
                } else {
                    Ok(vec![])
                }
            }
            
            SourceMethod::Tagged { tag } => {
                let rows = self.vector_store.get_by_tag(
                    tag,
                    source.limit,
                ).await?;
                
                Ok(rows.into_iter().map(breadcrumb_row_to_node).collect())
            }
            
            SourceMethod::Causal { seed_ids } => {
                if let Some(g) = graph {
                    let result_ids = self.path_finder.get_causal_chains(g, seed_ids.clone());
                    
                    let mut nodes = Vec::new();
                    for id in result_ids {
                        if let Some(node) = g.nodes.get(&id) {
                            nodes.push(node.clone());
                        }
                    }
                    
                    Ok(nodes)
                } else {
                    // Fallback to database if no graph
                    let mut nodes = Vec::new();
                    for id in seed_ids {
                        if let Some(row) = self.vector_store.get_by_id(*id).await? {
                            nodes.push(breadcrumb_row_to_node(row));
                        }
                    }
                    Ok(nodes)
                }
            }
        }
    }
}

fn breadcrumb_row_to_node(row: BreadcrumbRow) -> BreadcrumbNode {
    let trigger_event_id = row.context
        .get("trigger_event_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    
    BreadcrumbNode {
        id: row.id,
        schema_name: row.schema_name,
        tags: row.tags,
        context: row.context,
        embedding: row.embedding,
        created_at: row.created_at,
        trigger_event_id,
    }
}

