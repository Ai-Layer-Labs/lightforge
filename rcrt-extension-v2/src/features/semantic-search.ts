/**
 * Semantic Search Feature
 * Search notes by meaning using pgvector
 */

import type { RCRTClient } from '../lib/rcrt-client';
import type { Breadcrumb } from '../lib/types';

/**
 * Search notes semantically
 */
export async function searchNotes(
  client: RCRTClient,
  query: string,
  options: {
    limit?: number;
    tag?: string;
  } = {}
): Promise<Breadcrumb[]> {
  if (!query.trim()) {
    // List all notes
    return await client.searchBreadcrumbs({
      schema_name: 'note.v1',
      tag: options.tag,
      nn: options.limit || 100
    });
  }

  // Semantic vector search
  return await client.searchBreadcrumbs({
    q: query,
    schema_name: 'note.v1',
    tag: options.tag,
    nn: options.limit || 20
  });
}

/**
 * Search notes by tag
 */
export async function searchByTag(
  client: RCRTClient,
  tag: string,
  options: { limit?: number } = {}
): Promise<Breadcrumb[]> {
  return await client.searchBreadcrumbs({
    schema_name: 'note.v1',
    any_tags: [tag],
    nn: options.limit || 100
  });
}

/**
 * Get all unique tags from notes
 */
export async function getAllTags(client: RCRTClient): Promise<string[]> {
  // Get all note.tags.v1 breadcrumbs
  const tagBreadcrumbs = await client.listBreadcrumbs({
    schema_name: 'note.tags.v1',
    limit: 1000
  });

  const tagSet = new Set<string>();
  
  tagBreadcrumbs.forEach(bc => {
    const tags = bc.context.tags || [];
    tags.forEach((tag: string) => tagSet.add(tag));
  });

  return Array.from(tagSet).sort();
}

