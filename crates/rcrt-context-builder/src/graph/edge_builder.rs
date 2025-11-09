/*!
 * Edge Builder
 * 
 * Computes relationships between breadcrumbs and stores them as graph edges
 */

use crate::vector_store::{VectorStore, BreadcrumbRow};
use anyhow::Result;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;
use tracing::info;

#[derive(Debug, Clone)]
pub struct EdgeFeatures {
    pub edge_type: i16,       // 0=causal, 1=temporal, 2=tag, 3=semantic
    pub weight: f32,
    pub time_delta_sec: Option<i32>,
    pub shared_tag_count: Option<i16>,
    pub similarity: Option<f32>,
}

impl Default for EdgeFeatures {
    fn default() -> Self {
        EdgeFeatures {
            edge_type: 0,
            weight: 1.0,
            time_delta_sec: None,
            shared_tag_count: None,
            similarity: None,
        }
    }
}

pub struct EdgeBuilder {
    db_pool: PgPool,
    vector_store: Arc<VectorStore>,
}

impl EdgeBuilder {
    pub fn new(db_pool: PgPool, vector_store: Arc<VectorStore>) -> Self {
        EdgeBuilder {
            db_pool,
            vector_store,
        }
    }
    
    /// Build all types of edges for a newly created breadcrumb
    pub async fn build_edges_for_breadcrumb(&self, bc_id: Uuid) -> Result<()> {
        // Fetch the breadcrumb
        let bc = self.vector_store.get_by_id(bc_id).await?
            .ok_or_else(|| anyhow::anyhow!("Breadcrumb {} not found", bc_id))?;
        
        let mut all_edges = Vec::new();
        
        // 1. Build causal edges
        if let Some(causal_edges) = self.build_causal_edges(&bc).await? {
            all_edges.extend(causal_edges);
        }
        
        // 2. Build session tag edges
        let tag_edges = self.build_tag_edges(&bc).await?;
        all_edges.extend(tag_edges);
        
        // 3. Build temporal edges
        let temporal_edges = self.build_temporal_edges(&bc).await?;
        all_edges.extend(temporal_edges);
        
        // 4. Build semantic edges
        let semantic_edges = self.build_semantic_edges(&bc).await?;
        all_edges.extend(semantic_edges);
        
        // Bulk insert all edges
        if !all_edges.is_empty() {
            let edge_count = all_edges.len();
            self.insert_edges(bc_id, all_edges).await?;
            info!("✅ Built {} edges for breadcrumb {}", edge_count, bc_id);
        }
        
        Ok(())
    }
    
    /// Build causal edges (trigger_event_id links)
    async fn build_causal_edges(&self, bc: &BreadcrumbRow) -> Result<Option<Vec<(Uuid, EdgeFeatures)>>> {
        // Extract trigger_event_id from context
        let trigger_id = bc.context
            .get("trigger_event_id")
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok());
        
