/*!
 * Edge Builder Service
 * 
 * Background async service that builds graph edges for breadcrumbs
 * Subscribes to breadcrumb.created events via SSE
 */

use crate::{
    rcrt_client::{RcrtClient, BreadcrumbEvent},
    graph::EdgeBuilder,
};
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{info, error};

pub struct EdgeBuilderService {
    edge_builder: Arc<EdgeBuilder>,
    rcrt_client: Arc<RcrtClient>,
}

impl EdgeBuilderService {
    pub fn new(edge_builder: Arc<EdgeBuilder>, rcrt_client: Arc<RcrtClient>) -> Self {
        EdgeBuilderService {
            edge_builder,
            rcrt_client,
        }
    }
    
    pub async fn start(&self) -> Result<()> {
        let (tx, mut rx) = mpsc::unbounded_channel();
        
        // Start SSE stream
        self.rcrt_client.start_sse_stream(tx).await?;
        
        info!("🔧 Edge builder service started, listening for breadcrumb.created events...");
        
        // Process events
        while let Some(event) = rx.recv().await {
            if let Err(e) = self.handle_event(event).await {
                error!("Error handling event: {}", e);
            }
        }
        
        Ok(())
    }
    
    async fn handle_event(&self, event: BreadcrumbEvent) -> Result<()> {
        // Only process breadcrumb.created events
        if event.event_type == "breadcrumb.created" {
            if let Some(bc_id) = event.breadcrumb_id {
                info!("📨 New breadcrumb created: {}", bc_id);
                
                // Fire-and-forget: Build edges in background
                let builder = self.edge_builder.clone();
                tokio::spawn(async move {
                    if let Err(e) = builder.build_edges_for_breadcrumb(bc_id).await {
                        error!("❌ Failed to build edges for {}: {}", bc_id, e);
                    }
                });
            }
        }
        
        Ok(())
    }
}

