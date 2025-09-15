use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize)]
pub struct Breadcrumb {
    pub id: Uuid,
    pub title: String,
    pub tags: Vec<String>,
    pub version: i32,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize)]
pub struct BreadcrumbContext {
    pub id: Uuid,
    pub title: String,
    pub context: serde_json::Value,
    pub tags: Vec<String>,
    pub version: i32,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize)]
pub struct TokenRequest {
    pub owner_id: String,
    pub agent_id: String,
    pub roles: Option<Vec<String>>,
    pub ttl_sec: Option<i64>,
}

#[derive(Deserialize)]
pub struct TokenResponse {
    pub token: String,
    #[allow(dead_code)] // Used for deserialization but not actively accessed
    pub owner_id: String,
    #[allow(dead_code)] // Used for deserialization but not actively accessed
    pub agent_id: String,
    #[allow(dead_code)] // Used for deserialization but not actively accessed
    pub roles: Vec<String>,
    #[allow(dead_code)] // Used for deserialization but not actively accessed
    pub exp: i64,
}

#[derive(Serialize, Deserialize)]
pub struct CreateBreadcrumbRequest {
    pub title: String,
    pub context: serde_json::Value,
    pub tags: Vec<String>,
    pub schema_name: Option<String>,
    pub visibility: Option<String>,
    pub sensitivity: Option<String>,
    pub ttl: Option<DateTime<Utc>>,
}

#[derive(Serialize, Deserialize)]
pub struct UpdateBreadcrumbRequest {
    pub title: Option<String>,
    pub context: Option<serde_json::Value>,
    pub tags: Option<Vec<String>>,
    pub schema_name: Option<String>,
    pub visibility: Option<String>,
    pub sensitivity: Option<String>,
    pub ttl: Option<DateTime<Utc>>,
}

use crate::auth::AuthManager;

#[derive(Clone)]
pub struct AppState {
    pub http_client: reqwest::Client,
    pub rcrt_base_url: String,
    #[allow(dead_code)] // May be used by future features
    pub owner_id: Uuid,
    #[allow(dead_code)] // May be used by future features  
    pub agent_id: Uuid,
    pub jwt_token: Option<String>,
    pub auth_manager: AuthManager,
}
