### RCRT Visual Builder (Next.js App)

Purpose
- Live visual builder that renders UI from RCRT breadcrumbs and reacts to events via SSE.
- Ships an agentic demo that showcases end‑to‑end auth, SSE, validation, and plan application.

Contents
- `app/agentic-demo` – isolated demo page for e2e testing
- `app/api/rcrt/[...path]` – proxy to RCRT backend (forwards Authorization or maps `access_token`)
- `app/api/forge/validate` – validates `ui.plan.v1` against component catalog
- `app/api/forge/apply` – applies UI plans by calling RCRT (auth forwarded)

Quick start
1) Start backend: `docker compose up -d rcrt`
2) Dev server: `pnpm dev` (in `apps/builder`)
3) Open `http://localhost:3000/agentic-demo` → click Seed → click Gaming/Ultrabook

Environment
- `.env.local` in `apps/builder` should include:
  - `JWT_PRIVATE_KEY_PEM` – PEM private key (RS256) used by `/api/auth/token`
  - Optional: `RCRT_BASE=http://localhost:8081` if proxy target changes

Auth flow
- REST: send `Authorization: Bearer <jwt>`; proxy forwards to RCRT
- SSE: browser `EventSource` can’t set headers, so the SDK appends `access_token=<jwt>` to the stream URL; proxy translates to `Authorization`

Key routes
- `GET /api/rcrt/...` → proxies to RCRT (`http://localhost:8081`) with auth
- `POST /api/auth/token` → returns a short‑lived demo JWT derived from `JWT_PRIVATE_KEY_PEM`
- `POST /api/forge/validate` → validates `ui.plan.v1`
- `POST /api/forge/apply` → applies a plan by creating/updating/deleting breadcrumbs against RCRT

Agentic demo walkthrough
- Seed creates `ui.layout.v1` and starter `ui.instance.v1` records in workspace `workspace:agentic-demo`
- Buttons emit `ui.event.v1` via declarative bindings; the orchestrator listens to SSE
- On events, a `ui.plan.v1` is constructed and sent to `/api/forge/apply` (Authorization forwarded)

Using the SDK in the app
```ts
import { createClient } from '@rcrt-builder/sdk';

// RCRT API client (REST + SSE)
const client = await createClient({ baseUrl: '/api/rcrt', tokenEndpoint: '/api/auth/token' });

// Plan application via Next proxy
const applyClient = await createClient({ baseUrl: '/api', tokenEndpoint: '/api/auth/token' });
await applyClient.applyPlan(plan);
```

UILoader integration
- `UILoader` fetches and renders workspace context view
- It subscribes to SSE using the passed client (with JWT)
- Pointer resolution: components may use `state_tag` and `src_tag` to reference `ui.state.v1` and `ui.asset.v1`

Troubleshooting
- SSE 401: ensure token present (Seed first) and stream URL contains `access_token`
- `missing Authorization`: validate `/api/forge/apply` and `/api/rcrt/...` see `Authorization` in the proxy
- 403/500 on `/full`: use context view (the app defaults to it)


