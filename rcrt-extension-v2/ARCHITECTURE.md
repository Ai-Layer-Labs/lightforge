# RCRT Browser Extension v2 - Architecture

## Core Principle: Everything is a Breadcrumb

Unlike Think Extension (Chrome storage), RCRT Extension v2 stores **everything as breadcrumbs**:

| Data Type | Schema | Storage |
|-----------|--------|---------|
| Notes | `note.v1` | Breadcrumb |
| Tags | `note.tags.v1` | Breadcrumb |
| Summaries | `note.summary.v1` | Breadcrumb |
| Insights | `note.insights.v1` | Breadcrumb |
| ELI5 | `note.eli5.v1` | Breadcrumb |
| Chat Messages | `user.message.v1` | Breadcrumb |
| Agent Responses | `agent.response.v1` | Breadcrumb |
| Tab Contexts | `browser.tab.context.v1` | Breadcrumb |
| **Settings** | `extension.settings.v1` | **Breadcrumb** |
| **UI State** | `extension.ui-state.v1` | **Breadcrumb** |

**Only ephemeral runtime state** stays in Chrome storage:
- JWT token (security)
- Cache keys (performance)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                  RCRT Browser Extension v2                       │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Side Panel (React + TailwindCSS)                          │ │
│  │                                                            │ │
│  │  ┌─────────┬─────────┬─────────┬──────────┐              │ │
│  │  │  Chat   │  Notes  │  Save   │ Settings │  ← Tabs     │ │
│  │  └─────────┴─────────┴─────────┴──────────┘              │ │
│  │                                                            │ │
│  │  Chat: user.message.v1 → agent.response.v1                │ │
│  │  Notes: Semantic search (pgvector)                        │ │
│  │  Save: note.v1 → 4 agents process in parallel             │ │
│  │  Settings: extension.settings.v1 (breadcrumb!)            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  RCRT Client Library                                       │ │
│  │  • JWT authentication                                      │ │
│  │  • Breadcrumb CRUD                                         │ │
│  │  • Vector search                                           │ │
│  │  • SSE subscription (auto-reconnect)                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Background Service Worker (MV3)                           │ │
│  │  • TabContextManager (multi-tab tracking)                  │ │
│  │  • SettingsManager (breadcrumb-based)                      │ │
│  │  • UIStateManager (breadcrumb-based)                       │ │
│  │  • Context menus                                           │ │
│  │  • Alarms (periodic capture)                               │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ REST API + SSE
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RCRT Server (Rust)                          │
│  • PostgreSQL + pgvector (unlimited storage)                   │
│  • NATS JetStream (pub/sub events)                             │
│  • SSE streams (/events/stream)                                │
│  • JWT authentication                                           │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ SSE Events
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Agent Runner (Node.js)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Note Processing Agents (Parallel)                       │  │
│  │  ├── note-tagger (tags.v1)                              │  │
│  │  ├── note-summarizer (summary.v1)                       │  │
│  │  ├── note-insights (insights.v1)                        │  │
│  │  └── note-eli5 (eli5.v1)                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Chat Agent                                              │  │
│  │  └── default-chat-assistant                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Multi-Tab Context Tracking

**Key Innovation:** All tabs tracked, only active tab subscribed by agents

```
Browser State:
┌─────────────────────────────────────────┐
│ Tab 1: GitHub (inactive)                 │
│ └── browser.tab.context.v1 (id-1)       │
│     tags: [browser:context, tab:1]      │
│     ❌ NOT tagged browser:active-tab    │
├─────────────────────────────────────────┤
│ Tab 2: Documentation (inactive)          │
│ └── browser.tab.context.v1 (id-2)       │
│     tags: [browser:context, tab:2]      │
│     ❌ NOT tagged browser:active-tab    │
├─────────────────────────────────────────┤
│ Tab 3: Dashboard [ACTIVE] ✓             │
│ └── browser.tab.context.v1 (id-3)       │
│     tags: [browser:context, tab:3,      │
│            browser:active-tab]           │
│     ✅ AGENTS SUBSCRIBE TO THIS         │
└─────────────────────────────────────────┘

Agent Subscription:
{
  "schema_name": "browser.tab.context.v1",
  "any_tags": ["browser:active-tab"]
}
→ Gets real-time updates ONLY from active tab

Search All Tabs:
await client.searchBreadcrumbs({
  schema_name: 'browser.tab.context.v1'
})
→ Returns ALL tabs, agents can reason about full browser state
```

