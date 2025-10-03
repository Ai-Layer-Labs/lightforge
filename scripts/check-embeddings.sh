#!/bin/bash
# Check which breadcrumbs have embeddings

echo "🔍 Checking embedding coverage in database..."
echo ""

docker-compose exec db psql -U postgres -d rcrt << 'SQL'
-- Total breadcrumbs
SELECT 
    'Total Breadcrumbs' as metric,
    COUNT(*) as count
FROM breadcrumbs
UNION ALL
-- Breadcrumbs WITH embeddings
SELECT 
    'With Embeddings' as metric,
    COUNT(*) as count
FROM breadcrumbs 
WHERE embedding IS NOT NULL
UNION ALL
-- Breadcrumbs WITHOUT embeddings
SELECT 
    'Without Embeddings' as metric,
    COUNT(*) as count
FROM breadcrumbs 
WHERE embedding IS NULL;

-- Breakdown by schema
SELECT 
    COALESCE(schema_name, 'null') as schema,
    COUNT(*) as total,
    COUNT(embedding) as with_embedding,
    COUNT(*) - COUNT(embedding) as without_embedding,
    ROUND(100.0 * COUNT(embedding) / COUNT(*), 1) as coverage_pct
FROM breadcrumbs
GROUP BY schema_name
ORDER BY total DESC;
SQL

