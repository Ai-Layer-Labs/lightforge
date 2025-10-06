/**
 * Browser Page Context Tracker
 * Maintains a living breadcrumb representing the user's current browser state
 * Agents subscribe to browser.page.context.v1 to receive real-time page updates
 */

// Lazy-load rcrtClient to avoid DOM access in service worker context
let rcrtClientModule = null;
async function getRcrtClient() {
  if (!rcrtClientModule) {
    rcrtClientModule = await import('../lib/rcrt-client.ts');
  }
  return rcrtClientModule.rcrtClient;
}

class PageContextTracker {
  constructor() {
    this.state = {
      breadcrumbId: null,
      lastUpdate: 0,
      currentVersion: 1,
      currentTabId: null
    };
    
    this.updateDebounce = null;
    this.DEBOUNCE_MS = 500;
    this.MAX_TEXT_LENGTH = 5000;
    this.MAX_LINKS = 50;
    this.MAX_IMAGES = 20;
  }
  
  async initialize() {
    console.log('🚀 PageContextTracker: Initializing...');
    
    try {
      // Find or create the living breadcrumb
      await this.ensureBreadcrumb();
      
      // Set up listeners
      this.setupListeners();
      
      // Capture current active tab
      await this.captureActiveTab();
      
      console.log('✅ PageContextTracker: Ready');
    } catch (error) {
      console.error('❌ PageContextTracker initialization failed:', error);
    }
  }
  
  async ensureBreadcrumb() {
    try {
      const rcrtClient = await getRcrtClient();
      
      // Search for existing browser context breadcrumb for this extension
      const extensionId = await this.getExtensionId();
      const existing = await rcrtClient.listBreadcrumbs(`extension:${extensionId}`);
      
      const contextBreadcrumb = existing.find(
        b => b.schema_name === 'browser.page.context.v1'
      );
      
      if (contextBreadcrumb) {
        // Use existing
        this.state.breadcrumbId = contextBreadcrumb.id;
        this.state.currentVersion = contextBreadcrumb.version;
        console.log('✅ Using existing browser context breadcrumb:', this.state.breadcrumbId);
      } else {
        // Create new
        const result = await this.createInitialBreadcrumb();
        this.state.breadcrumbId = result.id;
        this.state.currentVersion = 1;
        console.log('🆕 Created new browser context breadcrumb:', this.state.breadcrumbId);
      }
    } catch (error) {
      console.error('❌ Failed to ensure breadcrumb:', error);
      // Will retry on next update attempt
    }
  }
  
