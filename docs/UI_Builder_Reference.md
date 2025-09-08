## RCRT UI Builder – Comprehensive Reference

This document explains how the UI Builder works end‑to‑end: data model (breadcrumbs), rendering, events, SDK/API interactions, validation/apply flows, SSE, performance, and operational practices.

---

### 1) Architecture Overview

- Data-first UI: Every page element is a breadcrumb. Layout, theme, inline CSS, and each rendered component are represented as data.
- Rendering stack (client):
  - `UILoader` reads workspace breadcrumbs, fetches full records, and renders regions and instances.
  - `ComponentRegistry` maps `component_ref` names to actual React components (HeroUI + custom).
  - `ComponentRenderer` mounts a component and wires declarative event bindings (`emit_breadcrumb`, `update_state`, `update_breadcrumb`, `call_api`, `navigate`).
- Transport:
  - Browser → Next.js proxy (`/api/rcrt`) → RCRT backend (avoids CORS; streams SSE).
  - SDK (`@rcrt-builder/sdk`) wraps REST + SSE.
- Optional agent loop:
  - UI emits durable `ui.event.v1` records.
  - Agents subscribe by selector and respond with `ui.plan.v1` or direct CRUD.

---

### 2) Breadcrumb Taxonomy (UI)

Each breadcrumb has `title`, `tags[]`, and `context` (arbitrary JSON) and optional `schema_name`. Tags anchor discovery and authorization.

- `ui.layout.v1`
  - Role: page regions and container styling.
  - Tags: `workspace:<ws>`, `ui:layout`
  - Context: `{ regions: string[], container?: { className?: string, style?: any }, regionStyles?: Record<string,{ className?: string, style?: any }> }`

- `ui.theme.v1`
  - Role: HeroUI theme object.
  - Tags: `workspace:<ws>`, `ui:theme`
  - Context: theme object (passed to `HeroUIProvider`).

- `ui.styles.v1`
  - Role: inline CSS.
  - Tags: `workspace:<ws>`, `ui:styles`
  - Context: `{ css: string }`

- `ui.instance.v1`
  - Role: one rendered component instance.
  - Tags: `workspace:<ws>`, `ui:instance`, `region:<name>`
  - Context: `{ component_ref: string, props?: any, bindings?: Record<string, Binding>, order?: number, created_from_template?: string }`

- `ui.template.v1`
  - Role: reusable component presets for palette/instantiation.
  - Tags: `workspace:builder`, `ui:template`, `component:<Type>`, optional `variant:*`, `palette:heroui`
  - Context: `{ component_type: string, default_props?: any, preview_asset_tag?: string, description?: string }`

- `ui.asset.v1`
  - Role: images/icons/docs; preview and runtime assets.
  - Tags: `workspace:builder`, `ui:asset`, `asset:*`, optional `component:*`
  - Context: `{ kind: "image"|"icon"|"doc"|"json"|"html"|"text", content_type: string, url?: string, data_base64?: string, width?: number, height?: number, alt?: string }`

- `ui.component.v1`
  - Role: component catalog metadata (props schema, examples, install/imports) for LLM/authoring.
  - Tags: `workspace:builder`, `ui:component`, `component:<Type>`, `palette:heroui`
  - Context: `{ component_type, props_schema, installation, imports, examples }`

- `ui.event.v1`
  - Role: durable interaction events emitted by instances.
  - Tags: `workspace:<ws>`, `ui:event`, typically `component:<Type>`
  - Context: `{ triggered_by: <instance_id>, event_name: string, event_data?: any, timestamp: string }`

- `ui.plan.v1`
  - Role: LLM/agent intent to mutate UI; validated/applied by UI Forge.
  - Tags: `workspace:<ws>`, `ui:plan`
  - Context: `{ actions: Action[], idempotency_key?: string }`

- `ui.validation.v1`
  - Role: validation feedback for a plan.
  - Tags: `workspace:<ws>`, `ui:validation`
  - Context: `{ ok: boolean, errors?: { code, path, message, suggestion? }[], summary?: string }`

- `ui.plan.result.v1`
  - Role: result of apply (created/updated/deleted collections, errors).
  - Tags: `workspace:<ws>`, `ui:plan:result`
  - Context: `{ ok, created?: any[], updated?: any[], deleted?: any[], errors?: any[] }`

Optional / advanced (pattern support):

- `ui.state.v1` – referenced, long‑lived state shards keyed by `component_id` + state key.
- `ui.composite.v1` – multi‑node authored structure expanded into `ui.instance.v1[]` on apply.

Tag conventions:

