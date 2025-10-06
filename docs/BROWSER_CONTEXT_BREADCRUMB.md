# Browser Context Breadcrumb System

## Overview

A **living context breadcrumb** that represents the user's current browser state. This provides agents with "eyes" into the webpage, enabling them to understand what the user is looking at and interact intelligently.

## Architecture

```
Browser Extension (Active Tab)
    ↓ [Page Load/Navigate]
Chrome Background Service
    ↓ [Extract Page Data via buildDomTree]
Update browser.page.context.v1 breadcrumb
    ↓ [NATS Event: breadcrumb.updated]
Agents subscribe via selector
    ↓ [Receive page context]
Agents can respond with actions
```

## Schema Design

### `browser.page.context.v1`

The breadcrumb uses **one instance per user/extension** that gets updated on every page change. This provides a "current state" that agents can always reference.

```typescript
{
  schema_name: 'browser.page.context.v1',
  title: 'Browser: {page_title}',
  tags: [
    'browser:context',
    'browser:active-tab',
    'extension:chrome',
    'url:{domain}'  // e.g., 'url:github.com'
  ],
  
  context: {
    // === Core Page Info ===
    url: string,              // Full URL
    domain: string,           // 'github.com'
    title: string,            // Page title
    favicon: string,          // Favicon URL
    
    // === Viewport Info ===
    viewport: {
      width: number,
      height: number,
      scrollX: number,
      scrollY: number,
      devicePixelRatio: number
    },
    
    // === Page Structure (from buildDomTree) ===
    dom: {
      rootId: string,         // Root of DOM tree
      map: object,            // Full DOM hash map
      interactiveElements: {  // Quick access to clickable items
        [highlightIndex]: {
          tag: string,
          attributes: object,
          xpath: string
        }
      }
    },
    
    // === Extracted Content ===
    content: {
      mainText: string,       // Visible text content
      headings: string[],     // H1-H6 headings
      links: Array<{          // All visible links
        text: string,
        href: string
      }>,
      images: Array<{         // Visible images
        alt: string,
        src: string
      }>,
      forms: Array<{          // Forms on page
        action: string,
        method: string,
        inputs: Array<{type, name, placeholder}>
      }>
    },
    
    // === Metadata ===
    meta: {
      description: string,    // Meta description
      keywords: string[],     // Meta keywords
      ogTitle: string,        // OpenGraph title
      ogImage: string,        // OpenGraph image
      ogDescription: string   // OpenGraph description
    },
    
    // === Session Info ===
    session: {
      extensionId: string,    // Unique extension instance
      userId: string,         // Owner ID
      capturedAt: string,     // ISO timestamp
      tabId: number,          // Chrome tab ID
      windowId: number        // Chrome window ID
    },
    
    // === LLM Hints (Transform for optimal LLM consumption) ===
    llm_hints: {
      mode: "merge",          // Merge transformed fields with original
      transform: {
        // Human-readable summary
        summary: {
          type: "template",
          template: "The user is viewing '{{context.title}}' at {{context.domain}}. The page has {{context.content.headings.length}} sections and {{context.content.links.length}} links."
        },
        
        // Interactive elements in natural language
        interactive_summary: {
          type: "template",
          template: "There are {{context.dom.interactiveElements.length}} interactive elements on this page that the user can click or interact with."
        },
        
        // Main content extraction (no DOM noise)
        page_text: {
          type: "extract",
          value: "$.content.mainText"
        },
        
        // Navigation context
        page_structure: {
          type: "literal",
          literal: {
            headings: "{{context.content.headings}}",
            key_links: "{{context.content.links}}",
            forms_present: "{{context.content.forms.length > 0}}"
          }
        }
      },
      
      // Hide technical fields from LLM
      exclude: [
        "dom.map",            // Too verbose for LLM
        "session.extensionId", // Not relevant for agent
        "session.tabId",
        "session.windowId"
      ]
    }
  }
}
```

## LLM-Optimized View

When agents fetch this breadcrumb, the `llm_hints` transform it to:

