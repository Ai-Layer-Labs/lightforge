use crate::models::{TokenRequest, TokenResponse};
use anyhow::Result;
use uuid::Uuid;

pub async fn get_jwt_token(
    client: &reqwest::Client,
    base_url: &str,
    owner_id: Uuid,
    agent_id: Uuid,
) -> Result<String> {
    let token_req = TokenRequest {
        owner_id: owner_id.to_string(),
        agent_id: agent_id.to_string(),
        roles: Some(vec!["curator".to_string(), "emitter".to_string(), "subscriber".to_string()]),
        ttl_sec: Some(3600), // 1 hour
    };

    let response = client
        .post(&format!("{}/auth/token", base_url))
        .json(&token_req)
        .send()
        .await?;

    if response.status().is_success() {
        let token_response: TokenResponse = response.json().await?;
        Ok(token_response.token)
    } else {
        anyhow::bail!("Token request failed with status: {}", response.status())
    }
}
