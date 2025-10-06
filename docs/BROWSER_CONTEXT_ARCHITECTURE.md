# Browser Context Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Browser                           │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Active Tab: github.com/RCRT/docs                          │ │
│  │                                                           │ │
│  │  • Title: "RCRT Documentation"                           │ │
│  │  • Content: Introduction, Architecture...                │ │
│  │  • Links: [Get Started], [API Docs]...                   │ │
│  │  • Interactive: 23 clickable elements                    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                           ↓                                     │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Extension Background Service                              │ │
│  │                                                           │ │
│  │  Page Context Tracker                                    │ │
│  │  • Detects: tab change, navigation, reload               │ │
│  │  • Captures: buildDomTree() → page data                  │ │
│  │  • Updates: browser.page.context.v1 breadcrumb           │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                      RCRT Core (Rust)                           │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Living Breadcrumb: browser.page.context.v1                │ │
│  │                                                           │ │
│  │  {                                                        │ │
│  │    title: "Browser: RCRT Documentation",                 │ │
│  │    schema_name: "browser.page.context.v1",               │ │
│  │    version: 42,  ← Optimistic locking                    │ │
│  │    tags: ["browser:context", "url:github.com"],          │ │
│  │    context: {                                            │ │
│  │      url, title, domain, content, dom,                   │ │
│  │      llm_hints: { /* Transform for LLMs */ }             │ │
│  │    }                                                      │ │
│  │  }                                                        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                           ↓                                     │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ NATS Event Bus                                            │ │
│  │                                                           │ │
│  │  bc.{id}.updated event published                         │ │
│  │  → All subscribed agents notified                        │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Agent Runner (Node.js)                        │
│                                                                 │
│  ┌────────────────────┐  ┌────────────────────┐               │
│  │ Page Assistant     │  │ Page Summarizer    │               │
│  │                    │  │                    │               │
│  │ Subscription:      │  │ Subscription:      │               │
│  │ • schema_name:     │  │ • schema_name:     │               │
│  │   browser.page     │  │   browser.page     │               │
│  │   .context.v1      │  │   .context.v1      │               │
│  │ • any_tags:        │  │ • auto_trigger:    │               │
│  │   [browser:active  │  │   on_page_change   │               │
│  │    -tab]           │  │                    │               │
│  │                    │  │                    │               │
│  │ ↓ Receives update  │  │ ↓ Receives update  │               │
│  │                    │  │                    │               │
│  │ Sees:              │  │ Sees:              │               │
│  │ • "User viewing    │  │ • Auto-creates     │               │
│  │    GitHub docs"    │  │   summary          │               │
│  │ • Page has 3       │  │ • "Main topic: X"  │               │
│  │   sections         │  │ • "Key sections:   │               │
│  │ • 45 links         │  │   Y, Z"            │               │
│  │ • 23 interactive   │  │ • "TL;DR: ..."     │               │
│  │   elements         │  │                    │               │
│  │                    │  │                    │               │
│  │ Can respond to:    │  │ Automatically:     │               │
│  │ "What's on page?"  │  │ Posts summary      │               │
│  │ "Find signup btn"  │  │ to chat            │               │
│  └────────────────────┘  └────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Detail

### 1. Page Capture (Extension)

```typescript
// Runs in page context
buildDomTree() →
  {
    rootId: "0",
    map: { /* Full DOM */ },
    interactiveElements: {
      5: { tag: "a", xpath: "/html/body/div/a[1]", text: "Get Started" },
      8: { tag: "button", xpath: "/html/body/form/button", text: "Sign Up" }
    }
  }

Extract content →
  {
    mainText: "RCRT is a breadcrumb-centric...",
    headings: ["Introduction", "Architecture", "Quick Start"],
    links: [
      { text: "Get Started", href: "/docs/start" },
      { text: "API Reference", href: "/docs/api" }
    ],
    images: [...]
  }

Get metadata →
  {
    description: "Event-driven system for AI agents",
    keywords: ["breadcrumbs", "events", "agents"],
    ogTitle: "RCRT - Right Context Right Time"
  }
```

