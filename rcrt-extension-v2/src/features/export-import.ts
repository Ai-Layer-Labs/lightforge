/**
 * Export/Import Feature
 * Export notes as JSON or Markdown, import from JSON
 */

import type { RCRTClient } from '../lib/rcrt-client';

/**
 * Export notes as JSON
 */
export async function exportNotesAsJSON(client: RCRTClient): Promise<string> {
  const notes = await client.searchBreadcrumbs({
    schema_name: 'note.v1',
    nn: 10000 // Get all notes
  });

  const exportData = {
    version: '2.0.0',
    exported_at: new Date().toISOString(),
    note_count: notes.length,
    notes: notes
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export a single note as Markdown
 */
export async function exportNoteAsMarkdown(
  client: RCRTClient,
  noteId: string
): Promise<string> {
  const note = await client.getBreadcrumb(noteId);

  // Get related content
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

  let markdown = `# ${note.title}\n\n`;
  markdown += `**Source:** ${note.context.url}\n\n`;
  markdown += `**Saved:** ${new Date(note.created_at).toLocaleString()}\n\n`;

  if (tags.length > 0) {
    markdown += `**Tags:** ${tags.map(t => `#${t}`).join(', ')}\n\n`;
  }

  if (summary) {
    markdown += `## Summary\n\n${summary}\n\n`;
  }

  if (insights.length > 0) {
    markdown += `## Key Insights\n\n`;
    insights.forEach(insight => {
      markdown += `- ${insight}\n`;
    });
    markdown += '\n';
  }

  if (eli5) {
    markdown += `## ELI5\n\n${eli5}\n\n`;
  }

  markdown += `## Content\n\n${note.context.content}\n`;

  return markdown;
}

/**
 * Export all notes as individual Markdown files (as ZIP)
 */
export async function exportAllNotesAsMarkdown(client: RCRTClient): Promise<Blob> {
  const notes = await client.searchBreadcrumbs({
    schema_name: 'note.v1',
    nn: 10000
  });

  // For now, return a single concatenated markdown file
  // TODO: Use JSZip to create proper ZIP with individual files
  let combined = `# RCRT Notes Export\n\n`;
  combined += `Exported: ${new Date().toLocaleString()}\n\n`;
  combined += `Total notes: ${notes.length}\n\n`;
  combined += `---\n\n`;

  for (const note of notes) {
    const markdown = await exportNoteAsMarkdown(client, note.id);
    combined += markdown + '\n\n---\n\n';
  }

  return new Blob([combined], { type: 'text/markdown' });
}

/**
 * Import notes from JSON
 */
export async function importNotesFromJSON(
  client: RCRTClient,
  jsonData: string
): Promise<{ imported: number; failed: number }> {
  let imported = 0;
  let failed = 0;

  try {
    const data = JSON.parse(jsonData);
    const notes = data.notes || [];

    for (const note of notes) {
      try {
        // Create breadcrumb (will get new ID)
        await client.createBreadcrumb({
          schema_name: 'note.v1',
          title: note.title,
          tags: note.tags || ['note', 'imported'],
          context: note.context
        });
        imported++;
      } catch (error) {
        console.error('[Import] Failed to import note:', note.title, error);
        failed++;
      }
    }
  } catch (error) {
    console.error('[Import] Failed to parse JSON:', error);
    throw new Error('Invalid JSON format');
  }

  return { imported, failed };
}

/**
 * Download file helper
 */
export function downloadFile(content: string | Blob, filename: string) {
  const blob = typeof content === 'string'
    ? new Blob([content], { type: 'text/plain' })
    : content;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

