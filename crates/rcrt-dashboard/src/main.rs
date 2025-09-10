use std::net::SocketAddr;
use axum::{
    routing::get,
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
    
    // Get JWT token for API access
    let jwt_token = match auth::get_jwt_token(&http_client, &rcrt_base_url, owner_id, agent_id).await {
        Ok(token) => {
            tracing::info!("Successfully obtained JWT token");
            Some(token)
        },
        Err(e) => {
            tracing::warn!("Failed to get JWT token: {}, using disabled auth mode if available", e);
            None
        }
    };

    let state = AppState {
        http_client,
        rcrt_base_url,
        owner_id,
        agent_id,
        jwt_token,
    };

    let app = Router::new()
        .route("/", get(dashboard_page))
        .route("/api/breadcrumbs", get(get_breadcrumbs).post(create_breadcrumb))
        .route("/api/breadcrumbs/:id", get(get_breadcrumb_context).patch(update_breadcrumb).delete(delete_breadcrumb))
        .route("/api/events/stream", get(proxy_sse_stream))
        .route("/api/agents", get(get_agents))
        .route("/api/agents/:id", get(get_agent))
        .route("/api/tenants", get(get_tenants))
        .route("/api/tenants/:id", get(get_tenant))
        .route("/api/secrets", get(get_secrets))
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