/**
 * THE RCRT WAY - Browser Page Context Tracker
 * Maintains a living breadcrumb representing the user's current browser state
 * 
 * MV3 Compatible: Uses persistent listeners + alarms to survive service worker sleep
 * Uses direct fetch API to RCRT server (no client imports in service worker)
 */

// Helper to get stored token
async function getStoredToken() {
  const result = await chrome.storage.local.get(['extensionToken']);
  return result.extensionToken || '';
}

// Helper to make RCRT API calls from service worker
async function rcrtApi(method, endpoint, body = null) {
  const token = await getStoredToken();
  const baseUrl = 'http://127.0.0.1:8081';
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const options = { method, headers };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${baseUrl}${endpoint}`, options);
  
  if (!response.ok) {
    throw new Error(`RCRT API error ${response.status}: ${await response.text()}`);
  }
  
  return await response.json();
}

class SimplePageContextTracker {
  constructor() {
    this.state = {
      breadcrumbId: null,
      lastUpdate: 0,
      currentVersion: 1,
      currentTabId: null,
      initialized: false
    };
    
    this.DEBOUNCE_MS = 500;
    this.MAX_TEXT_LENGTH = 5000;
    this.MAX_LINKS = 50;
    this.MAX_IMAGES = 20;
  }
  
  async initialize() {
    if (this.state.initialized) {
      console.log('⏭️ PageContextTracker already initialized');
      return;
    }
    
    console.log('🚀 PageContextTracker: Initializing...');
    
    try {
      // Load persisted state from storage
      const stored = await chrome.storage.local.get(['browserContextState']);
      if (stored.browserContextState) {
        this.state = { ...this.state, ...stored.browserContextState };
        console.log('📦 Restored state:', this.state);
      }
      
      // Find or create the living breadcrumb
      await this.ensureBreadcrumb();
      
      // Set up periodic capture alarm (survives service worker sleep!)
      await this.setupPeriodicCapture();
      
      // Capture current active tab
      await this.captureActiveTab();
      
      this.state.initialized = true;
      await this.persistState();
      
      console.log('✅ PageContextTracker: Ready');
    } catch (error) {
      console.error('❌ PageContextTracker initialization failed:', error);
    }
  }
  
  async setupPeriodicCapture() {
    // Clear any existing alarm
    await chrome.alarms.clear('rcrt-page-capture');
    
    // Create alarm that fires every 30 seconds
    // This keeps the tracker active even if service worker sleeps
    await chrome.alarms.create('rcrt-page-capture', {
      delayInMinutes: 0.5,  // 30 seconds
      periodInMinutes: 0.5
    });
    
    console.log('⏰ Set up periodic page capture alarm (30s interval)');
  }
  
  async ensureBreadcrumb() {
    try {
      // Wait for token to be available (may take a moment on startup)
      const token = await getStoredToken();
      if (!token) {
        console.log('⏳ No token yet, waiting for authentication...');
        // Wait up to 5 seconds for token
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const newToken = await getStoredToken();
          if (newToken) {
            console.log('✅ Token now available');
            break;
          }
        }
      }
      
      // Search for existing browser context breadcrumb for this extension
      const extensionId = chrome.runtime.id;
      const existing = await rcrtApi('GET', `/breadcrumbs?tag=extension:${extensionId}&schema_name=browser.page.context.v1`);
      
      const contextBreadcrumb = Array.isArray(existing) ? existing[0] : null;
      
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
      
      await this.persistState();
    } catch (error) {
      console.error('❌ Failed to ensure breadcrumb:', error);
    }
  }
  
  async captureActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Skip protected pages
      if (!tab?.id || !tab.url || 
          tab.url.startsWith('chrome://') || 
          tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('devtools://') ||
          tab.url.startsWith('edge://') ||
          tab.url.startsWith('about:')) {
        console.log('⏭️ Active tab is protected page, skipping');
        return;
      }
      
      this.state.currentTabId = tab.id;
      await this.captureAndUpdate(tab.id);
    } catch (error) {
      console.error('Failed to capture active tab:', error);
    }
  }
  
  async captureAndUpdate(tabId) {
    try {
      console.log('📸 Capturing page context for tab', tabId);
      
      // Get tab info
      const tab = await chrome.tabs.get(tabId);
      
      // Skip protected/internal pages
      if (!tab.url || 
          tab.url.startsWith('chrome://') || 
          tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('devtools://') ||
          tab.url.startsWith('edge://') ||
          tab.url.startsWith('about:')) {
        console.log('⏭️ Skipping protected page:', tab.url);
        return;
      }
      
      // THE RCRT WAY: No longer need buildDomTree - we use lightweight capture
      
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
      
      // If we lost the breadcrumb, try to recreate it
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        console.log('🔄 Breadcrumb lost, recreating...');
        this.state.breadcrumbId = null;
        await this.ensureBreadcrumb();
      }
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
    
    // Extract counts from simplified structure
    const interactiveCount = pageContext.dom.interactiveCount || 0;
    const headingCount = pageContext.content.headings.length;
    const linkCount = pageContext.content.links.length;
    
    // THE RCRT WAY: Send only essential data (top 50 interactive elements)
    const context = {
      url: pageContext.url,
      domain: pageContext.domain,
      title: pageContext.title,
      favicon: pageContext.favicon,
      
      viewport: pageContext.viewport,
      
      // Actionable DOM data - top 50 interactive elements with XPath
      dom: {
        interactiveCount: interactiveCount,
        interactiveElements: pageContext.dom.interactiveElements
      },
      
      content: pageContext.content,  // Already limited in capture function
      
      meta: pageContext.meta,
      
      session: {
        tabId: tab.id,
        capturedAt: new Date().toISOString()
      },
      
      // LLM hints for optimal consumption
      llm_hints: {
        mode: "merge",
        transform: {
          summary: {
            type: "template",
            template: `The user is viewing '${pageContext.title}' at ${pageContext.domain}.`
          },
          page_text: {
            type: "extract",
            value: "$.content.mainText"
          }
        },
        exclude: [
          "dom.map",           // Never send full DOM map
          "session.tabId"      // Internal detail
        ]
      }
    };
    
    try {
      const updateData = {
        title: `Browser: ${pageContext.title.slice(0, 50)}`,
        context,
        tags: [
          'browser:context',
          'browser:active-tab',
          `url:${pageContext.domain}`
        ]
      };
      
      // Use PATCH with If-Match header for optimistic locking
      await fetch(`http://127.0.0.1:8081/breadcrumbs/${this.state.breadcrumbId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getStoredToken()}`,
          'If-Match': `"${this.state.currentVersion}"`
        },
        body: JSON.stringify(updateData)
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Update failed: ${response.status} ${await response.text()}`);
        }
        return response.json();
      });
      
      this.state.currentVersion++;
      this.state.lastUpdate = Date.now();
      await this.persistState();
      
      console.log(`✅ Updated browser context (v${this.state.currentVersion}):`, 
        pageContext.title.slice(0, 30));
      
    } catch (error) {
      if (error.message?.includes('412') || error.message?.includes('version_mismatch')) {
        // Concurrent update - refetch and retry
        console.warn('⚠️ Version conflict, refetching breadcrumb...');
        try {
          const current = await rcrtApi('GET', `/breadcrumbs/${this.state.breadcrumbId}`);
          this.state.currentVersion = current.version;
          await this.persistState();
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
    return await rcrtApi('POST', '/breadcrumbs', {
      schema_name: 'browser.page.context.v1',
      title: 'Browser: Loading...',
      tags: [
        'browser:context',
        'browser:active-tab'
      ],
      context: {
        url: 'about:blank',
        domain: 'loading',
        title: 'Loading...',
        viewport: { width: 0, height: 0, scrollX: 0, scrollY: 0, devicePixelRatio: 1 },
        dom: { interactiveCount: 0, interactiveElements: {} },
        content: { mainText: '', headings: [], links: [], images: [] },
        meta: { description: '', keywords: [], ogTitle: '', ogImage: '', ogDescription: '' },
        session: {
          capturedAt: new Date().toISOString()
        }
      }
    });
  }
  
  // THE RCRT WAY: No longer needed - we use lightweight DOM capture
  // Keeping method for backwards compatibility but it's a no-op
  async ensureBuildDomTree(tabId) {
    // Not needed - we count interactive elements directly
  }
  
  async persistState() {
    await chrome.storage.local.set({ 
      browserContextState: {
        breadcrumbId: this.state.breadcrumbId,
        currentVersion: this.state.currentVersion,
        lastUpdate: this.state.lastUpdate,
        currentTabId: this.state.currentTabId
      }
    });
  }
  
  // Public method for manual trigger
  async forceUpdate() {
    if (this.state.currentTabId) {
      await this.captureAndUpdate(this.state.currentTabId);
    } else {
      await this.captureActiveTab();
    }
  }
}

// Function that runs in page context (injected)
function capturePageContextFunc(config) {
  // THE RCRT WAY: Lightweight but actionable DOM capture
  // Send interactive elements with automation details (limited to top 50)
  
  const allInteractive = Array.from(document.querySelectorAll(
    'button, a[href], input, select, textarea, [onclick], [role="button"], [role="link"]'
  )).filter(el => el.offsetParent !== null); // Visible only
  
  // Build lightweight interactive map (top 50 elements)
  const interactiveElements = {};
  allInteractive.slice(0, 50).forEach((el, index) => {
    // Generate XPath for reliable targeting
    const getXPath = (element) => {
      if (element.id) return `//*[@id="${element.id}"]`;
      
      const parts = [];
      let current = element;
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let index = 0;
        let sibling = current.previousSibling;
        while (sibling) {
          if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === current.nodeName) {
            index++;
          }
          sibling = sibling.previousSibling;
        }
        const tagName = current.nodeName.toLowerCase();
        const nth = index > 0 ? `[${index + 1}]` : '';
        parts.unshift(tagName + nth);
        current = current.parentNode;
      }
      return '/' + parts.join('/');
    };
    
    interactiveElements[index] = {
      tag: el.tagName.toLowerCase(),
      type: el.type || '',
      text: (el.textContent || el.value || '').trim().slice(0, 100),
      href: el.href || '',
      id: el.id || '',
      classes: Array.from(el.classList).slice(0, 5),
      xpath: getXPath(el),
      ariaLabel: el.getAttribute('aria-label') || '',
      placeholder: el.placeholder || ''
    };
  });
  
  const interactiveCount = allInteractive.length;
  
  // Extract content (limited for payload size)
  const mainText = document.body.innerText.trim().slice(0, 2000); // 2KB limit
  
  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    .slice(0, 20)  // Top 20 headings
    .map(h => h.textContent?.trim())
    .filter(Boolean);
  
  const links = Array.from(document.querySelectorAll('a[href]'))
    .filter(a => a.offsetParent !== null) // Visible only
    .slice(0, 15)  // Reduced from 50 to 15
    .map(a => ({
      text: (a.textContent?.trim() || '').slice(0, 80),
      href: a.href
    }));
  
  const images = Array.from(document.querySelectorAll('img[src]'))
    .filter(img => img.offsetParent !== null)
    .slice(0, 10)
    .map(img => ({
      alt: (img.alt || '').slice(0, 100),
      src: img.src.slice(0, 200)  // Limit URL length
    }));
  
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
    
    // THE RCRT WAY: Actionable but lightweight DOM data
    dom: {
      interactiveCount: interactiveCount,
      interactiveElements: interactiveElements // Top 50 elements with XPath for automation
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

// Singleton instance
export const simplePageContextTracker = new SimplePageContextTracker();

// ============ MV3 PERSISTENT EVENT LISTENERS ============
// These MUST be at the top level to survive service worker sleep

// Tab activation - capture when user switches tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log('📍 Tab activated:', activeInfo.tabId);
  simplePageContextTracker.state.currentTabId = activeInfo.tabId;
  
  // Wait a bit for tab to load
  setTimeout(async () => {
    try {
      await simplePageContextTracker.captureAndUpdate(activeInfo.tabId);
    } catch (error) {
      console.error('Failed to capture on tab activation:', error);
    }
  }, 1000);
});

