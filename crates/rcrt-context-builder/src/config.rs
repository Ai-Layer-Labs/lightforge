/*!
 * Configuration management for Context Builder service
 */

use anyhow::Result;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    /// RCRT API base URL
    pub rcrt_api_url: String,
    
    /// PostgreSQL connection string
    pub database_url: String,
    
    /// Owner ID for authentication
    pub owner_id: String,
    
    /// Agent ID for this service
    pub agent_id: String,
    
    /// Maximum database connections
    #[serde(default = "default_max_db_connections")]
    pub max_db_connections: u32,
    
    /// Cache size in megabytes
    #[serde(default = "default_cache_size_mb")]
    pub cache_size_mb: usize,
    
    /// Maximum sessions to cache
    #[serde(default = "default_max_sessions")]
    pub max_sessions: usize,
}

fn default_max_db_connections() -> u32 {
    10
}

fn default_cache_size_mb() -> usize {
    1024 // 1GB
}

fn default_max_sessions() -> usize {
    100
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();
        
        let config = Config {
            rcrt_api_url: std::env::var("RCRT_API_URL")
                .unwrap_or_else(|_| "http://localhost:8080".to_string()),
            database_url: std::env::var("DATABASE_URL")
                .expect("DATABASE_URL must be set"),
            owner_id: std::env::var("OWNER_ID")
                .unwrap_or_else(|_| "00000000-0000-0000-0000-000000000001".to_string()),
            agent_id: std::env::var("AGENT_ID")
                .unwrap_or_else(|_| "context-builder-service".to_string()),
            max_db_connections: std::env::var("MAX_DB_CONNECTIONS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or_else(default_max_db_connections),
            cache_size_mb: std::env::var("CACHE_SIZE_MB")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or_else(default_cache_size_mb),
            max_sessions: std::env::var("MAX_SESSIONS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or_else(default_max_sessions),
        };
        
        Ok(config)
    }
}

