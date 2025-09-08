## Agentic UI – End‑to‑End Walkthrough (Mocked Example)

This narrative shows a complete interaction across RCRT with UI Forge, agents, SSE, and breadcrumbs. Everything is data-first. All payloads below are example JSONs that would be POSTed/returned via the SDK/API and surfaced via SSE. IDs are illustrative.

Workspace used: `workspace:agentic-demo`

---

### 0) Initial UI surface (pre-seeded)

Layout
```json
{ "schema_name": "ui.layout.v1", "title": "Agentic Demo Layout", "tags": ["workspace:agentic-demo","ui:layout"], "context": { "regions": ["top","content","right"], "container": { "className": "min-h-screen bg-content" }, "regionStyles": { "top": { "className": "border-b p-3" }, "content": { "className": "container mx-auto p-6 grid grid-cols-1 gap-6" }, "right": { "className": "w-full lg:w-96 p-3 border-l" } } } }
```

Theme (optional)
```json
{ "schema_name": "ui.theme.v1", "title": "Demo Theme", "tags": ["workspace:agentic-demo","ui:theme"], "context": { "className": "light", "layout": { "radius": 10 }, "colors": { "primary": "#0072f5" } } }
```

Styles (optional)
```json
{ "schema_name": "ui.styles.v1", "title": "Inline CSS", "tags": ["workspace:agentic-demo","ui:styles"], "context": { "css": ":root{--rcrt-accent:#0072f5;} .note{opacity:.85;}" } }
```

Top bar (Navbar)
```json
{ "schema_name": "ui.instance.v1", "title": "Navbar: Agentic", "tags": ["workspace:agentic-demo","ui:instance","region:top"], "context": { "component_ref": "Navbar", "props": { "className": "z-10" }, "order": 0 } }
```

Right side (initial helper card)
```json
{ "schema_name": "ui.instance.v1", "title": "Helper", "tags": ["workspace:agentic-demo","ui:instance","region:right"], "context": { "component_ref": "Card", "props": { "className": "p-4", "children": "Ask the assistant anything…" }, "order": 0 } }
```

---

### 1) User asks a question (UI emits an event)

In the page a simple input sends an event (via a `Button` binding `emit_breadcrumb`).

Event
```json
{ "schema_name": "ui.event.v1", "title": "User Query", "tags": ["workspace:agentic-demo","ui:event","component:Input"], "context": { "event_id": "evt-0001", "triggered_by": "c2b7…(input_instance_id)", "event_name": "onSubmit", "event_data": { "text": "Find the best 2 laptops under $1200 and show me pictures" }, "timestamp": "2025-09-08T10:00:03Z", "text": "User requested best laptops under $1200 with images" } }
```

Selector (registered via /subscriptions/selectors by the orchestrator agent)
```json
{ "any_tags": ["workspace:agentic-demo"], "all_tags": ["ui:event"] }
```

Workspace SSE (single stream)
```
GET /events/stream   // client-side store fans out updates to components
```

---

### 2) Orchestrator agent plans a small UI to present options

Mock LLM thought (orchestrator)
```
User intent: laptop recommendations with visuals. Build a small chooser UI with two options (Gaming, Ultrabook). Also stage a results area. Ask specialist agents to fetch 3 links & images each.
```

Plan (ui.plan.v1)
```json
{ "schema_name": "ui.plan.v1", "title": "Build chooser", "tags": ["workspace:agentic-demo","ui:plan"], "context": { "actions": [
  { "type": "create_instance", "region": "content", "instance": { "component_ref": "Card", "props": { "className": "p-4", "children": "Pick a category" }, "order": 0 } },
  { "type": "create_instance", "region": "content", "instance": { "component_ref": "Button", "props": { "color": "primary", "children": "Gaming" }, "bindings": { "onPress": { "action": "emit_breadcrumb", "payload": { "schema_name": "ui.event.v1", "title": "Category Chosen", "tags": ["workspace:agentic-demo","ui:event"], "context": { "category": "gaming" } } } }, "order": 1 } },
  { "type": "create_instance", "region": "content", "instance": { "component_ref": "Button", "props": { "color": "secondary", "children": "Ultrabook" }, "bindings": { "onPress": { "action": "emit_breadcrumb", "payload": { "schema_name": "ui.event.v1", "title": "Category Chosen", "tags": ["workspace:agentic-demo","ui:event"], "context": { "category": "ultrabook" } } } }, "order": 2 } },
  { "type": "create_instance", "region": "content", "instance": { "component_ref": "Card", "props": { "className": "p-4", "children": "Results will appear here…" }, "order": 3 } }
] } }
```

