
### RCRT Visual Builder - 5 Minute Quickstart

This guide gets you from zero to a live, auth-enabled Agentic demo with SSE.

Prereqs
- Docker and Docker Compose
- Node 18+ and pnpm

1) Start the backend (RCRT)
- From repo root:
```
docker compose up -d --build
```
- Wait until the `rcrt` container is healthy (`/health` → ok).

2) Start the builder (Next.js)
- In `rcrt-visual-builder/apps/builder`:
```
pnpm dev
```
- Open http://localhost:3000/agentic-demo

3) Auth token for dev
- The builder exposes a helper endpoint to mint a JWT from env keys:
```
POST /api/auth/token
```
- The demo page calls it automatically when you click Seed.

4) Seed the demo and stream events
- Click “Seed Agentic Demo”. This creates layout and starter components.
- SSE subscribes to `workspace:agentic-demo` and live-updates UI on events.

5) Interact
- Click “Gaming” or “Ultrabook”. The orchestrator reacts to the `ui.event.v1` breadcrumb and applies a plan to render product cards.
- Click “Details” to open a drawer and update the shortlist (state).

Using the SDK directly
```ts
import { createClient } from '@rcrt-builder/sdk';

const client = await createClient({
  baseUrl: '/api/rcrt',            // proxied RCRT API
  tokenEndpoint: '/api/auth/token' // fetches and sets JWT
});

const stop = client.startEventStream(evt => {
  console.log('SSE:', evt);
}, { filters: { any_tags: ['workspace:agentic-demo'] } });

// Apply a UI plan via Next proxy (Authorization is forwarded)
const applyClient = await createClient({ baseUrl: '/api', tokenEndpoint: '/api/auth/token' });
await applyClient.applyPlan({ schema_name: 'ui.plan.v1', tags: ['workspace:agentic-demo','ui:plan'], context: { actions: [] } });
```

Common issues
- SSE 401: Ensure the stream URL contains `access_token`. The SDK adds it automatically when a token is set.
- 403/500 on GET full: Use `view=context` (SDK defaults). Full view requires extra ACLs.
- “missing Authorization”: Make sure requests carry `Authorization: Bearer <jwt>`; the Next proxy forwards it.