- Workspace: always include `workspace:<ws>`.
- Role: `ui:layout`, `ui:theme`, `ui:styles`, `ui:instance`, `ui:template`, `ui:asset`, `ui:component`, `ui:event`, `ui:plan`, `ui:validation`.
- Placement: `region:<name>` on instances.
- Component family: `component:<Type>` on templates/assets/events where applicable.

---

### 3) Rendering Pipeline (Client)

1. `UILoader`
   - `searchBreadcrumbs({ tag: workspace })` → summaries.
   - `batchGet(ids, 'full')` → full records (bounded concurrency).
   - Extract `ui.layout.v1` (required), `ui.theme.v1`, `ui.styles.v1`, and `ui.instance.v1`.
   - Sort instances by `context.order` then creation time; render by regions.
   - Inject inline CSS and apply theme.

2. `ComponentRegistry`
   - Registers HeroUI components and custom builder widgets (`BuilderCanvas`, `BuilderPalette`).
   - `component_ref` → React component.

3. `ComponentRenderer`
   - Computes props and event handlers.
   - Event bindings:
     - `emit_breadcrumb`: create `ui.event.v1` (adds workspace, `triggered_by`, `event_name`, `timestamp`).
     - `update_state`: local state only.
     - `update_breadcrumb`: `GET /breadcrumbs/{id}`, then `PATCH /breadcrumbs/{id}` with `If-Match`.
     - `call_api`: POST/GET to arbitrary URL; may emit a breadcrumb with the response.
     - `navigate`: UI-level navigation or hard redirect.
   - SSE: per‑instance SSE is disabled by default (to avoid N streams). A single workspace SSE is recommended (see §7).

---

### 4) SDK and API Interactions

All browser calls go through Next proxy `/api/rcrt` (same origin). The SDK is already parity‑aligned with the OpenAPI spec.

- Breadcrumbs
  - Create: `POST /breadcrumbs` (Idempotency-Key optional) → `{ id }`.
  - List summaries: `GET /breadcrumbs?tag=<workspace>`.
  - Get context view: `GET /breadcrumbs/{id}`.
  - Get full view: `GET /breadcrumbs/{id}/full`.
  - Update: `PATCH /breadcrumbs/{id}` with header `If-Match: <version>` (returns `OkResp`; SDK then fetches fresh full).
  - Delete: `DELETE /breadcrumbs/{id}` (optional `If-Match`).

- Search
  - Basic: `GET /breadcrumbs?tag=<t>&schema_name=<s>...`.
  - Vector: `GET /breadcrumbs/search?q=...|qvec=...&nn=...&tag=...`.

- Agents & ACL
  - Agents: `GET /agents`, `POST /agents/{id}`, `GET/DELETE /agents/{id}`.
  - ACL list: `GET /acl`.

- Secrets
  - Create/list/update/delete per OpenAPI; decrypt: `POST /secrets/{id}/decrypt`.

- SSE
  - Stream: `GET /events/stream` (text/event-stream). Filters (owner/agent) are backend‑enforced; client can pass simple filters (e.g., tag JSON) as a query param.

Next.js proxy:

- `apps/builder/app/api/rcrt/[...path]/route.ts` forwards verb + headers, streams body (SSE compatible), supports `GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS`.

---

### 5) Validation and Apply (LLM/Agent Loop)

- Validate (Next app route): `POST /api/forge/validate`
  - Input: `ui.plan.v1` JSON (`tags` must include `workspace:<ws>`).
  - Checks: known component types via catalog (`heroui-templates/ui-components.json`), JSON‑serializability, region existence (reads workspace layout), and action semantics.
  - Output: `ui.validation.v1` with deterministic error codes:
    - `MISSING_WORKSPACE_TAG`, `UNKNOWN_COMPONENT_TYPE`, `INVALID_PROP_NAME`, `INVALID_PROP_VALUE`, `NON_SERIALIZABLE_PROP`, `MISSING_REGION`, `UNKNOWN_REGION`, `MISSING_COMPONENT_REF`, `MISSING_TEMPLATE_ID`, `MISSING_ID`, `UNSUPPORTED_ACTION`.

- Apply (Next app route): `POST /api/forge/apply`
  - Executes actions by calling the proxy to the backend (create/update/delete), using `If-Match` for optimistic concurrency and optional `Idempotency-Key`.
  - Output: `ui.plan.result.v1` with created/updated/deleted ids and errors.

Both routes run under Node runtime and include short internal timeouts to avoid UI hangs.

---

### 6) Data Flow Patterns (Recommended)

