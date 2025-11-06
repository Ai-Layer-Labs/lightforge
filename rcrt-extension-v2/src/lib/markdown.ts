import MarkdownIt from 'markdown-it';
import TurndownService from 'turndown';
import DOMPurify from 'dompurify';

// Initialize markdown-it with options
const md = new MarkdownIt({
  html: false, // Disable HTML tags for security (prevent XSS)
  linkify: true, // Auto-convert URL-like text to links
  typographer: true, // Enable smartquotes and other typographic replacements
  breaks: true, // Convert '\n' in paragraphs into <br>
});

// Initialize turndown for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx', // Use # style headings
  codeBlockStyle: 'fenced', // Use ``` for code blocks
  emDelimiter: '*', // Use * for emphasis
  strongDelimiter: '**', // Use ** for strong
  bulletListMarker: '-', // Use - for bullet lists
});

/**
 * Convert markdown text to HTML with XSS protection
 * @param markdown - The markdown string to convert
 * @returns Sanitized HTML string safe for rendering
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  try {
    // Render markdown to HTML
    const rawHtml = md.render(markdown);

    // Sanitize HTML to prevent XSS attacks
    const sanitizedHtml = DOMPurify.sanitize(rawHtml);

    return sanitizedHtml;
  } catch (error) {
    console.error('[Markdown] Failed to convert markdown to HTML:', error);
    // Fallback: return safe error message with escaped content
    const escaped = markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    return `<pre class="markdown-error">⚠️ Markdown rendering error<br><code>${escaped}</code></pre>`;
  }
}

/**
 * Convert HTML to Markdown
 * @param html - The HTML string to convert
 * @returns Markdown string
 */
export function htmlToMarkdown(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    return turndownService.turndown(html);
  } catch (error) {
    console.error('[Markdown] Failed to convert HTML to markdown:', error);
    // Fallback: return the HTML as-is
    return html;
  }
}

/**
 * Check if content is likely markdown (vs HTML)
 * @param content - The content to check
 * @returns true if content appears to be markdown
 */
export function isMarkdown(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }

  // Check for markdown-specific patterns
  const markdownPatterns = [
    /^#{1,6}\s/m, // Headers: # ## ### etc
    /^\*\s/m, // Unordered list with *
    /^-\s/m, // Unordered list with -
    /^\d+\.\s/m, // Ordered list
    /\*\*.*\*\*/,  // Bold
    /\*.*\*/,  // Italic
    /\[.*\]\(.*\)/, // Links
    /^>\s/m, // Blockquote
    /```/, // Code block
    /`[^`]+`/, // Inline code
  ];

  // If content contains HTML tags, it's probably not markdown
  if (/<[^>]+>/.test(content)) {
    return false;
  }

  // Check if at least one markdown pattern matches
  return markdownPatterns.some(pattern => pattern.test(content));
}

