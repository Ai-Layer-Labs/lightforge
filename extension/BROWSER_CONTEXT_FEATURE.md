# Browser Context Feature Implementation

## ✅ Completed Implementation

### What We Built

A **living context breadcrumb** system that gives RCRT agents real-time visibility into the user's current webpage. This is the foundation for intelligent browser assistance and automation.

### Key Components

#### 1. **Breadcrumb Schema** (`browser.page.context.v1`)

A comprehensive schema that captures:
- **Page metadata**: URL, title, domain, favicon
- **Viewport state**: Dimensions, scroll position
- **DOM structure**: Interactive elements with XPath selectors
- **Extracted content**: Text, headings, links, images, metadata
- **LLM hints**: Transforms raw data into clean, natural language for agents

#### 2. **Page Context Tracker** (`src/background/page-context-tracker.ts`)

A background service that:
- Creates/maintains a single living breadcrumb per extension instance
- Captures page data on navigation, tab switches, reloads
- Debounces rapid updates (500ms) for performance
- Uses optimistic locking to prevent update conflicts
- Handles version mismatches with automatic retry

#### 3. **Integration** (`src/background/index.js`)

Initialized automatically on:
- Extension installation
- Extension startup
- Ready to track immediately

### How It Works

```
User navigates to new page
    ↓
Tab change/navigation detected
    ↓
Debounced update triggered (500ms)
    ↓
Inject buildDomTree.js if needed
    ↓
Execute page capture in page context
    ↓
Extract: content, structure, interactive elements
    ↓
Update browser.page.context.v1 breadcrumb (with version)
    ↓
NATS publishes breadcrumb.updated event
    ↓
Subscribed agents receive update via SSE
    ↓
Agents can now "see" and respond to page content
```

### LLM-Optimized Data

The breadcrumb includes `llm_hints` that transform technical data into natural language:

**Raw Data:**
```json
{
  "url": "https://github.com/RCRT/docs",
  "content": {
    "headings": ["Introduction", "Architecture", "Quick Start"],
    "links": [{"text": "Get Started", "href": "/docs/start"}]
  }
}
```

**Transformed for LLM:**
```json
{
  "summary": "The user is viewing 'RCRT Documentation' at github.com. The page has 3 sections and 45 links.",
  "page_text": "RCRT is a breadcrumb-centric event-driven system...",
  "page_structure": {
    "headings": ["Introduction", "Architecture", "Quick Start"],
    "key_links": [{"text": "Get Started", "href": "/docs/start"}]
  }
}
```

Result: Agents get clean, natural language perfect for reasoning!

## Files Created

### Implementation
- ✅ `extension/src/background/page-context-tracker.ts` - Core tracker service
- ✅ `extension/src/background/index.js` - Integration (updated)

### Documentation
- ✅ `docs/BROWSER_CONTEXT_BREADCRUMB.md` - Complete technical spec
- ✅ `examples/BROWSER_CONTEXT_QUICKSTART.md` - Quick start guide
- ✅ `extension/BROWSER_CONTEXT_FEATURE.md` - This file

### Examples
- ✅ `examples/agents/page-assistant-agent.json` - Interactive Q&A agent
- ✅ `examples/agents/page-summarizer-agent.json` - Auto-summarization agent

## Usage

### For Users

1. **Install extension** (already done if using RCRT Chat)
2. **Navigate to any webpage**
3. **Chat with agents** - They can now see what you're looking at!

Example:
```
User: "What's on this page?"
Agent: "You're viewing the RCRT Documentation. It covers Introduction, 
        Architecture, and Quick Start. There are 45 links including..."
```

### For Agent Developers

Subscribe to page context in your agent definition:

```json
{
  "subscriptions": {
    "selectors": [
      {
        "schema_name": "browser.page.context.v1",
        "any_tags": ["browser:active-tab"]
      }
    ]
  }
}
```

Your agent will receive updates on every page change!

### For Tool Developers

Access current page context in your tools:

```typescript
// In tool execution context
const pageContext = await rcrtClient.searchBreadcrumbs({
  schema_name: 'browser.page.context.v1',
  tag: 'browser:active-tab'
});

// Get interactive elements
const buttons = pageContext[0].context.dom.interactiveElements;
```

## Performance

- **Update frequency**: Max 1 per 500ms (debounced)
- **Content limits**:
  - Main text: 5000 chars
  - Links: 50 max
  - Images: 20 max
- **Excluded pages**: chrome://, chrome-extension://
- **Memory**: Single breadcrumb, no history

## Security & Privacy

- **Local only**: All data stays in your RCRT instance
- **User control**: Can pause/resume tracking
- **No external calls**: No data sent to third parties
- **Extension-scoped**: Each extension instance has own breadcrumb

## Testing

### Manual Test

1. Start RCRT: `docker compose up -d`
2. Build extension: `cd extension && npm run build`
3. Load extension in Chrome
4. Navigate to any webpage
5. Check console logs for: `✅ Browser context updated`
6. View breadcrumb: `http://localhost:8082` → Breadcrumbs → Filter by `browser:context`

### With Agents

1. Upload example agent: 
   ```bash
   curl -X POST http://localhost:8081/breadcrumbs \
     -H "Content-Type: application/json" \
     --data @examples/agents/page-assistant-agent.json
   ```

2. Start agent runner:
   ```bash
   cd rcrt-visual-builder/apps/agent-runner
   npm run dev
   ```

3. Open extension, ask: "What's on this page?"

## Next Phase: Browser Control

With **context** ✅ complete, the next phase is **actions**:

### Planned Features

1. **`browser.action.v1` breadcrumbs**
   - Click elements by index/xpath
   - Type into inputs
   - Scroll, navigate, back/forward
   - Screenshot, extract data

2. **Action Handler**
   - Listen for action breadcrumbs
   - Execute via Chrome DevTools Protocol
   - Return results as breadcrumbs

3. **Workflows**
   - Multi-step automation
   - Conditional logic
   - Error handling

### Example Future Usage

```
User: "Fill out the signup form with my info"

Agent: [Analyzes form from page context]
       [Creates browser.action.v1 breadcrumbs]
       
Actions:
1. Click input[name="email"] → Type: user@example.com
2. Click input[name="password"] → Type: ••••••
3. Click button[type="submit"]

Extension executes actions → Returns success
```

## Benefits

✅ **Agents understand context** - No more blind responses  
✅ **Real-time updates** - Always current page state  
✅ **LLM-optimized** - Clean data via llm_hints  
✅ **Efficient** - One breadcrumb, minimal updates  
✅ **Foundation for automation** - Context → Actions → Workflows  
✅ **Universal pattern** - All agents can subscribe  

## Related Documents

- [Technical Spec](../docs/BROWSER_CONTEXT_BREADCRUMB.md)
- [Quick Start](../examples/BROWSER_CONTEXT_QUICKSTART.md)
- [RCRT System Overview](../docs/RCRT_ONE_PAGER_TECHNICAL.md)
- [Extension Integration](./RCRT_INTEGRATION.md)

## Status

🟢 **READY FOR USE** - Feature is complete and tested

Test it now:
```bash
cd extension
npm run build
# Load in Chrome and navigate to any page!
```
