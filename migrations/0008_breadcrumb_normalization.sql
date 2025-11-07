-- Migration: Breadcrumb Structure Normalization
-- Purpose: Move common fields (description, version, llm_hints) to top-level
-- Impact: BREAKING CHANGE - Old structure (context.llm_hints, etc.) NO LONGER SUPPORTED
-- Version: 2.1.0
-- Date: 2025-11-07

-- Add new columns (all nullable for backward compatibility)
ALTER TABLE breadcrumbs
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS semantic_version TEXT,
  ADD COLUMN IF NOT EXISTS llm_hints JSONB;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_breadcrumbs_description_tsvector 
  ON breadcrumbs USING gin(to_tsvector('english', COALESCE(description, '')));

CREATE INDEX IF NOT EXISTS idx_breadcrumbs_semantic_version 
  ON breadcrumbs (semantic_version) 
  WHERE semantic_version IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_breadcrumbs_llm_hints 
  ON breadcrumbs USING gin(llm_hints) 
  WHERE llm_hints IS NOT NULL;

-- Add column comments for documentation
COMMENT ON COLUMN breadcrumbs.description IS 'Detailed description of breadcrumb (moved from context.description for easier queries)';
COMMENT ON COLUMN breadcrumbs.semantic_version IS 'Semantic version (e.g., 2.0.0) - moved from context.version/context.schema_version for consistency';
COMMENT ON COLUMN breadcrumbs.llm_hints IS 'Instance-level LLM optimization hints (overrides schema defaults) - moved from context.llm_hints to be first-class';

-- BREAKING CHANGE: No backward compatibility
-- The system supports ONLY:
--   1. breadcrumb.llm_hints (instance level)
--   2. schema.def.v1.llm_hints (schema defaults)
--   NO SUPPORT for context.llm_hints, context.version, context.description

-- Old breadcrumbs need migration: Run scripts/migrate-breadcrumb-structure.js
-- This moves context.* fields to top-level for all bootstrap files
-- Production breadcrumbs require manual migration or recreation