```json
{
  "summary": "The user is viewing 'RCRT Documentation' at github.com. The page has 12 sections and 45 links.",
  "interactive_summary": "There are 23 interactive elements on this page that the user can click or interact with.",
  "page_text": "RCRT is a breadcrumb-centric event-driven system...",
  "page_structure": {
    "headings": ["Introduction", "Architecture", "Quick Start", ...],
    "key_links": [
      {"text": "Get Started", "href": "/docs/quick-start"},
      {"text": "API Reference", "href": "/docs/api"}
    ],
    "forms_present": true
  },
  "url": "https://github.com/rcrt/docs",
  "domain": "github.com",
  "title": "RCRT Documentation",
  "viewport": { "width": 1920, "height": 1080 },
  "content": { /* full content */ },
  "meta": { /* metadata */ }
}
```

**Result**: Agents get a clean, natural-language description perfect for LLM reasoning!

## Update Strategy

### Single Living Breadcrumb

- **One breadcrumb per user/extension instance**
- Gets **updated** (not recreated) on every page change
- Uses **optimistic locking** (version field) to prevent conflicts
- Agents subscribe once and receive all updates

### Update Triggers

1. **Tab Activation**: User switches to a different tab
2. **Page Navigation**: URL changes (navigation, back/forward)
3. **Page Load**: New page finishes loading
4. **Manual Refresh**: User clicks refresh
5. **DOM Changes**: Major DOM mutations (debounced)

### Performance Optimization

- **Debounce updates**: Max 1 update per 500ms
- **Smart diffing**: Only update if meaningful changes
- **Lazy DOM capture**: Only capture DOM when agents are subscribed
- **Incremental updates**: Update only changed fields

## Extension Implementation

### Background Service