        if let Some(trigger) = trigger_id {
            info!("  📎 Causal edge: {} → {}", trigger, bc.id);
            
            Ok(Some(vec![(trigger, EdgeFeatures {
                edge_type: 0,  // Causal
                weight: 0.95,
                ..Default::default()
            })]))
        } else {
            Ok(None)
        }
    }
    
    /// Build tag-based edges (shared tags, especially session)
    async fn build_tag_edges(&self, bc: &BreadcrumbRow) -> Result<Vec<(Uuid, EdgeFeatures)>> {
        let mut edges = Vec::new();
        
        // Extract session tags (highest priority)
        let session_tags: Vec<String> = bc.tags.iter()
            .filter(|t| t.starts_with("session:"))
            .cloned()
            .collect();
        
        if !session_tags.is_empty() {
            // Find all breadcrumbs in same session
            let session_breadcrumbs = sqlx::query_as::<_, (Uuid, Vec<String>)>(
                "SELECT id, tags
                 FROM breadcrumbs
                 WHERE tags && $1::text[]
                   AND id != $2
                 ORDER BY created_at DESC
                 LIMIT 100"
            )
            .bind(&session_tags)
            .bind(bc.id)
            .fetch_all(&self.db_pool).await?;
            
            info!("  🏷️  Found {} breadcrumbs in same session", session_breadcrumbs.len());
            
            for (other_id, other_tags) in session_breadcrumbs {
                let shared = count_shared_tags(&bc.tags, &other_tags);
                
                edges.push((other_id, EdgeFeatures {
                    edge_type: 2,  // Tag
                    weight: 0.9,   // High weight for session tags
                    shared_tag_count: Some(shared),
                    ..Default::default()
                }));
            }
        }
        
        // Also find breadcrumbs with other shared tags (lower weight)
        let other_tags: Vec<String> = bc.tags.iter()
            .filter(|t| !t.starts_with("session:") && !t.starts_with("system:"))
            .cloned()
            .collect();
        
        if !other_tags.is_empty() && session_tags.is_empty() {
            let tag_breadcrumbs = sqlx::query_as::<_, (Uuid, Vec<String>)>(
                "SELECT id, tags
                 FROM breadcrumbs
                 WHERE tags && $1::text[]
                   AND id != $2
                 ORDER BY created_at DESC
                 LIMIT 20"
            )
            .bind(&other_tags)
            .bind(bc.id)
            .fetch_all(&self.db_pool).await?;
            
            for (other_id, other_tags) in tag_breadcrumbs {
                let shared = count_shared_tags(&bc.tags, &other_tags);
                let weight = (shared as f32) / (bc.tags.len() as f32).max(1.0);
                
                edges.push((other_id, EdgeFeatures {
                    edge_type: 2,  // Tag
                    weight: weight.min(0.8),  // Cap at 0.8 for non-session tags
                    shared_tag_count: Some(shared),
                    ..Default::default()
                }));
            }
        }
        
        Ok(edges)
    }
    
    /// Build temporal edges (time proximity)
    async fn build_temporal_edges(&self, bc: &BreadcrumbRow) -> Result<Vec<(Uuid, EdgeFeatures)>> {
        use chrono::{DateTime, Utc};
        
        // Find breadcrumbs within 5 minutes
        let temporal_breadcrumbs = sqlx::query_as::<_, (Uuid, DateTime<Utc>)>(
            "SELECT id, created_at
             FROM breadcrumbs
             WHERE created_at BETWEEN $1 - INTERVAL '5 minutes' 
                                  AND $1 + INTERVAL '5 minutes'
               AND id != $2
             ORDER BY ABS(EXTRACT(EPOCH FROM (created_at - $1)))
             LIMIT 50"
        )
        .bind(bc.created_at)
        .bind(bc.id)
        .fetch_all(&self.db_pool).await?;
        
        info!("  ⏱️  Found {} temporally close breadcrumbs", temporal_breadcrumbs.len());
        
        let mut edges = Vec::new();
        for (other_id, other_created_at) in temporal_breadcrumbs {
            let delta_sec = (bc.created_at.timestamp() - other_created_at.timestamp()).abs();
            let weight = 1.0 - (delta_sec as f32 / 300.0);  // Decay over 5 minutes
            
            edges.push((other_id, EdgeFeatures {
                edge_type: 1,  // Temporal
                weight: weight.max(0.0),
                time_delta_sec: Some(delta_sec as i32),
                ..Default::default()
            }));
        }
        
        Ok(edges)
    }
    
    /// Build semantic edges (vector similarity)
    async fn build_semantic_edges(&self, bc: &BreadcrumbRow) -> Result<Vec<(Uuid, EdgeFeatures)>> {
        let Some(ref embedding) = bc.embedding else {
            return Ok(Vec::new());
        };
        
        // Find top 20 most similar breadcrumbs  
        let similar = sqlx::query_as::<_, (Uuid, f32)>(
            "SELECT id, 
                    (1.0 / (1.0 + (embedding <=> $1)))::real as similarity
             FROM breadcrumbs
             WHERE embedding IS NOT NULL
               AND id != $2
             ORDER BY embedding <=> $1
             LIMIT 20"
        )
        .bind(embedding)
        .bind(bc.id)
        .fetch_all(&self.db_pool).await?;
        
        let mut edges = Vec::new();
        let mut high_quality_count = 0;
        
        for (other_id, similarity) in similar {
            // Only create edges for similarity > 0.8
            if similarity > 0.8 {
                high_quality_count += 1;
                edges.push((other_id, EdgeFeatures {
                    edge_type: 3,  // Semantic
                    weight: similarity,
                    similarity: Some(similarity),
                    ..Default::default()
                }));
            }
        }
        
        if high_quality_count > 0 {
            info!("  🔗 Found {} high-similarity edges (> 0.8)", high_quality_count);
        }
        
        Ok(edges)
    }
    
    /// Bulk insert edges into database
    async fn insert_edges(&self, from_id: Uuid, edges: Vec<(Uuid, EdgeFeatures)>) -> Result<()> {
        for (to_id, features) in edges {
            sqlx::query(
                "INSERT INTO breadcrumb_edges (
                     from_id, to_id, edge_type, weight,
                     time_delta_sec, shared_tag_count, similarity
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (from_id, to_id) DO UPDATE
                 SET weight = EXCLUDED.weight,
                     time_delta_sec = EXCLUDED.time_delta_sec,
                     shared_tag_count = EXCLUDED.shared_tag_count,
                     similarity = EXCLUDED.similarity"
            )
            .bind(from_id)
            .bind(to_id)
            .bind(features.edge_type)
            .bind(features.weight)
            .bind(features.time_delta_sec)
            .bind(features.shared_tag_count)
            .bind(features.similarity)
            .execute(&self.db_pool).await?;
        }
        
        Ok(())
    }
}

/// Count shared tags between two tag vectors
fn count_shared_tags(tags1: &[String], tags2: &[String]) -> i16 {
    tags1.iter()
        .filter(|t| tags2.contains(t))
        .count() as i16
}

