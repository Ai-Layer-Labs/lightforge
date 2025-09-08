### @rcrt-builder/sdk – RCRT Client SDK

Goals
- Simple, auth‑aware client for all RCRT operations (CRUD, SSE, plans)
- Works in browser and Node; handles SSE token transport automatically

Install
```
pnpm add @rcrt-builder/sdk
```

Create a client
```ts
import { createClient, RcrtClientEnhanced } from '@rcrt-builder/sdk';

// Recommended: auto‑fetch token and set it
const client = await createClient({ baseUrl: '/api/rcrt', tokenEndpoint: '/api/auth/token' });

// Or manual control
const manual = new RcrtClientEnhanced('/api/rcrt');
manual.setToken(myJwt);
```

CRUD
```ts
const id = (await client.createBreadcrumb({ title: 'Hello', tags: ['workspace:x'], context: {} })).id;
const brief = await client.getBreadcrumb(id);           // context view
await client.updateBreadcrumb(id, brief.version, { title: 'World' });
await client.deleteBreadcrumb(id);
```

Search & vectors
```ts
await client.searchBreadcrumbs({ tag: 'workspace:x' });
await client.vectorSearch({ q: 'laptops', filters: { tag: 'workspace:x' } });
```

SSE (workspace stream)
```ts
const stop = client.startEventStream(evt => {
  console.log('SSE', evt);
}, { filters: { any_tags: ['workspace:x'] } });
// The SDK appends access_token automatically when a JWT is set
```

Apply plans
```ts
// Call a Next proxy that forwards Authorization to RCRT
const applyClient = await createClient({ baseUrl: '/api', tokenEndpoint: '/api/auth/token' });
await applyClient.applyPlan({ schema_name: 'ui.plan.v1', tags: ['workspace:x','ui:plan'], context: { actions: [] } });
```

Auth model
- REST: `Authorization: Bearer <jwt>` always sent if `setToken()` used
- SSE: uses `access_token` query param in browsers; server accepts header or query

Defaults
- `getBreadcrumb` returns context view (safer); call `getBreadcrumbFull` for full view
- `batchGet` defaults to context view

Errors
- Update requires `If-Match` version; the SDK populates it from current version
- Vector search returns empty on embedding failures (server behavior), not 500

Types
- Exposes types for breadcrumbs, selectors, agents, tenants, ACL, DLQ, secrets