Validation response (ui.validation.v1)
```json
{ "schema_name": "ui.validation.v1", "tags": ["workspace:agentic-demo","ui:validation"], "context": { "ok": true, "summary": "ok" } }
```

Apply result (ui.plan.result.v1)
```json
{ "schema_name": "ui.plan.result.v1", "tags": ["workspace:agentic-demo","ui:plan:result"], "context": { "ok": true, "created": [ { "id": "card-chooser" }, { "id": "btn-gaming" }, { "id": "btn-ultrabook" }, { "id": "card-results" } ] } }
```

SSE events
```
breadcrumb.created (card-chooser)
breadcrumb.created (btn-gaming)
breadcrumb.created (btn-ultrabook)
breadcrumb.created (card-results)
```

---

### 3) Specialist agents perform web search and stage assets/state

Search requests (domain records)
```json
{ "schema_name": "search.request.v1", "title": "Search: gaming laptops", "tags": ["workspace:agentic-demo","search:request"], "context": { "q": "best gaming laptops under 1200 2025" } }
```
```json
{ "schema_name": "search.request.v1", "title": "Search: ultrabooks", "tags": ["workspace:agentic-demo","search:request"], "context": { "q": "best ultrabooks under 1200 2025" } }
```

Mock LLM/tool responses (top 2 each)
```json
{ "schema_name": "search.result.v1", "title": "Gaming #1", "tags": ["workspace:agentic-demo","search:result","category:gaming"], "context": { "title": "Acer Nitro X", "price": 1099, "link": "https://example.com/acer-nitro-x", "image": "https://cdn.example.com/img/acer-nitro-x.jpg" } }
```
```json
{ "schema_name": "search.result.v1", "title": "Gaming #2", "tags": ["workspace:agentic-demo","search:result","category:gaming"], "context": { "title": "Lenovo Legion Lite", "price": 1199, "link": "https://example.com/legion-lite", "image": "https://cdn.example.com/img/legion-lite.jpg" } }
```
```json
{ "schema_name": "search.result.v1", "title": "Ultrabook #1", "tags": ["workspace:agentic-demo","search:result","category:ultrabook"], "context": { "title": "ASUS ZenBook Air", "price": 1150, "link": "https://example.com/zenbook-air", "image": "https://cdn.example.com/img/zenbook-air.jpg" } }
```
```json
{ "schema_name": "search.result.v1", "title": "Ultrabook #2", "tags": ["workspace:agentic-demo","search:result","category:ultrabook"], "context": { "title": "HP Spectre Slim", "price": 1190, "link": "https://example.com/spectre-slim", "image": "https://cdn.example.com/img/spectre-slim.jpg" } }
```

Agents also create preview assets for thumbnails (optional)
```json
{ "schema_name": "ui.asset.v1", "title": "Asset: Nitro X", "tags": ["workspace:agentic-demo","ui:asset","asset:laptop:acer-nitro-x"], "context": { "kind": "image", "content_type": "image/jpeg", "url": "https://cdn.example.com/img/acer-nitro-x.jpg", "width": 640, "height": 360, "alt": "Acer Nitro X" } }
```

Semantic recall (vector search) – orchestrator pulls recent relevant facts
```json
{ "vector_search": {
  "q": "laptops under 1200 gaming ultrabook with images",
  "filters": { "tag": "workspace:agentic-demo" },
  "nn": 20
} }
```
Results (ids only)
```json
[ { "id": "evt-0001" }, { "id": "gaming-result-1" }, { "id": "ultrabook-result-1" } ]
```

---

### 4) Orchestrator updates the UI with results when user picks a category

User clicks “Gaming” – UI emits an event
```json
{ "schema_name": "ui.event.v1", "title": "Category Chosen", "tags": ["workspace:agentic-demo","ui:event"], "context": { "event_id": "evt-0002", "triggered_by": "btn-gaming", "event_name": "onPress", "event_data": { "category": "gaming" }, "timestamp": "2025-09-08T10:00:32Z", "text": "User chose gaming category" } }
```

Mock LLM thought
```
Replace the results card body with two product cards; each card shows image, name, price, and a “Details” button.
```

