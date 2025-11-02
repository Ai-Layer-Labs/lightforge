/*!
 * Vector Store
 * 
 * Direct PostgreSQL/pgvector queries for semantic search
 */

use anyhow::Result;
use pgvector::Vector;
use sqlx::PgPool;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, sqlx::FromRow)]
pub struct BreadcrumbRow {
    pub id: Uuid,
    pub schema_name: String,
    pub title: Option<String>,
    pub tags: Vec<String>,
    pub context: serde_json::Value,
    pub embedding: Option<Vector>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct VectorStore {
    pool: PgPool,
}

impl VectorStore {
    pub fn new(pool: PgPool) -> Self {
        VectorStore { pool }
    }
    
    /// Find similar breadcrumbs using pgvector cosine similarity
    pub async fn find_similar(
        &self,
        query_embedding: &Vector,
        limit: usize,
        session_filter: Option<&str>,
    ) -> Result<Vec<BreadcrumbRow>> {
        let query = if let Some(session) = session_filter {
            sqlx::query_as::<_, BreadcrumbRow>(
                r#"
                SELECT id, schema_name, title, tags, context, embedding, created_at, updated_at
                FROM breadcrumbs
                WHERE embedding IS NOT NULL
                  AND $2 = ANY(tags)
                ORDER BY embedding <=> $1
                LIMIT $3
                "#
            )
            .bind(query_embedding)
            .bind(session)
            .bind(limit as i64)
        } else {
            sqlx::query_as::<_, BreadcrumbRow>(
                r#"
                SELECT id, schema_name, title, tags, context, embedding, created_at, updated_at
                FROM breadcrumbs
                WHERE embedding IS NOT NULL
                ORDER BY embedding <=> $1
                LIMIT $2
                "#
            )
            .bind(query_embedding)
            .bind(limit as i64)
        };
        
        let results = query.fetch_all(&self.pool).await?;
        Ok(results)
    }
    
    /// Get recent breadcrumbs (by created_at)
    /// THE RCRT WAY: Blacklist system internals, not whitelist schemas
    pub async fn get_recent(
        &self,
        schema_name: Option<&str>,
        session_filter: Option<&str>,
        limit: usize,
    ) -> Result<Vec<BreadcrumbRow>> {
        // System schemas to exclude (blacklist approach)
        // Future: Make this configurable via context.config.v1
        let blacklist = vec![
            "system.health.v1",
            "system.metric.v1",
            "tool.config.v1",        // Tool settings, not context
            "secret.v1",             // Never include secrets
            "system.startup.v1",     // System events, not conversational
        ];
        
        let query = match (schema_name, session_filter) {
            (Some(schema), Some(session)) => {
                sqlx::query_as::<_, BreadcrumbRow>(
                    r#"
                    SELECT id, schema_name, title, tags, context, embedding, created_at, updated_at
                    FROM breadcrumbs
                    WHERE schema_name = $1
                      AND $2 = ANY(tags)
                    ORDER BY created_at DESC
                    LIMIT $3
                    "#
                )
                .bind(schema)
                .bind(session)
                .bind(limit as i64)
            }
            (Some(schema), None) => {
                sqlx::query_as::<_, BreadcrumbRow>(
                    r#"
                    SELECT id, schema_name, title, tags, context, embedding, created_at, updated_at
                    FROM breadcrumbs
                    WHERE schema_name = $1
                    ORDER BY created_at DESC
                    LIMIT $2
                    "#
                )
                .bind(schema)
                .bind(limit as i64)
            }
            (None, Some(session)) => {
                // THE RCRT WAY: Get everything, exclude system internals
                sqlx::query_as::<_, BreadcrumbRow>(
                    r#"
                    SELECT id, schema_name, title, tags, context, embedding, created_at, updated_at
                    FROM breadcrumbs
                    WHERE $1 = ANY(tags)
                      AND schema_name NOT IN ('system.health.v1', 'system.metric.v1', 'tool.config.v1', 'secret.v1', 'system.startup.v1')
                    ORDER BY created_at DESC
                    LIMIT $2
                    "#
                )
                .bind(session)
                .bind(limit as i64)
            }
            (None, None) => {
                sqlx::query_as::<_, BreadcrumbRow>(
                    r#"
                    SELECT id, schema_name, title, tags, context, embedding, created_at, updated_at
                    FROM breadcrumbs
                    WHERE schema_name NOT IN ('system.health.v1', 'system.metric.v1', 'tool.config.v1', 'secret.v1', 'system.startup.v1')
                    ORDER BY created_at DESC
                    LIMIT $1
                    "#
                )
                .bind(limit as i64)
            }
        };
        
        let results = query.fetch_all(&self.pool).await?;
        Ok(results)
    }
    
    /// Get latest breadcrumb of a schema
    pub async fn get_latest(
        &self,
        schema_name: &str,
        session_filter: Option<&str>,
    ) -> Result<Option<BreadcrumbRow>> {
        let query = if let Some(session) = session_filter {
            sqlx::query_as::<_, BreadcrumbRow>(
                r#"
                SELECT id, schema_name, title, tags, context, embedding, created_at, updated_at
                FROM breadcrumbs
                WHERE schema_name = $1
                  AND $2 = ANY(tags)
                ORDER BY created_at DESC
                LIMIT 1
                "#
            )
            .bind(schema_name)
            .bind(session)
        } else {
            sqlx::query_as::<_, BreadcrumbRow>(
                r#"
                SELECT id, schema_name, title, tags, context, embedding, created_at, updated_at
                FROM breadcrumbs
                WHERE schema_name = $1
                ORDER BY created_at DESC
                LIMIT 1
                "#
            )
            .bind(schema_name)
        };
        
        let result = query.fetch_optional(&self.pool).await?;
        Ok(result)
    }
    
    /// Get breadcrumbs by tag
    pub async fn get_by_tag(
        &self,
        tag: &str,
        limit: usize,
    ) -> Result<Vec<BreadcrumbRow>> {
        let results = sqlx::query_as::<_, BreadcrumbRow>(
            r#"
            SELECT id, schema_name, title, tags, context, embedding, created_at, updated_at
            FROM breadcrumbs
            WHERE $1 = ANY(tags)
            ORDER BY created_at DESC
            LIMIT $2
            "#
        )
        .bind(tag)
        .bind(limit as i64)
        .fetch_all(&self.pool)
        .await?;
        
        Ok(results)
    }
    
    /// Get breadcrumb by ID
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<BreadcrumbRow>> {
        let result = sqlx::query_as::<_, BreadcrumbRow>(
            r#"
            SELECT id, schema_name, title, tags, context, embedding, created_at, updated_at
            FROM breadcrumbs
            WHERE id = $1
            "#
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;
        
        Ok(result)
    }
}

