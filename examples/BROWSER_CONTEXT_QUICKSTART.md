# Browser Context Breadcrumb - Quick Start

## What is this?

The **Browser Context Breadcrumb** gives your agents "eyes" to see what webpage the user is currently viewing. It's a single, living breadcrumb that updates automatically whenever the user navigates to a new page.

## Quick Demo

### 1. Start RCRT System

```bash
# From project root
docker compose up -d
```

### 2. Load Extension

```bash
cd extension
npm install
npm run build

# Load dist/ folder in Chrome:
# chrome://extensions/ → Developer mode → Load unpacked → Select extension/dist
```

### 3. Create Page Assistant Agent

```bash
# Upload the agent definition
curl -X POST http://localhost:8081/breadcrumbs \
  -H "Content-Type: application/json" \
  --data @examples/agents/page-assistant-agent.json
```

### 4. Start Agent Runner

```bash
cd rcrt-visual-builder/apps/agent-runner
npm run dev
```

### 5. Try it out!

1. Open any webpage (e.g., https://github.com/RCRT/docs)
2. Open extension side panel (click extension icon)
3. Ask: **"What's on this page?"**

The agent will respond with details about the current webpage!

## How It Works

```
1. You navigate to a webpage
   ↓
2. Extension captures page data (title, content, links, structure)
   ↓
3. Updates browser.page.context.v1 breadcrumb
   ↓
4. NATS publishes breadcrumb.updated event
   ↓
5. Agent receives event via subscription
   ↓
6. Agent can now "see" the page and respond intelligently
```

## Example Conversations

### Example 1: Understanding Page Content

**User:** "What's on this page?"

**Agent:** "You're viewing the RCRT Documentation on GitHub. The page covers:

- Introduction to RCRT - The breadcrumb-centric event system
- Architecture Overview - How components work together
- Quick Start Guide - Getting started in 5 minutes
- API Reference - Complete API documentation

There are 45 links on this page, including quick navigation to:
- Installation guide
- Docker setup
- Agent definitions
- Tool creation

Would you like me to explain any specific section?"

### Example 2: Finding Information

**User:** "How do I install this?"

**Agent:** "I can see an 'Installation' section on the page. It mentions:

1. Clone the repository
2. Run `docker compose up -d`
3. Add your API keys
4. Start the agent runner

There's a 'Quick Start' link (element #8) that provides detailed step-by-step instructions. Would you like me to summarize those steps?"

### Example 3: Navigation Help

**User:** "Where can I learn about creating agents?"

**Agent:** "There's a section called 'Agent Definitions' with a link to the agent creation guide. I can also see:

- 'Creating Your First Agent' tutorial (element #12)
- 'Agent Patterns' documentation (element #15)
- Example agent definitions in the code samples

Would you like me to click on one of these links for you?"

## Breadcrumb Structure

The `browser.page.context.v1` breadcrumb contains:

```json
{
  "title": "Browser: GitHub - RCRT Documentation",
  "schema_name": "browser.page.context.v1",
  "tags": [
    "browser:context",
    "browser:active-tab",
    "extension:chrome",
    "url:github.com"
  ],
  "context": {
    "url": "https://github.com/RCRT/docs",
    "domain": "github.com",
    "title": "GitHub - RCRT Documentation",
    
    "content": {
      "mainText": "RCRT is a breadcrumb-centric...",
      "headings": ["Introduction", "Architecture", ...],
      "links": [
        {"text": "Get Started", "href": "/docs/quick-start"},
        ...
      ]
    },
    
    "dom": {
      "interactiveElements": {
        "5": {
          "tag": "a",
          "attributes": {"href": "/docs/quick-start"},
          "xpath": "/html/body/div/a[1]"
        }
      }
    },
    
    "llm_hints": {
      "transform": {
        "summary": "The user is viewing 'GitHub - RCRT Documentation' at github.com...",
        "page_text": "RCRT is a breadcrumb-centric..."
      }
    }
  }
}
```

## Agent Subscription

To receive page updates, your agent subscribes:

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

Every time the user navigates, your agent receives an update!

## Advanced: Auto-Summarization

Want summaries automatically? Use the **Page Summarizer Agent**:

```bash
# Upload summarizer agent
curl -X POST http://localhost:8081/breadcrumbs \
  -H "Content-Type: application/json" \
  --data @examples/agents/page-summarizer-agent.json
```

Now whenever you navigate to a new page, you'll automatically get a summary in the chat!

## Monitoring

View page context updates in real-time:

```bash
# Watch breadcrumb updates
curl "http://localhost:8081/events/stream?tags=browser:context"

# Or view in Dashboard v2
open http://localhost:8082
# Navigate to: Breadcrumbs → Filter by schema: browser.page.context.v1
```

## Next Steps

1. **Try the examples**: Load the sample agents and test them
2. **Create custom agents**: Build agents that react to specific pages/domains
3. **Add browser control**: Next phase - agents that can click, type, navigate
4. **Build workflows**: Chain multiple agents for complex tasks

## Troubleshooting

### Extension not capturing pages

1. Check browser console (F12) for errors
2. Ensure buildDomTree.js is injected
3. Verify RCRT server is running
4. Check extension permissions

### Agent not receiving updates

1. Verify agent is running (`agent-runner` logs)
2. Check subscription selector matches
3. Ensure NATS is running (docker-compose includes it)
4. Check agent logs for SSE connection

### No page content in breadcrumb

1. Some sites block content scripts (e.g., chrome:// pages)
2. Check if page finished loading
3. Try manual refresh in extension

## Resources

- [Full Documentation](../docs/BROWSER_CONTEXT_BREADCRUMB.md)
- [Extension Code](../extension/src/background/page-context-tracker.ts)
- [Example Agents](./agents/)
- [RCRT Documentation](../README.md)
