use crate::models::*;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{Json, Redirect},
};
use uuid::Uuid;

pub async fn dashboard_page() -> Redirect {
    Redirect::permanent("/static/index.html")
}

pub async fn health() -> &'static str {
    "ok"
}

pub async fn get_jwt_token(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.auth_manager.get_valid_token().await {
        Some(token) => {
            // 🔧 NETWORK FIX: Convert Docker internal URL to browser-accessible URL
            let browser_rcrt_url = if state.rcrt_base_url.contains("rcrt:8080") {
                // Dashboard runs in Docker, browser on host - use external port mapping
                "http://localhost:8081".to_string()
            } else {
                // Use the configured URL as-is
                state.rcrt_base_url.clone()
            };
            
            Ok(Json(serde_json::json!({
                "token": token,
                "rcrt_base_url": browser_rcrt_url
            })))
        },
        None => {
            Err(StatusCode::UNAUTHORIZED)
        }
    }
}

/// Helper function to make authenticated API requests with retry logic
async fn make_authenticated_request<T>(
    state: &AppState,
    method: reqwest::Method,
    endpoint: &str,
    body: Option<&serde_json::Value>,
    headers: Option<&HeaderMap>,
) -> Result<T, StatusCode>
where
    T: serde::de::DeserializeOwned,
{
    let max_retries = 3;
    let mut retry_count = 0;

    while retry_count < max_retries {
        let token = state.auth_manager.get_valid_token().await;
        
        let mut request = state.http_client
            .request(method.clone(), &format!("{}/{}", state.rcrt_base_url, endpoint));
        
        if let Some(token) = token {
            request = request.header("Authorization", format!("Bearer {}", token));
        }
        
        if let Some(body) = body {
            request = request.json(body);
        }
        
        if let Some(headers) = headers {
            for (key, value) in headers.iter() {
                request = request.header(key, value);
            }
        }
        
        match request.send().await {
            Ok(response) => {
                let status = response.status();
                if status.is_success() {
                    match response.json::<T>().await {
                        Ok(data) => return Ok(data),
                        Err(e) => {
                            tracing::error!("Failed to parse response JSON for {}: {}", endpoint, e);
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
                tracing::error!("Failed to fetch {}: {}", endpoint, e);
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

pub async fn get_breadcrumbs(State(state): State<AppState>) -> Result<Json<Vec<Breadcrumb>>, StatusCode> {
    match make_authenticated_request::<Vec<Breadcrumb>>(&state, reqwest::Method::GET, "breadcrumbs", None, None).await {
        Ok(breadcrumbs) => Ok(Json(breadcrumbs)),
        Err(status) => Err(status),
    }
}

pub async fn get_breadcrumb_context(
    State(state): State<AppState>, 
    Path(id): Path<Uuid>
) -> Result<Json<BreadcrumbContext>, StatusCode> {
    match make_authenticated_request::<BreadcrumbContext>(&state, reqwest::Method::GET, &format!("breadcrumbs/{}", id), None, None).await {
        Ok(context) => Ok(Json(context)),
        Err(status) => Err(status),
    }
}

pub async fn create_breadcrumb(
    State(state): State<AppState>,
    Json(req): Json<CreateBreadcrumbRequest>
) -> Result<Json<serde_json::Value>, StatusCode> {
    let body = serde_json::to_value(&req).map_err(|_| StatusCode::BAD_REQUEST)?;
    match make_authenticated_request::<serde_json::Value>(&state, reqwest::Method::POST, "breadcrumbs", Some(&body), None).await {
        Ok(result) => Ok(Json(result)),
        Err(status) => Err(status),
    }
}

pub async fn update_breadcrumb(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Json(req): Json<UpdateBreadcrumbRequest>
) -> Result<Json<serde_json::Value>, StatusCode> {
    let body = serde_json::to_value(&req).map_err(|_| StatusCode::BAD_REQUEST)?;
    
    // Extract relevant headers for forwarding
    let mut forwarded_headers = HeaderMap::new();
    if let Some(if_match) = headers.get("if-match") {
        forwarded_headers.insert("If-Match", if_match.clone());
    }
    
    match make_authenticated_request::<serde_json::Value>(
        &state, 
        reqwest::Method::PATCH, 
        &format!("breadcrumbs/{}", id), 
        Some(&body),
        Some(&forwarded_headers)
    ).await {
        Ok(result) => Ok(Json(result)),
        Err(status) => Err(status),
    }
}

pub async fn delete_breadcrumb(
    State(state): State<AppState>,
    Path(id): Path<Uuid>
) -> Result<Json<serde_json::Value>, StatusCode> {
    match make_authenticated_request::<serde_json::Value>(&state, reqwest::Method::DELETE, &format!("breadcrumbs/{}", id), None, None).await {
        Ok(result) => Ok(Json(result)),
        Err(status) => Err(status),
    }
}

// ============ SECRETS MANAGEMENT ENDPOINTS ============

pub async fn get_secrets(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    match make_authenticated_request::<serde_json::Value>(&state, reqwest::Method::GET, "secrets", None, None).await {
        Ok(secrets) => Ok(Json(secrets)),
        Err(status) => Err(status),
    }
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct CreateSecretRequest {
    pub name: String,
    pub scope_type: String,
    pub scope_id: Option<Uuid>,
    pub value: String,
}

pub async fn create_secret(
    State(state): State<AppState>,
    Json(req): Json<CreateSecretRequest>
) -> Result<Json<serde_json::Value>, StatusCode> {
    let body = serde_json::to_value(&req).map_err(|_| StatusCode::BAD_REQUEST)?;
    match make_authenticated_request::<serde_json::Value>(&state, reqwest::Method::POST, "secrets", Some(&body), None).await {
        Ok(result) => Ok(Json(result)),
        Err(status) => Err(status),
    }
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct UpdateSecretRequest {
    pub value: String,
}

pub async fn update_secret(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateSecretRequest>
) -> Result<Json<serde_json::Value>, StatusCode> {
    let body = serde_json::to_value(&req).map_err(|_| StatusCode::BAD_REQUEST)?;
    match make_authenticated_request::<serde_json::Value>(&state, reqwest::Method::PUT, &format!("secrets/{}", id), Some(&body), None).await {
        Ok(result) => Ok(Json(result)),
        Err(status) => Err(status),
    }
}

pub async fn delete_secret(
    State(state): State<AppState>,
    Path(id): Path<Uuid>
) -> Result<Json<serde_json::Value>, StatusCode> {
    match make_authenticated_request::<serde_json::Value>(&state, reqwest::Method::DELETE, &format!("secrets/{}", id), None, None).await {
        Ok(result) => Ok(Json(result)),
        Err(status) => Err(status),
    }
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct DecryptSecretRequest {
    pub reason: Option<String>,
}

pub async fn decrypt_secret(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<DecryptSecretRequest>
) -> Result<Json<serde_json::Value>, StatusCode> {
    let body = serde_json::to_value(&req).map_err(|_| StatusCode::BAD_REQUEST)?;
    match make_authenticated_request::<serde_json::Value>(&state, reqwest::Method::POST, &format!("secrets/{}/decrypt", id), Some(&body), None).await {
        Ok(result) => Ok(Json(result)),
        Err(status) => Err(status),
    }
}
