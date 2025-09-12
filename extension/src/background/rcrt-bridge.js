/**
 * RCRT Bridge for Chrome Extension Background Service
 * Handles communication between extension and RCRT ecosystem
 */

class RCRTBridge {
  constructor() {
    this.rcrtBaseUrl = 'http://localhost:8082'; // Dashboard proxy (Docker port)
    this.token = null;
    this.eventSource = null;
    this.isConnected = false;
    this.pendingRequests = new Map();
  }

  async initialize() {
    console.log('🚀 Initializing RCRT Bridge...');
    
    try {
      await this.authenticate();
      await this.connectEventStream();
      console.log('✅ RCRT Bridge initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize RCRT Bridge:', error);
      return false;
    }
  }

  async authenticate() {
    try {
      console.log('🔑 Authenticating with RCRT via dashboard proxy...');
      const response = await fetch(`${this.rcrtBaseUrl}/api/auth/token`);
      
      if (response.ok) {
        const data = await response.json();
        this.token = data.token;
        console.log('✅ RCRT authentication successful');
        return true;
      } else {
        throw new Error(`Authentication failed: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ RCRT authentication failed:', error);
      throw error;
    }
  }

  async connectEventStream() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    const streamUrl = `${this.rcrtBaseUrl}/api/events/stream`;
    this.eventSource = new EventSource(streamUrl);

    this.eventSource.onopen = () => {
      console.log('📡 Connected to RCRT event stream');
      this.isConnected = true;
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleRCRTEvent(data);
      } catch (error) {
        console.warn('Failed to parse RCRT event:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('RCRT SSE error:', error);
      this.isConnected = false;
      
      // Reconnect after delay
      setTimeout(() => {
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          this.connectEventStream();
        }
      }, 5000);
    };
  }

  async handleRCRTEvent(eventData) {
    console.log('📡 RCRT Event:', eventData);

    // Handle tool responses (for chat messages)
    if (eventData.type === 'breadcrumb_created' && eventData.schema_name === 'tool.response.v1') {
      try {
        const breadcrumb = await this.getBreadcrumb(eventData.breadcrumb_id);
        const requestId = breadcrumb.context?.request_id;
        
        if (requestId && this.pendingRequests.has(requestId)) {
          const { resolve } = this.pendingRequests.get(requestId);
          resolve(breadcrumb.context);
          this.pendingRequests.delete(requestId);
        }
      } catch (error) {
        console.error('Failed to handle tool response:', error);
      }
    }

    // Handle browser state requests
    if (eventData.type === 'breadcrumb_created' && eventData.schema_name === 'browser.request.v1') {
      await this.handleBrowserRequest(eventData.breadcrumb_id);
    }
  }

  async handleBrowserRequest(breadcrumbId) {
    try {
      const breadcrumb = await this.getBreadcrumb(breadcrumbId);
      const request = breadcrumb.context;

      console.log('🌐 Handling browser request:', request.action);

      let result;
      switch (request.action) {
        case 'get_state':
          result = await this.getBrowserState(request.options);
          break;
        case 'navigate':
          result = await this.navigateToUrl(request.url);
          break;
        case 'click':
          result = await this.clickElement(request.selector);
          break;
        case 'type':
          result = await this.typeText(request.selector, request.text);
          break;
        case 'screenshot':
          result = await this.takeScreenshot();
          break;
        default:
          result = { ok: false, error: `Unknown action: ${request.action}` };
      }

      // Send response as breadcrumb
      await this.createBreadcrumb({
        title: `Browser Response: ${request.action}`,
        context: {
          type: 'browser_response',
          request_id: breadcrumbId,
          action: request.action,
          result,
          timestamp: new Date().toISOString(),
        },
        tags: ['browser:response', 'chrome:extension'],
        schema_name: 'browser.response.v1',
        visibility: 'team',
      });

    } catch (error) {
      console.error('Failed to handle browser request:', error);
      
      // Send error response
      await this.createBreadcrumb({
        title: `Browser Error: ${request?.action || 'unknown'}`,
        context: {
          type: 'browser_error',
          request_id: breadcrumbId,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        tags: ['browser:error', 'chrome:extension'],
        schema_name: 'browser.error.v1',
        visibility: 'team',
      });
    }
  }

  // ============ Browser Automation Methods ============

  async getBrowserState(options = {}) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');

      await this.ensureBuildDomTreeInjected(tab.id);
      
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (args) => {
          if (typeof window.buildDomTree !== 'function') {
            return { ok: false, error: 'buildDomTree not available' };
          }
          try {
            const snapshot = window.buildDomTree(args || {
              showHighlightElements: false,
              focusHighlightIndex: -1,
              viewportExpansion: 0,
              debugMode: false
            });
            const title = document.title || '';
            const url = location.href || '';
            const viewport = { width: window.innerWidth, height: window.innerHeight };
            return { ok: true, data: { url, title, viewport, timestamp: Date.now(), snapshot } };
          } catch (e) {
            return { ok: false, error: String(e?.message || e) };
          }
        },
        args: [options]
      });

      const payload = result?.[0]?.result || { ok: false, error: 'no result' };
      return payload;
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async navigateToUrl(url) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.tabs.update(tab.id, { url });
        return { ok: true, data: { url } };
      } else {
        const newTab = await chrome.tabs.create({ url, active: true });
        return { ok: true, data: { url, tabId: newTab.id } };
      }
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async clickElement(selector) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel) => {
          const element = document.querySelector(sel);
          if (!element) throw new Error('Element not found');
          element.click();
          return true;
        },
        args: [selector]
      });

      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async typeText(selector, text) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel, txt) => {
          const element = document.querySelector(sel);
          if (!element) throw new Error('Element not found');
          
          if (element instanceof HTMLInputElement || 
              element instanceof HTMLTextAreaElement || 
              element.isContentEditable) {
            element.focus();
            if ('value' in element) {
              element.value = txt;
            }
            const event = new Event('input', { bubbles: true });
            element.dispatchEvent(event);
            return true;
          }
          throw new Error('Element is not editable');
        },
        args: [selector, text]
      });

      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async takeScreenshot() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');

      const dataUrl = await chrome.tabs.captureVisibleTab();
      return { ok: true, data: { dataUrl } };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  // ============ RCRT API Methods ============

  async createBreadcrumb(breadcrumb) {
    const response = await fetch(`${this.rcrtBaseUrl}/api/breadcrumbs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify(breadcrumb),
    });

    if (!response.ok) {
      throw new Error(`Failed to create breadcrumb: ${response.status}`);
    }

    return response.json();
  }

  async getBreadcrumb(id) {
    const response = await fetch(`${this.rcrtBaseUrl}/api/breadcrumbs/${id}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get breadcrumb: ${response.status}`);
    }

    return response.json();
  }

  async ensureBuildDomTreeInjected(tabId) {
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => typeof window.buildDomTree === 'function'
      });
      
      if (!result?.[0]?.result) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['buildDomTree.js']
        });
      }
    } catch (error) {
      console.warn('Failed to inject buildDomTree:', error);
    }
  }

  // ============ Lifecycle ============

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    console.log('🔌 RCRT Bridge disconnected');
  }
}

// Global bridge instance
const rcrtBridge = new RCRTBridge();

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  rcrtBridge.initialize();
});

chrome.runtime.onInstalled.addListener(async () => {
  await rcrtBridge.initialize();
});

// Export for use in background script
self.rcrtBridge = rcrtBridge;
