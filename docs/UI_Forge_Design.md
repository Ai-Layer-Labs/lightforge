## UI Forge with RCRT and HeroUI — Architecture, Changes, and Build Plan

This document explains how the current system works, what needs to change, and what we will build to make UI Forge a robust, data-first runtime for dynamic UIs powered by RCRT and HeroUI. It also details why each change is necessary.

---

### 1) Current System Overview

- Rendering pipeline
  - `UILoader` reads breadcrumbs tagged by workspace, fetches full records, extracts `ui.layout.v1`, `ui.theme.v1`, `ui.styles.v1`, and `ui.instance.v1`, then renders HeroUI components through the `ComponentRegistry`.
  - `ComponentRenderer` wires component events to actions: `emit_breadcrumb`, `update_state`, `update_breadcrumb`, `call_api`, and `navigate`.
  - Next.js API route `/api/rcrt` proxies to the Rust backend to avoid CORS.

- Backend (Rust)
  - Exposes routes for breadcrumbs CRUD, vectors, ACLs, webhooks, agents, tenants, secrets. RLS is enforced via per-request settings.
  - Emits events/webhooks upon breadcrumb updates.

- SDK
  - Provides `searchBreadcrumbs`, `getBreadcrumb`, `batchGet`, CRUD helpers, SSE subscription, and convenience helpers.

- Data model used for UI
  - Layout: `ui.layout.v1` (regions, container, regionStyles)
  - Theme: `ui.theme.v1`
  - Styles: `ui.styles.v1` (inline CSS)
  - Instances: `ui.instance.v1` (one per rendered item)
  - Events: `ui.event.v1` produced by component interactions via bindings

- Grouping and discovery
  - Tags are the grouping primitive: `workspace:*`, `ui:*` roles, `region:*`, `component:*`, `variant:*`, etc.
  - Selectors allow agents/systems to subscribe to groups.

---

### 2) Gaps and Integration Issues

- SDK/server mismatches
  - `getBreadcrumb(id, 'full')` → server expects `GET /breadcrumbs/:id/full` (not query param)
  - `updateBreadcrumb` uses `PUT` → server handler expects `PATCH` with `If-Match`
  - Vector search path differs (`POST /search/vector` vs `GET /breadcrumbs/search`)
  - ACL list path differs (`/acls` vs `/acl`)
  - Agent update path/method differs (SDK `PUT /agents/:id` vs server `POST /agents/:id`)

- Missing first-class templates and assets
  - Today we seed `ui.instance.v1`. We should add `ui.template.v1` (reusable component templates) and `ui.asset.v1` (images/icons/docs) to make palettes and previews first-class.

- Seeding breadth
  - We partially seed demo/showcase workspaces. We need a one-shot bootstrap that seeds the entire HeroUI palette as templates, and optionally a reference workspace using those templates.

---

### 3) Proposed Additions to the Data Model

- `ui.template.v1`
  - Purpose: reusable component templates for palettes and cloning.
  - Tags: `workspace:*` (e.g., `workspace:builder`), `ui:template`, `component:<Type>`, optional `variant:*`, `palette:*`.
  - Context:
    - `component_type: string` — name in `ComponentRegistry`
    - `default_props: object` — safe, serializable props
    - `preview_asset_tag?: string` — links to a `ui.asset.v1`
    - `description?: string`

- `ui.asset.v1`
  - Purpose: images/icons/docs and other media to preview templates and be referenced by instances.
  - Tags: `workspace:*`, `ui:asset`, optional `asset:*`, `component:*`.
  - Context:
    - `kind: "image" | "icon" | "doc" | "json" | "html" | "text"`
    - `content_type: string`
    - `url?: string` — external CDN or internal proxy
    - `data_base64?: string` — optional inline payload for small assets
    - `width?: number`, `height?: number`, `alt?: string`

- Optional: `ui.state.v1`
  - Purpose: long-lived state projections when we want a materialized view separate from the instance.

- `ui.composite.v1` (NEW)
  - Purpose: express multi-node, structured components (e.g., Modal, Drawer, Popover, Table, Navbar, Breadcrumbs) as a single logical record
  - Tags: `workspace:*`, `ui:composite`
  - Context:
    - `name: string` — composite name (e.g., "Modal")
    - `graph: Array<{ id?: string, component_ref: string, props?: object, parent_id?: string, slot?: string }>` — nodes with parent/slot relations
    - `expansion: 'ui.instance.v1[]' | 'inline'` — how UI Forge expands the composite

