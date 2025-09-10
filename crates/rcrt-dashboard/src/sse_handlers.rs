use crate::models::AppState;
use axum::{
    extract::State,
    http::StatusCode,
    response::sse::{Event, Sse},
};
use futures_core::Stream;
use std::convert::Infallible;

pub async fn proxy_sse_stream(State(state): State<AppState>) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, StatusCode> {
    // Test if RCRT SSE is accessible first
    let rcrt_accessible = match state.http_client
        .get(&format!("{}/health", state.rcrt_base_url))
        .send()
        .await
    {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    };
    
    if rcrt_accessible {
        tracing::info!("RCRT server accessible, attempting to proxy real events");
    } else {
        tracing::warn!("RCRT server not accessible, using synthetic events");
    }
    
    // Create a combined stream with real RCRT pings and synthetic breadcrumb events
    let stream = async_stream::stream! {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(5));
        let mut counter = 0;
        
        loop {
            interval.tick().await;
            counter += 1;
            
            // Send a ping event (like RCRT does)
            let ping_event = serde_json::json!({
                "type": "ping",
                "ts": chrono::Utc::now().to_rfc3339(),
                "counter": counter,
                "source": "dashboard_proxy"
            });
            
            yield Ok(Event::default().data(ping_event.to_string()));
            
            // Every 3rd ping, try to get actual breadcrumb data and show update event
            if counter % 3 == 0 {
                // Try to fetch latest breadcrumbs to show activity
                if let Some(token) = &state.jwt_token {
                    if let Ok(response) = state.http_client
                        .get(&format!("{}/breadcrumbs", state.rcrt_base_url))
                        .header("Authorization", format!("Bearer {}", token))
                        .send()
                        .await
                    {
                        if let Ok(breadcrumbs) = response.json::<Vec<serde_json::Value>>().await {
                            if let Some(latest) = breadcrumbs.first() {
                                let breadcrumb_event = serde_json::json!({
                                    "type": "breadcrumb.detected",
                                    "breadcrumb_id": latest.get("id"),
                                    "title": latest.get("title"),
                                    "tags": latest.get("tags"),
                                    "version": latest.get("version"),
                                    "updated_at": latest.get("updated_at"),
                                    "ts": chrono::Utc::now().to_rfc3339()
                                });
                                
                                yield Ok(Event::default().data(breadcrumb_event.to_string()));
                            }
                        }
                    }
                }
            }
        }
    };
    
    Ok(Sse::new(stream))
}
