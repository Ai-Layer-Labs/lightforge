/*!
 * LRU cache for session graphs
 */

use super::types::SessionGraph;
use lru::LruCache;
use std::num::NonZeroUsize;
use std::sync::RwLock;
use tracing::info;

pub struct SessionGraphCache {
    cache: RwLock<LruCache<String, SessionGraph>>,
    max_memory_mb: usize,
}

impl SessionGraphCache {
    pub fn new(max_memory_mb: usize) -> Self {
        // Estimate ~10MB per session graph
        let capacity = (max_memory_mb / 10).max(10);
        
        info!("📊 Session graph cache capacity: {} sessions (~{}MB)", capacity, max_memory_mb);
        
        SessionGraphCache {
            cache: RwLock::new(LruCache::new(NonZeroUsize::new(capacity).unwrap())),
            max_memory_mb,
        }
    }
    
    pub fn get(&self, session_id: &str) -> Option<SessionGraph> {
        let mut cache = self.cache.write().unwrap();
        cache.get(session_id).cloned()
    }
    
    pub fn put(&self, session_id: String, graph: SessionGraph) {
        let mut cache = self.cache.write().unwrap();
        
        // Check memory usage
        let graph_size_mb = graph.estimate_memory_usage() / (1024 * 1024);
        if graph_size_mb > self.max_memory_mb / 10 {
            tracing::warn!(
                "Session graph {} is very large ({}MB), skipping cache",
                session_id,
                graph_size_mb
            );
            return;
        }
        
        cache.put(session_id, graph);
    }
    
    pub fn remove(&self, session_id: &str) {
        let mut cache = self.cache.write().unwrap();
        cache.pop(session_id);
    }
    
    pub fn clear(&self) {
        let mut cache = self.cache.write().unwrap();
        cache.clear();
    }
    
    pub fn len(&self) -> usize {
        let cache = self.cache.read().unwrap();
        cache.len()
    }
    
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

