/**
 * Simple Browser Page Context Tracker
 * Works within Chrome Extension Service Worker constraints
 * Updates breadcrumb via RCRT API (no dynamic imports)
 */

class SimplePageContextTracker {
  constructor() {
    this.state = {
      breadcrumbId: null,
      currentVersion: 1,
      currentTabId: null,
      lastUpdate: 0
    };
    
    this.updateDebounce = null;
    this.DEBOUNCE_MS = 500;
  }
  
  async initialize() {
    console.log('🚀 PageContextTracker: Initializing (simple mode)...');
    
    try {
      // Ensure breadcrumb exists via direct API call
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
  
  setupListeners() {
    // Tab activation
    chrome.tabs.onActivated.addListener((activeInfo) => {
      console.log('📍 Tab activated:', activeInfo.tabId);
      this.state.currentTabId = activeInfo.tabId;
      this.scheduleUpdate(activeInfo.tabId);
    });
    
    // Tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.active) {
        console.log('🔄 Tab updated:', tabId);
        this.scheduleUpdate(tabId);
      }
    });
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
    if (this.updateDebounce) {
      clearTimeout(this.updateDebounce);
    }
    
    this.updateDebounce = setTimeout(() => {
      this.captureAndUpdate(tabId);
    }, this.DEBOUNCE_MS);
  }
  
  async captureAndUpdate(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        console.log('⏭️ Skipping internal page');
        return;
      }
      
      // Inject and execute capture
      await this.ensureBuildDomTree(tabId);
      
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          // Simplified capture (no buildDomTree dependency for MVP)
          const mainText = document.body.innerText.trim().slice(0, 5000);
          const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
            .map(h => h.textContent?.trim()).filter(Boolean);
          const links = Array.from(document.querySelectorAll('a[href]'))
            .filter(a => a.offsetParent !== null)
            .slice(0, 50)
            .map(a => ({ text: a.textContent?.trim(), href: a.href }));
          
          return {
            url: window.location.href,
            domain: window.location.hostname,
            title: document.title,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
              scrollX: window.scrollX,
              scrollY: window.scrollY
            },
            content: { mainText, headings, links }
          };
        }
      });
      
      if (result?.result) {
        await this.updateBreadcrumb(result.result, tab);
        console.log('✅ Browser context updated');
      }
      
    } catch (error) {
      console.error('❌ Failed to capture:', error);
    }
  }
  
  async ensureBreadcrumb() {
    try {
      const { extensionToken } = await chrome.storage.local.get('extensionToken');
      
      // Search for existing breadcrumb via API
      const response = await fetch('http://127.0.0.1:8081/breadcrumbs?schema_name=browser.page.context.v1&limit=1', {
        headers: { 'Authorization': `Bearer ${extensionToken}` }
      });
      
      if (response.ok) {
        const breadcrumbs = await response.json();
        if (breadcrumbs.length > 0) {
          this.state.breadcrumbId = breadcrumbs[0].id;
          this.state.currentVersion = breadcrumbs[0].version;
          console.log('✅ Found existing browser context breadcrumb');
          return;
        }
      }
      
      // Create new
      const createResp = await fetch('http://127.0.0.1:8081/breadcrumbs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${extensionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          schema_name: 'browser.page.context.v1',
          title: 'Browser: Loading...',
          tags: ['browser:context', 'browser:active-tab', 'extension:chrome'],
          context: {
            url: 'about:blank',
            title: 'Loading...',
            content: { mainText: '', headings: [], links: [] }
          }
        })
      });
      
      if (createResp.ok) {
        const created = await createResp.json();
        this.state.breadcrumbId = created.id;
        this.state.currentVersion = 1;
        console.log('🆕 Created browser context breadcrumb');
      }
      
    } catch (error) {
      console.error('Failed to ensure breadcrumb:', error);
    }
  }
  
  async updateBreadcrumb(pageContext, tab) {
    if (!this.state.breadcrumbId) return;
    
    try {
      const { extensionToken } = await chrome.storage.local.get('extensionToken');
      
      const context = {
        ...pageContext,
        session: {
          capturedAt: new Date().toISOString(),
          tabId: tab.id
        },
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
          }
        }
      };
      
      const response = await fetch(`http://127.0.0.1:8081/breadcrumbs/${this.state.breadcrumbId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${extensionToken}`,
          'Content-Type': 'application/json',
          'If-Match': `"${this.state.currentVersion}"`
        },
        body: JSON.stringify({
          title: `Browser: ${pageContext.title.slice(0, 50)}`,
          context,
          tags: ['browser:context', 'browser:active-tab', `url:${pageContext.domain}`]
        })
      });
      
      if (response.ok) {
        this.state.currentVersion++;
        this.state.lastUpdate = Date.now();
        console.log(`✅ Updated (v${this.state.currentVersion}): ${pageContext.title.slice(0, 30)}`);
      } else if (response.status === 412) {
        // Version mismatch - refetch
        console.warn('⚠️ Version mismatch, refetching...');
        await this.ensureBreadcrumb();
        // Retry
        await this.updateBreadcrumb(pageContext, tab);
      }
      
    } catch (error) {
      console.error('Failed to update breadcrumb:', error);
    }
  }
  
  async ensureBuildDomTree(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['buildDomTree.js']
      });
    } catch (error) {
      // May already be injected
    }
  }
}

export const simplePageContextTracker = new SimplePageContextTracker();