  setupListeners() {
    // Tab activation
    chrome.tabs.onActivated.addListener((activeInfo) => {
      console.log('📍 Tab activated:', activeInfo.tabId);
      this.state.currentTabId = activeInfo.tabId;
      this.scheduleUpdate(activeInfo.tabId);
    });
    
    // Tab updates (navigation, reload)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.active) {
        console.log('🔄 Tab updated:', tabId);
        this.scheduleUpdate(tabId);
      }
    });
    
    // URL changes (navigation without reload)
    if (chrome.webNavigation) {
      chrome.webNavigation.onCommitted.addListener((details) => {
        if (details.frameId === 0) { // Main frame only
          chrome.tabs.get(details.tabId, (tab) => {
            if (chrome.runtime.lastError) {
              console.warn('Tab no longer exists');
              return;
            }
            if (tab.active) {
              console.log('🌐 Navigation committed:', details.tabId);
              this.scheduleUpdate(details.tabId);
            }
          });
        }
      });
    }
  }
  
  async captureActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        this.state.currentTabId = tab.id;
        this.scheduleUpdate(tab.id);
      }
    } catch (error) {
      console.error('Failed to capture active tab:', error);
    }
  }
  
  scheduleUpdate(tabId) {
    // Debounce rapid updates
    if (this.updateDebounce) {
      clearTimeout(this.updateDebounce);
    }
    
    this.updateDebounce = setTimeout(() => {
      this.captureAndUpdate(tabId);
    }, this.DEBOUNCE_MS);
  }
  
  async captureAndUpdate(tabId) {
    try {
      console.log('📸 Capturing page context for tab', tabId);
      
      // Get tab info
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        console.log('⏭️ Skipping internal page:', tab.url);
        return;
      }
      
      // Inject buildDomTree if needed
      await this.ensureBuildDomTree(tabId);
      
      // Execute capture
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: capturePageContextFunc,
        args: [{
          maxTextLength: this.MAX_TEXT_LENGTH,
          maxLinks: this.MAX_LINKS,
          maxImages: this.MAX_IMAGES
        }]
      });
      
      if (!result?.result) {
        console.warn('No result from page capture');
        return;
      }
      
      const pageContext = result.result;
      
      // Update breadcrumb
      await this.updateBreadcrumb(pageContext, tab);
      
      console.log('✅ Browser context updated successfully');
      
    } catch (error) {
      console.error('❌ Failed to capture page context:', error);
    }
  }
  
  async updateBreadcrumb(pageContext, tab) {
    if (!this.state.breadcrumbId) {
      console.warn('No breadcrumb ID - attempting to create');
      await this.ensureBreadcrumb();
      if (!this.state.breadcrumbId) {
        console.error('Still no breadcrumb ID - cannot update');
        return;
      }
    }
    
    const rcrtClient = await getRcrtClient();
    const interactiveCount = Object.keys(pageContext.dom.interactiveElements).length;
    const headingCount = pageContext.content.headings.length;
    const linkCount = pageContext.content.links.length;
    
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
            template: `The user is viewing '${pageContext.title}' at ${pageContext.domain}. The page has ${headingCount} sections and ${linkCount} links.`
          },
          interactive_summary: {
            type: "template",
            template: `There are ${interactiveCount} interactive elements on this page that the user can click or interact with.`
          },
          page_text: {
            type: "extract",
            value: "$.content.mainText"
          },
          page_structure: {
            type: "literal",
            literal: {
              headings: pageContext.content.headings,
              key_links: pageContext.content.links.slice(0, 10),
              forms_present: false
            }
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
          title: `Browser: ${pageContext.title.slice(0, 50)}`,
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
      
      console.log(`✅ Updated browser context (v${this.state.currentVersion}):`, 
        pageContext.title.slice(0, 30));
      
    } catch (error) {
      if (error.message?.includes('version_mismatch') || error.message?.includes('412')) {
        // Concurrent update - refetch and retry
        console.warn('⚠️ Version conflict, refetching breadcrumb...');
        try {
          const current = await rcrtClient.getBreadcrumb(this.state.breadcrumbId);
          this.state.currentVersion = current.version;
          console.log(`🔄 Retrying with version ${this.state.currentVersion}`);
          // Retry with correct version
          await this.updateBreadcrumb(pageContext, tab);
        } catch (retryError) {
          console.error('Failed to retry after version mismatch:', retryError);
        }
      } else {
        console.error('Failed to update breadcrumb:', error);
      }
    }
  }
  
  async createInitialBreadcrumb() {
    const rcrtClient = await getRcrtClient();
    
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
        viewport: { width: 0, height: 0, scrollX: 0, scrollY: 0, devicePixelRatio: 1 },
        dom: { rootId: '', map: {}, interactiveElements: {} },
        content: { mainText: '', headings: [], links: [], images: [] },
        meta: { description: '', keywords: [], ogTitle: '', ogImage: '', ogDescription: '' },
        session: {
          extensionId: await this.getExtensionId(),
          userId: await this.getUserId(),
          capturedAt: new Date().toISOString()
        }
      }
    });
  }
  
  async ensureBuildDomTree(tabId) {
    try {
      // Check if already injected
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => typeof window.buildDomTree === 'function'
      });
      
      if (!result?.result) {
        // Inject
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['buildDomTree.js']
        });
        console.log('✅ Injected buildDomTree');
      }
    } catch (error) {
      console.warn('Failed to inject buildDomTree:', error);
    }
  }
  
  async getExtensionId() {
    return chrome.runtime.id;
  }
  
  async getUserId() {
    const result = await chrome.storage.local.get('userId');
    if (result.userId) return result.userId;
    
    const defaultId = '00000000-0000-0000-0000-000000000EEE';
    await chrome.storage.local.set({ userId: defaultId });
    return defaultId;
  }
  
  // Public methods for manual control
  async forceUpdate() {
    if (this.state.currentTabId) {
      await this.captureAndUpdate(this.state.currentTabId);
    }
  }
  
  async pause() {
    if (this.updateDebounce) {
      clearTimeout(this.updateDebounce);
      this.updateDebounce = null;
    }
    console.log('⏸️ PageContextTracker paused');
  }
  
  async resume() {
    await this.captureActiveTab();
    console.log('▶️ PageContextTracker resumed');
  }
}

// Function that runs in page context (injected)
function capturePageContextFunc(config) {
  // Use existing buildDomTree
  const domData = window.buildDomTree ? window.buildDomTree({
    showHighlightElements: false,
    viewportExpansion: 0
  }) : { rootId: null, map: {}, interactiveElements: {} };
  
  // Extract content
  const mainText = document.body.innerText.trim().slice(0, config.maxTextLength);
  
  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    .map(h => h.textContent?.trim())
    .filter(Boolean);
  
  const links = Array.from(document.querySelectorAll('a[href]'))
    .filter(a => a.offsetParent !== null) // Visible only
    .slice(0, config.maxLinks)
    .map(a => ({
      text: (a.textContent?.trim() || '').slice(0, 100),
      href: a.href
    }));
  
  const images = Array.from(document.querySelectorAll('img[src]'))
    .filter(img => img.offsetParent !== null)
    .slice(0, config.maxImages)
    .map(img => ({
      alt: img.alt || '',
      src: img.src
    }));
  
  // Extract interactive elements for quick reference
  const interactiveElements = {};
  Object.keys(domData.map || {}).forEach(key => {
    const node = domData.map[key];
    if (node.isInteractive && node.highlightIndex !== undefined) {
      interactiveElements[node.highlightIndex] = {
        tag: node.tagName,
        attributes: node.attributes || {},
        xpath: node.xpath
      };
    }
  });
  
  // Get metadata
  const getMeta = (name) => {
    const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    return el?.getAttribute('content') || '';
  };
  
  return {
    url: window.location.href,
    domain: window.location.hostname,
    title: document.title,
    favicon: document.querySelector('link[rel~="icon"]')?.href || '',
    
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      devicePixelRatio: window.devicePixelRatio
    },
    
    dom: {
      rootId: domData.rootId || '',
      map: domData.map || {},
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
      keywords: getMeta('keywords').split(',').map(s => s.trim()).filter(Boolean),
      ogTitle: getMeta('og:title'),
      ogImage: getMeta('og:image'),
      ogDescription: getMeta('og:description')
    }
  };
}

export const pageContextTracker = new PageContextTracker();
