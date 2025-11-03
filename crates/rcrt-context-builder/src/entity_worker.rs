/*!
 * SSE-based Entity Extraction Worker
 * 
 * Subscribes to breadcrumb creation events via SSE and extracts entities
 * for hybrid search. Uses SSE fan-out pattern for:
 * - Simplicity (consistent with other services)
 * - Multiple subscribers (all services receive all events)
 * - Idempotency (skips already-processed breadcrumbs)
 */

use anyhow::Result;
use tracing::{info, warn, error};
use uuid::Uuid;
use std::sync::Arc;
use sqlx;
use tokio::sync::mpsc;

use crate::entity_extractor::EntityExtractor;
use crate::vector_store::VectorStore;
use crate::rcrt_client::{RcrtClient, BreadcrumbEvent};

/// Entity extraction worker that subscribes to SSE events
pub struct EntityWorker {
    rcrt_client: Arc<RcrtClient>,
    vector_store: Arc<VectorStore>,
    entity_extractor: Arc<EntityExtractor>,
}

impl EntityWorker {
    pub fn new(
        rcrt_client: Arc<RcrtClient>,
        vector_store: Arc<VectorStore>,
        entity_extractor: Arc<EntityExtractor>,
    ) -> Self {
        Self {
            rcrt_client,
            vector_store,
            entity_extractor,
        }
    }

    /// Start consuming from SSE and processing entity extraction
    pub async fn start(&self) -> Result<()> {
        info!("🔧 Entity worker starting SSE subscription...");
        
        let (tx, mut rx) = mpsc::unbounded_channel();
        
        // Start SSE stream
        self.rcrt_client.start_sse_stream(tx).await?;
        
        info!("✅ Entity worker started, listening for breadcrumb creation events via SSE...");
        
        // Process events
        while let Some(event) = rx.recv().await {
            // Only process breadcrumb creation events
            if event.event_type == "bc.created" {
                if let Err(e) = self.process_event(event).await {
                    error!("❌ Entity extraction failed: {}", e);
                }
            }
        }
        
        Ok(())
    }

    /// Process a single SSE event
    async fn process_event(&self, event: BreadcrumbEvent) -> Result<()> {
        // Skip events without breadcrumb_id
        let Some(bc_id) = event.breadcrumb_id else {
            return Ok(());
        };
        let schema = event.schema_name.as_deref().unwrap_or("unknown");
        
        info!("📨 Processing breadcrumb {} (schema: {})", bc_id, schema);
        
        // Fetch full breadcrumb from database
        let bc_row = match self.vector_store.get_by_id(bc_id).await? {
            Some(row) => row,
            None => {
                warn!("⚠️  Breadcrumb {} not found in database, skipping", bc_id);
                return Ok(());
            }
        };
        
        // Skip if already has entities (idempotent)
        if bc_row.entities.is_some() && bc_row.entity_keywords.is_some() {
            return Ok(());
        }
        
        // Extract text from breadcrumb
        let text = self.extract_text_from_breadcrumb(&bc_row);
        
        if text.trim().is_empty() {
            return Ok(());
        }
        
        info!("🔍 Extracting entities from {} chars of text...", text.len());
        
        // Extract entities
        let entities = self.entity_extractor.extract(&text)?;
        
        if entities.keywords.is_empty() {
            return Ok(());
        }
        
        // Save to database
        let entities_json = serde_json::to_value(&entities.entities)?;
        self.vector_store.update_entities(bc_id, &entities_json, &entities.keywords).await?;
        
        info!("✨ Extracted entities for {}: {:?}", bc_id, entities.keywords);
        
        Ok(())
    }

    /// Extract text from all relevant breadcrumb fields
    fn extract_text_from_breadcrumb(&self, bc: &crate::vector_store::BreadcrumbRow) -> String {
        let mut parts = Vec::new();
        
        // Add title
        if let Some(title) = &bc.title {
            if !title.is_empty() {
                parts.push(title.clone());
            }
        }
        
        // Add common context fields
        if let Some(content) = bc.context.get("content").and_then(|v| v.as_str()) {
            if !content.is_empty() {
                parts.push(content.to_string());
            }
        }
        
        if let Some(description) = bc.context.get("description").and_then(|v| v.as_str()) {
            if !description.is_empty() {
                parts.push(description.to_string());
            }
        }
        
        if let Some(summary) = bc.context.get("summary").and_then(|v| v.as_str()) {
            if !summary.is_empty() {
                parts.push(summary.to_string());
            }
        }
        
        // For code breadcrumbs, add code content
        if let Some(code) = bc.context.get("code") {
            if let Some(source) = code.get("source").and_then(|v| v.as_str()) {
                if !source.is_empty() {
                    parts.push(source.to_string());
                }
            }
        }
        
        parts.join(" ")
    }
}

/// Struct for backfill query results
#[derive(Debug, sqlx::FromRow)]
struct BackfillRow {
    id: Uuid,
    title: Option<String>,
    context: serde_json::Value,
    schema_name: Option<String>,
}

/// Run startup backfill for breadcrumbs without entities
pub async fn startup_backfill(
    vector_store: Arc<VectorStore>,
    entity_extractor: Arc<EntityExtractor>,
    db_pool: &sqlx::PgPool,
) -> Result<()> {
    info!("🔄 Starting entity backfill for existing breadcrumbs...");
    
    // Query breadcrumbs without entity_keywords that have embeddings
    let rows: Vec<BackfillRow> = sqlx::query_as(
        r#"
        SELECT id, title, context, schema_name
        FROM breadcrumbs 
        WHERE entity_keywords IS NULL 
        AND embedding IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 10000
        "#
    )
    .fetch_all(db_pool)
    .await?;
    
    let total = rows.len();
    info!("📊 Found {} breadcrumbs to backfill", total);
    
    if total == 0 {
        info!("✅ No breadcrumbs need backfilling");
        return Ok(());
    }
    
    let mut processed = 0;
    let mut skipped = 0;
    
    for (i, row) in rows.iter().enumerate() {
        // Extract text
        let text = format!(
            "{} {} {} {}",
            row.title.as_deref().unwrap_or(""),
            row.context.get("content").and_then(|v| v.as_str()).unwrap_or(""),
            row.context.get("description").and_then(|v| v.as_str()).unwrap_or(""),
            row.context.get("summary").and_then(|v| v.as_str()).unwrap_or("")
        );
        
        if text.trim().is_empty() {
            skipped += 1;
            continue;
        }
        
        // Extract entities
        match entity_extractor.extract(&text) {
            Ok(entities) => {
                if !entities.keywords.is_empty() {
                    match serde_json::to_value(&entities.entities) {
                        Ok(entities_json) => {
                            if let Err(e) = vector_store.update_entities(row.id, &entities_json, &entities.keywords).await {
                                error!("❌ Failed to update entities for {}: {}", row.id, e);
                            } else {
                                processed += 1;
                                if (i + 1) % 100 == 0 {
                                    info!("📊 Backfilled {}/{} breadcrumbs ({} processed, {} skipped)", 
                                        i + 1, total, processed, skipped);
                                }
                            }
                        }
                        Err(e) => {
                            error!("❌ Failed to serialize entities for {}: {}", row.id, e);
                            skipped += 1;
                        }
                    }
                } else {
                    skipped += 1;
                }
            }
            Err(e) => {
                error!("❌ Failed to extract entities for {}: {}", row.id, e);
                skipped += 1;
            }
        }
    }
    
    info!("✅ Startup backfill complete: {}/{} breadcrumbs processed, {} skipped", 
        processed, total, skipped);
    
    Ok(())
}

