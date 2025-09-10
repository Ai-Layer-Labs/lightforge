use crate::models::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use uuid::Uuid;

pub async fn get_agents(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    proxy_request(&state, "agents", "GET", None).await
}

pub async fn get_agent(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<serde_json::Value>, StatusCode> {
    proxy_request(&state, &format!("agents/{}", id), "GET", None).await
}

pub async fn get_tenants(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    proxy_request(&state, "tenants", "GET", None).await
}

pub async fn get_tenant(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<serde_json::Value>, StatusCode> {
    proxy_request(&state, &format!("tenants/{}", id), "GET", None).await
}

pub async fn get_secrets(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    proxy_request(&state, "secrets", "GET", None).await
}

pub async fn get_acl(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    proxy_request(&state, "acl", "GET", None).await
}

pub async fn get_agent_webhooks(State(state): State<AppState>, Path(agent_id): Path<Uuid>) -> Result<Json<serde_json::Value>, StatusCode> {
    proxy_request(&state, &format!("agents/{}/webhooks", agent_id), "GET", None).await
}

pub async fn get_subscriptions(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    proxy_request(&state, "subscriptions/selectors", "GET", None).await
}

async fn proxy_request(
    state: &AppState, 
    endpoint: &str, 
    method: &str, 
    body: Option<&serde_json::Value>
) -> Result<Json<serde_json::Value>, StatusCode> {
    let url = format!("{}/{}", state.rcrt_base_url, endpoint);
    
    let mut request = match method {
        "GET" => state.http_client.get(&url),
        "POST" => state.http_client.post(&url),
        "PUT" => state.http_client.put(&url),
        "PATCH" => state.http_client.patch(&url),
        "DELETE" => state.http_client.delete(&url),
        _ => return Err(StatusCode::METHOD_NOT_ALLOWED),
    };
    
    if let Some(token) = &state.jwt_token {
        request = request.header("Authorization", format!("Bearer {}", token));
    }
    
    if let Some(json_body) = body {
        request = request.json(json_body);
    }
    
    match request.send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(data) => Ok(Json(data)),
                    Err(e) => {
                        tracing::error!("Failed to parse {} response: {}", endpoint, e);
                        Err(StatusCode::INTERNAL_SERVER_ERROR)
                    }
                }
            } else {
                tracing::error!("RCRT API {} returned status: {}", endpoint, response.status());
                Err(StatusCode::BAD_GATEWAY)
            }
        },
        Err(e) => {
            tracing::error!("Failed to proxy {}: {}", endpoint, e);
            Err(StatusCode::SERVICE_UNAVAILABLE)
        }
    }
}
