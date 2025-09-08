## RCRT Dynamic UI (UI Forge with HeroUI)

This guide explains how to build fully dynamic UIs using RCRT breadcrumbs and HeroUI components. The entire UI (layout, theme, styles, and components) is defined as data and rendered at runtime by the UILoader. No legacy fallbacks, no hidden defaults.

---

### Why UI Forge?

- Data-first UI: pages are described by breadcrumbs, not hardcoded React trees
- Fast iteration: create/update/delete UI via API calls; no rebuilds
- Predictable behavior: strict schema/tag rules, no silent fallbacks
- Works with 210+ HeroUI components out of the box

---

### Core Concepts

- Workspace: a logical namespace identified by a tag, e.g. `workspace:demo`
- Breadcrumb: an immutable record with `title`, `tags`, and `context`
- UILoader: a client-side renderer that reads breadcrumbs and builds the UI
- Component Registry: maps `component_ref` names to real React components

---

### Schemas

UI Forge uses these schemas for the UI surface:

1) Layout (required)
```json
{
  "schema_name": "ui.layout.v1",
  "title": "Builder Layout",
  "tags": ["workspace:builder", "ui:layout"],
  "context": {
    "regions": ["top", "content", "right"],
    "container": {
      "className": "min-h-screen flex flex-col bg-content"
    },
    "regionStyles": {
      "top": { "className": "border-b border-default bg-background" },
      "content": { "className": "flex-1 container mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6" },
      "right": { "className": "w-full lg:w-80 p-3 border-l border-default" }
    }
  }
}
```

2) Component Instance (one per rendered item)
```json
{
  "schema_name": "ui.instance.v1",
  "title": "Navbar: Builder",
  "tags": ["workspace:builder", "ui:instance", "region:top"],
  "context": {
    "component_ref": "Navbar",
    "props": {
      "shouldHideOnScroll": false,
      "className": "z-10"
    },
    "bindings": {
      "onPress": {
        "action": "emit_breadcrumb",
        "payload": {
          "schema_name": "ui.event.v1",
          "title": "Nav Press",
          "tags": ["workspace:builder", "ui:event"],
          "context": { "path": "/" }
        }
      }
    },
    "order": 0
  }
}
```

3) Theme (optional)
```json
{
  "schema_name": "ui.theme.v1",
  "title": "Builder Theme",
  "tags": ["workspace:builder", "ui:theme"],
  "context": {
    "className": "light",
    "layout": { "radius": 10 },
    "colors": { "primary": "#0072f5", "success": "#17c964" }
  }
}
```

4) Inline CSS (optional)
```json
{
  "schema_name": "ui.styles.v1",
  "title": "Inline CSS",
  "tags": ["workspace:builder", "ui:styles"],
  "context": { "css": ":root{--rcrt-accent:#0072f5;} .container{max-width:1280px;}" }
}
```

Notes:
- Instances are placed into regions via `tags: ["region:<name>"]`.
- Ordering within a region is controlled by `context.order` (ascending). If equal, creation time is the tiebreaker.

---

### UILoader Contract

Props:
- `workspace: string` - required workspace tag
- `rcrtUrl?: string` or `rcrtClient?: RcrtClientEnhanced` - optional override
- `onEvent?: (eventName: string, data: any) => void` - event hook
- `className?: string` - wrapper class

Behavior:
1. `searchBreadcrumbs({ tag: workspace })` to fetch summaries
2. `batchGet(ids, 'full')` to fetch full context
3. Extract:
   - Layout: schema_name `ui.layout.v1` (or tag `ui:layout`)
   - Theme: schema_name `ui.theme.v1` (or tag `ui:theme`)
   - Styles: schema_name `ui.styles.v1` (or tag `ui:styles`)
   - Instances: schema_name `ui.instance.v1` (or tag `ui:instance`)
4. If no layout is found: render an explicit error (no fallback)
5. Render regions from `layout.context.regions`
6. For each region, render instances tagged `region:<name>` in order

Runtime details (from `packages/heroui-breadcrumbs/src/renderer/UILoader.tsx`):
- Theme is applied via `HeroUIProvider`
- Inline CSS is injected via a single `<style id="rcrt-inline-css">`
- Components are resolved by `ComponentRegistry`

---

### Component Registry

Registry file: `packages/heroui-breadcrumbs/src/registry/registerComponents.ts`

- Maps `component_ref` names (e.g., `Button`, `Card`, `Navbar`, `Tabs`) to actual HeroUI components
- You can add more HeroUI components by registering them here
- Custom components can also be registered (e.g., `BuilderCanvas`, `BuilderPalette`)

Example registration snippet:
```ts
import { Button, Card, Navbar, Tabs, Chip } from '@heroui/react';
import { ComponentRegistry } from './ComponentRegistry';

export function registerHeroUIComponents() {
  ComponentRegistry.registerBatch({
    Button,
    Card,
    Navbar,
    Tabs,
    Chip
  });
}
```