// Tab updates - capture when page loads or navigates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    console.log('🔄 Tab updated (complete):', tabId);
    
    try {
      // Capture after brief delay to let page settle
      setTimeout(async () => {
        await simplePageContextTracker.captureAndUpdate(tabId);
      }, 500);
    } catch (error) {
      console.error('Failed to capture on tab update:', error);
    }
  }
});

// Navigation committed - capture immediately on URL change
if (chrome.webNavigation) {
  chrome.webNavigation.onCommitted.addListener(async (details) => {
    if (details.frameId === 0) { // Main frame only
      try {
        const tab = await chrome.tabs.get(details.tabId);
        
        // Skip protected pages
        if (!tab.active || !tab.url || 
            tab.url.startsWith('chrome://') || 
            tab.url.startsWith('chrome-extension://') ||
            tab.url.startsWith('devtools://') ||
            tab.url.startsWith('edge://') ||
            tab.url.startsWith('about:')) {
          return;
        }
        
        console.log('🌐 Navigation committed:', details.tabId);
        
        // Update tab ID
        simplePageContextTracker.state.currentTabId = details.tabId;
        
        // Schedule capture (page might still be loading)
        setTimeout(async () => {
          await simplePageContextTracker.captureAndUpdate(details.tabId);
        }, 1500);
      } catch (error) {
        console.error('Failed to handle navigation:', error);
      }
    }
  });
}

// Alarm listener - periodic capture to keep context fresh
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'rcrt-page-capture') {
    console.log('⏰ Periodic page capture triggered');
    
    try {
      // Re-initialize if needed (service worker may have slept)
      if (!simplePageContextTracker.state.initialized) {
        console.log('🔄 Service worker woke up, re-initializing tracker...');
        await simplePageContextTracker.initialize();
      } else {
        // Just capture current tab
        await simplePageContextTracker.captureActiveTab();
      }
    } catch (error) {
      console.error('Periodic capture failed:', error);
    }
  }
});

// Service worker startup - restore state
chrome.runtime.onStartup.addListener(async () => {
  console.log('🚀 Service worker startup - initializing tracker');
  await simplePageContextTracker.initialize();
});

// Extension install/update - initialize
chrome.runtime.onInstalled.addListener(async () => {
  console.log('📦 Extension installed/updated - initializing tracker');
  await simplePageContextTracker.initialize();
});
