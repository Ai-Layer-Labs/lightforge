/*!
 * Path-based context retrieval
 * 
 * Constrained shortest paths algorithm for finding relevant breadcrumbs
 */

use crate::graph::{SessionGraph, EdgeType};
use std::collections::{BinaryHeap, HashSet};
use std::cmp::Ordering;
use uuid::Uuid;

#[derive(Debug, Clone)]
struct PathNode {
    id: Uuid,
    cost: f32,
    depth: usize,
}

impl Eq for PathNode {}

impl PartialEq for PathNode {
    fn eq(&self, other: &Self) -> bool {
        self.cost == other.cost
    }
}

impl Ord for PathNode {
    fn cmp(&self, other: &Self) -> Ordering {
        // Reverse for min-heap
        other.cost.partial_cmp(&self.cost).unwrap_or(Ordering::Equal)
    }
}

impl PartialOrd for PathNode {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

pub struct PathFinder {
    max_depth: usize,
    max_results: usize,
}

impl PathFinder {
    pub fn new(max_depth: usize, max_results: usize) -> Self {
        PathFinder {
            max_depth,
            max_results,
        }
    }
    
    /// Find relevant breadcrumbs using Dijkstra-style shortest paths
    pub fn find_paths(
        &self,
        graph: &SessionGraph,
        seed_nodes: Vec<Uuid>,
    ) -> Vec<Uuid> {
        let mut visited = HashSet::new();
        let mut heap = BinaryHeap::new();
        let mut results = Vec::new();
        
        // Initialize with seed nodes
        for seed_id in seed_nodes {
            heap.push(PathNode {
                id: seed_id,
                cost: 0.0,
                depth: 0,
            });
        }
        
        // Dijkstra-style exploration
        while let Some(PathNode { id, cost, depth }) = heap.pop() {
            if visited.contains(&id) {
                continue;
            }
            
            visited.insert(id);
            results.push(id);
            
            // Stop if we have enough results
            if results.len() >= self.max_results {
                break;
            }
            
            // Stop if we've reached max depth
            if depth >= self.max_depth {
                continue;
            }
            
            // Explore neighbors
            for (neighbor_id, edge_type, weight) in graph.neighbors(id) {
                if !visited.contains(&neighbor_id) {
                    // Calculate new cost (lower is better)
                    let edge_cost = match edge_type {
                        EdgeType::Causal => 0.1,     // Lowest cost (highest priority)
                        EdgeType::Temporal => 0.3,
                        EdgeType::TagRelated => 0.5,
                        EdgeType::Semantic => 1.0 - weight, // Use similarity as inverse cost
                    };
                    
                    heap.push(PathNode {
                        id: neighbor_id,
                        cost: cost + edge_cost,
                        depth: depth + 1,
                    });
                }
            }
        }
        
        results
    }
    
    /// Find paths with token budget awareness
    /// Stops when accumulated context exceeds target_tokens
    pub fn find_paths_token_aware(
        &self,
        graph: &SessionGraph,
        seed_nodes: Vec<Uuid>,
        target_tokens: usize,
    ) -> Vec<Uuid> {
        let mut visited = HashSet::new();
        let mut heap = BinaryHeap::new();
        let mut results = Vec::new();
        let mut token_count = 0;
        
        // Initialize with seed nodes
        for seed_id in seed_nodes {
            heap.push(PathNode {
                id: seed_id,
                cost: 0.0,
                depth: 0,
            });
        }
        
        // Dijkstra-style exploration with token awareness
        while let Some(PathNode { id, cost, depth }) = heap.pop() {
            if visited.contains(&id) {
                continue;
            }
            
            visited.insert(id);
            
            // Estimate tokens for this node
            if let Some(node) = graph.nodes.get(&id) {
                let node_tokens = estimate_node_tokens(node);
                
                // Check if adding this node would exceed budget
                if token_count + node_tokens > target_tokens && !results.is_empty() {
                    tracing::info!("⏹️  Token budget reached: {} + {} > {}", 
                        token_count, node_tokens, target_tokens);
                    break;
                }
                
                token_count += node_tokens;
                results.push(id);
                
                tracing::debug!("  ✓ Added node {} ({} tokens, total: {})", 
                    id, node_tokens, token_count);
            }
            
            // Stop if max results
            if results.len() >= self.max_results {
                break;
            }
            
            // Stop if max depth
            if depth >= self.max_depth {
                continue;
            }
            
            // Explore neighbors
            for (neighbor_id, edge_type, weight) in graph.neighbors(id) {
                if !visited.contains(&neighbor_id) {
                    let edge_cost = match edge_type {
                        EdgeType::Causal => 0.1,
                        EdgeType::TagRelated => 0.3,
                        EdgeType::Temporal => 0.5,
                        EdgeType::Semantic => 1.0 - weight,
                    };
                    
                    heap.push(PathNode {
                        id: neighbor_id,
                        cost: cost + edge_cost,
                        depth: depth + 1,
                    });
                }
            }
        }
        
        tracing::info!("✅ Path finding: {} nodes, ~{} tokens", results.len(), token_count);
        
        results
    }
    
    /// Get causal chains for all seed nodes
    pub fn get_causal_chains(
        &self,
        graph: &SessionGraph,
        seed_nodes: Vec<Uuid>,
    ) -> Vec<Uuid> {
        let mut all_nodes = HashSet::new();
        
        for seed_id in seed_nodes {
            let chain = graph.causal_chain(seed_id, self.max_depth);
            all_nodes.extend(chain);
        }
        
        all_nodes.into_iter().collect()
    }
}

/// Estimate token count for a breadcrumb node
/// Rough estimate: context size / 3 (average 3 chars per token)
fn estimate_node_tokens(node: &crate::graph::BreadcrumbNode) -> usize {
    node.context.to_string().len() / 3
}

