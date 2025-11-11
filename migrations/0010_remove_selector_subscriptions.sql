-- Migration 0010: Remove selector_subscriptions table
-- RCRT uses global broadcast + client-side tag matching
-- No server-side filtering needed

-- Drop the unused selector_subscriptions table
DROP TABLE IF EXISTS selector_subscriptions CASCADE;

-- Note: RCRT event routing now works via:
-- 1. Global broadcast to NATS bc.*.updated
-- 2. agent-runner receives ALL events (owner filtered)
-- 3. Client-side tag matching in UniversalExecutor
-- 4. Trigger on match
--
-- Benefits:
-- - Simple: One routing mechanism
-- - Debuggable: All events in logs
-- - Scalable: Stateless client-side filtering
-- - Flexible: Any tag pattern works