```typescript
// extension/src/background/page-context-tracker.ts

interface PageContextState {
  breadcrumbId: string | null;
  lastUpdate: number;
  currentVersion: number;
}

class PageContextTracker {
  private state: PageContextState = {
    breadcrumbId: null,
    lastUpdate: 0,
    currentVersion: 1
  };
  
  private updateDebounce: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 500;
  
  async initialize() {
    // Find or create the living breadcrumb
    await this.ensureBreadcrumb();
    
    // Set up listeners
    this.setupListeners();
  }
  
  private async ensureBreadcrumb() {
    // Search for existing browser context breadcrumb for this extension
    const existing = await rcrtClient.searchBreadcrumbs({
      schema_name: 'browser.page.context.v1',
      tag: `extension:${await this.getExtensionId()}`
    });
    
    if (existing.length > 0) {
      // Use existing
      this.state.breadcrumbId = existing[0].id;
      this.state.currentVersion = existing[0].version;
      console.log('✅ Using existing browser context breadcrumb:', this.state.breadcrumbId);
    } else {
      // Create new
      const result = await this.createInitialBreadcrumb();
      this.state.breadcrumbId = result.id;
      this.state.currentVersion = 1;
      console.log('🆕 Created new browser context breadcrumb:', this.state.breadcrumbId);
    }
  }
  
  private setupListeners() {
    // Tab activation
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.scheduleUpdate(activeInfo.tabId);
    });
    
    // Tab updates (navigation, reload)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.active) {
        this.scheduleUpdate(tabId);
      }
    });
    
    // URL changes
    chrome.webNavigation.onCommitted.addListener((details) => {
      if (details.frameId === 0) { // Main frame only
        chrome.tabs.get(details.tabId, (tab) => {
          if (tab.active) {
            this.scheduleUpdate(details.tabId);
          }
        });
      }
    });
  }
  
  private scheduleUpdate(tabId: number) {
    // Debounce rapid updates
    if (this.updateDebounce) {
      clearTimeout(this.updateDebounce);
    }
    
    this.updateDebounce = setTimeout(() => {
      this.captureAndUpdate(tabId);
    }, this.DEBOUNCE_MS);
  }
  
  private async captureAndUpdate(tabId: number) {
    try {
      console.log('📸 Capturing page context for tab', tabId);
      
      // Get tab info
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url || tab.url.startsWith('chrome://')) {
        console.log('⏭️ Skipping chrome:// page');
        return;
      }
      
      // Inject buildDomTree if needed
      await this.ensureBuildDomTree(tabId);
      
      // Execute capture
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: this.capturePageContext
      });
      
      const pageContext = result.result;
      
      // Update breadcrumb
      await this.updateBreadcrumb(pageContext, tab);
      
      console.log('✅ Browser context updated');
      
    } catch (error) {
      console.error('❌ Failed to capture page context:', error);
    }
  }
  
  // This runs in page context
  private capturePageContext() {
    // Use existing buildDomTree
    const domData = (window as any).buildDomTree({
      showHighlightElements: false,
      viewportExpansion: 0
    });
    
    // Extract content
    const mainText = document.body.innerText.trim().slice(0, 5000); // Limit size
    
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
      .map(h => h.textContent?.trim())
      .filter(Boolean);
    
    const links = Array.from(document.querySelectorAll('a[href]'))
      .filter(a => a.offsetParent !== null) // Visible only
      .slice(0, 50) // Limit
      .map(a => ({
        text: a.textContent?.trim(),
        href: (a as HTMLAnchorElement).href
      }));
    
    const images = Array.from(document.querySelectorAll('img[src]'))
      .filter(img => img.offsetParent !== null)
      .slice(0, 20)
      .map(img => ({
        alt: (img as HTMLImageElement).alt,
        src: (img as HTMLImageElement).src
      }));
    
    // Extract interactive elements for quick reference
    const interactiveElements: any = {};
    Object.keys(domData.map).forEach(key => {
      const node = domData.map[key];
      if (node.isInteractive && node.highlightIndex !== undefined) {
        interactiveElements[node.highlightIndex] = {
          tag: node.tagName,
          attributes: node.attributes,
          xpath: node.xpath
        };
      }
    });
    
    // Get metadata
    const getMeta = (name: string) => {
      const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
      return el?.getAttribute('content') || '';
    };
    
    return {
      url: window.location.href,
      domain: window.location.hostname,
      title: document.title,
      favicon: (document.querySelector('link[rel~="icon"]') as HTMLLinkElement)?.href || '',
      
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        devicePixelRatio: window.devicePixelRatio
      },
      
      dom: {
        rootId: domData.rootId,
        map: domData.map,
        interactiveElements
      },
      
      content: {
        mainText,
        headings,
        links,
        images
      },
      
      meta: {
        description: getMeta('description'),
        keywords: getMeta('keywords').split(',').map((s: string) => s.trim()),
        ogTitle: getMeta('og:title'),
        ogImage: getMeta('og:image'),
        ogDescription: getMeta('og:description')
      }
    };
  }
  
  private async updateBreadcrumb(pageContext: any, tab: chrome.tabs.Tab) {
    if (!this.state.breadcrumbId) {
      console.error('No breadcrumb ID - cannot update');
      return;
    }
    
    const context = {
      ...pageContext,
      session: {
        extensionId: await this.getExtensionId(),
        userId: await this.getUserId(),
        capturedAt: new Date().toISOString(),
        tabId: tab.id,
        windowId: tab.windowId
      },
      
      // LLM hints for optimal consumption
      llm_hints: {
        mode: "merge",
        transform: {
          summary: {
            type: "template",
            template: `The user is viewing '{{context.title}}' at {{context.domain}}. The page has ${pageContext.content.headings.length} sections and ${pageContext.content.links.length} links.`
          },
          interactive_summary: {
            type: "template",
            template: `There are ${Object.keys(pageContext.dom.interactiveElements).length} interactive elements on this page.`
          },
          page_text: {
            type: "extract",
            value: "$.content.mainText"
          }
        },
        exclude: [
          "dom.map",
          "session.extensionId",
          "session.tabId",
          "session.windowId"
        ]
      }
    };
    
    try {
      await rcrtClient.updateBreadcrumb(
        this.state.breadcrumbId,
        this.state.currentVersion,
        {
          title: `Browser: ${pageContext.title}`,
          context,
          tags: [
            'browser:context',
            'browser:active-tab',
            'extension:chrome',
            `url:${pageContext.domain}`,
            `extension:${await this.getExtensionId()}`
          ]
        }
      );
      
      this.state.currentVersion++;
      this.state.lastUpdate = Date.now();
      
    } catch (error: any) {
      if (error.message?.includes('version_mismatch')) {
        // Concurrent update - refetch and retry
        console.warn('Version conflict, refetching...');
        const current = await rcrtClient.getBreadcrumb(this.state.breadcrumbId);
        this.state.currentVersion = current.version;
        // Retry with correct version
        await this.updateBreadcrumb(pageContext, tab);
      } else {
        throw error;
      }
    }
  }
  
  private async createInitialBreadcrumb() {
    return await rcrtClient.createBreadcrumb({
      schema_name: 'browser.page.context.v1',
      title: 'Browser: Loading...',
      tags: [
        'browser:context',
        'browser:active-tab',
        'extension:chrome',
        `extension:${await this.getExtensionId()}`
      ],
      context: {
        url: 'about:blank',
        domain: 'loading',
        title: 'Loading...',
        session: {
          extensionId: await this.getExtensionId(),
          userId: await this.getUserId(),
          capturedAt: new Date().toISOString()
        }
      }
    });
  }
  
  private async ensureBuildDomTree(tabId: number) {
    // Check if already injected
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => typeof (window as any).buildDomTree === 'function'
    });
    
    if (!result.result) {
      // Inject
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['buildDomTree.js']
      });
    }
  }
  
  private async getExtensionId(): Promise<string> {
    return chrome.runtime.id;
  }
  
  private async getUserId(): Promise<string> {
    // Get from storage or generate
    const { userId } = await chrome.storage.local.get('userId');
    if (userId) return userId;
    
    const newId = '00000000-0000-0000-0000-000000000EEE'; // Extension agent ID
    await chrome.storage.local.set({ userId: newId });
    return newId;
  }
}

export const pageContextTracker = new PageContextTracker();
```

