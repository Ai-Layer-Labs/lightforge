/**
 * Shared TypeScript types for RCRT SDK
 * Platform-agnostic - works in Node.js, Deno, and browsers
 */

export interface RcrtClientOptions {
  baseUrl: string;
  token?: string;
  fetch?: typeof globalThis.fetch;
}

export interface BreadcrumbCreate {
  title: string;
  description?: string;
  semantic_version?: string;
  context: Record<string, any>;
  tags: string[];
  schema_name?: string;
  llm_hints?: {
    exclude: string[];
    transform?: Record<string, any>;
    mode?: 'replace' | 'merge';
  };
  visibility?: 'public' | 'team' | 'private';
  sensitivity?: 'low' | 'pii' | 'secret';
  ttl?: string;
}

export interface BreadcrumbUpdate {
  title?: string;
  description?: string;
  semantic_version?: string;
  context?: Record<string, any>;
  tags?: string[];
  llm_hints?: any;
  visibility?: string;
  sensitivity?: string;
  ttl?: string;
}

export interface SearchParams {
  tag?: string;
  tags?: string[];
  schema_name?: string;
  limit?: number;
  offset?: number;
  include_context?: boolean;
}

export interface VectorSearchParams {
  q?: string;
  qvec?: number[];
  nn?: number;
  tag?: string;
  schema_name?: string;
}

