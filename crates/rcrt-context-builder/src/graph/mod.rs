/*!
 * Graph Module
 * 
 * Session-local breadcrumb graphs for fast context retrieval
 */

mod types;
mod cache;
mod edge_builder;
mod builder_service;
mod loader;
mod cache_updater;

pub use types::{BreadcrumbNode, EdgeType, SessionGraph, Edge};
pub use cache::SessionGraphCache;
pub use edge_builder::{EdgeBuilder, EdgeFeatures};
pub use builder_service::EdgeBuilderService;
pub use loader::{LoadedGraph, load_graph_around_trigger};
pub use cache_updater::GraphCacheUpdater;

