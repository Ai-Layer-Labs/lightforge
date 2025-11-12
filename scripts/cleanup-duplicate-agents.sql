-- Cleanup Duplicate Agent Definitions
-- Run this inside the PostgreSQL container:
-- docker compose exec db psql -U rcrt -d rcrt -f /path/to/this/file.sql

-- First, let's see what duplicates we have
SELECT 
  context->>'agent_id' as agent_id,
  title,
  COUNT(*) as count,
  array_agg(id ORDER BY updated_at DESC) as ids,
  array_agg(updated_at ORDER BY updated_at DESC) as timestamps
FROM breadcrumbs
WHERE schema_name = 'agent.def.v1'
GROUP BY context->>'agent_id', title
HAVING COUNT(*) > 1;

-- If you see duplicates, copy the query results and then run:
-- DELETE FROM breadcrumbs WHERE id IN ('old-id-1', 'old-id-2', ...);
-- Keep the FIRST id from each group (most recent), delete the rest

-- Example cleanup (uncomment and replace IDs after checking above):
-- DELETE FROM breadcrumbs 
-- WHERE id IN (
--   'uuid-of-old-duplicate-1',
--   'uuid-of-old-duplicate-2'
-- );

-- Verify cleanup worked:
SELECT 
  context->>'agent_id' as agent_id,
  title,
  COUNT(*) as count
FROM breadcrumbs
WHERE schema_name = 'agent.def.v1'
GROUP BY context->>'agent_id', title
HAVING COUNT(*) > 1;
-- Should return 0 rows

-- Also check for any agents without proper tags:
SELECT 
  id,
  title,
  context->>'agent_id' as agent_id,
  tags
FROM breadcrumbs
WHERE schema_name = 'agent.def.v1'
  AND NOT (tags @> ARRAY['workspace:agents']);
-- All agents should have workspace:agents tag