---

## Data Flow Examples

### Example 1: Save Page

```
1. User clicks "Save Page"
   ↓
2. Extension captures content (Think Extension quality)
   • Smart selector (main, article, etc.)
   • Markdown conversion
   • Metadata extraction
   ↓
3. Extension creates note.v1 breadcrumb
   POST /breadcrumbs
   {
     schema_name: "note.v1",
     context: { content, url, domain, ... }
   }
   ↓
4. RCRT generates embedding, publishes SSE event
   ↓
5. 4 Agents see event (subscribed to note.v1)
   → note-tagger-agent
   → note-summarizer-agent
   → note-insights-agent
   → note-eli5-agent
   ↓
6. Agents call openrouter tool (LLM) in PARALLEL
   ↓
7. Each agent creates result breadcrumb:
   • note.tags.v1
   • note.summary.v1
   • note.insights.v1
   • note.eli5.v1
   ↓
8. Extension subscribed to note:NOTE_ID events
   → Updates UI in real-time as each agent completes
   ↓
9. All 4 agents complete in 3-5 seconds (parallel!)
```

### Example 2: Semantic Search

```
1. User types: "articles about databases"
   ↓
2. Debounced (500ms wait)
   ↓
3. Extension calls vector search:
   GET /breadcrumbs/search?q=articles+about+databases&schema_name=note.v1&nn=20
   ↓
4. RCRT generates query embedding (ONNX)
   ↓
5. pgvector cosine similarity search
   ↓
6. Returns top 20 notes ranked by semantic relevance
   ↓
7. Results may include:
   • "PostgreSQL Tutorial" (high similarity)
   • "SQL Basics" (medium similarity)
   • "Data Modeling" (medium similarity)
   Even if they don't contain exact word "database"!
```

### Example 3: Chat with Multi-Tab Context

```
1. User types: "What's on my screen?"
   ↓
2. Extension creates user.message.v1
   ↓
3. default-chat-assistant agent receives event
   ↓
4. Agent searches for browser:active-tab:
   GET /breadcrumbs?any_tags=browser:active-tab&schema_name=browser.tab.context.v1
   ↓
5. Gets active tab context (markdown content, interactive elements)
   ↓
6. Agent calls openrouter with context
   ↓
7. Agent creates agent.response.v1
   ↓
8. Extension SSE listener receives response
   ↓
9. Displays in chat
```

---

## Key Differences from Think Extension

| Feature | Think Extension | RCRT Extension v2 |
|---------|----------------|-------------------|
| **Storage** | Chrome local storage (10MB) | PostgreSQL (unlimited) |
| **Settings** | Chrome storage | **Breadcrumb** (extension.settings.v1) |
| **Processing** | Sequential plugins (11-12s) | Parallel agents (3-4s) |
| **Search** | Text matching | Semantic (pgvector) |
| **Collaboration** | ❌ Single user | ✅ Multi-user (SSE) |
| **Tab Tracking** | ❌ None | ✅ All tabs (active tagged) |
| **Versioning** | ❌ No history | ✅ Full history |
| **Real-Time** | ❌ Manual refresh | ✅ SSE updates |

---

## File Structure

