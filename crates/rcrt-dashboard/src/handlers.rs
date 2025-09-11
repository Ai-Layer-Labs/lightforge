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
    match &state.jwt_token {
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

pub async fn get_breadcrumbs(State(state): State<AppState>) -> Result<Json<Vec<Breadcrumb>>, StatusCode> {
    let mut request = state.http_client
        .get(&format!("{}/breadcrumbs", state.rcrt_base_url));
    
    if let Some(token) = &state.jwt_token {
        request = request.header("Authorization", format!("Bearer {}", token));
    }
    
    match request.send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<Vec<Breadcrumb>>().await {
                    Ok(breadcrumbs) => Ok(Json(breadcrumbs)),
                    Err(e) => {
                        tracing::error!("Failed to parse breadcrumbs JSON: {}", e);
                        Err(StatusCode::INTERNAL_SERVER_ERROR)
                    }
                }
            } else {
                tracing::error!("RCRT API returned status: {}", response.status());
                Err(StatusCode::BAD_GATEWAY)
            }
        },
        Err(e) => {
            tracing::error!("Failed to fetch breadcrumbs: {}", e);
            Err(StatusCode::SERVICE_UNAVAILABLE)
        }
    }
}

pub async fn get_breadcrumb_context(
    State(state): State<AppState>, 
    Path(id): Path<Uuid>
) -> Result<Json<BreadcrumbContext>, StatusCode> {
    let mut request = state.http_client
        .get(&format!("{}/breadcrumbs/{}", state.rcrt_base_url, id));
    
    if let Some(token) = &state.jwt_token {
        request = request.header("Authorization", format!("Bearer {}", token));
    }
    
    match request.send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<BreadcrumbContext>().await {
                    Ok(context) => Ok(Json(context)),
                    Err(e) => {
                        tracing::error!("Failed to parse breadcrumb context JSON: {}", e);
                        Err(StatusCode::INTERNAL_SERVER_ERROR)
                    }
                }
            } else {
                tracing::error!("RCRT API returned status: {}", response.status());
                Err(StatusCode::BAD_GATEWAY)
            }
        },
        Err(e) => {
            tracing::error!("Failed to fetch breadcrumb context: {}", e);
            Err(StatusCode::SERVICE_UNAVAILABLE)
        }
    }
}

pub async fn create_breadcrumb(
    State(state): State<AppState>,
    Json(req): Json<CreateBreadcrumbRequest>
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut request = state.http_client
        .post(&format!("{}/breadcrumbs", state.rcrt_base_url))
        .json(&req);
    
    if let Some(token) = &state.jwt_token {
        request = request.header("Authorization", format!("Bearer {}", token));
    }
    
    match request.send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(result) => Ok(Json(result)),
                    Err(e) => {
                        tracing::error!("Failed to parse create response JSON: {}", e);
                        Err(StatusCode::INTERNAL_SERVER_ERROR)
                    }
                }
            } else {
                tracing::error!("RCRT API returned status: {}", response.status());
                Err(StatusCode::BAD_GATEWAY)
            }
        },
        Err(e) => {
            tracing::error!("Failed to create breadcrumb: {}", e);
            Err(StatusCode::SERVICE_UNAVAILABLE)
        }
    }
}

pub async fn update_breadcrumb(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Json(req): Json<UpdateBreadcrumbRequest>
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut request = state.http_client
        .patch(&format!("{}/breadcrumbs/{}", state.rcrt_base_url, id))
        .json(&req);
    
    if let Some(token) = &state.jwt_token {
        request = request.header("Authorization", format!("Bearer {}", token));
    }
    
    // Forward If-Match header for optimistic concurrency
    if let Some(if_match) = headers.get("if-match") {
        request = request.header("If-Match", if_match);
    }
    
    match request.send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(result) => Ok(Json(result)),
                    Err(e) => {
                        tracing::error!("Failed to parse update response JSON: {}", e);
                        Err(StatusCode::INTERNAL_SERVER_ERROR)
                    }
                }
            } else {
                tracing::error!("RCRT API returned status: {}", response.status());
                Err(StatusCode::BAD_GATEWAY)
            }
        },
        Err(e) => {
            tracing::error!("Failed to update breadcrumb: {}", e);
            Err(StatusCode::SERVICE_UNAVAILABLE)
        }
    }
}

pub async fn delete_breadcrumb(
    State(state): State<AppState>,
    Path(id): Path<Uuid>
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut request = state.http_client
        .delete(&format!("{}/breadcrumbs/{}", state.rcrt_base_url, id));
    
    if let Some(token) = &state.jwt_token {
        request = request.header("Authorization", format!("Bearer {}", token));
    }
    
    match request.send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(result) => Ok(Json(result)),
                    Err(e) => {
                        tracing::error!("Failed to parse delete response JSON: {}", e);
                        Err(StatusCode::INTERNAL_SERVER_ERROR)
                    }
                }
            } else {
                tracing::error!("RCRT API returned status: {}", response.status());
                Err(StatusCode::BAD_GATEWAY)
            }
        },
        Err(e) => {
            tracing::error!("Failed to delete breadcrumb: {}", e);
            Err(StatusCode::SERVICE_UNAVAILABLE)
        }
    }
}
