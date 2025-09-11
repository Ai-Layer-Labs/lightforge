-- Manual cleanup script for health check breadcrumbs
-- These should be cleaned up automatically by hygiene system, but this is a temporary fix

-- Remove health check breadcrumbs older than 5 minutes
DELETE FROM breadcrumbs 
WHERE schema_name = 'tool.request.v1' 
AND tags @> ARRAY['health:check'] 
AND created_at < NOW() - INTERVAL '5 minutes';

-- Remove other temporary breadcrumbs that should expire quickly  
DELETE FROM breadcrumbs
WHERE schema_name = 'system.ping.v1'
AND created_at < NOW() - INTERVAL '10 minutes';

-- Remove old tool response logs (keep only last 24 hours)
DELETE FROM breadcrumbs
WHERE schema_name IN ('tool.response.v1', 'tool.error.v1')
AND tags @> ARRAY['log:execution']
AND created_at < NOW() - INTERVAL '24 hours';

-- Show cleanup results
SELECT 
  'cleanup_complete' as status,
  COUNT(*) as remaining_health_checks
FROM breadcrumbs 
WHERE schema_name = 'tool.request.v1' 
AND tags @> ARRAY['health:check'];
