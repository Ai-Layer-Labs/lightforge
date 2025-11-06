/**
 * RCRT Browser Extension v2 - Background Service Worker
 * Manages multi-tab context tracking and RCRT connection
 */

import { RCRTClient } from '../lib/rcrt-client';
import { TabContextManager } from './tab-context-manager';

let rcrtClient: RCRTClient | null = null;
let tabContextManager: TabContextManager | null = null;
let isInitialized = false;

/**
 * Initialize the extension
 */
async function initialize(): Promise<void> {
  if (isInitialized) {
    console.log('[Background] Already initialized');
    return;
  }

  console.log('[Background] Initializing RCRT Extension v2...');

  try {
    // Load settings
    const settings = await chrome.storage.local.get([
      'rcrtServerUrl',
      'ownerId',
      'agentId',
      'multiTabTracking'
    ]);

    // Initialize RCRT client
    rcrtClient = new RCRTClient({
      baseUrl: settings.rcrtServerUrl || 'http://localhost:8081',
      ownerId: settings.ownerId,
      agentId: settings.agentId,
    });

    // Authenticate
    await rcrtClient.authenticate();
    console.log('[Background] Authenticated with RCRT server');

    // Initialize tab context manager (if enabled)
    if (settings.multiTabTracking !== false) {
      tabContextManager = new TabContextManager(rcrtClient);
      await tabContextManager.initialize();
      console.log('[Background] Tab context manager initialized');
    }

    isInitialized = true;
    console.log('[Background] Initialization complete');
  } catch (error) {
    console.error('[Background] Initialization failed:', error);
    throw error;
  }
}

/**
 * Tab activated - switch active tab subscription
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log('[Background] Tab activated:', activeInfo.tabId);

  if (tabContextManager) {
    await tabContextManager.markTabAsActive(activeInfo.tabId);
  }
});

/**
 * Tab updated - capture when page loads
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, _tab) => {
  if (changeInfo.status === 'complete' && tabContextManager) {
    // Brief delay to let page settle
    setTimeout(async () => {
      await tabContextManager!.captureAndUpdateTab(tabId);
    }, 500);
  }
});

/**
 * Tab created - ensure it has a breadcrumb
 */
chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.id && tabContextManager) {
    // Will be captured when page loads (onUpdated)
    console.log('[Background] New tab created:', tab.id);
  }
});

/**
 * Tab removed - mark breadcrumb as closed
 */
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabContextManager) {
    await tabContextManager.handleTabClose(tabId);
  }
});

/**
 * Navigation committed - immediate capture on URL change
 */
chrome.webNavigation?.onCommitted.addListener(async (details) => {
  if (details.frameId === 0 && tabContextManager) {
    // Main frame navigation
    setTimeout(async () => {
      await tabContextManager!.captureAndUpdateTab(details.tabId);
    }, 1000);
  }
});

/**
 * Alarm listener - periodic capture
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'tab-context-capture') {
    // Re-initialize if service worker woke up
    if (!isInitialized) {
      await initialize();
    } else if (tabContextManager) {
      // Capture all tabs
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id) {
          await tabContextManager.captureAndUpdateTab(tab.id);
        }
      }
    }
  }
});

/**
 * Extension installed/updated
 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Background] Extension installed/updated');

  // Set default settings
  const existing = await chrome.storage.local.get([
    'rcrtServerUrl',
    'multiTabTracking'
  ]);

  await chrome.storage.local.set({
    rcrtServerUrl: existing.rcrtServerUrl || 'http://localhost:8081',
    multiTabTracking: existing.multiTabTracking !== false, // Default: true
    workspace: existing.workspace || 'workspace:browser',
    theme: existing.theme || 'system'
  });

  // Initialize
  await initialize();

  // Set up side panel
  try {
    chrome.sidePanel?.setOptions({
      path: 'sidepanel.html',
      enabled: true
    });
    chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    console.warn('[Background] Side panel setup failed:', error);
  }
});

/**
 * Service worker startup
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Background] Service worker startup');
  await initialize();
});

/**
 * Message handler for communication with side panel
 */
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'GET_CLIENT') {
    // Return client status
    sendResponse({
      initialized: isInitialized,
      hasClient: rcrtClient !== null,
      hasTabManager: tabContextManager !== null
    });
    return true;
  }

  if (request.type === 'REINITIALIZE') {
    // Reinitialize after settings change
    isInitialized = false;
    rcrtClient = null;
    tabContextManager = null;
    
    initialize()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true;
  }

  if (request.type === 'GET_ALL_TABS') {
    // Get all tab contexts
    if (tabContextManager) {
      tabContextManager.getAllTabContexts()
        .then(tabs => sendResponse({ success: true, tabs }))
        .catch(error => sendResponse({ success: false, error: error.message }));
    } else {
      sendResponse({ success: false, error: 'Tab manager not initialized' });
    }
    return true;
  }
  
  if (request.type === 'GET_ACTIVE_TAB') {
    // Get active tab context
    if (tabContextManager) {
      tabContextManager.getActiveTabContext()
        .then(tab => sendResponse({ success: true, tab }))
        .catch(error => sendResponse({ success: false, error: error.message }));
    } else {
      sendResponse({ success: false, error: 'Tab manager not initialized' });
    }
    return true;
  }
});

/**
 * Context menu - "Save to RCRT"
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-rcrt',
    title: 'Save to RCRT',
    contexts: ['page', 'selection']
  });

  chrome.contextMenus.create({
    id: 'share-with-chat',
    title: 'Share with RCRT Chat',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'open-notes',
    title: 'Open RCRT Notes',
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'save-to-rcrt') {
    // Open side panel to save page
    if (tab?.windowId) {
      chrome.sidePanel.open({ windowId: tab.windowId });
    }
  }
  
  if (info.menuItemId === 'share-with-chat') {
    // Send selection to chat (implement in side panel)
    if (tab?.id) {
      chrome.runtime.sendMessage({
        type: 'ADD_SELECTION_TO_CHAT',
        selection: info.selectionText
      });
    }
  }

  if (info.menuItemId === 'open-notes') {
    // Open side panel to notes tab
    if (tab?.windowId) {
      chrome.sidePanel.open({ windowId: tab.windowId });
      chrome.runtime.sendMessage({ type: 'SWITCH_TO_NOTES_TAB' });
    }
  }
});