- Keep durable UI in `ui.instance.v1` (structure/props). Mutate only when UI changes.
- Outbound (user interactions): append `ui.event.v1` (and optionally domain breadcrumbs). Don’t mutate instances for telemetry.
- Inbound (LLM data): create referenced records instead of bloating instance props:
  - `ui.asset.v1` for images/docs; instance props point by tag (e.g., `src_tag`).
  - `ui.state.v1` for dynamic lists/state keyed by `component_id` and state key; instance props carry a pointer (`state_tag` or `markers_tag`).

Agents subscribe by selector (e.g., `all_tags:["ui:event","workspace:<ws>"]`) or specific ids; the UI uses a single workspace SSE (see §7).

---

### 7) SSE Strategy (Scalable Updates)

- UI should open a single SSE to `/events/stream` scoped to the workspace, not one per component.
- On event (`breadcrumb.created|updated|deleted` with `id`, `tags`, `schema_name?`, `updated_at`):
  - If relevant to the current view, `GET /breadcrumbs/{id}` (or `/full` if needed) and update a local store; components subscribe to the store.
- Benefits: avoids hundreds of EventSource connections; reduces memory/CPU; aligns with agent subscriptions (server-side selectors).

---

### 8) Seeding and Catalog

- `heroui-templates/` contains pre-generated templates/assets/components:
  - `ui-templates.json` (→ `ui.template.v1`), `ui-assets.json` (→ `ui.asset.v1`), `ui-components.json` (`ui.component.v1`).
  - `seed-heroui.js` can POST to RCRT to populate `workspace:builder` idempotently.
- Offline generator: `offline_heroui_seeder.js` builds static files and a seeder script.

---

### 9) Performance & Reliability

- `batchGet` is bounded-concurrency (default 16) to avoid saturating proxy/backend.
- Disable per-instance SSE; use a workspace-level SSE.
- Use `If-Match` on PATCH; handle 412 by refetching version.
- Use `Idempotency-Key` for multi-item creates to dedupe retries.
- Keep instances small; store large or frequently changing payloads as assets/state.

---

### 10) Examples

- Instance (Card)
```json
{ "schema_name": "ui.instance.v1", "title": "Card: Welcome", "tags": ["workspace:demo","ui:instance","region:content"], "context": { "component_ref": "Card", "props": { "className": "p-6", "children": "Welcome" }, "order": 1 } }
```

- Template (Button / Primary)
```json
{ "schema_name": "ui.template.v1", "title": "Template: Button / Primary", "tags": ["workspace:builder","ui:template","component:Button","variant:primary","palette:heroui"], "context": { "component_type": "Button", "default_props": { "color": "primary", "children": "Click" }, "preview_asset_tag": "asset:button:primary" } }
```

- Event from component
```json
{ "schema_name": "ui.event.v1", "title": "Button Pressed", "tags": ["workspace:demo","ui:event","component:Button"], "context": { "triggered_by": "<instance_id>", "event_name": "onPress", "event_data": { "value": true }, "timestamp": "2025-09-08T00:00:00Z" } }
```

- Plan (create instance) and validation response
```json
{ "schema_name": "ui.plan.v1", "title": "Add Button", "tags": ["workspace:demo","ui:plan"], "context": { "actions": [ { "type": "create_instance", "region": "content", "instance": { "component_ref": "Button", "props": { "color": "primary", "children": "Save" }, "order": 1 } } ] } }
```
```json
{ "schema_name": "ui.validation.v1", "tags": ["workspace:demo","ui:validation"], "context": { "ok": false, "errors": [ { "code": "UNKNOWN_COMPONENT_TYPE", "path": "context.actions[0].instance.component_ref", "message": "Unknown component_ref 'Button'" } ], "summary": "1 errors found" } }
```

---

### 11) Troubleshooting

- Page freeze / high CPU in dev:
  - Ensure per-instance SSE is disabled; prefer one workspace SSE.
  - Keep `batchGet` concurrency bounded (SDK default is 16).
  - Clear `.next` and restart `next dev` if chunk read errors appear.
- Validation hangs:
  - The app routes enforce short timeouts; check Network tab for `/api/forge/validate` status; inspect response body; verify the catalog file is present.
- No render:
  - Ensure a `ui.layout.v1` exists for the workspace; UILoader requires it.

---

### 12) Glossary

- Breadcrumb: minimal persistent record (title, tags, context, metadata).
- Workspace: tag `workspace:<name>` grouping all records for a UI/app.
- Selector: subscription definition (any/all tags, schema, simple context match).
- UI Forge: the runtime that validates/applies plans and renders UI from breadcrumbs.
- Plan: `ui.plan.v1` intent envelope with actions.

---

Version: 1.0 (kept in docs; update as schema/API evolve)


