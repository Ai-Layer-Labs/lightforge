/*!
 * RCRT API Client
 * 
 * Handles:
 * - JWT authentication
 * - SSE event stream
 * - Breadcrumb CRUD operations
 */

use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::{info, error, warn};
use uuid::Uuid;
use futures::stream::StreamExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreadcrumbEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub breadcrumb_id: Option<Uuid>,
    pub schema_name: Option<String>,
    pub tags: Option<Vec<String>>,
    pub context: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Breadcrumb {
    pub id: Uuid,
    pub schema_name: String,
    pub title: Option<String>,
    pub tags: Vec<String>,
    pub context: serde_json::Value,
    pub version: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

// BreadcrumbContextView - returned from GET /breadcrumbs/{id} with llm_hints applied
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreadcrumbContextView {
    pub id: Uuid,
    pub title: String,
    pub context: serde_json::Value,
    pub tags: Vec<String>,
    pub schema_name: Option<String>,
    pub version: i32,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

// Lightweight breadcrumb from list endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreadcrumbListItem {
    pub id: Uuid,
    pub schema_name: String,
    pub title: Option<String>,
    pub tags: Vec<String>,
    pub version: i32,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct TokenRequest {
    pub owner_id: String,
    pub agent_id: String,
    pub roles: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    token: String,
}

#[derive(Debug, Deserialize)]
struct CreateResponse {
    id: Uuid,
}

#[derive(Debug, Deserialize)]
struct OkResponse {
    ok: bool,
}

pub struct RcrtClient {
    base_url: String,
    http_client: reqwest::Client,
    token: Arc<RwLock<String>>,
    owner_id: String,
    agent_id: String,
}

impl RcrtClient {
    pub async fn new(base_url: &str, owner_id: &str, agent_id: &str) -> Result<Self> {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()?;
        
        let client = RcrtClient {
            base_url: base_url.to_string(),
            http_client,
            token: Arc::new(RwLock::new(String::new())),
            owner_id: owner_id.to_string(),
            agent_id: agent_id.to_string(),
        };
        
        // Get initial token
        client.refresh_token().await?;
        
        Ok(client)
    }
    
    async fn refresh_token(&self) -> Result<()> {
        let request = TokenRequest {
            owner_id: self.owner_id.clone(),
            agent_id: self.agent_id.clone(),
            roles: vec!["curator".to_string(), "emitter".to_string(), "subscriber".to_string()],
        };
        
        let url = format!("{}/auth/token", self.base_url);
        info!("🔐 Requesting JWT token from {}", url);
        info!("🔐 Request payload: {:?}", request);
        
        let response = self.http_client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .context("Failed to request token")?;
        
        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_else(|_| "Unable to read response body".to_string());
            error!("❌ Token request failed: {} - {}", status, body);
            anyhow::bail!("Token request failed: {} - {}", status, body);
        }
        
        let token_response: TokenResponse = response.json().await?;
        *self.token.write().await = token_response.token;
        
        info!("🔐 JWT token refreshed successfully");
        Ok(())
    }
    
    pub async fn start_sse_stream(
        &self,
        tx: mpsc::UnboundedSender<BreadcrumbEvent>,
    ) -> Result<()> {
        let base_url = self.base_url.clone();
        let token = self.token.read().await.clone();
        
        tokio::spawn(async move {
            loop {
                match Self::sse_connection_loop(&base_url, &token, tx.clone()).await {
                    Ok(_) => {
                        warn!("SSE stream ended, reconnecting...");
                    }
                    Err(e) => {
                        error!("SSE connection error: {}, reconnecting in 5s...", e);
                        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                    }
                }
            }
        });
        
        Ok(())
    }
    
    async fn sse_connection_loop(
        base_url: &str,
        token: &str,
        tx: mpsc::UnboundedSender<BreadcrumbEvent>,
    ) -> Result<()> {
        let url = format!("{}/events/stream", base_url);
        let response = reqwest::Client::new()
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept", "text/event-stream")
            .header("Cache-Control", "no-cache")
            .send()
            .await?;
        
        if !response.status().is_success() {
            anyhow::bail!("SSE connection failed: {}", response.status());
        }
        
        info!("✅ SSE stream connected");
        
        let mut stream = response.bytes_stream();
        let mut buffer = String::new();
        
        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result?;
            let text = String::from_utf8_lossy(&chunk);
            buffer.push_str(&text);
            
            // Process complete lines
            while let Some(newline_pos) = buffer.find('\n') {
                let line = buffer[..newline_pos].trim().to_string();
                buffer = buffer[newline_pos + 1..].to_string();
                
                if line.starts_with("data: ") {
                    let data = &line[6..];
                    
                    if let Ok(event) = serde_json::from_str::<BreadcrumbEvent>(data) {
                        if event.event_type != "ping" {
                            if tx.send(event).is_err() {
                                warn!("Event receiver dropped");
                                return Ok(());
                            }
                        }
                    }
                }
            }
        }
        
        Ok(())
    }
    
    pub async fn search_breadcrumbs(
        &self,
        schema_name: &str,
        tags: Option<Vec<String>>,
    ) -> Result<Vec<BreadcrumbListItem>> {
        let token = self.token.read().await.clone();
        
        // API only supports single tag parameter, so we'll use the first one
        // and filter the rest client-side
        let url = if let Some(tag_list) = &tags {
            if let Some(first_tag) = tag_list.first() {
                format!("{}/breadcrumbs?tag={}", self.base_url, first_tag)
            } else {
                format!("{}/breadcrumbs", self.base_url)
            }
        } else {
            format!("{}/breadcrumbs", self.base_url)
        };
        
        let response = self.http_client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await?;
        
        let status = response.status();
        
        // Handle 404 as empty result (no breadcrumbs found)
        if status == reqwest::StatusCode::NOT_FOUND {
            return Ok(vec![]);
        }
        
        if !status.is_success() {
            let body = response.text().await.unwrap_or_else(|_| "Unable to read response".to_string());
            error!("❌ Search failed: {} - {}", status, body);
            anyhow::bail!("Search failed: {} - {}", status, body);
        }
        
        let all_breadcrumbs: Vec<BreadcrumbListItem> = response.json().await?;
        
        // Filter by schema_name and remaining tags client-side
        let filtered: Vec<BreadcrumbListItem> = all_breadcrumbs
            .into_iter()
            .filter(|b| {
                // Must match schema
                if b.schema_name != schema_name {
                    return false;
                }
                
                // If tags were specified, breadcrumb must have ALL of them
                if let Some(required_tags) = &tags {
                    for req_tag in required_tags {
                        if !b.tags.contains(req_tag) {
                            return false;
                        }
                    }
                }
                
                true
            })
            .collect();
        
        Ok(filtered)
    }
    
    /// Get breadcrumb with llm_hints applied (returns BreadcrumbContextView)
    pub async fn get_breadcrumb(&self, id: Uuid) -> Result<BreadcrumbContextView> {
        let token = self.token.read().await.clone();
        let url = format!("{}/breadcrumbs/{}", self.base_url, id);
        
        let response = self.http_client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await?;
        
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Get breadcrumb failed: {} - {}", status, body);
        }
        
        let breadcrumb = response.json::<BreadcrumbContextView>().await
            .context("Failed to deserialize BreadcrumbContextView")?;
        Ok(breadcrumb)
    }
    
    pub async fn create_breadcrumb(
        &self,
        schema_name: &str,
        title: &str,
        tags: Vec<String>,
        context: serde_json::Value,
    ) -> Result<Uuid> {
        let token = self.token.read().await.clone();
        let url = format!("{}/breadcrumbs", self.base_url);
        
        let payload = serde_json::json!({
            "schema_name": schema_name,
            "title": title,
            "tags": tags,
            "context": context,
        });
        
        info!("📤 Creating breadcrumb: POST {}", url);
        info!("📤 Schema: {}, Title: {}, Tags: {:?}", schema_name, title, tags);
        
        let response = self.http_client
            .post(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await?;
        
        let status = response.status();
        
        if !status.is_success() {
            let body = response.text().await.unwrap_or_else(|_| "Unable to read response".to_string());
            error!("❌ Create breadcrumb failed: {} - {}", status, body);
            error!("❌ Payload was: {}", serde_json::to_string_pretty(&payload)?);
            anyhow::bail!("Create breadcrumb failed: {} - {}", status, body);
        }
        
        let create_response: CreateResponse = response.json().await?;
        info!("✅ Breadcrumb created successfully: {}", create_response.id);
        Ok(create_response.id)
    }
    
    pub async fn update_breadcrumb(
        &self,
        id: Uuid,
        version: i32,
        context: serde_json::Value,
    ) -> Result<()> {
        let token = self.token.read().await.clone();
        let url = format!("{}/breadcrumbs/{}", self.base_url, id);
        
        let payload = serde_json::json!({
            "context": context,
        });
        
        info!("🔄 Updating breadcrumb: PATCH {}", url);
        
        let response = self.http_client
            .patch(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("If-Match", version.to_string())
            .json(&payload)
            .send()
            .await?;
        
        let status = response.status();
        
        if !status.is_success() {
            let body = response.text().await.unwrap_or_else(|_| "Unable to read response".to_string());
            error!("❌ Update breadcrumb failed: {} - {}", status, body);
            anyhow::bail!("Update breadcrumb failed: {} - {}", status, body);
        }
        
        let _ok_response: OkResponse = response.json().await?;
        info!("✅ Breadcrumb updated successfully");
        Ok(())
    }
}

