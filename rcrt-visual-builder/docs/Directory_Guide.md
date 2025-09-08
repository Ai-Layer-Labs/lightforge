## RCRT Visual Builder – Directory Guide

This guide explains the purpose of each directory and key files in the `rcrt-visual-builder` workspace, how they connect, and typical commands to use.

### Top-level

- `package.json`: Workspace-level scripts (build, dev, bootstrap) and shared dev deps.
- `pnpm-workspace.yaml`: Declares the monorepo packages: `packages/*` and `apps/*`.
- `tsconfig.json`: Shared TS config and path aliases (e.g., `@rcrt-builder/sdk` → `packages/sdk/src`).
- `docker-compose.yml`: Services for dev (builder, agent-runner). Adjust ports/envs here.
- `Dockerfile.builder`, `Dockerfile.agent`: Docker builds for the Next.js builder app and the agent runner.
- `scripts/bootstrap.ts`: Seeds RCRT with everything needed (workspace, tools, agents, UI layout/theme/styles, UI instances). Idempotent via keys.
- `docs/`: Project documentation. See `Dynamic_UI.md` for breadcrumb-driven UI. This file provides the tree overview.

### apps/

#### apps/builder
Next.js 14 application that renders the UI entirely from breadcrumbs.
- `app/layout.tsx`: Root HTML; includes providers and global CSS.
- `app/providers.tsx`: Wraps app with `next-themes` and `HeroUIProvider`.
- `app/page.tsx`: Client page that loads `UILoader` (client-side) full-screen.
- `app/api/rcrt/[...path]/route.ts`: Proxy for all RCRT REST/SSE (browser → same-origin → backend), avoids CORS.
- `globals.css`: Tailwind base & some legacy styles.
- `next.config.js`: Transpile internal packages; proxy rewrite `/rcrt/:path* → /api/rcrt/:path*`.
- `tailwind.config.js`: Tailwind + HeroUI plugin and content globs (includes local packages).
- `lib/workflow-executor.ts`: Utility placeholder for executing flows in the UI context (if needed later).

Typical commands:
- Dev: `pnpm --filter @rcrt-builder/builder-app dev -p 3000`
- Build: `pnpm --filter @rcrt-builder/builder-app build`

#### apps/agent-runner
Small service wrapper to run agents and flows outside the browser.
- `src/index.ts`: Entry point to run the runtime with configuration.

### packages/

#### packages/core
Core type system and JSON schemas for breadcrumbs, agents, flows, UI, etc.
- `src/index.ts`: Exports schemas/types.
- `src/schemas/*`: Schema definitions (e.g., `ui.layout.v1`, `ui.instance.v1`).
- `src/validators/*`: Lightweight validators for schema shapes.

Used by: SDK, runtime, UI, and bootstrap.

#### packages/sdk
Universal TypeScript SDK for the RCRT backend (browser + Node).
- `src/index.ts`:
  - REST CRUD for breadcrumbs (`create`, `get`, `update`, `delete`).
  - Search (`/breadcrumbs`, `/search`, `/search/vector`).
  - Agents/Tenants/ACL/Secrets helpers.
  - SSE client (`startEventStream`) with robust absolute URL building and browser/node compatibility.

Used by: builder app (via proxy), custom components, bootstrap script.

#### packages/runtime
Runtime helpers for executing flows and agents (server-side). Includes SSE utilities and agent executors.
- `src/runtime-manager.ts`: Orchestration of runtime lifecycle.
- `src/executor/*`: Execution primitives.
- `src/agent/*`: Agent runner utilities.

Used by: `apps/agent-runner`.

#### packages/node-sdk
Developer kit for authoring visual nodes outside the UI. Provides dev server, registry and tooling.
- `src/dev-server.ts`: Hot reloading server for node development.
- `src/registry.ts`: Node registration/lookup.

#### packages/nodes/*
Modular node families. Each subpackage exposes nodes with a simple interface (type, ports, config, execute). Examples:
- `llm/`, `agent/`, `breadcrumb/`, `utility/`, `database/`, `security/`, `observability/`, `search/`.

Used by: runtime and later by the visual builder to render and configure nodes.

#### packages/ui
General UI building blocks (not used for canvas now). Contains shared components and hooks.
- `src/components/*`: Reusable UI parts.
- `src/hooks/useRCRT.ts`: React hook wrapping the enhanced SDK with proxy awareness.
- `stores/*`: Zustand stores where applicable.

#### packages/management
Admin/management UI widgets (AgentPanel, etc.).

#### packages/heroui-breadcrumbs
Dynamic UI layer that renders HeroUI components and custom builder widgets from breadcrumbs.
- `src/renderer/UILoader.tsx`:
  - Fetches workspace breadcrumbs via SDK (through Next proxy `/api/rcrt`).
  - Strictly requires `ui.layout.v1`; if missing, renders an explicit error (no flat fallback).
  - Loads `ui.theme.v1`, `ui.styles.v1` and all `ui.instance.v1` by `schema_name`.
  - Renders regions defined by layout; mounts instances tagged `region:<name>` ordered by `context.order`.
  - Injects inline CSS and applies theme (via app provider).
- `src/renderer/ComponentRenderer.tsx`:
  - Resolves `component_ref` to a React component from the registry.
  - Wires event bindings (e.g., `emit_breadcrumb`, `update_breadcrumb`, `call_api`, `navigate`).
- `src/registry/registerComponents.ts`:
  - Registers HeroUI components and custom `BuilderCanvas`, `BuilderPalette` with the registry.
- `src/custom/BuilderCanvas.tsx` / `src/custom/BuilderPalette.tsx`:
  - Minimal WIP components for canvas/palette rendered by breadcrumbs.
- `src/index.tsx`: Exports public APIs of this package.

### scripts/

#### scripts/bootstrap.ts
Idempotent initializer that seeds the RCRT backend.
- Creates workspace + tool catalog + meta-agent + templates + example flow.
- Seeds UI:
  - `ui.layout.v1` with regions: `top`, `content`, `right`.
  - `ui.theme.v1` and `ui.styles.v1` for theming and CSS tweaks.
  - `ui.instance.v1` for Navbar (top), Save Button (top), `BuilderCanvas` (content), `BuilderPalette` (right).

Run via: `pnpm bootstrap` (or `pnpm exec tsx scripts/bootstrap.ts`).

### How pieces connect

1) Start the builder app. It proxies to the backend.
2) `UILoader` fetches workspace breadcrumbs and renders layout and instances.
3) Instances map `component_ref` to concrete components (HeroUI or custom) via the registry.
4) Events from components can emit/update breadcrumbs, call APIs, or navigate.
5) SSE (via SDK) enables live updates.

### Common tasks

- Re-seed UI or update defaults: edit `scripts/bootstrap.ts` and re-run.
- Add a new UI component:
  1. Implement it (e.g., in `packages/heroui-breadcrumbs/src/custom/MyWidget.tsx`).
  2. Register it in `registerComponents.ts`.
  3. Create a `ui.instance.v1` breadcrumb with `component_ref: 'MyWidget'` and a `region:<name>` tag.

### Notes

- All UI is data-driven. The builder app contains no fixed pages; layout and components are defined via breadcrumbs.
- The Next.js API route is required for browser CORS and SSE streaming.
- The runtime/agent-runner are optional for the UI bootstrap to render, but required to execute flows.