```
rcrt-extension-v2/
├── manifest.json                    # Extension manifest (MV3)
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
├── vite.config.ts                   # Build config
├── src/
│   ├── background/
│   │   ├── index.ts                 # Service worker entry
│   │   ├── tab-context-manager.ts   # Multi-tab tracking
│   │   └── page-capture-enhanced.ts # Think + RCRT capture
│   ├── sidepanel/
│   │   ├── index.html               # Side panel HTML
│   │   ├── index.tsx                # React entry
│   │   ├── Panel.tsx                # Main panel with tabs
│   │   ├── ChatPanel.tsx            # Chat UI
│   │   ├── NotesList.tsx            # Notes list with search
│   │   ├── NoteDetail.tsx           # Note detail with tabs
│   │   ├── SavePage.tsx             # Save page UI
│   │   ├── Settings.tsx             # Settings UI
│   │   └── styles.css               # Global styles
│   ├── lib/
│   │   ├── rcrt-client.ts           # RCRT API client
│   │   ├── settings-manager.ts      # Settings as breadcrumbs
│   │   ├── ui-state-manager.ts      # UI state as breadcrumbs
│   │   ├── error-handler.ts         # Error handling
│   │   ├── performance.ts           # Performance utils
│   │   ├── page-capture.ts          # Think Extension logic
│   │   ├── markdown.ts              # Markdown utils
│   │   ├── text-utils.ts            # Text utils
│   │   └── types.ts                 # TypeScript types
│   ├── features/
│   │   ├── save-page.ts             # Save page logic
│   │   ├── semantic-search.ts       # Search logic
│   │   ├── chat.ts                  # Chat logic
│   │   ├── find-similar.ts          # Similarity search
│   │   └── export-import.ts         # Export/import
│   └── hooks/
│       ├── useRCRTClient.ts         # RCRT client hook
│       ├── useSettings.ts           # Settings hook
│       ├── useDebounce.ts           # Debounce hook
│       └── useVirtualScroll.ts      # Virtual scroll hook
└── dist/                            # Build output
```

---

## Breadcrumb Schemas

### note.v1
```json
{
  "schema_name": "note.v1",
  "title": "Article Title",
  "tags": ["note", "saved-page", "domain:example.com"],
  "context": {
    "content": "# Markdown content...",
    "url": "https://example.com/article",
    "domain": "example.com",
    "og_image": "https://example.com/image.jpg",
    "headings": ["Heading 1", "Heading 2"],
    "links": [{"text": "Link", "href": "..."}],
    "captured_at": "2024-11-04T..."
  }
}
```

### note.tags.v1
```json
{
  "schema_name": "note.tags.v1",
  "tags": ["ai-generated", "note:NOTE_ID"],
  "context": {
    "note_id": "uuid",
    "tags": ["machine-learning", "ai", "neural-networks", ...]
  }
}
```

### browser.tab.context.v1
```json
{
  "schema_name": "browser.tab.context.v1",
  "title": "Browser Tab: Article Title",
  "tags": [
    "browser:context",
    "browser:tab:123",
    "browser:active-tab",  // Only on active tab!
    "url:example.com"
  ],
  "context": {
    "url": "https://example.com",
    "title": "Article Title",
    "content": { "mainText": "...", "headings": [...] },
    "dom": { "interactiveElements": {...} }
  }
}
```

### extension.settings.v1 (NEW!)
```json
{
  "schema_name": "extension.settings.v1",
  "title": "RCRT Extension Settings",
  "tags": ["extension:rcrt-v2", "settings"],
  "context": {
    "rcrt_server_url": "http://localhost:8081",
    "workspace": "workspace:browser",
    "multi_tab_tracking": true,
    "theme": "dark",
    "collaboration_enabled": true
  }
}
```

---

## Agent Processing Flow

When a note is saved, 4 agents process it **in parallel**:

```
Time: 0ms
└── User saves page
    └── note.v1 created
        ↓ SSE event broadcast
        
Time: 50ms
├── note-tagger-agent sees event
├── note-summarizer-agent sees event
├── note-insights-agent sees event
└── note-eli5-agent sees event

Time: 100ms - 3000ms (parallel LLM calls)
├── Tagger calls openrouter: "Generate tags..."
├── Summarizer calls openrouter: "Summarize..."
├── Insights calls openrouter: "Extract insights..."
└── ELI5 calls openrouter: "Explain simply..."

Time: 3000ms - 4000ms
├── note.tags.v1 created       → Extension UI updates
├── note.summary.v1 created    → Extension UI updates
├── note.insights.v1 created   → Extension UI updates
└── note.eli5.v1 created       → Extension UI updates

Time: 4000ms
└── All processing complete! ✅
```

