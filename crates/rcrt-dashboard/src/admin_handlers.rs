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
    let max_retries = 3;
    let mut retry_count = 0;

    while retry_count < max_retries {
        let token = state.auth_manager.get_valid_token().await;
        
        let mut request = match method {
            "GET" => state.http_client.get(&format!("{}/{}", state.rcrt_base_url, endpoint)),
            "POST" => state.http_client.post(&format!("{}/{}", state.rcrt_base_url, endpoint)),
            "PUT" => state.http_client.put(&format!("{}/{}", state.rcrt_base_url, endpoint)),
            "PATCH" => state.http_client.patch(&format!("{}/{}", state.rcrt_base_url, endpoint)),
            "DELETE" => state.http_client.delete(&format!("{}/{}", state.rcrt_base_url, endpoint)),
            _ => return Err(StatusCode::METHOD_NOT_ALLOWED),
        };
        
        if let Some(token) = token {
            request = request.header("Authorization", format!("Bearer {}", token));
        }
        
        if let Some(json_body) = body {
            request = request.json(json_body);
        }
        
        match request.send().await {
            Ok(response) => {
                let status = response.status();
                if status.is_success() {
                    match response.json::<serde_json::Value>().await {
                        Ok(data) => return Ok(Json(data)),
                        Err(e) => {
                            tracing::error!("Failed to parse {} response: {}", endpoint, e);
                            return Err(StatusCode::INTERNAL_SERVER_ERROR);
                        }
                    }
                } else if status == reqwest::StatusCode::UNAUTHORIZED && retry_count < max_retries - 1 {
                    // Token might be expired, force refresh and retry
                    tracing::warn!("Got 401 for {}, forcing token refresh and retrying", endpoint);
                    retry_count += 1;
                    continue;
                } else {
                    tracing::error!("RCRT API {} returned status: {}", endpoint, status);
                    return Err(match status.as_u16() {
                        401 => StatusCode::UNAUTHORIZED,
                        403 => StatusCode::FORBIDDEN,
                        404 => StatusCode::NOT_FOUND,
                        _ => StatusCode::BAD_GATEWAY,
                    });
                }
            },
            Err(e) => {
                tracing::error!("Failed to proxy {}: {}", endpoint, e);
                if retry_count < max_retries - 1 {
                    retry_count += 1;
                    tokio::time::sleep(tokio::time::Duration::from_millis(100 * (1 << retry_count))).await;
                    continue;
                }
                return Err(StatusCode::SERVICE_UNAVAILABLE);
            }
        }
    }

    Err(StatusCode::SERVICE_UNAVAILABLE)
}
