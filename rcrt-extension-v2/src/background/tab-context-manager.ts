/**
 * Multi-Tab Context Manager
 * Tracks all browser tabs and maintains browser.tab.context.v1 breadcrumbs
 * Only the active tab is tagged with 'browser:active-tab'
 */

import { RCRTClient } from '../lib/rcrt-client';
import type { TabContext } from '../lib/types';

export interface TabState {
  tabId: number;
  breadcrumbId: string | null;
  currentVersion: number;
  lastUpdate: number;
  isActive: boolean;
}

export class TabContextManager {
  private client: RCRTClient;
  private tabStates: Map<number, TabState> = new Map();
  private activeTabId: number | null = null;
  private initialized = false;

  private readonly MAX_TEXT_LENGTH = 2000;
  private readonly MAX_INTERACTIVE_ELEMENTS = 50;
  private readonly MAX_LINKS = 50;
  private readonly MAX_IMAGES = 20;

  constructor(client: RCRTClient) {
    this.client = client;
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[TabContextManager] Already initialized');
      return;
    }

    console.log('[TabContextManager] Initializing...');

    try {
      // Load persisted state
      const stored = await chrome.storage.local.get('tabContextState');
      if (stored.tabContextState) {
        this.tabStates = new Map(Object.entries(stored.tabContextState).map(
          ([key, value]) => [parseInt(key), value as TabState]
        ));
        console.log(`[TabContextManager] Restored ${this.tabStates.size} tab states`);
      }

      // Get all current tabs and ensure they have breadcrumbs
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && this.canCaptureTab(tab)) {
          await this.ensureBreadcrumbForTab(tab.id);
        }
      }

      // Get active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id) {
        this.activeTabId = activeTab.id;
        await this.markTabAsActive(activeTab.id);
      }

      // Set up periodic capture alarm
      await chrome.alarms.create('tab-context-capture', {
        delayInMinutes: 0.5,  // 30 seconds
        periodInMinutes: 0.5
      });

      this.initialized = true;
      console.log('[TabContextManager] Initialized successfully');
    } catch (error) {
      console.error('[TabContextManager] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if a tab can be captured
   */
  private canCaptureTab(tab: chrome.tabs.Tab): boolean {
    if (!tab.url) return false;

    const uncapturableProtocols = [
      'chrome://',
      'chrome-extension://',
      'devtools://',
      'edge://',
      'about:'
    ];

    return !uncapturableProtocols.some(protocol => tab.url!.startsWith(protocol));
  }

  /**
   * Ensure a tab has a breadcrumb
   */
  private async ensureBreadcrumbForTab(tabId: number): Promise<void> {
    let state = this.tabStates.get(tabId);

    if (!state) {
      // Create initial breadcrumb
      const breadcrumb = await this.createInitialBreadcrumb(tabId);
      state = {
        tabId,
        breadcrumbId: breadcrumb.id,
        currentVersion: 1,
        lastUpdate: Date.now(),
        isActive: false
      };
      this.tabStates.set(tabId, state);
      await this.persistState();
      console.log(`[TabContextManager] Created breadcrumb for tab ${tabId}`);
    }
  }

  /**
   * Create initial breadcrumb for a tab
   */
  private async createInitialBreadcrumb(tabId: number) {
    const tab = await chrome.tabs.get(tabId);
    
    // 5 minute TTL for browser context (ephemeral)
    const ttl = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    
    return await this.client.createBreadcrumb({
      schema_name: 'browser.tab.context.v1',
      title: `Browser Tab: ${tab.title || 'Loading...'}`,
      tags: [
        'browser:context',
        `browser:tab:${tabId}`,
        'extension:rcrt-v2'
      ],
      ttl: ttl,
      context: {
        url: tab.url || 'about:blank',
        domain: new URL(tab.url || 'about:blank').hostname,
        title: tab.title || 'Loading...',
        tab_id: tabId,
        viewport: { width: 0, height: 0, scrollX: 0, scrollY: 0, devicePixelRatio: 1 },
        dom: { interactiveCount: 0, interactiveElements: {} },
        content: { mainText: '', headings: [], links: [], images: [] },
        meta: { description: '', keywords: [], ogTitle: '', ogImage: '', ogDescription: '' },
        session: {
          capturedAt: new Date().toISOString(),
          workspace: 'workspace:browser'
        }
      }
    });
  }

  /**
   * Capture and update tab context
   */
  async captureAndUpdateTab(tabId: number): Promise<void> {
    try {
      const tab = await chrome.tabs.get(tabId);

      if (!this.canCaptureTab(tab)) {
        console.log(`[TabContextManager] Skipping protected tab ${tabId}`);
        return;
      }

      // Ensure tab has a breadcrumb
      await this.ensureBreadcrumbForTab(tabId);

      // Execute capture script
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: this.captureTabContextFunc,
        args: [{
          maxTextLength: this.MAX_TEXT_LENGTH,
          maxInteractiveElements: this.MAX_INTERACTIVE_ELEMENTS,
          maxLinks: this.MAX_LINKS,
          maxImages: this.MAX_IMAGES
        }]
      });

      if (!result?.result) {
        console.warn(`[TabContextManager] No result from tab ${tabId}`);
        return;
      }

      const tabContext = result.result as TabContext;

      // Update breadcrumb
      await this.updateBreadcrumb(tabId, tabContext, tab);

      console.log(`[TabContextManager] Updated tab ${tabId}: ${tab.title}`);
    } catch (error) {
      console.error(`[TabContextManager] Failed to capture tab ${tabId}:`, error);
    }
  }

  /**
   * Function that runs in page context to capture tab data
   */
  private captureTabContextFunc(config: {
    maxTextLength: number;
    maxInteractiveElements: number;
    maxLinks: number;
    maxImages: number;
  }): TabContext {
    // Capture interactive elements with XPath
    const allInteractive = Array.from(document.querySelectorAll(
      'button, a[href], input, select, textarea, [onclick], [role="button"], [role="link"]'
    )).filter(el => (el as HTMLElement).offsetParent !== null);

    const interactiveElements: Record<string, any> = {};
    
    allInteractive.slice(0, config.maxInteractiveElements).forEach((el, index) => {
      const getXPath = (element: Element): string => {
        if (element.id) return `//*[@id="${element.id}"]`;
        
        const parts: string[] = [];
        let current: Element | null = element;
        
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
          current = current.parentNode as Element;
        }
        
        return '/' + parts.join('/');
      };

      const htmlEl = el as HTMLElement;
      interactiveElements[index] = {
        tag: htmlEl.tagName.toLowerCase(),
        type: (htmlEl as any).type || '',
        text: (htmlEl.textContent || (htmlEl as any).value || '').trim().slice(0, 100),
        href: (htmlEl as any).href || '',
        id: htmlEl.id || '',
        classes: Array.from(htmlEl.classList).slice(0, 5),
        xpath: getXPath(htmlEl),
        ariaLabel: htmlEl.getAttribute('aria-label') || '',
        placeholder: (htmlEl as any).placeholder || ''
      };
    });

    // Extract content
    const mainText = document.body.innerText.trim().slice(0, config.maxTextLength);

    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
      .slice(0, 20)
      .map(h => h.textContent?.trim())
      .filter(Boolean) as string[];

    const links = Array.from(document.querySelectorAll('a[href]'))
      .filter(a => (a as HTMLElement).offsetParent !== null)
      .slice(0, config.maxLinks)
      .map(a => ({
        text: (a.textContent?.trim() || '').slice(0, 80),
        href: (a as HTMLAnchorElement).href
      }));

    const images = Array.from(document.querySelectorAll('img[src]'))
      .filter(img => (img as HTMLElement).offsetParent !== null)
      .slice(0, config.maxImages)
      .map(img => ({
        alt: (img.getAttribute('alt') || '').slice(0, 100),
        src: (img as HTMLImageElement).src.slice(0, 200)
      }));

    // Get metadata
    const getMeta = (name: string) => {
      const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
      return el?.getAttribute('content') || '';
    };

    return {
      url: window.location.href,
      domain: window.location.hostname,
      title: document.title,
      favicon: document.querySelector('link[rel~="icon"]')?.getAttribute('href') || '',
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        devicePixelRatio: window.devicePixelRatio
      },
      dom: {
        interactiveCount: allInteractive.length,
        interactiveElements: interactiveElements
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

  /**
   * Update breadcrumb with captured context
   */
  private async updateBreadcrumb(
    tabId: number,
    tabContext: TabContext,
    tab: chrome.tabs.Tab
  ): Promise<void> {
    const state = this.tabStates.get(tabId);
    if (!state?.breadcrumbId) {
      console.error(`[TabContextManager] No breadcrumb ID for tab ${tabId}`);
      return;
    }

    const tags = [
      'browser:context',
      `browser:tab:${tabId}`,
      `url:${tabContext.domain}`,
      'extension:rcrt-v2'
    ];

    // Add active tag if this is the active tab
    if (state.isActive) {
      tags.push('browser:active-tab');
    }

    // 5 minute TTL for browser context (ephemeral)
    const ttl = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    try {
      await this.client.updateBreadcrumb(
        state.breadcrumbId,
        state.currentVersion,
        {
          title: `Browser Tab: ${tabContext.title.slice(0, 50)}`,
          tags,
          ttl: ttl,
          context: {
            ...tabContext,
            tab_id: tabId,
            session: {
              capturedAt: new Date().toISOString(),
              workspace: 'workspace:browser'
            }
          }
        }
      );

      state.currentVersion++;
      state.lastUpdate = Date.now();
      await this.persistState();
    } catch (error: any) {
      // Handle version conflicts
      if (error.message?.includes('412') || error.message?.includes('version_mismatch')) {
        console.warn(`[TabContextManager] Version conflict for tab ${tabId}, refetching...`);
        try {
          const current = await this.client.getBreadcrumb(state.breadcrumbId);
          state.currentVersion = current.version;
          await this.updateBreadcrumb(tabId, tabContext, tab);
        } catch (retryError) {
          console.error(`[TabContextManager] Retry failed for tab ${tabId}:`, retryError);
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Mark a tab as active (add browser:active-tab tag)
   */
  async markTabAsActive(tabId: number): Promise<void> {
    // Remove active tag from previous active tab
    if (this.activeTabId !== null && this.activeTabId !== tabId) {
      await this.markTabAsInactive(this.activeTabId);
    }

    const state = this.tabStates.get(tabId);
    if (state) {
      state.isActive = true;
      this.activeTabId = tabId;
      
      // Immediately update breadcrumb to add active tag
      await this.captureAndUpdateTab(tabId);
    }
  }

  /**
   * Mark a tab as inactive (remove browser:active-tab tag)
   */
  private async markTabAsInactive(tabId: number): Promise<void> {
    const state = this.tabStates.get(tabId);
    if (state && state.isActive) {
      state.isActive = false;
      
      // Update breadcrumb to remove active tag
      try {
        const tab = await chrome.tabs.get(tabId);
        if (this.canCaptureTab(tab)) {
          // Get current context
          const [result] = await chrome.scripting.executeScript({
            target: { tabId },
            func: this.captureTabContextFunc,
            args: [{
              maxTextLength: this.MAX_TEXT_LENGTH,
              maxInteractiveElements: this.MAX_INTERACTIVE_ELEMENTS,
              maxLinks: this.MAX_LINKS,
              maxImages: this.MAX_IMAGES
            }]
          });

          if (result?.result) {
            await this.updateBreadcrumb(tabId, result.result as TabContext, tab);
          }
        }
      } catch (error) {
        console.error(`[TabContextManager] Failed to mark tab ${tabId} as inactive:`, error);
      }
    }
  }

  /**
   * Handle tab close
   */
  async handleTabClose(tabId: number): Promise<void> {
    const state = this.tabStates.get(tabId);
    if (state?.breadcrumbId) {
      try {
        // Update breadcrumb to mark as closed (add TTL)
        await this.client.updateBreadcrumb(
          state.breadcrumbId,
          state.currentVersion,
          {
            tags: ['browser:context', 'browser:closed', `browser:tab:${tabId}`],
            ttl: new Date(Date.now() + 3600000).toISOString() // 1 hour TTL
          }
        );
      } catch (error) {
        console.error(`[TabContextManager] Failed to mark tab ${tabId} as closed:`, error);
      }
    }

    this.tabStates.delete(tabId);
    if (this.activeTabId === tabId) {
      this.activeTabId = null;
    }
    await this.persistState();
  }

  /**
   * Persist state to chrome storage
   */
  private async persistState(): Promise<void> {
    const stateObject: Record<string, TabState> = {};
    this.tabStates.forEach((value, key) => {
      stateObject[key] = value;
    });

    await chrome.storage.local.set({ tabContextState: stateObject });
  }

  /**
   * Get all tab contexts
   */
  async getAllTabContexts(): Promise<any[]> {
    return await this.client.listBreadcrumbs({
      schema_name: 'browser.tab.context.v1',
      limit: 50
    });
  }

  /**
   * Get active tab context
   */
  async getActiveTabContext(): Promise<any | null> {
    const results = await this.client.searchBreadcrumbs({
      schema_name: 'browser.tab.context.v1',
      any_tags: ['browser:active-tab'],
      limit: 1
    });

    return results.length > 0 ? results[0] : null;
  }
}