- `ui.validation.v1` (NEW)
  - Purpose: machine-readable validation feedback for LLMs and agents
  - Tags: `workspace:*`, `ui:validation`
  - Context:
    - `ok: boolean`
    - `errors?: Array<{ code: string, path: string, message: string, suggestion?: any }>` — deterministic error codes with pointers and fix suggestions
    - `summary?: string`

Why: Templates enable scalable reuse; assets enable visual palettes; state projections keep views clean for large UIs.

---

### 4) Seeding Strategy (HeroUI Full Palette)

We will build a seeder that:
1. Reads all registered components from `ComponentRegistry.getTypes()`.
2. Creates one `ui.template.v1` per component (and optional variants) with sensible `default_props`.
3. Creates optional `ui.asset.v1` preview images and links via `preview_asset_tag`.
4. Idempotency: search-by-title+tags before create to avoid duplicates.
5. Optionally seeds a reference workspace `workspace:showcase` with a layout/theme/styles and a sample selection of `ui.instance.v1` cloned from templates into regions.

Result: The Builder’s palette can query `ui:template` + `palette:heroui` and render previews from `ui.asset.v1`.

Design updates for correctness and robustness:
- Templates are a source for cloning, not a live reference. Instances should be independent after creation.
- Instances may include `created_from_template: <id>` for audit only (no implicit coupling).
- A validation step must confirm `default_props` are render-safe before seeding.
- For composite components, prefer authoring `ui.composite.v1` templates and letting UI Forge expand them into `ui.instance.v1[]` on apply.

---

### 5) Event and Interaction Model

- Instances carry `bindings` for event names. `ComponentRenderer` executes actions:
  - `emit_breadcrumb`: write `ui.event.v1` with `triggered_by`, `event_name`, `event_data`, `timestamp` and workspace tag.
  - `update_state`: in-memory only (keeps UI responsive without writes).
  - `update_breadcrumb`: persisted instance changes (uses optimistic concurrency via `If-Match`).
  - `call_api`: side-effects; result may be stored as breadcrumbs
  - `navigate`: UI-level navigation event or URL change.

Why: keeps UI declarative and stateless by default; emits durable facts as breadcrumbs for agents.

---

### 6) Subscriptions and Grouping

- Use Selectors for agent/app subscriptions:
  - Workspaces: `any_tags: ["workspace:demo"]`
  - Roles: `all_tags: ["ui:instance"]`
  - Component families: `all_tags: ["ui:template","component:Card"]`
  - Events feed: `all_tags: ["ui:event","workspace:demo"]`

Why: Agents operate on groups instead of single IDs, enabling adaptive behavior and autonomous curation.

---

### 7) Required Changes (Code)

- SDK alignments
  - `getBreadcrumb(id, 'full')`: call `GET /breadcrumbs/:id/full`; `getBreadcrumb(id)` → `GET /breadcrumbs/:id`.
  - `updateBreadcrumb`: use `PATCH /breadcrumbs/:id` with `If-Match` header.
  - `batchGet(ids, 'full')`: map to `getBreadcrumbFull` per ID.
  - `listAcls`: call `/acl`.
  - `createOrUpdateAgent`: call `POST /agents/:id`.
  - `vectorSearch`: either add SDK support for server’s current `GET /breadcrumbs/search` or add a server POST endpoint for parity.

- New seeding util
  - A script or route to seed templates/assets/workspaces idempotently using `RcrtClientEnhanced('/api/rcrt')`.

- Builder palette
  - Query `ui.template.v1` via tags and display previews from `ui.asset.v1`.

---

### 8) Build Plan (Milestones)

M1. SDK/server parity
  - Implement SDK route/method corrections
  - Smoke test Demo/Showcase with your Docker backend on port 8081

M2. Templates and assets
  - Add docs for `ui.template.v1` and `ui.asset.v1`
  - Implement seeding util generating templates for all HeroUI components
  - Add optional preview assets

M3. Palette integration
  - Update `BuilderPalette` to list templates via selectors and show previews
  - Add “instantiate from template” action (clone template → `ui.instance.v1` in selected region)

M4. Event surfacing
  - Add Builder panel to stream `ui:event.v1` for current workspace (SSE)
  - Filter by `component:*`/`region:*`