### 2. Breadcrumb Update (RCRT Core)

```rust
// Rust server
PATCH /breadcrumbs/{id}
If-Match: version=41

→ Optimistic locking check
→ Update context with new page data
→ Apply llm_hints transform
→ Increment version to 42
→ Publish to NATS: bc.{id}.updated
```

### 3. LLM Hints Transform (Server-Side)

```json
// Original context (technical)
{
  "url": "https://github.com/RCRT/docs",
  "domain": "github.com",
  "title": "RCRT Documentation",
  "content": {
    "mainText": "RCRT is a breadcrumb-centric...",
    "headings": ["Introduction", "Architecture"],
    "links": [{"text": "Get Started", "href": "/start"}]
  },
  "dom": {
    "map": { /* 1000+ nodes */ },
    "interactiveElements": { /* 23 elements */ }
  }
}

// After llm_hints transform (LLM-friendly)
{
  "summary": "The user is viewing 'RCRT Documentation' at github.com. 
              The page has 2 sections and 45 links.",
  "interactive_summary": "There are 23 interactive elements on this page.",
  "page_text": "RCRT is a breadcrumb-centric event-driven system...",
  "page_structure": {
    "headings": ["Introduction", "Architecture"],
    "key_links": [{"text": "Get Started", "href": "/start"}],
    "forms_present": false
  },
  "url": "https://github.com/RCRT/docs",
  "domain": "github.com",
  "title": "RCRT Documentation"
  // Note: dom.map excluded (too verbose for LLM)
}
```

### 4. Agent Processing (Agent Runner)

```typescript
// Agent receives SSE event
event: breadcrumb.updated
data: {
  breadcrumb_id: "xxx",
  schema_name: "browser.page.context.v1",
  tags: ["browser:active-tab", "url:github.com"]
}

// Agent fetches full breadcrumb (with llm_hints applied)
const breadcrumb = await client.getBreadcrumb(event.breadcrumb_id);

// Agent's LLM sees clean, natural language:
`
The user is viewing 'RCRT Documentation' at github.com. 
The page has 2 sections and 45 links.

Page content:
RCRT is a breadcrumb-centric event-driven system...

Page structure:
- Introduction
- Architecture

Key links:
- Get Started (/start)
- API Reference (/api)
`

// Agent can now answer intelligently:
User: "What's on this page?"
Agent: "You're viewing the RCRT Documentation. It covers Introduction 
        and Architecture sections. Would you like me to explain either?"
```

## Update Triggers & Debouncing

```
┌──────────────────────────────────────────────────────────┐
│ User Actions                                             │
└──────────────────────────────────────────────────────────┘
  │
  ├─→ Tab activation (switch to different tab)
  │   └─→ scheduleUpdate(tabId) → debounce 500ms
  │
  ├─→ Navigation (click link, type URL, back/forward)
  │   └─→ webNavigation.onCommitted → scheduleUpdate(tabId)
  │
  ├─→ Page reload (F5, refresh button)
  │   └─→ tabs.onUpdated (status=complete) → scheduleUpdate(tabId)
  │
  └─→ Manual trigger (future: button in extension)
      └─→ pageContextTracker.forceUpdate()

┌──────────────────────────────────────────────────────────┐
│ Debounce Timer (500ms)                                   │
│                                                          │
│  First trigger starts timer                              │
│  Additional triggers restart timer                       │
│  After 500ms of quiet: Execute capture                   │
└──────────────────────────────────────────────────────────┘
  │
  ├─→ Inject buildDomTree.js (if needed)
  ├─→ Execute page capture script
  ├─→ Update breadcrumb (with version check)
  └─→ NATS event published

Result: Max 1 update per 500ms, even with rapid navigation
```

## Concurrency Handling

