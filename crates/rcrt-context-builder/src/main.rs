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
use tracing::info;
use std::sync::Arc;

mod config;
mod rcrt_client;
mod vector_store;
mod graph;
mod retrieval;
mod event_handler;
mod output;

use config::Config;
use rcrt_client::RcrtClient;
use vector_store::VectorStore;
use graph::SessionGraphCache;
use event_handler::EventHandler;

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

    // Initialize event handler
    let event_handler = EventHandler::new(
        rcrt_client.clone(),
        vector_store.clone(),
        graph_cache.clone(),
        config.clone(),
    );
    info!("✅ Event handler initialized");

    // Start SSE event stream
    info!("📡 Starting SSE event stream...");
    event_handler.start().await?;

    // Keep running
    info!("💚 Context Builder is running");
    tokio::signal::ctrl_c().await?;
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

