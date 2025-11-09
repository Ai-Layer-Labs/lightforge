/*!
 * Graph Loader
 * 
 * Loads breadcrumb graphs from PostgreSQL using recursive queries
 */

use crate::{
    graph::{BreadcrumbNode, EdgeFeatures},
    vector_store::BreadcrumbRow,
};
use anyhow::Result;
use petgraph::graph::{Graph, NodeIndex};
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;
use tracing::info;

pub struct LoadedGraph {
    pub graph: Graph<BreadcrumbNode, EdgeFeatures>,
    pub node_map: HashMap<Uuid, NodeIndex>,
    pub trigger_idx: NodeIndex,
}

/// Load a subgraph centered around a trigger breadcrumb
/// Uses recursive SQL to find all connected nodes within radius hops
pub async fn load_graph_around_trigger(
    trigger_id: Uuid,
    radius: usize,
    db_pool: &PgPool,
) -> Result<LoadedGraph> {
    info!("📊 Loading graph around trigger {} (radius: {})", trigger_id, radius);
    
    // Step 1: Get all nodes within radius hops using recursive CTE
    let nodes = sqlx::query_as::<_, BreadcrumbRow>(
        "WITH RECURSIVE graph_walk AS (
             -- Start from trigger node
             SELECT id, 0 as depth
             FROM breadcrumbs
             WHERE id = $1
             
             UNION
             
             -- Follow edges in both directions
             SELECT DISTINCT
                 CASE 
                     WHEN e.from_id = gw.id THEN e.to_id
                     ELSE e.from_id
                 END as id,
                 gw.depth + 1 as depth
             FROM graph_walk gw
             JOIN breadcrumb_edges e ON (e.from_id = gw.id OR e.to_id = gw.id)
             WHERE gw.depth < $2
         )
         SELECT DISTINCT 
             b.id,
             b.schema_name,
             b.title,
             b.tags,
             b.context,
             b.embedding,
             b.entities,
             b.entity_keywords,
             b.created_at,
             b.updated_at
         FROM graph_walk gw
         JOIN breadcrumbs b ON b.id = gw.id"
    )
    .bind(trigger_id)
    .bind(radius as i32)
    .fetch_all(db_pool).await?;
    
    info!("  ✓ Loaded {} nodes", nodes.len());
    
    // Step 2: Fetch edges between these nodes
    let node_ids: Vec<Uuid> = nodes.iter().map(|n| n.id).collect();
    
    let edges = sqlx::query_as::<_, (Uuid, Uuid, i16, f32, Option<i32>, Option<i16>, Option<f32>)>(
        "SELECT 
             from_id,
             to_id,
             edge_type,
             weight,
             time_delta_sec,
             shared_tag_count,
             similarity
         FROM breadcrumb_edges
         WHERE from_id = ANY($1) AND to_id = ANY($1)"
    )
    .bind(&node_ids)
    .fetch_all(db_pool).await?;
    
    info!("  ✓ Loaded {} edges", edges.len());
    
    // Step 3: Build petgraph structure
    let mut graph = Graph::new();
    let mut node_map = HashMap::new();
    
    // Add all nodes
    for node_row in nodes {
        let node = breadcrumb_row_to_node(node_row);
        let idx = graph.add_node(node.clone());
        node_map.insert(node.id, idx);
    }
    
    // Add all edges
    for (from_id, to_id, edge_type, weight, time_delta_sec, shared_tag_count, similarity) in edges {
        if let (Some(&src_idx), Some(&dst_idx)) = (
            node_map.get(&from_id),
            node_map.get(&to_id),
        ) {
            let edge_features = EdgeFeatures {
                edge_type,
                weight,
                time_delta_sec,
                shared_tag_count,
                similarity,
            };
            
            graph.add_edge(src_idx, dst_idx, edge_features);
        }
    }
    
    let trigger_idx = *node_map.get(&trigger_id)
        .ok_or_else(|| anyhow::anyhow!("Trigger node not found in graph"))?;
    
    info!("✅ Graph loaded: {} nodes, {} edges", 
        graph.node_count(), graph.edge_count());
    
    Ok(LoadedGraph {
        graph,
        node_map,
        trigger_idx,
    })
}

/// Convert BreadcrumbRow to BreadcrumbNode
fn breadcrumb_row_to_node(row: BreadcrumbRow) -> BreadcrumbNode {
    let trigger_event_id = row.context
        .get("trigger_event_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    
    BreadcrumbNode {
        id: row.id,
        schema_name: row.schema_name,
        tags: row.tags,
        context: row.context,
        embedding: row.embedding,
        created_at: row.created_at,
        trigger_event_id,
    }
}

