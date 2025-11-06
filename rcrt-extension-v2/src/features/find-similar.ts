/**
 * Find Similar Notes Feature
 * Semantic similarity search across notes
 */

import type { RCRTClient } from '../lib/rcrt-client';
import type { Breadcrumb } from '../lib/types';

/**
 * Find similar notes using semantic search
 */
export async function findSimilarNotes(
  client: RCRTClient,
  noteId: string,
  options: { limit?: number } = {}
): Promise<Breadcrumb[]> {
  // Get the note
  const note = await client.getBreadcrumb(noteId);

  // Use first 500 chars of content as semantic query
  const query = note.context.content.substring(0, 500);

  // Search for similar notes
  const results = await client.searchBreadcrumbs({
    q: query,
    schema_name: 'note.v1',
    nn: options.limit || 10
  });

  // Filter out the note itself
  return results.filter(n => n.id !== noteId);
}

/**
 * Find notes related by tags
 */
export async function findRelatedByTags(
  client: RCRTClient,
  noteId: string,
  options: { limit?: number } = {}
): Promise<Breadcrumb[]> {
  // Get tags for this note
  const tagBreadcrumbs = await client.searchBreadcrumbs({
    schema_name: 'note.tags.v1',
    any_tags: [`note:${noteId}`],
    limit: 1
  });

  if (tagBreadcrumbs.length === 0) {
    return [];
  }

  const tags = tagBreadcrumbs[0].context.tags || [];

  if (tags.length === 0) {
    return [];
  }

  // Find notes with any of these tags
  const results = await client.searchBreadcrumbs({
    schema_name: 'note.v1',
    any_tags: tags,
    nn: options.limit || 20
  });

  // Filter out the note itself
  return results.filter(n => n.id !== noteId);
}

