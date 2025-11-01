/*!
 * Graph data structures
 */

use chrono::{DateTime, Utc};
use pgvector::Vector;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct BreadcrumbNode {
    pub id: Uuid,
    pub schema_name: String,
    pub tags: Vec<String>,
    pub context: serde_json::Value,
    pub embedding: Option<Vector>,
    pub created_at: DateTime<Utc>,
    pub trigger_event_id: Option<Uuid>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EdgeType {
    /// Causal relationship (trigger_event_id)
    Causal,
    /// Temporal (close in time)
    Temporal,
    /// Tag-based relationship
    TagRelated,
    /// Semantic similarity
    Semantic,
}

#[derive(Debug, Clone)]
pub struct Edge {
    pub from: Uuid,
    pub to: Uuid,
    pub edge_type: EdgeType,
    pub weight: f32,
}

#[derive(Clone)]
pub struct SessionGraph {
    pub session_id: String,
    pub nodes: HashMap<Uuid, BreadcrumbNode>,
    pub edges: Vec<Edge>,
    pub last_updated: DateTime<Utc>,
    
    /// Adjacency list for fast graph traversal
    pub adjacency: HashMap<Uuid, Vec<(Uuid, EdgeType, f32)>>,
}

impl SessionGraph {
    pub fn new(session_id: String) -> Self {
        SessionGraph {
            session_id,
            nodes: HashMap::new(),
            edges: Vec::new(),
            last_updated: Utc::now(),
            adjacency: HashMap::new(),
        }
    }
    
    pub fn add_node(&mut self, node: BreadcrumbNode) {
        self.nodes.insert(node.id, node);
        self.rebuild_adjacency();
        self.last_updated = Utc::now();
    }
    
    pub fn add_edge(&mut self, edge: Edge) {
        self.edges.push(edge);
        self.rebuild_adjacency();
        self.last_updated = Utc::now();
    }
    
    fn rebuild_adjacency(&mut self) {
        self.adjacency.clear();
        
        for edge in &self.edges {
            self.adjacency
                .entry(edge.from)
                .or_insert_with(Vec::new)
                .push((edge.to, edge.edge_type, edge.weight));
        }
    }
    
    /// Get all neighbors of a node
    pub fn neighbors(&self, node_id: Uuid) -> Vec<(Uuid, EdgeType, f32)> {
        self.adjacency
            .get(&node_id)
            .cloned()
            .unwrap_or_default()
    }
    
    /// Get causal chain (follow trigger_event_id backwards)
    pub fn causal_chain(&self, node_id: Uuid, max_depth: usize) -> Vec<Uuid> {
        let mut chain = Vec::new();
        let mut current = node_id;
        
        for _ in 0..max_depth {
            if let Some(node) = self.nodes.get(&current) {
                chain.push(current);
                
                if let Some(trigger_id) = node.trigger_event_id {
                    if self.nodes.contains_key(&trigger_id) {
                        current = trigger_id;
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        
        chain
    }
    
    /// Estimate memory usage in bytes
    pub fn estimate_memory_usage(&self) -> usize {
        let nodes_size = self.nodes.len() * std::mem::size_of::<BreadcrumbNode>();
        let edges_size = self.edges.len() * std::mem::size_of::<Edge>();
        let adjacency_size = self.adjacency.len() * 100; // Rough estimate
        
        nodes_size + edges_size + adjacency_size
    }
}

