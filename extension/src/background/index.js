// RCRT Chrome Extension Background Service
// Connects to RCRT dashboard proxy for authentication and automation

let currentTabId = null;
let isAttached = false;
let keepAliveCreated = false;

async function getConfig() {
  const { dashboardUrl, extensionToken } = await chrome.storage.local.get(['dashboardUrl', 'extensionToken']);
  // 🚀 RCRT-ONLY: Connect to RCRT dashboard proxy
  return {
    dashboardUrl: dashboardUrl || 'http://localhost:8082', // RCRT dashboard proxy (Docker port)
    extensionToken: extensionToken || ''
  };
}

async function connectToRCRT() {
  const { dashboardUrl, extensionToken } = await getConfig();
  
  console.log(`🚀 RCRT Extension - Connecting to dashboard: ${dashboardUrl}`);
  
  try {
    // Try to get JWT token from RCRT dashboard
    let token = extensionToken;
    
    console.log('🔑 Fetching JWT token from RCRT dashboard...');
    const res = await fetch(`${dashboardUrl}/api/auth/token`);
    
    if (res.ok) {
      const data = await res.json();
      if (data && data.token) {
        token = data.token;
        await chrome.storage.local.set({ extensionToken: token });
        console.log('✅ Got JWT token from RCRT dashboard');
        console.log('🎯 Extension ready for RCRT integration');
        return true;
      }
    } else if (res.status === 404) {
      console.log('ℹ️ RCRT dashboard running but no auth endpoint - extension will work via API');
      return true;
    } else {
      throw new Error(`Dashboard returned ${res.status}`);
    }
  } catch (e) {
    console.warn('❌ RCRT dashboard not available:', e.message);
    console.log('ℹ️ Start RCRT dashboard (cargo run -p rcrt-dashboard) for full features');
    console.log('📋 Extension will work with local storage until dashboard is available');
    return false;
  }
}

async function ensureDebuggerAttached(tabId) {
  if (isAttached) return;
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    isAttached = true;
  } catch (e) {
    // Might already be attached; try to detach and reattach
    try { await chrome.debugger.detach({ tabId }); } catch (err) { void 0; }
    await chrome.debugger.attach({ tabId }, '1.3');
    isAttached = true;
  }
}

async function ensureBuildDomTreeInjected(tabId) {
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

// Keep DOM helper available after navigations
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    if (tabId && changeInfo.status === 'complete' && tab?.url?.startsWith('http')) {
      await ensureBuildDomTreeInjected(tabId);
    }
  } catch (err) {
    console.warn('onUpdated ensure injection failed', err);
  }
});

// Initialize
chrome.runtime.onInstalled.addListener(async () => {
  // 🔧 FORCE RESET: Clear any old storage from previous versions
  await chrome.storage.local.clear();
  await chrome.storage.local.set({ 
    dashboardUrl: 'http://localhost:8082',
    extensionToken: '',
    _version: '2.0-rcrt' // Track version to avoid future storage conflicts
  });
  
  console.log('🧹 Cleared old storage, set dashboard URL to localhost:8082');
  
  await connectToRCRT();
  
  try { 
    chrome.sidePanel?.setOptions({ 
      path: 'src/sidepanel/index.html', 
      enabled: true 
    }); 
  } catch (err) { 
    console.warn('sidePanel setup failed:', err);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await connectToRCRT();
  
  try { 
    chrome.sidePanel?.setOptions({ 
      path: 'src/sidepanel/index.html', 
      enabled: true 
    }); 
  } catch (err) { 
    console.warn('sidePanel setup failed:', err);
  }
});

// Create keepalive alarm
if (!keepAliveCreated) {
  try {
    chrome.alarms.create('rcrt-keepalive', { periodInMinutes: 1 });
    keepAliveCreated = true;
  } catch (err) {
    console.warn('Failed to create keepalive alarm', err);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'rcrt-keepalive') {
    // Periodically check RCRT dashboard connection
    connectToRCRT().catch(err => 
      console.log('Keepalive check - RCRT dashboard not available:', err.message)
    );
  }
});

// When the toolbar icon is clicked, open the side panel
try {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
} catch (err) {
  console.warn('setPanelBehavior failed', err);
}