# RCRT Hygiene System and TTL Implementation

## Summary

Successfully implemented Time-To-Live (TTL) values for all agent-created breadcrumbs, ensuring automatic cleanup by the hygiene runner. This prevents the accumulation of stale data like error logs and metrics.

## Key Learnings

### TTL Format
The RCRT server expects TTL values as **ISO 8601 datetime strings**, not duration strings:
- ❌ `ttl: '2h'` (duration format)  
- ✅ `ttl: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()` (ISO datetime)

### Implementation

1. **Error Breadcrumbs** (`agent.error.v1`):
   ```typescript
   ttl: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),  // 2 hours
   ```

2. **Metrics Breadcrumbs** (`agent.metrics.v1`):
   ```typescript
   ttl: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),  // 24 hours
   ```

3. **Agent Responses** (`agent.response.v1`):
   ```typescript
   ttl: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),  // 7 days
   ```

4. **Tool Requests** (`tool.request.v1`):
   ```typescript
   ttl: new Date(Date.now() + 60 * 60 * 1000).toISOString(),  // 1 hour
   ```

5. **Memory Breadcrumbs** (`agent.memory.v1`):
   ```typescript
   const memoryTtlHours = this.agentDef.context.memory?.ttl_hours || 48;
   const memoryTtl = new Date(Date.now() + memoryTtlHours * 60 * 60 * 1000).toISOString();
   ```

## Hygiene System

The hygiene runner in the RCRT server:
- **Runs every 30 seconds** (configured for testing)
- **Cleans up expired breadcrumbs** based on their TTL
- **Logs cleanup activity** for monitoring

Example hygiene log:
```
🧹 Hygiene cycle starting...
Running direct expired breadcrumb cleanup...
🧹 Hygiene cycle complete: 2ms, cleaned 2 breadcrumbs
```

## Testing

Created test breadcrumbs with short TTL values (1-2 minutes) to verify the hygiene system:
- Test breadcrumb with 1 minute TTL: ID `d6d3ec7c-c940-4d6f-8abc-7f6d5dce26e2`
- Error breadcrumb with 2 minute TTL: ID `10024f5d-3786-4587-85e3-7df46160d013`

The hygiene runner will automatically remove these after expiration.

## Benefits

1. **Automatic cleanup** - No manual intervention needed
2. **Resource efficiency** - Database doesn't accumulate stale data
3. **Configurable lifetimes** - Each breadcrumb type has appropriate TTL
4. **Self-documenting** - Error shows when it was created and when it expires
5. **Memory management** - Agent memory can be configured per agent

## Next Steps

- Monitor hygiene logs to confirm cleanup is working
- Consider adjusting TTL values based on operational needs
- Add TTL to other breadcrumb types as needed
- Consider adding TTL configuration to agent definitions

## Related Files

- `rcrt-visual-builder/packages/runtime/src/agent/agent-executor.ts` - Updated with TTL logic
- `BREADCRUMB_TTL_UPDATE.md` - Initial TTL documentation
- `test-ttl-breadcrumb.js` - Test script for TTL verification
- `docker-compose.yml` - Hygiene configuration settings