M5. Optional server enhancements
  - Consider adding batch endpoints for `get full` to reduce client round-trips
  - Optional POST vector search if desired by SDK

M6. Validation and metadata
  - Add a validation layer that server-side renders each component with `default_props` (ReactDOMServer) and accepts only passing presets
  - Ingest HeroUI metadata into a `ui.component.v1` catalog for authoring/AI: prop schema, events, accessibility, relationships, install/import strings
  - Keep `ui.template.v1` lean; templates reference `component_type` and provide only safe `default_props`

M7. Composite + LLM loop
  - Implement `ui.composite.v1` with expansion to `ui.instance.v1[]` (parent/slot semantics)
  - Add `ui.validation.v1` and a validate-only (dry-run) endpoint
  - Document LLM contract and correction loop; emit clear fix suggestions

---

### 9) Rationale

- Data-first UI keeps rendering deterministic and auditable. Every change is a breadcrumb.
- Templates + assets create a scalable design system the Builder and agents can reason about.
- Agents remain autonomous, subscribing to groups and acting on events, while UI remains thin.
- Aligning SDK and server eliminates subtle runtime errors, reduces friction for agents and Builder.

---

### 10) Operational Notes

- Ports: your Docker server is on 8081. The Next.js proxy defaults already support this; seeding tools should use `/api/rcrt` so they inherit proxy config. The default SDK base URL should remain `http://localhost:8081` in development.
- Auth: dev can run with `AUTH_MODE=disabled` + `OWNER_ID`/`AGENT_ID`. Production uses JWT + ACLs.
- Idempotency: use `Idempotency-Key` for bulk seeding and client-side retries.

---

### 11) Acceptance Criteria

- Demo and Showcase render entirely from breadcrumbs.
- Templates for all registered HeroUI components exist in `workspace:builder` with tags for discovery.
- Palette lists templates with image previews; “add to canvas” creates `ui.instance.v1` in a region.
- Interactions emit `ui.event.v1`; agents can subscribe by selector and act.
- SDK calls match server routes; no 404/405/409 surprises in normal flows.

---

### 12) Appendix: Example Records

- Template (Card / Primary)
```
{ "schema_name": "ui.template.v1", "title": "Template: Card / Primary", "tags": ["workspace:builder","ui:template","component:Card","variant:primary","palette:heroui"], "context": { "component_type": "Card", "default_props": { "className": "p-6", "children": "Card content" }, "preview_asset_tag": "asset:card:primary" } }
```

- Asset (Card preview)
```
{ "schema_name": "ui.asset.v1", "title": "Asset: Card / Primary", "tags": ["workspace:builder","ui:asset","asset:card:primary","component:Card"], "context": { "kind": "image", "content_type": "image/png", "url": "https://cdn.example.com/assets/card-primary.png", "width": 640, "height": 360, "alt": "Card primary" } }
```

- Instance from template
```
{ "schema_name": "ui.instance.v1", "title": "Card: Welcome", "tags": ["workspace:demo","ui:instance","region:content"], "context": { "component_ref": "Card", "props": { "className": "p-6", "children": "Welcome" }, "order": 1, "created_from_template": "<template_id_or_tag>" } }

---

### 13) Metadata Extraction and Validation Strategy

- Source-of-truth for component metadata
  - Prefer a curated, versioned catalog (`ui.component.v1`) per HeroUI release
  - Programmatic augmentation via TypeScript type inspection (e.g., ts-morph over `@heroui/react` `.d.ts`) to enumerate props and event names
  - Optional doc-driven enrichments: accessibility notes, relationships, slots, links to documentation and storybook

- Generating safe `default_props`
  - Curated defaults per component for reliable seeding (sizes, colors, variants, `children` text)
  - Fallback heuristics: use library defaults; avoid functions/non-serializable values; omit uncontrolled props
  - Validate each preset by server-side rendering (ReactDOMServer.renderToString) using the registered component; if render fails, fall back to a more minimal preset

- Preview assets
  - Stage 1: create text/documentation assets (`ui.asset.v1`) linking to official docs or inline descriptions
  - Stage 2: generate visual previews via headless browser screenshots against a `/preview` route that renders each template; store as CDN URLs or data URIs, then reference via `preview_asset_tag`
```

---

This plan delivers a predictable, scalable, and agent-friendly UI runtime where everything (templates, instances, assets, events) is represented as breadcrumbs, and agents subscribe to groups to provide autonomous behavior.