## Agent Subscription Example

```typescript
// Example: Agent that helps with current webpage

{
  schema_name: 'agent.def.v1',
  title: 'Page Assistant Agent',
  context: {
    agent_id: 'page-assistant',
    model: 'openrouter/anthropic/claude-3.5-sonnet',
    system_prompt: `You are a helpful assistant that understands the webpage the user is viewing.
    
You receive real-time updates about the current page through browser.page.context.v1 breadcrumbs.
When the user asks questions, you can reference the page content, suggest actions, or help navigate.

You have access to:
- Page URL and title
- Visible text content  
- Interactive elements (buttons, links, forms)
- Page structure (headings, sections)

Be specific and helpful based on what you see on the page.`,
    
    subscriptions: {
      selectors: [
        // Subscribe to browser context updates
        {
          schema_name: 'browser.page.context.v1',
          any_tags: ['browser:active-tab']
        },
        // Also listen for user messages
        {
          schema_name: 'chat.message.v1',
          any_tags: ['user:message']
        }
      ]
    },
    
    capabilities: {
      can_create_breadcrumbs: true,
      can_read_browser_context: true,
      can_suggest_actions: true
    }
  }
}
```

## Usage Examples

### User asks about current page

```
User: "What's on this page?"

[Agent receives browser.page.context.v1 via subscription]
[LLM sees transformed context with summary and page_text]

Agent: "You're viewing the RCRT Documentation on GitHub. The page covers:
- Introduction to RCRT
- Architecture Overview  
- Quick Start Guide
- API Reference

There are 23 interactive elements including links to:
- Get Started guide
- Installation instructions
- API documentation

Would you like help with any specific section?"
```

### User wants to interact

```
User: "Click the Get Started button"

Agent: [Reads interactive elements from context]
"I can see a 'Get Started' link (element #5). To click it, I'll create a browser action breadcrumb..."

[Creates browser.action.v1 breadcrumb]
{
  schema_name: 'browser.action.v1',
  context: {
    action: 'click',
    target: {
      highlightIndex: 5,
      xpath: '/html/body/div/a[1]',
      text: 'Get Started'
    }
  }
}
```

## Next Steps: Browser Control

This context system sets the foundation for **browser automation**:

1. **Read current state** ✅ (this document)
2. **Execute actions** 🔄 (next phase)
   - `browser.action.v1` breadcrumbs for click, type, scroll, etc.
   - Extension listens for action breadcrumbs and executes them
   - Uses Chrome DevTools Protocol (debugger) for reliable control

3. **Workflows** 🔮 (future)
   - Multi-step browser automation
   - Form filling, navigation, data extraction
   - "Click this, then that, then extract X"

## Benefits

✅ **Agents "see" what user sees** - No more guessing context  
✅ **Real-time updates** - Context always current  
✅ **LLM-optimized** - Clean, natural language format via llm_hints  
✅ **Efficient** - One living breadcrumb, not thousands  
✅ **Scalable** - Multiple agents can subscribe to same context  
✅ **Foundation for control** - Context + Actions = Full browser automation