Plan
```json
{ "schema_name": "ui.plan.v1", "title": "Render gaming results", "tags": ["workspace:agentic-demo","ui:plan"], "context": { "actions": [
  { "type": "update_instance", "id": "card-results", "updates": { "props": { "children": "" } } },
  { "type": "create_instance", "region": "content", "instance": { "component_ref": "Card", "props": { "className": "p-4", "children": "Acer Nitro X – $1099" } }, "overrides": {} },
  { "type": "create_instance", "region": "content", "instance": { "component_ref": "Image", "props": { "src": "https://cdn.example.com/img/acer-nitro-x.jpg", "alt": "Acer Nitro X", "width": 400, "height": 200 } }, "overrides": {} },
  { "type": "create_instance", "region": "content", "instance": { "component_ref": "Card", "props": { "className": "p-4", "children": "Lenovo Legion Lite – $1199" } } }
] } }
```

Validation → ok; Apply → creates two new Cards and one Image. SSE notifies UI → UI re-renders.

---

### 5) User clicks “Details” on the first result (telemetry & agent follow-up)

Event
```json
{ "schema_name": "ui.event.v1", "title": "Details Clicked", "tags": ["workspace:agentic-demo","ui:event","component:Button"], "context": { "event_id": "evt-0003", "triggered_by": "btn-details-nitrox", "event_name": "onPress", "event_data": { "product": "acer-nitro-x", "price": 1099 }, "timestamp": "2025-09-08T10:01:05Z", "text": "User requested details for acer-nitro-x" } }
```

Orchestrator asks a “specs agent” to fetch key specs
```json
{ "schema_name": "agent.task.v1", "title": "Specs: acer-nitro-x", "tags": ["workspace:agentic-demo","agent:task","category:specs"], "context": { "product": "acer-nitro-x", "fields": ["cpu","gpu","ram","weight","battery"] } }
```

Specs response (mock)
```json
{ "schema_name": "specs.result.v1", "title": "Specs: Nitro X", "tags": ["workspace:agentic-demo","specs:result"], "context": { "cpu": "Intel i7‑1360P", "gpu": "RTX 4060", "ram": "16GB", "weight": "1.9kg", "battery": "8h" } }
```

Plan to show a Drawer with specs
```json
{ "schema_name": "ui.plan.v1", "title": "Show specs drawer", "tags": ["workspace:agentic-demo","ui:plan"], "context": { "actions": [
  { "type": "create_instance", "region": "content", "instance": { "component_ref": "Drawer", "props": { } }, "overrides": {} },
  { "type": "create_instance", "region": "content", "instance": { "component_ref": "Card", "props": { "className": "p-4", "children": "Intel i7‑1360P • RTX 4060 • 16GB • 1.9kg • 8h" } } }
] } }
```

Apply → drawer + specs card appear.

---

### 6) Persisting choices as durable facts (state)

The orchestrator also records the user’s shortlist using a state breadcrumb referenced by the view.

State
```json
{ "schema_name": "ui.state.v1", "title": "Shortlist", "tags": ["workspace:agentic-demo","ui:state","component:shortlist"], "context": { "component_id": "card-results", "key": "shortlist", "value": [ { "id": "acer-nitro-x", "price": 1099 } ], "caused_by": "evt-0003" } }
```

Instance points to the state (pointer prop)
```json
{ "schema_name": "ui.instance.v1", "title": "Shortlist Panel", "tags": ["workspace:agentic-demo","ui:instance","region:right"], "context": { "component_ref": "Card", "props": { "className": "p-4", "state_tag": "ui:state;component:shortlist" }, "order": 10 } }
```

UI resolves the pointer → renders shortlist items.

---

### 7) Final user action and checkout handoff

Event
```json
{ "schema_name": "ui.event.v1", "title": "Checkout", "tags": ["workspace:agentic-demo","ui:event"], "context": { "triggered_by": "btn-checkout", "event_name": "onPress", "event_data": { "ids": ["acer-nitro-x"] }, "timestamp": "2025-09-08T10:02:30Z" } }
```

Agent creates a checkout link and emits a response breadcrumb (or updates a CTA component)
```json
{ "schema_name": "checkout.link.v1", "title": "Checkout Nitro X", "tags": ["workspace:agentic-demo","checkout:link"], "context": { "url": "https://merchant.example/checkout?item=acer-nitro-x&price=1099" } }
```

UI shows a `Link` instance referencing the checkout URL.

---

### 8) Notes & Observability

- Every step generated durable breadcrumbs; agents subscribe by tag or id and receive SSE/webhooks upon create/update/delete.
- UI mutates `ui.instance.v1` only when view structure/props change; otherwise events/state/assets are appended facts.
- Validation precedes apply to prevent runtime errors; apply uses idempotency and `If‑Match`.
- Images are carried as `ui.asset.v1` or external URLs; components reference by props or tags.

This end‑to‑end trace can be replayed by posting the JSONs in order (validating plans where shown) in a clean workspace `workspace:agentic-demo`.


