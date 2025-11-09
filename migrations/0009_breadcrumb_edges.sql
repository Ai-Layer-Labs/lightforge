-- Migration: Add breadcrumb_edges table for graph-based context retrieval
-- Purpose: Store relationships between breadcrumbs (causal, temporal, tag-based, semantic)
-- Part of: GNN Context System implementation

CREATE TABLE IF NOT EXISTS breadcrumb_edges (
    from_id UUID NOT NULL REFERENCES breadcrumbs(id) ON DELETE CASCADE,
    to_id UUID NOT NULL REFERENCES breadcrumbs(id) ON DELETE CASCADE,
    edge_type SMALLINT NOT NULL,  -- 0=causal, 1=temporal, 2=tag, 3=semantic
    weight REAL NOT NULL DEFAULT 1.0,
    time_delta_sec INTEGER,       -- For temporal edges (time difference in seconds)
    shared_tag_count SMALLINT,    -- For tag edges (number of shared tags)
    similarity REAL,              -- For semantic edges (cosine similarity score)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (from_id, to_id),
    
    -- Validate edge type
    CONSTRAINT valid_edge_type CHECK (edge_type IN (0, 1, 2, 3)),
    
    -- Validate weight range
    CONSTRAINT valid_weight CHECK (weight >= 0.0 AND weight <= 1.0)
);

-- Indexes for fast graph traversal
CREATE INDEX idx_edges_from ON breadcrumb_edges(from_id, edge_type);
CREATE INDEX idx_edges_to ON breadcrumb_edges(to_id, edge_type);
CREATE INDEX idx_edges_weight ON breadcrumb_edges(weight) WHERE weight > 0.8;
CREATE INDEX idx_edges_bidirectional ON breadcrumb_edges(from_id, to_id);

-- Index for finding high-quality edges
CREATE INDEX idx_edges_quality ON breadcrumb_edges(edge_type, weight DESC) WHERE weight > 0.7;

-- Comments for documentation
COMMENT ON TABLE breadcrumb_edges IS 'Graph edges between breadcrumbs for GNN-based context retrieval';
COMMENT ON COLUMN breadcrumb_edges.edge_type IS '0=causal (trigger_event_id), 1=temporal (time proximity), 2=tag (shared tags), 3=semantic (vector similarity)';
COMMENT ON COLUMN breadcrumb_edges.weight IS 'Edge weight/strength from 0.0 to 1.0, used by GNN attention mechanism';
COMMENT ON COLUMN breadcrumb_edges.time_delta_sec IS 'Time difference in seconds (for temporal edges)';
COMMENT ON COLUMN breadcrumb_edges.shared_tag_count IS 'Number of shared tags (for tag-based edges)';
COMMENT ON COLUMN breadcrumb_edges.similarity IS 'Cosine similarity score (for semantic edges)';

