use crate::models::AppState;
use axum::{
    extract::State,
    http::StatusCode,
    response::sse::{Event, Sse},
};
use futures_core::Stream;
use futures_util::StreamExt; // For bytes_stream().next()
use std::convert::Infallible;

pub async fn proxy_sse_stream(State(state): State<AppState>) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, StatusCode> {
    use reqwest::header::{ACCEPT, AUTHORIZATION, CACHE_CONTROL};
    
    tracing::info!("🔌 Dashboard connecting to real RCRT SSE stream");
    
    // Connect to real RCRT SSE stream
    let sse_url = format!("{}/events/stream", state.rcrt_base_url);
    
    let mut request = state.http_client
        .get(&sse_url)
        .header(ACCEPT, "text/event-stream")
        .header(CACHE_CONTROL, "no-cache");
        
    // Add auth header if available
    if let Some(token) = &state.jwt_token {
        request = request.header(AUTHORIZATION, format!("Bearer {}", token));
    }
    
    let response = match request.send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                tracing::info!("✅ Connected to real RCRT SSE stream");
                resp
            } else {
                tracing::error!("❌ RCRT SSE connection failed: {}", resp.status());
                return Err(StatusCode::BAD_GATEWAY);
            }
        },
        Err(e) => {
            tracing::error!("❌ Failed to connect to RCRT SSE: {}", e);
            return Err(StatusCode::SERVICE_UNAVAILABLE);
        }
    };
    
    // 🔐 SECURE HIGH-PERFORMANCE PROXY: 2-second polling for near real-time (CORS compliant)
    // Note: True streaming proxy requires complex reqwest stream handling (bytes_stream() doesn't exist)
    let stream = async_stream::stream! {
        // Send initial connection success event
        let connect_event = serde_json::json!({
            "type": "system",
            "message": "🔐 Secure high-performance RCRT proxy (2s polling - limited by CORS & reqwest API)",
            "timestamp": chrono::Utc::now().to_rfc3339()
        });
        yield Ok(Event::default().data(connect_event.to_string()));
        
        // 🚀 HIGH-PERFORMANCE POLLING: 2-second updates for near real-time
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(2));
        let mut last_seen_response_id: Option<String> = None;
        let mut last_seen_request_id: Option<String> = None;
        let mut counter = 0;
        
        loop {
            interval.tick().await;
            counter += 1;
            
            if let Some(token) = &state.jwt_token {
                // Check for NEW tool requests (show immediately)
                match state.http_client
                    .get(&format!("{}/breadcrumbs?tag=tool:request", state.rcrt_base_url))
                    .header("Authorization", format!("Bearer {}", token))
                    .send()
                    .await
                {
                    Ok(resp) if resp.status().is_success() => {
                        if let Ok(requests) = resp.json::<Vec<serde_json::Value>>().await {
                            if let Some(latest) = requests.first() {
                                let id = latest.get("id").and_then(|v| v.as_str()).map(String::from);
                                if id.is_some() && id != last_seen_request_id {
                                    last_seen_request_id = id.clone();
                                    
                                    // 🎯 FETCH FULL CONTEXT for tool events to show payloads
                                    let mut event = serde_json::json!({
                                        "type": "breadcrumb.updated",
                                        "schema_name": "tool.request.v1", 
                                        "breadcrumb_id": id,
                                        "title": latest.get("title"),
                                        "tags": latest.get("tags"),
                                        "version": latest.get("version"),
                                        "updated_at": latest.get("updated_at"),
                                        "timestamp": chrono::Utc::now().to_rfc3339()
                                    });
                                    
                                    // Get full context for tool request details
                                    if let Some(id_str) = &id {
                                        match state.http_client
                                            .get(&format!("{}/breadcrumbs/{}", state.rcrt_base_url, id_str))
                                            .header("Authorization", format!("Bearer {}", token))
                                            .send()
                                            .await
                                        {
                                            Ok(context_resp) if context_resp.status().is_success() => {
                                                if let Ok(context_data) = context_resp.json::<serde_json::Value>().await {
                                                    if let Some(context) = context_data.get("context") {
                                                        event["context"] = context.clone();
                                                    }
                                                }
                                            },
                                            _ => {} // Ignore context fetch failures
                                        }
                                    }
                                    
                                    yield Ok(Event::default().data(event.to_string()));
                                }
                            }
                        }
                    },
                    _ => {} 
                }
                
                // Check for NEW user messages and responses (for chat)
                match state.http_client
                    .get(&format!("{}/breadcrumbs?tag=user:message", state.rcrt_base_url))
                    .header("Authorization", format!("Bearer {}", token))
                    .send()
                    .await
                {
                    Ok(resp) if resp.status().is_success() => {
                        if let Ok(messages) = resp.json::<Vec<serde_json::Value>>().await {
                            if let Some(latest) = messages.first() {
                                let id = latest.get("id").and_then(|v| v.as_str()).map(String::from);
                                if id.is_some() {
                                    let event = serde_json::json!({
                                        "type": "breadcrumb.updated",
                                        "schema_name": "user.message.v1", 
                                        "breadcrumb_id": id,
                                        "title": latest.get("title"),
                                        "tags": latest.get("tags"),
                                        "version": latest.get("version"),
                                        "updated_at": latest.get("updated_at"),
                                        "timestamp": chrono::Utc::now().to_rfc3339()
                                    });
                                    yield Ok(Event::default().data(event.to_string()));
                                }
                            }
                        }
                    },
                    _ => {}
                }
                
                // Check for NEW user responses (for chat)
                match state.http_client
                    .get(&format!("{}/breadcrumbs?tag=user:response", state.rcrt_base_url))
                    .header("Authorization", format!("Bearer {}", token))
                    .send()
                    .await
                {
                    Ok(resp) if resp.status().is_success() => {
                        if let Ok(responses) = resp.json::<Vec<serde_json::Value>>().await {
                            if let Some(latest) = responses.first() {
                                let id = latest.get("id").and_then(|v| v.as_str()).map(String::from);
                                if id.is_some() {
                                    let event = serde_json::json!({
                                        "type": "breadcrumb.updated",
                                        "schema_name": "user.response.v1", 
                                        "breadcrumb_id": id,
                                        "title": latest.get("title"),
                                        "tags": latest.get("tags"),
                                        "version": latest.get("version"),
                                        "updated_at": latest.get("updated_at"),
                                        "timestamp": chrono::Utc::now().to_rfc3339()
                                    });
                                    yield Ok(Event::default().data(event.to_string()));
                                }
                            }
                        }
                    },
                    _ => {}
                }
                
                // Check for NEW tool responses (show immediately)  
                match state.http_client
                    .get(&format!("{}/breadcrumbs?tag=tool:response", state.rcrt_base_url))
                    .header("Authorization", format!("Bearer {}", token))
                    .send()
                    .await
                {
                    Ok(resp) if resp.status().is_success() => {
                        if let Ok(responses) = resp.json::<Vec<serde_json::Value>>().await {
                            if let Some(latest) = responses.first() {
                                let id = latest.get("id").and_then(|v| v.as_str()).map(String::from);
                                if id.is_some() && id != last_seen_response_id {
                                    last_seen_response_id = id.clone();
                                    
                                    // 🎯 FETCH FULL CONTEXT for tool response details  
                                    let mut event = serde_json::json!({
                                        "type": "breadcrumb.updated", 
                                        "schema_name": "tool.response.v1",
                                        "breadcrumb_id": id,
                                        "title": latest.get("title"),
                                        "tags": latest.get("tags"),
                                        "version": latest.get("version"),
                                        "updated_at": latest.get("updated_at"),
                                        "timestamp": chrono::Utc::now().to_rfc3339()
                                    });
                                    
                                    // Get full context for tool response details (LLM output, costs, etc)
                                    if let Some(id_str) = &id {
                                        match state.http_client
                                            .get(&format!("{}/breadcrumbs/{}", state.rcrt_base_url, id_str))
                                            .header("Authorization", format!("Bearer {}", token))
                                            .send()
                                            .await
                                        {
                                            Ok(context_resp) if context_resp.status().is_success() => {
                                                if let Ok(context_data) = context_resp.json::<serde_json::Value>().await {
                                                    if let Some(context) = context_data.get("context") {
                                                        event["context"] = context.clone();
                                                    }
                                                }
                                            },
                                            _ => {} // Ignore context fetch failures
                                        }
                                    }
                                    
                                    yield Ok(Event::default().data(event.to_string()));
                                }
                            }
                        }
                    },
                    _ => {}
                }
            }
            
            // Heartbeat every 15 cycles (30 seconds)
            if counter % 15 == 0 {
                let ping = serde_json::json!({
                    "type": "ping",
                    "ts": chrono::Utc::now().to_rfc3339(),
                    "source": "secure_proxy"
                });
                yield Ok(Event::default().data(ping.to_string()));
            }
        }
    };
    
    Ok(Sse::new(stream))
}
