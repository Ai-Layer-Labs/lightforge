/**
 * Type definitions for RCRT Browser Extension v2
 */

// ============ RCRT Breadcrumb Types ============

export interface Breadcrumb {
  id: string;
  title: string;
  schema_name?: string;
  tags: string[];
  context: Record<string, any>;
  version: number;
  checksum: string;
  ttl?: string;
  visibility?: 'public' | 'team' | 'private';
  sensitivity?: 'low' | 'pii' | 'secret';
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  owner_id: string;
}

export interface BreadcrumbCreate {
  schema_name?: string;
  title: string;
  tags: string[];
  context: Record<string, any>;
  ttl?: string;
  visibility?: 'public' | 'team' | 'private';
  sensitivity?: 'low' | 'pii' | 'secret';
}

// ============ Page Context ============

export interface PageContext {
  url: string;
  title: string;
  domain: string;
  ogImage?: string;
  content: {
    mainText: string; // Markdown-formatted content
    headings: string[];
    links: Array<{
      text: string;
      href: string;
    }>;
    images?: Array<{
      alt: string;
      src: string;
    }>;
  };
  timestamp: number;
}

// ============ Note Types (note.v1) ============

export interface NoteContext {
  content: string; // Markdown content
  url: string;
  domain: string;
  og_image?: string;
  captured_at: string;
}

export interface NoteTags {
  note_id: string;
  tags: string[];
}

export interface NoteSummary {
  note_id: string;
  summary: string;
}

export interface NoteInsights {
  note_id: string;
  insights: string[];
}

export interface NoteEli5 {
  note_id: string;
  eli5: string;
}

// ============ Chat Types ============

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  tool_name?: string;
  conversation_id?: string;
}

// ============ Browser Tab Context ============

export interface TabContext {
  url: string;
  domain: string;
  title: string;
  favicon?: string;
  viewport: {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
    devicePixelRatio: number;
  };
  dom: {
    interactiveCount: number;
    interactiveElements: Record<string, InteractiveElement>;
  };
  content: {
    mainText: string;
    headings: string[];
    links: Array<{ text: string; href: string }>;
    images: Array<{ alt: string; src: string }>;
  };
  meta: {
    description: string;
    keywords: string[];
    ogTitle: string;
    ogImage: string;
    ogDescription: string;
  };
}

export interface InteractiveElement {
  tag: string;
  type: string;
  text: string;
  href?: string;
  id?: string;
  classes: string[];
  xpath: string;
  ariaLabel?: string;
  placeholder?: string;
}

// ============ SSE Event Types ============

export interface SSEEvent {
  type: 'breadcrumb.created' | 'breadcrumb.updated' | 'breadcrumb.deleted';
  breadcrumb_id: string;
  breadcrumb: Breadcrumb;
  timestamp: string;
}

// ============ Search Types ============

export interface SearchParams {
  q?: string; // Semantic search query
  schema_name?: string;
  tag?: string;
  any_tags?: string[];
  all_tags?: string[];
  nn?: number; // Number of nearest neighbors
  exclude_ids?: string[];
  sort?: string;
  limit?: number;
}

// ============ Settings Types ============

export interface ExtensionSettings {
  rcrtServerUrl: string;
  workspace: string;
  multiTabTracking: boolean;
  theme: 'light' | 'dark' | 'system';
}

// ============ UI State Types ============

export interface ProcessingStatus {
  noteId: string;
  breadcrumb?: 'pending' | 'complete' | 'error';
  tags?: 'pending' | 'complete' | 'error';
  summary?: 'pending' | 'complete' | 'error';
  insights?: 'pending' | 'complete' | 'error';
  eli5?: 'pending' | 'complete' | 'error';
}

