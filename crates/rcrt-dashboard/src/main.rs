use std::net::SocketAddr;
use axum::{
    routing::{get, post, put},
    Router,
};
use tower_http::{services::ServeDir, cors::CorsLayer};
use tracing_subscriber::{EnvFilter, fmt};
use uuid::Uuid;
use anyhow::Result;

mod models;
mod handlers;
mod admin_handlers;
mod sse_handlers;
mod auth;

use models::AppState;
use handlers::*;
use admin_handlers::*;
use sse_handlers::*;
use auth::AuthManager;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    let filter = EnvFilter::from_default_env();
    fmt().with_env_filter(filter).init();

    let rcrt_base_url = std::env::var("RCRT_URL")
        .unwrap_or_else(|_| "http://localhost:8080".to_string());
    
    let owner_id = std::env::var("OWNER_ID")
        .ok()
        .and_then(|s| Uuid::parse_str(&s).ok())
        .unwrap_or_else(|| Uuid::new_v4());

    let agent_id = std::env::var("AGENT_ID")
        .ok()
        .and_then(|s| Uuid::parse_str(&s).ok())
        .unwrap_or_else(|| Uuid::new_v4());

    let http_client = reqwest::Client::new();
    
    // Create AuthManager for robust JWT handling
    let auth_manager = AuthManager::new(
        http_client.clone(),
        rcrt_base_url.clone(),
        owner_id,
        agent_id,
    );
    
    // Start background token renewal task
    auth_manager.start_token_renewal_task();
    
    // Wait for RCRT service to be healthy before starting the server
    tracing::info!("Waiting for RCRT service to become healthy...");
    let mut health_check_attempts = 0;
    const MAX_HEALTH_CHECK_ATTEMPTS: u32 = 30; // 5 minutes with 10s intervals
    
    while health_check_attempts < MAX_HEALTH_CHECK_ATTEMPTS {
        if auth_manager.check_service_health().await {
            tracing::info!("RCRT service is healthy, proceeding with startup");
            break;
        }
        
        health_check_attempts += 1;
        tracing::info!(
            "RCRT service not yet healthy (attempt {}/{}), waiting 10 seconds...",
            health_check_attempts,
            MAX_HEALTH_CHECK_ATTEMPTS
        );
        
        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
    }
    
    if health_check_attempts >= MAX_HEALTH_CHECK_ATTEMPTS {
        tracing::warn!("RCRT service did not become healthy within timeout, starting anyway with resilient mode");
    }
    
    // Try to get initial JWT token (non-blocking)
    tracing::info!("Attempting to acquire initial JWT token...");
    let jwt_token = auth_manager.get_valid_token().await;
    
    match &jwt_token {
        Some(_) => tracing::info!("Successfully obtained initial JWT token"),
        None => tracing::warn!("Could not obtain initial JWT token, will retry in background"),
    }

    let state = AppState {
        http_client,
        rcrt_base_url,
        owner_id,
        agent_id,
        jwt_token,
        auth_manager,
    };

    let app = Router::new()
        .route("/", get(dashboard_page))
        .route("/api/breadcrumbs", get(get_breadcrumbs).post(create_breadcrumb))
        .route("/api/breadcrumbs/:id", get(get_breadcrumb_context).patch(update_breadcrumb).delete(delete_breadcrumb))
        .route("/api/events/stream", get(proxy_sse_stream))
        .route("/api/auth/token", get(get_jwt_token)) // 🎯 NEW: Direct JWT access for frontend
        .route("/api/agents", get(get_agents))
        .route("/api/agents/:id", get(get_agent))
        .route("/api/tenants", get(get_tenants))
        .route("/api/tenants/:id", get(get_tenant))
        .route("/api/secrets", get(handlers::get_secrets).post(create_secret))
        .route("/api/secrets/:id", put(update_secret).delete(delete_secret))
        .route("/api/secrets/:id/decrypt", post(decrypt_secret))
        .route("/api/acl", get(get_acl))
        .route("/api/agents/:id/webhooks", get(get_agent_webhooks))
        .route("/api/subscriptions", get(get_subscriptions))
        .route("/health", get(health))
        .nest_service("/static", ServeDir::new("static"))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr: SocketAddr = "0.0.0.0:8082".parse().unwrap();
    tracing::info!("Dashboard listening on {}", addr);
    axum::serve(tokio::net::TcpListener::bind(addr).await?, app).await?;
    Ok(())
}