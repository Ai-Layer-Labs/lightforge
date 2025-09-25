# JWT Token Refresh Fix for Tools Runner

## Problem
The tools runner was failing with "ExpiredSignature" errors because JWT tokens expire and the tools runner wasn't renewing them automatically.

## Root Cause
1. The tools runner fetched a JWT token once at startup
2. It passed this static token to the SSE connection
3. When the token expired, all operations failed with 401/ExpiredSignature errors
4. There was no mechanism to refresh the token

## Solution
Updated both the SDK and tools runner to implement automatic token refresh:

### SDK Changes (`packages/sdk/src/index.ts`)
1. Made `refreshTokenIfNeeded()` public so it can be called externally
2. Added `getToken()` method to retrieve the current token
3. The SDK already had auto-refresh on 401 responses, but it needed to be accessible

### Tools Runner Changes (`apps/tools-runner/src/index.ts`)
1. **Passed tokenRequestBody to SDK**: The client now knows how to request new tokens
   ```typescript
   const tokenRequest = {
     owner_id: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
     agent_id: process.env.AGENT_ID || '00000000-0000-0000-0000-0000000000aa'
   };
   client = new RcrtClientEnhanced(config.rcrtBaseUrl, 'jwt', token, {
     tokenEndpoint: config.tokenEndpoint,
     autoRefresh: true,
     tokenRequestBody: tokenRequest
   });
   ```

2. **SSE Connection Token Refresh**: 
   - Gets current token from client (which may have been refreshed)
   - Handles 401 responses by refreshing token and retrying
   - Implements retry logic with max attempts

3. **Proactive Token Refresh**:
   - Sets up a timer to refresh token every 10 minutes
   - Prevents tokens from expiring during long-running connections
   - Cleans up timer when connection closes

## Benefits
1. **Automatic Recovery**: When a token expires, the system automatically fetches a new one
2. **Proactive Refresh**: Tokens are refreshed before they expire during long connections
3. **Resilient SSE**: The SSE connection can recover from token expiration
4. **No Manual Intervention**: Tools continue working without needing restarts

## Testing
To test the fix:
1. Start the tools runner with JWT auth enabled
2. Wait for token expiration (or manually expire it)
3. Observe that operations continue working with automatic token refresh
4. Check logs for "🔄 SSE got 401, attempting to refresh token..." messages

## Configuration
Ensure your tools runner has these environment variables:
- `RCRT_AUTH_MODE=jwt`
- `TOKEN_ENDPOINT=/api/auth/token` or full URL
- `OWNER_ID` and `AGENT_ID` (optional, has defaults)

