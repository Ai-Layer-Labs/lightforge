-- Add TTL Enhancement Columns
-- Supports: never, datetime, duration, usage, and hybrid TTL policies

-- Add TTL type column
ALTER TABLE breadcrumbs ADD COLUMN IF NOT EXISTS ttl_type VARCHAR(20) DEFAULT 'datetime';
-- Values: 'never', 'datetime', 'duration', 'usage', 'hybrid'

-- Add TTL config (for duration specs, max_reads, etc)
ALTER TABLE breadcrumbs ADD COLUMN IF NOT EXISTS ttl_config JSONB;

-- Add read tracking for usage-based TTL
ALTER TABLE breadcrumbs ADD COLUMN IF NOT EXISTS read_count INTEGER DEFAULT 0;

-- Track where TTL came from (for debugging)
ALTER TABLE breadcrumbs ADD COLUMN IF NOT EXISTS ttl_source VARCHAR(50) DEFAULT 'manual';
-- Values: 'manual', 'schema-default', 'auto-applied', 'explicit', 'migrated'

-- Backfill existing data
UPDATE breadcrumbs 
SET ttl_type = CASE 
    WHEN ttl IS NOT NULL THEN 'datetime'
    ELSE 'never'
END,
ttl_source = 'migrated',
read_count = 0
WHERE ttl_type IS NULL OR ttl_source IS NULL OR read_count IS NULL;

-- Create indexes for hygiene queries
CREATE INDEX IF NOT EXISTS idx_breadcrumbs_ttl_type ON breadcrumbs(ttl_type) WHERE ttl_type != 'never';
CREATE INDEX IF NOT EXISTS idx_breadcrumbs_read_count ON breadcrumbs(read_count) WHERE ttl_type IN ('usage', 'hybrid');
CREATE INDEX IF NOT EXISTS idx_breadcrumbs_ttl_expiry ON breadcrumbs(ttl) WHERE ttl IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN breadcrumbs.ttl_type IS 'Type of TTL: never, datetime, duration, usage, or hybrid';
COMMENT ON COLUMN breadcrumbs.ttl_config IS 'Configuration for TTL (duration spec, max_reads, hybrid policies, etc)';
COMMENT ON COLUMN breadcrumbs.read_count IS 'Number of times this breadcrumb has been read (for usage-based TTL)';
COMMENT ON COLUMN breadcrumbs.ttl_source IS 'Source of TTL: manual, schema-default, auto-applied, explicit, or migrated';

