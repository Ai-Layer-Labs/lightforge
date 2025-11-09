/*!
 * Graph Cache Updater
 * 
 * Invalidates cached graphs when breadcrumbs are updated
 */

use crate::{
    rcrt_client::{RcrtClient, BreadcrumbEvent},
    graph::SessionGraphCache,
};
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{info, error};

pub struct GraphCacheUpdater {
    graph_cache: Arc<SessionGraphCache>,
    rcrt_client: Arc<RcrtClient>,
}

impl GraphCacheUpdater {
    pub fn new(graph_cache: Arc<SessionGraphCache>, rcrt_client: Arc<RcrtClient>) -> Self {
        GraphCacheUpdater {
            graph_cache,
            rcrt_client,
        }
    }
    
    pub async fn start(&self) -> Result<()> {
        let (tx, mut rx) = mpsc::unbounded_channel();
        
        // Start SSE stream
        self.rcrt_client.start_sse_stream(tx).await?;
        
        info!("♻️  Graph cache updater started, listening for breadcrumb updates...");
        
        // Process events
        while let Some(event) = rx.recv().await {
            if let Err(e) = self.handle_event(event).await {
                error!("Error handling cache invalidation: {}", e);
            }
        }
        
        Ok(())
    }
    
    async fn handle_event(&self, event: BreadcrumbEvent) -> Result<()> {
        // Invalidate cache on breadcrumb.updated events
        if event.event_type == "breadcrumb.updated" {
            // Extract session tags from event
            if let Some(tags) = &event.tags {
                for tag in tags {
                    if tag.starts_with("session:") {
                        // Invalidate cached graph for this session
                        self.graph_cache.remove(tag);
                        info!("♻️  Cache invalidated for {}", tag);
                    }
                }
            }
        }
        
        Ok(())
    }
}