```
Scenario: Two tabs update same breadcrumb simultaneously

Tab A                        Tab B
  │                            │
  ├─ Capture page (v41)        │
  │                            ├─ Capture page (v41)
  │                            │
  ├─ PATCH with If-Match: 41   │
  │   ✅ Success! → v42         │
  │                            │
  │                            ├─ PATCH with If-Match: 41
  │                            │   ❌ 412 Precondition Failed!
  │                            │
  │                            ├─ Fetch current (v42)
  │                            ├─ Retry with If-Match: 42
  │                            │   ✅ Success! → v43

Optimistic locking ensures no data loss!
```

## Performance Characteristics

```
Operation                      Time        Notes
─────────────────────────────────────────────────────────────
buildDomTree execution         ~50-200ms   Depends on page size
Content extraction             ~5-20ms     Text, links, headings
Breadcrumb API call            ~10-50ms    Network + DB
Total page capture             ~100-300ms  Acceptable latency

Update frequency               Max 1/500ms Debounced
Breadcrumb size                ~10-50KB    With content limits
Memory footprint               Minimal     Single breadcrumb
```

## Next Phase: Browser Actions

```
┌─────────────────────────────────────────────────────────────┐
│                    Current: READ ONLY ✅                     │
│                                                             │
│  Browser → Context Breadcrumb → Agents see page            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   Next: WRITE ACTIONS 🔄                     │
│                                                             │
│  Agent → Action Breadcrumb → Extension executes            │
│                                                             │
│  browser.action.v1:                                         │
│  {                                                          │
│    action: "click",                                         │
│    target: {                                                │
│      highlightIndex: 5,  ← From page context                │
│      xpath: "/html/body/div/a[1]",                         │
│      text: "Get Started"                                    │
│    }                                                        │
│  }                                                          │
│                                                             │
│  Extension listens → Executes via Chrome DevTools Protocol │
│  → Returns result as breadcrumb                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Future: WORKFLOWS 🔮                        │
│                                                             │
│  Multi-step automation:                                     │
│  1. Read context                                            │
│  2. Click "Sign Up"                                         │
│  3. Type email                                              │
│  4. Type password                                           │
│  5. Click submit                                            │
│  6. Verify success                                          │
│                                                             │
│  All orchestrated by agents via breadcrumbs!                │
└─────────────────────────────────────────────────────────────┘
```

## Key Innovation: LLM Hints

Traditional approach:
```json
// Dump everything to LLM
{
  "dom": { /* 10KB of nested objects */ },
  "styles": { /* CSS properties */ },
  "attributes": { /* 100s of HTML attrs */ }
}
```

RCRT approach with llm_hints:
```json
// Server-side transform before LLM sees it
{
  "summary": "Natural language description of page",
  "page_text": "Clean extracted content",
  "page_structure": { /* Organized, relevant data */ }
}
```

**Benefits:**
- ✅ Smaller context window usage (10x reduction)
- ✅ Faster LLM processing
- ✅ Better LLM understanding (natural language)
- ✅ Consistent formatting across agents
- ✅ Privacy (exclude sensitive fields)

## Security Model

```
Extension Permissions:
├─ tabs ✓           (read tab info)
├─ activeTab ✓      (access current page)
├─ scripting ✓      (inject buildDomTree)
└─ storage ✓        (save breadcrumb ID)

Data Flow:
User's Browser
  ↓ (localhost only)
RCRT Server (local)
  ↓ (NATS/SSE - local)
Agent Runner (local)

❌ No external APIs
❌ No data sent to cloud
❌ No tracking
✅ All data stays local
```

## Summary

**What it is:**
A living breadcrumb that gives agents real-time visibility into the user's current webpage

**How it works:**
Extension captures → Updates breadcrumb → NATS event → Agents receive → LLM sees clean context

**Why it matters:**
Foundation for intelligent browser assistance and automation - agents can finally "see" what users see

**What's next:**
Browser actions (clicking, typing, navigation) to enable full automation workflows
