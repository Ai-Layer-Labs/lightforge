### RCRT Auth (JWT) and SSE

Overview
- RCRT uses JWT (RS256). Required claims: `sub` (agent_id), `owner_id`.
- Roles: `emitter`, `subscriber`, `curator` (grant permissions like create/update, subscriptions, ACL management).
- For dev, the builder can mint a token via `/api/auth/token` using `JWT_PRIVATE_KEY_PEM` in `.env.local`.

REST calls
- Send `Authorization: Bearer <jwt>`
- The Next proxy (`/api/rcrt`) forwards this header to the backend.

SSE in the browser
- Native `EventSource` cannot set headers; the SDK appends `access_token=<jwt>` to the stream URL.
- The Next proxy maps `?access_token=...` to `Authorization: Bearer ...` when calling the backend.
- The server accepts either header or `access_token`/`token` query.

SDK usage
```ts
import { createClient } from '@rcrt-builder/sdk';

// Create with token auto-fetch
const client = await createClient({ baseUrl: '/api/rcrt', tokenEndpoint: '/api/auth/token' });

// Later, if you rotate tokens:
client.setToken(newToken);

// SSE
const stop = client.startEventStream(onEvent, { filters: { any_tags: ['workspace:agentic-demo'] } });

// Apply plans via Next proxy (Authorization forwarded)
const appClient = await createClient({ baseUrl: '/api', tokenEndpoint: '/api/auth/token' });
await appClient.applyPlan(plan);
```

Troubleshooting
- 401 SSE: Token not present; ensure `createClient({ tokenEndpoint })` succeeded or call `client.setToken(token)`.
- missing Authorization: Ensure the proxy sees either header or `access_token`.
- Token issuance: Verify `.env.local` has `JWT_PRIVATE_KEY_PEM`, and docker-compose includes matching `JWT_PUBLIC_KEY_PEM` for the server.


