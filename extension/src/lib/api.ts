// API utilities for Chrome extension (side panel)
// 🚀 RCRT-ONLY: Pure RCRT integration via dashboard proxy
const RCRT_DASHBOARD_PROXY = 'http://localhost:8082';

export type ExtMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type ChatOptions = {
  crew_id?: string;
  supervisor_id?: string;
};

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${RCRT_DASHBOARD_PROXY}${url}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// Legacy API - will be replaced by RCRT adapter
export const ExtensionCrewAPI = {
  config: () => http('/api/v1/crew/config'),
  supervisors: () => http('/api/v1/crew/supervisors'),
  // Unified sessions endpoints (backend/api/chat/sessions.py)
  listSessions: (page = 1, perPage = 50) => http(`/api/v1/chat/sessions?page=${page}&per_page=${perPage}`),
  createSession: (title: string, metadata?: Record<string, unknown>) => http('/api/v1/chat/sessions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, metadata })
  }),
  getSession: (sessionId: string) => http(`/api/v1/chat/sessions/${encodeURIComponent(sessionId)}`),
  messages: (sessionId: string, page = 1, perPage = 200) => http(`/api/v1/chat/sessions/${encodeURIComponent(sessionId)}/messages?page=${page}&per_page=${perPage}`),

  chat: (body: { session_id?: string; messages: ExtMessage[]; options?: ChatOptions }) =>
    http('/api/v1/crew/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }),

  chatStream: (body: { session_id?: string; messages: ExtMessage[]; options?: ChatOptions }) => {
    const controller = new AbortController();
    const run = async (onChunk: (chunk: string) => void) => {
      const res = await fetch(`${RCRT_DASHBOARD_PROXY}/api/v1/crew/chat?stream=true`, {
        method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' }, signal: controller.signal
      });
      if (!res.ok || !res.body) throw new Error('Stream failed');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        onChunk(decoder.decode(value, { stream: true }));
      }
    };
    const cancel = () => controller.abort();
    return { run, cancel };
  },
};

export const ExtensionSettingsAPI = {
  get: (category: string) => http(`/llm/api/v1/settings/${encodeURIComponent(category)}`),
  put: (category: string, settings: Record<string, unknown>) =>
    http(`/llm/api/v1/settings/${encodeURIComponent(category)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings })
    }),
};

// 🚀 NEW: RCRT-Integrated API (gradually replacing ExtensionCrewAPI)
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
  async chat(body: { session_id?: string; messages: ExtMessage[]; options?: ChatOptions }) {
    const { rcrtAdapter } = await import('./rcrt-adapter');
    return rcrtAdapter.chat(body);
  },

  chatStream(body: { session_id?: string; messages: ExtMessage[]; options?: ChatOptions }) {
    // Dynamic import to avoid circular dependencies
    return import('./rcrt-adapter').then(({ rcrtAdapter }) => 
      rcrtAdapter.chatStream(body)
    );
  },

  // Agent/crew discovery via RCRT agents
  async getCrews() {
    const { rcrtAdapter } = await import('./rcrt-adapter');
    return rcrtAdapter.getCrews();
  },

  async getSupervisors() {
    const { rcrtAdapter } = await import('./rcrt-adapter');
    return rcrtAdapter.getSupervisors();
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
  async getSelectedCrew(): Promise<string | null> {
    const result = await chrome.storage.local.get(['selectedCrew']);
    return result.selectedCrew || null;
  },
  async saveSelectedCrew(crewId: string): Promise<void> {
    await chrome.storage.local.set({ selectedCrew: crewId });
  },
  async getSelectedSupervisor(): Promise<string | null> {
    const result = await chrome.storage.local.get(['selectedSupervisor']);
    return result.selectedSupervisor || null;
  },
  async saveSelectedSupervisor(supervisorId: string): Promise<void> {
    await chrome.storage.local.set({ selectedSupervisor: supervisorId });
  },
};

