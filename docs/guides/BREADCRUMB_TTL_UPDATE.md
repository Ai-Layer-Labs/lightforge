# Breadcrumb TTL (Time-To-Live) Configuration

## Summary

Added TTL values to all breadcrumbs created by agents to ensure they are properly cleaned up by the hygiene function. This prevents the system from accumulating stale data over time.

## TTL Values Applied

| Breadcrumb Type | TTL | Reason |
|----------------|-----|---------|
| `agent.error.v1` | 2 hours | Errors are transient and should be investigated quickly |
| `agent.metrics.v1` | 24 hours | Metrics are useful for daily analysis but don't need long-term storage |
| `agent.response.v1` | 7 days | Agent responses may be referenced for a week in conversations |
| `tool.request.v1` | 1 hour | Tool requests are very short-lived, responses matter more |
| `agent.memory.v1` | 48 hours (configurable) | Memory persistence can be configured per agent via `memory.ttl_hours` |

## Hygiene Configuration

From `docker-compose.yml`:
- **Hygiene interval**: 30 seconds (for testing)
- **Health check TTL**: 5 minutes
- **Temporary data TTL**: 24 hours
- **Agent idle cleanup**: 48 hours

## Implementation Details

1. **Error Breadcrumbs** (`agent.error.v1`):
   ```typescript
   ttl: '2h',  // Expire after 2 hours
   ```

2. **Metrics Breadcrumbs** (`agent.metrics.v1`):
   ```typescript
   ttl: '24h',  // Keep metrics for 24 hours
   ```

3. **Dynamic TTL for Agent Responses**:
   ```typescript
   ttl: decision.breadcrumb.schema_name === 'agent.response.v1' ? '7d' : 
        decision.breadcrumb.schema_name === 'tool.request.v1' ? '1h' : 
        undefined,  // No TTL for other types unless specified
   ```

4. **Configurable Memory TTL**:
   ```typescript
   const memoryTtl = this.agentDef.context.memory?.ttl_hours 
     ? `${this.agentDef.context.memory.ttl_hours}h` 
     : '48h'; // Default 48 hours if not specified
   ```

## Benefits

1. **Automatic Cleanup**: The hygiene runner will automatically remove expired breadcrumbs
2. **Resource Management**: Prevents database bloat from accumulating error logs and metrics
3. **Configurable**: Memory TTL can be customized per agent based on use case
4. **Appropriate Lifetimes**: Each breadcrumb type has a TTL that matches its purpose

## Testing

To verify the hygiene function is working:

1. Check current breadcrumb count:
   ```bash
   node list-agents.js  # Modify to count breadcrumbs
   ```

2. Wait for hygiene cycles (every 30 seconds in test config)

3. Verify expired breadcrumbs are removed

## Note on Creator Metadata

All agent-created breadcrumbs now also include creator metadata:
```typescript
creator: {
  type: 'agent',
  agent_id: this.agentDef.context.agent_id
}
```

This prevents agents from triggering on their own breadcrumbs while still maintaining full conversation context.
