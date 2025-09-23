# RCRT System Hygiene and JWT Token Management - Complete ✅

## Summary

Successfully implemented hygiene system for breadcrumbs and fixed JWT token expiration issues in the agent-runner.

## 1. Hygiene System Implementation

### Added TTL to All Agent-Created Breadcrumbs

| Breadcrumb Type | TTL | Format |
|----------------|-----|---------|
| `agent.error.v1` | 2 hours | ISO 8601 datetime |
| `agent.metrics.v1` | 24 hours | ISO 8601 datetime |
| `agent.response.v1` | 7 days | ISO 8601 datetime |
| `tool.request.v1` | 1 hour | ISO 8601 datetime |
| `agent.memory.v1` | 48 hours (configurable) | ISO 8601 datetime |

### Key Learning
RCRT expects TTL values as ISO 8601 datetime strings, NOT duration strings:
```typescript
// ❌ Wrong
ttl: '2h'

// ✅ Correct
ttl: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
```

### Verification
The hygiene runner is actively cleaning up expired breadcrumbs every 30 seconds, as configured in `docker-compose.yml`.

## 2. JWT Token Refresh Implementation

### Problems Fixed
1. **Expired JWT tokens**: Agent-runner was failing with "ExpiredSignature" errors after tokens expired
2. **No refresh mechanism**: The SDK and agent-runner had no automatic token refresh

### Solution Implemented

#### SDK Updates (`packages/sdk/src/index.ts`)
- Added `tokenRequestBody` option to `RcrtClientEnhanced` constructor
- Enhanced `refreshTokenIfNeeded()` to use proper token request body
- Added automatic retry on 401 responses

#### Agent Runner Updates (`apps/agent-runner/src/index.ts`)
- Added 30-minute token refresh interval (before 1-hour expiry)
- Implemented token propagation to all `AgentExecutor` instances
- Added proper cleanup on shutdown

#### AgentExecutor Updates (`packages/runtime/src/agent/agent-executor.ts`)
- Added `updateToken()` method to update JWT tokens in running executors

### Code Example
```typescript
// Token refresh every 30 minutes
const tokenRefreshInterval = setInterval(async () => {
  try {
    const newToken = await getToken();
    if (newToken) {
      client.setToken(newToken);
      console.log('🔐 Refreshed JWT token');
      
      // Update token in all agent executors
      for (const executor of registry.executors.values()) {
        executor.updateToken(newToken);
      }
    }
  } catch (error) {
    console.error('❌ Failed to refresh token:', error);
  }
}, 30 * 60 * 1000); // 30 minutes
```

## 3. Error Cleanup

- Cleaned up **551 accumulated error breadcrumbs** (486 errors + 65 metrics)
- Created `cleanup-agent-errors.js` script for future cleanup needs
- System is now running cleanly without error accumulation

## 4. OpenRouter API Key Setup

- Successfully added OpenRouter API key to RCRT secrets (scoped to tools)
- Key is properly loaded in agent-runner configuration
- Tools-runner has access to the key for OpenRouter tool invocations

## Current System Status

✅ **All services running properly:**
- RCRT server: Hygiene runner active, cleaning expired breadcrumbs
- Agent runner: JWT refresh active, no token expiration errors
- Tools runner: OpenRouter key available
- Default chat agent: Registered and listening for events

## Scripts Created

1. **`test-ttl-breadcrumb.js`** - Test TTL functionality
2. **`cleanup-agent-errors.js`** - Clean up accumulated errors
3. **`add-openrouter-key.js`** - Add OpenRouter API key to secrets
4. **`set-openrouter-key.sh`** - Wrapper script for key setup

## Docker Changes

Updated `docker-compose.yml` to:
- Pass `OPENROUTER_API_KEY` to agent-runner
- Ensure hygiene runner configuration (30s interval, 10 breadcrumb batch)

## Next Steps

The system is now stable and ready for use. The hygiene system will automatically clean up expired breadcrumbs, and JWT tokens will be refreshed automatically before expiry.
