use crate::models::{TokenRequest, TokenResponse};
use anyhow::Result;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use tokio::time::{sleep, timeout};
use uuid::Uuid;

#[derive(Clone)]
pub struct AuthManager {
    client: reqwest::Client,
    base_url: String,
    owner_id: Uuid,
    agent_id: Uuid,
    token_info: Arc<RwLock<Option<TokenInfo>>>,
}

#[derive(Clone, Debug)]
struct TokenInfo {
    token: String,
    expires_at: u64,
}

impl AuthManager {
    pub fn new(
        client: reqwest::Client,
        base_url: String,
        owner_id: Uuid,
        agent_id: Uuid,
    ) -> Self {
        Self {
            client,
            base_url,
            owner_id,
            agent_id,
            token_info: Arc::new(RwLock::new(None)),
        }
    }

    /// Check if RCRT service is healthy and responding
    pub async fn check_service_health(&self) -> bool {
        match timeout(Duration::from_secs(5), self.client.get(&format!("{}/health", self.base_url)).send()).await {
            Ok(Ok(response)) => response.status().is_success(),
            _ => false,
        }
    }

    /// Get current valid JWT token, acquiring/renewing if needed
    pub async fn get_valid_token(&self) -> Option<String> {
        // Check if we have a valid token
        {
            let token_info = self.token_info.read().await;
            if let Some(info) = &*token_info {
                let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
                // Renew if token expires in less than 5 minutes
                if info.expires_at > now + 300 {
                    return Some(info.token.clone());
                }
            }
        }

        // Need to acquire/renew token
        self.acquire_token_with_retry().await
    }

    /// Acquire JWT token with exponential backoff retry
    pub async fn acquire_token_with_retry(&self) -> Option<String> {
        let max_retries = 10;
        let mut retry_count = 0;
        let mut delay = Duration::from_millis(500);

        while retry_count < max_retries {
            // First check if service is healthy
            if !self.check_service_health().await {
                tracing::warn!(
                    "RCRT service health check failed (attempt {}/{}), retrying in {:?}",
                    retry_count + 1,
                    max_retries,
                    delay
                );
                sleep(delay).await;
                delay = std::cmp::min(delay * 2, Duration::from_secs(30));
                retry_count += 1;
                continue;
            }

            // Service is healthy, try to get token
            match self.request_jwt_token().await {
                Ok(token_response) => {
                    let token_info = TokenInfo {
                        token: token_response.token.clone(),
                        expires_at: token_response.exp as u64,
                    };
                    
                    {
                        let mut token_guard = self.token_info.write().await;
                        *token_guard = Some(token_info);
                    }
                    
                    tracing::info!("Successfully acquired JWT token (attempt {})", retry_count + 1);
                    return Some(token_response.token);
                }
                Err(e) => {
                    tracing::warn!(
                        "Failed to acquire JWT token (attempt {}/{}): {}, retrying in {:?}",
                        retry_count + 1,
                        max_retries,
                        e,
                        delay
                    );
                    sleep(delay).await;
                    delay = std::cmp::min(delay * 2, Duration::from_secs(30));
                    retry_count += 1;
                }
            }
        }

        tracing::error!("Failed to acquire JWT token after {} attempts", max_retries);
        None
    }

    /// Make the actual JWT token request
    async fn request_jwt_token(&self) -> Result<TokenResponse> {
        let token_req = TokenRequest {
            owner_id: self.owner_id.to_string(),
            agent_id: self.agent_id.to_string(),
            roles: Some(vec!["curator".to_string(), "emitter".to_string(), "subscriber".to_string()]),
            ttl_sec: Some(3600), // 1 hour
        };

        let response = timeout(
            Duration::from_secs(10),
            self.client
                .post(&format!("{}/auth/token", self.base_url))
                .json(&token_req)
                .send()
        ).await??;

        if response.status().is_success() {
            let token_response: TokenResponse = response.json().await?;
            Ok(token_response)
        } else {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Token request failed with status {}: {}", status, body)
        }
    }

    /// Start background token renewal task
    pub fn start_token_renewal_task(&self) {
        let auth_manager = self.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(300)); // Check every 5 minutes
            loop {
                interval.tick().await;
                
                let should_renew = {
                    let token_info = auth_manager.token_info.read().await;
                    if let Some(info) = &*token_info {
                        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
                        // Renew if token expires in less than 10 minutes
                        info.expires_at <= now + 600
                    } else {
                        true // No token, try to get one
                    }
                };

                if should_renew {
                    tracing::info!("Background JWT token renewal triggered");
                    if let Some(_token) = auth_manager.acquire_token_with_retry().await {
                        tracing::info!("Background JWT token renewal successful");
                    } else {
                        tracing::warn!("Background JWT token renewal failed");
                    }
                }
            }
        });
    }
}

// Legacy function for backward compatibility
pub async fn get_jwt_token(
    client: &reqwest::Client,
    base_url: &str,
    owner_id: Uuid,
    agent_id: Uuid,
) -> Result<String> {
    let auth_manager = AuthManager::new(client.clone(), base_url.to_string(), owner_id, agent_id);
    match auth_manager.acquire_token_with_retry().await {
        Some(token) => Ok(token),
        None => anyhow::bail!("Failed to acquire JWT token after retries")
    }
}