---

### Events & Bindings

Supported actions in `context.bindings[<event>]`:
- `emit_breadcrumb`: Create a new breadcrumb from `payload` (UILoader appends metadata like `triggered_by`, `event_name`, `timestamp`, and includes the current `workspace` tag)
- `update_state`: Update local component state (in-memory)
- `update_breadcrumb`: Fetch and patch the current breadcrumb (requires version)
- `call_api`: Make an HTTP request and optionally emit a response breadcrumb
- `navigate`: Emit a navigation event or set `window.location.href`

Example:
```json
{
  "schema_name": "ui.instance.v1",
  "title": "Button: Primary",
  "tags": ["workspace:builder", "ui:instance", "region:content"],
  "context": {
    "component_ref": "Button",
    "props": { "color": "primary", "children": "Click me" },
    "bindings": {
      "onPress": {
        "action": "emit_breadcrumb",
        "payload": {
          "schema_name": "ui.event.v1",
          "title": "Button Pressed",
          "tags": ["workspace:builder", "ui:event"],
          "context": { "message": "Button clicked" }
        }
      }
    },
    "order": 10
  }
}
```

---

### Seeding a Workspace

In the builder app, the demo and showcase pages seed a workspace through the SDK using `/api/rcrt` proxy.

Client setup:
```ts
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
const client = new RcrtClientEnhanced('/api/rcrt');
```

Idempotent create helper:
```ts
async function ensureBreadcrumb(body: any, workspace: string) {
  const existing = await client.searchBreadcrumbs({ tag: workspace });
  const full = await client.batchGet(existing.map((i: any) => i.id), 'full');
  const match = full.find((b: any) => b.title === body.title);
  if (match) return match;
  return client.createBreadcrumb(body);
}
```

Seed order:
1. Create `ui.layout.v1`
2. Create `ui.theme.v1` (optional)
3. Create `ui.styles.v1` (optional)
4. Create `ui.instance.v1` for each region

---

### Integration Checklist (Next.js + Tailwind + HeroUI)

Builder app uses Next.js 14, Tailwind 3, and HeroUI 2.x.

- `app/layout.tsx` imports `./globals.css` and wraps in `HeroUIProvider`
- `app/globals.css` includes Tailwind directives
- `tailwind.config.js` includes:
  - app/pages/components paths
  - monorepo package paths for components (e.g., `packages/heroui-breadcrumbs/src`)
  - HeroUI theme content path (pnpm-friendly)
  - heroui plugin with any theme overrides
- `postcss.config.js` exists with `tailwindcss` and `autoprefixer`
- In UI code, prefer `className` and theme tokens over custom CSS

---

### Troubleshooting

- Missing layout error: Add a `ui.layout.v1` breadcrumb for the workspace
- Nothing appears in a region: Ensure instances include `tags: ["region:<name>", "workspace:<tag>"]`
- Style not applied: Verify Tailwind config content globs include your component source and the HeroUI theme dist
- Chunk load errors in dev: Clear `.next` and restart `next dev`
- Duplicate creation (409): Use an idempotent `ensureBreadcrumb` (search before create)
- Backend summaries missing `schema_name`: UILoader uses tag fallbacks (`ui:layout`, `ui:theme`, etc.) when needed

---

### Minimal End-to-End Example

1) Create layout
```json
{
  "schema_name": "ui.layout.v1",
  "title": "Demo Layout",
  "tags": ["workspace:demo", "ui:layout"],
  "context": {
    "regions": ["top", "content"],
    "container": { "className": "min-h-screen bg-content" },
    "regionStyles": {
      "top": { "className": "border-b p-3" },
      "content": { "className": "p-6" }
    }
  }
}
```

2) Add an instance
```json
{
  "schema_name": "ui.instance.v1",
  "title": "Button: Primary",
  "tags": ["workspace:demo", "ui:instance", "region:content"],
  "context": {
    "component_ref": "Button",
    "props": { "color": "primary", "children": "Click me" },
    "order": 1
  }
}
```

3) Optional: theme and inline CSS as shown above

4) Render
```tsx
import dynamic from 'next/dynamic';
const UILoader = dynamic(() => import('@rcrt-builder/heroui-breadcrumbs/src/renderer/UILoader').then(m => m.UILoader), { ssr: false });

export default function Page() {
  return <UILoader workspace="workspace:demo" />;
}
```

---

### Extending UI Forge

- Register more HeroUI components to expand your palette
- Create custom renderer entries for new schema types (e.g., `ui.menu.v1`)
- Add higher-level templates by saving sets of instances and cloning them
- Wire events to flows/agents to connect UI interactions to your backend logic

---

With this guide, you can confidently build and evolve dynamic UIs entirely from breadcrumbs, using the full power of HeroUI with strict, predictable behavior.


