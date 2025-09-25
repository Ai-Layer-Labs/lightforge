// API utilities for Chrome extension (side panel)
// Pure RCRT integration

export type ExtMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

// RCRT-Integrated API
export const ExtensionAPI = {
  // Session management via RCRT breadcrumbs
  async createSession(title: string, metadata?: Record<string, unknown>) {
    const { rcrtAdapter } = await import('./rcrt-adapter');
    return rcrtAdapter.createSession(title, metadata);
  },

  async getSession(sessionId: string) {
    const { rcrtAdapter } = await import('./rcrt-adapter');
    return rcrtAdapter.getSession(sessionId);
  },

  async listSessions(page = 1, perPage = 50) {
    const { rcrtAdapter } = await import('./rcrt-adapter');
    return rcrtAdapter.listSessions(page, perPage);
  },

  // Chat via RCRT tool requests
  async chat(body: { session_id?: string; messages: ExtMessage[] }) {
    const { rcrtAdapter } = await import('./rcrt-adapter');
    return rcrtAdapter.chat(body);
  },

  chatStream(body: { session_id?: string; messages: ExtMessage[] }) {
    // Dynamic import to avoid circular dependencies
    return import('./rcrt-adapter').then(({ rcrtAdapter }) => 
      rcrtAdapter.chatStream(body)
    );
  },

  // Browser state integration
  async createBrowserStateBreadcrumb(pageData: {
    url: string;
    title: string;
    viewport: { width: number; height: number };
    snapshot?: unknown;
  }) {
    const { rcrtClient } = await import('./rcrt-client');
    return rcrtClient.createBrowserStateBreadcrumb(pageData);
  },

  // Configuration
  async isReady() {
    const { rcrtAdapter } = await import('./rcrt-adapter');
    return rcrtAdapter.isReady();
  },

  async reconnect() {
    const { rcrtAdapter } = await import('./rcrt-adapter');
    return rcrtAdapter.reconnect();
  },
};

// Local storage helpers
export const ExtensionStorage = {
  async getMessages(): Promise<ExtMessage[]> {
    const result = await chrome.storage.local.get(['messages']);
    return result.messages || [];
  },
  async saveMessages(messages: ExtMessage[]): Promise<void> {
    await chrome.storage.local.set({ messages });
  },
  async clearMessages(): Promise<void> {
    await chrome.storage.local.remove('messages');
  },
  async getSessionId(): Promise<string | null> {
    const result = await chrome.storage.local.get(['sessionId']);
    return result.sessionId || null;
  },
  async saveSessionId(sessionId: string): Promise<void> {
    await chrome.storage.local.set({ sessionId });
  },
};