**Think Extension**: 11-12 seconds (sequential)
**RCRT Extension v2**: 3-4 seconds (parallel)

---

## Multi-Tab Awareness

Agents can reason about entire browser state:

**Example Chat:**
```
User: "What am I working on?"

Agent: "Based on your open tabs, you're:
- Writing documentation (Google Docs)
- Reviewing a pull request (GitHub)
- Reading about PostgreSQL (postgresql.org)
- Using the RCRT dashboard

Would you like help with any of these tasks?"
```

**How it works:**
```javascript
// Agent searches all tabs
const allTabs = await searchBreadcrumbs({
  schema_name: 'browser.tab.context.v1'
});

// But only subscribes to active tab
subscribeToSSE({
  schema_name: 'browser.tab.context.v1',
  any_tags: ['browser:active-tab']
});
```

---

## Performance Characteristics

### Benchmarks

| Operation | Think Extension | RCRT Extension v2 |
|-----------|----------------|-------------------|
| Save & Process | 11-12s | 3-4s |
| Search | 5-10ms | 50-200ms (semantic!) |
| Storage | 10MB (~200 notes) | Unlimited (millions) |
| Real-time Updates | ❌ None | ✅ <50ms via SSE |
| Multi-tab Tracking | ❌ None | ✅ All tabs |

### Optimizations

1. **Debounced Search** - 500ms wait before search
2. **Virtual Scrolling** - Only render visible notes
3. **LRU Cache** - Cache recent breadcrumbs
4. **Lazy Loading** - Load note content on demand
5. **SSE Reconnection** - Exponential backoff (1s, 2s, 4s...)
6. **Batch Updates** - Group breadcrumb updates

---

## Security

### What's in Chrome Storage (Minimal)

- JWT token (encrypted by Chrome)
- Cached server URL (for quick startup)
- Temporary UI state (scroll positions)

### What's in Breadcrumbs (Everything Else)

- Settings (extension.settings.v1)
- Notes (note.v1)
- Conversations (user.message.v1, agent.response.v1)
- Tab contexts (browser.tab.context.v1)
- UI state (extension.ui-state.v1)

**Benefits:**
- ✅ Synchronized across devices
- ✅ Version controlled
- ✅ Access controlled (ACL)
- ✅ Auditable (full history)
- ✅ Searchable (vector search)

---

## Collaborative Features

Because settings and state are breadcrumbs:

**Scenario 1: Team Settings**
- Admin updates workspace settings
- All team members' extensions update automatically (SSE)
- No manual configuration needed

**Scenario 2: Shared Notes**
- Team member saves important article
- Appears in everyone's Notes tab immediately
- Real-time collaboration

**Scenario 3: Multi-Device**
- Save note on desktop
- Immediately available on laptop
- Same extension, same workspace

---

## Advantages Over Think Extension

1. **Unlimited Storage** - PostgreSQL vs 10MB Chrome limit
2. **Semantic Search** - Find by meaning, not keywords
3. **3x Faster** - Parallel agents vs sequential plugins
4. **Collaborative** - Multi-user workspaces
5. **Real-Time** - SSE updates vs manual refresh
6. **Multi-Tab Aware** - Agents see all browser context
7. **Versioned** - Full history tracking
8. **Enterprise-Ready** - Security, audit logs, compliance
9. **Observable** - 3D dashboard visualization
10. **Settings as Breadcrumbs** - Synchronized, collaborative

---

## Future Enhancements

- **Automatic Tagging** - Auto-tag pages on navigation
- **Smart Capture** - Detect important pages and auto-save
- **Cross-Reference** - Link related notes automatically
- **Knowledge Graph** - Visualize note relationships
- **Offline Mode** - Queue operations when disconnected
- **Mobile Sync** - Access notes on mobile devices
- **Team Workspaces** - Department-specific note collections
- **AI Suggestions** - "You might want to save this page"

