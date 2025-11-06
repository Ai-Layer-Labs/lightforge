/**
 * Save Page Feature
 * Captures and saves current page as note.v1 breadcrumb
 */

import type { RCRTClient } from '../lib/rcrt-client';
import type { Breadcrumb, ProcessingStatus } from '../lib/types';
import { captureCurrentPage } from '../lib/page-capture';

export async function savePage(
  client: RCRTClient,
  onStatusUpdate?: (status: ProcessingStatus) => void
): Promise<{ note: Breadcrumb; unsubscribe: () => void }> {
  // 1. Capture page content with Think Extension's superior quality
  const pageContext = await captureCurrentPage();

  // 2. Create note.v1 breadcrumb
  const note = await client.createBreadcrumb({
    schema_name: 'note.v1',
    title: pageContext.title,
    tags: ['note', 'saved-page', `domain:${pageContext.domain}`],
    context: {
      content: pageContext.content.mainText,
      url: pageContext.url,
      domain: pageContext.domain,
      og_image: pageContext.ogImage,
      headings: pageContext.content.headings,
      links: pageContext.content.links,
      images: pageContext.content.images,
      captured_at: new Date().toISOString()
    }
  });

  // 3. Set initial status
  if (onStatusUpdate) {
    onStatusUpdate({
      noteId: note.id,
      breadcrumb: 'complete',
      tags: 'pending',
      summary: 'pending',
      insights: 'pending',
      eli5: 'pending'
    });
  }

  // 4. Subscribe to processing events from agents
  const unsubscribe = await client.subscribeToSSE(
    {
      any_tags: [`note:${note.id}`]
    },
    (event) => {
      if (!onStatusUpdate) return;

      // Track which agent completed
      if (event.breadcrumb.schema_name === 'note.tags.v1') {
        onStatusUpdate({
          noteId: note.id,
          breadcrumb: 'complete',
          tags: 'complete',
          summary: 'pending',
          insights: 'pending',
          eli5: 'pending'
        });
      } else if (event.breadcrumb.schema_name === 'note.summary.v1') {
        onStatusUpdate({
          noteId: note.id,
          breadcrumb: 'complete',
          tags: 'complete',
          summary: 'complete',
          insights: 'pending',
          eli5: 'pending'
        });
      } else if (event.breadcrumb.schema_name === 'note.insights.v1') {
        onStatusUpdate({
          noteId: note.id,
          breadcrumb: 'complete',
          tags: 'complete',
          summary: 'complete',
          insights: 'complete',
          eli5: 'pending'
        });
      } else if (event.breadcrumb.schema_name === 'note.eli5.v1') {
        onStatusUpdate({
          noteId: note.id,
          breadcrumb: 'complete',
          tags: 'complete',
          summary: 'complete',
          insights: 'complete',
          eli5: 'complete'
        });
      }
    }
  );

  return { note, unsubscribe };
}

/**
 * Get note with all agent-generated content
 */
export async function getNoteWithContent(
  client: RCRTClient,
  noteId: string
): Promise<{
  note: Breadcrumb;
  tags: string[];
  summary: string;
  insights: string[];
  eli5: string;
}> {
  // Fetch note
  const note = await client.getBreadcrumb(noteId);

  // Fetch related breadcrumbs
  const related = await client.searchBreadcrumbs({
    any_tags: [`note:${noteId}`]
  });

  let tags: string[] = [];
  let summary = '';
  let insights: string[] = [];
  let eli5 = '';

  related.forEach(bc => {
    if (bc.schema_name === 'note.tags.v1') {
      tags = bc.context.tags || [];
    } else if (bc.schema_name === 'note.summary.v1') {
      summary = bc.context.summary || '';
    } else if (bc.schema_name === 'note.insights.v1') {
      insights = bc.context.insights || [];
    } else if (bc.schema_name === 'note.eli5.v1') {
      eli5 = bc.context.eli5 || '';
    }
  });

  return { note, tags, summary, insights, eli5 };
}

