/*!
 * RCRT Context Builder Service
 * 
 * High-performance Rust service for assembling agent context using
 * graph-based breadcrumb flow networks.
 * 
 * Architecture:
 * - SSE event stream listener
 * - Session-local graph cache (LRU)
 * - Constrained shortest path retrieval
 * - Evolutionary genome optimization
 */

use anyhow::Result;
use tracing::{info, error};
use std::sync::Arc;
use std::env;

mod config;
mod rcrt_client;
mod vector_store;
mod graph;
mod retrieval;
mod event_handler;
mod output;
mod entity_extractor;  // Entity extraction (regex-based)
mod entity_worker;     // SSE-based worker for entity extraction

use config::Config;
use rcrt_client::RcrtClient;
use vector_store::VectorStore;
use graph::SessionGraphCache;
use event_handler::EventHandler;
use entity_extractor::EntityExtractor;  // NEW

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "rcrt_context_builder=info".into()),
        )
        .with_target(false)
        .with_thread_ids(true)
        .with_line_number(true)
        .init();

    info!("🚀 RCRT Context Builder starting...");

    // Load configuration
    let config = Config::from_env()?;
    info!("✅ Configuration loaded");
    info!("   RCRT API: {}", config.rcrt_api_url);
    info!("   Database: {}", mask_password(&config.database_url));
    info!("   Cache size: {}MB", config.cache_size_mb);

    // Initialize database connection pool
    let db_pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(config.max_db_connections)
        .connect(&config.database_url)
        .await?;
    
    info!("✅ Database connected");

    // Test pgvector extension
    sqlx::query("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
        .fetch_one(&db_pool)
        .await
        .map_err(|_| anyhow::anyhow!("pgvector extension not found - run CREATE EXTENSION vector"))?;
    
    info!("✅ pgvector extension verified");

    // Initialize vector store
    let vector_store = Arc::new(VectorStore::new(db_pool.clone()));
    info!("✅ Vector store initialized");

    // Initialize session graph cache
    let graph_cache = Arc::new(SessionGraphCache::new(config.cache_size_mb));
    info!("✅ Session graph cache initialized");

    // Initialize RCRT API client
    let rcrt_client = Arc::new(
        RcrtClient::new(&config.rcrt_api_url, &config.owner_id, &config.agent_id).await?
    );
    info!("✅ RCRT client connected");

    // Initialize entity extractor (regex-based)
    let model_path = env::var("GLINER_MODEL_PATH")
        .unwrap_or_else(|_| "/app/models/gliner_small.onnx".to_string());
    let tokenizer_path = env::var("GLINER_TOKENIZER_PATH")
        .unwrap_or_else(|_| "/app/models/tokenizer.json".to_string());
    
    let entity_extractor = Arc::new(EntityExtractor::new(&model_path, &tokenizer_path)?);
    info!("✅ Entity extractor initialized");

    // Run startup backfill for existing breadcrumbs without entities
    info!("🔄 Running startup backfill...");
    if let Err(e) = entity_worker::startup_backfill(
        vector_store.clone(),
        entity_extractor.clone(),
        &db_pool,
    ).await {
        error!("⚠️  Startup backfill failed: {}. Continuing anyway.", e);
    } else {
        info!("✅ Startup backfill complete");
    }

    // Initialize event handler (for context assembly from user messages)
    let event_handler = EventHandler::new(
        rcrt_client.clone(),
        vector_store.clone(),
        graph_cache.clone(),
        entity_extractor.clone(),
        config.clone(),
    );
    info!("✅ Event handler initialized");

    // Start entity extraction worker (SSE)
    let entity_worker = entity_worker::EntityWorker::new(
        rcrt_client.clone(),
        vector_store.clone(),
        entity_extractor.clone(),
    );
    
    info!("🔧 Starting entity extraction worker...");
    let entity_worker_handle = tokio::spawn(async move {
        if let Err(e) = entity_worker.start().await {
            error!("❌ Entity worker failed: {}", e);
        }
    });

    // Start SSE event stream (for context assembly triggers)
    info!("📡 Starting SSE event stream for context assembly...");
    let event_handler_handle = tokio::spawn(async move {
        if let Err(e) = event_handler.start().await {
            error!("❌ Event handler failed: {}", e);
        }
    });

    // Keep running until shutdown signal
    info!("💚 Context Builder is running");
    info!("   - Entity extraction: SSE stream");
    info!("   - Context assembly: SSE stream");
    
    tokio::select! {
        _ = tokio::signal::ctrl_c() => {
            info!("🛑 Received shutdown signal...");
        }
        _ = entity_worker_handle => {
            error!("❌ Entity worker stopped unexpectedly");
        }
        _ = event_handler_handle => {
            error!("❌ Event handler stopped unexpectedly");
        }
    }
    
    info!("🛑 Shutting down...");

    Ok(())
}

fn mask_password(url: &str) -> String {
    if let Some(at_pos) = url.rfind('@') {
        if let Some(colon_pos) = url[..at_pos].rfind(':') {
            let mut masked = url.to_string();
            masked.replace_range(colon_pos + 1..at_pos, "****");
            return masked;
        }
    }
    url.to_string()
}

