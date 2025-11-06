import type { PageContext } from './types';

/**
 * Check if a URL can be captured by the extension
 */
export function canCapturePage(url?: string): boolean {
  if (!url) return false;

  const uncapturableProtocols = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'data:',
    'file://',
    'view-source:',
  ];

  return !uncapturableProtocols.some(protocol => url.startsWith(protocol));
}

/**
 * Capture context from the current active tab
 */
export async function captureCurrentPage(): Promise<PageContext> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error('No active tab found');
  }

  if (!canCapturePage(tab.url)) {
    throw new Error('Cannot capture this page. Extension pages and browser pages cannot be captured.');
  }

  try {
    // Execute capture script in the page context
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContext,
    });

    if (!result || !result.result) {
      throw new Error('Page capture returned no data');
    }

    const pageContext = result.result as PageContext;

    if (!pageContext.url || !pageContext.title) {
      throw new Error('Page capture returned incomplete data');
    }

    return pageContext;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('Extension manifest must request permission')) {
      throw new Error(`Permission denied to access this page. Try clicking the extension icon first to grant access.`);
    } else if (errorMessage.includes('Cannot access contents')) {
      throw new Error('Cannot access this page. It may be a protected or restricted site.');
    } else {
      throw new Error(`Failed to capture page: ${errorMessage}`);
    }
  }
}

/**
 * Function that runs in page context to extract content
 * This is Think Extension's superior implementation with proper markdown conversion
 */
function extractPageContext(): PageContext {
  const selectors = [
    'main',
    'article',
    '[role="main"]',
    '#content',
    '#main',
    '.content',
    '.article-body',
    '.post-content',
    '.main-content',
  ];

  let mainContent: HTMLElement | null = null;
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && el instanceof HTMLElement) {
      mainContent = el;
      break;
    }
  }
  
  if (!mainContent) {
    mainContent = document.body;
  }

  function convertToMarkdown(): string {
    function isValidUrl(urlString: string): boolean {
      if (!urlString) return false;

      try {
        const url = new URL(urlString);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    }

    function escapeUrlParentheses(url: string): string {
      return url.replace(/\(/g, '%28').replace(/\)/g, '%29');
    }

    function processNode(node: Node): string {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }
      
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }
      
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();

      // Skip navigation, ads, etc.
      if (['script', 'style', 'noscript', 'iframe', 'nav', 'header', 'footer'].includes(tagName)) {
        return '';
      }

      let content = '';
      for (const child of Array.from(el.childNodes)) {
        content += processNode(child);
      }

      switch (tagName) {
        case 'h1': return `# ${content.trim()}\n\n`;
        case 'h2': return `## ${content.trim()}\n\n`;
        case 'h3': return `### ${content.trim()}\n\n`;
        case 'h4': return `#### ${content.trim()}\n\n`;
        case 'h5': return `##### ${content.trim()}\n\n`;
        case 'h6': return `###### ${content.trim()}\n\n`;
        case 'p': return `${content.trim()}\n\n`;
        case 'br': return '\n';
        case 'hr': return '---\n\n';
        case 'strong':
        case 'b': return `**${content}**`;
        case 'em':
        case 'i': return `*${content}*`;
        case 'code': return `\`${content}\``;
        case 'pre': return `\`\`\`\n${content}\n\`\`\`\n\n`;
        case 'a': {
          const href = el.getAttribute('href');
          if (href && isValidUrl(href)) {
            const escapedHref = escapeUrlParentheses(href);
            return `[${content}](${escapedHref})`;
          }
          return content;
        }
        case 'ul':
        case 'ol': return `${content}\n`;
        case 'li': {
          const parent = el.parentElement;
          const marker = parent?.tagName.toLowerCase() === 'ol' ? '1. ' : '- ';
          return `${marker}${content.trim()}\n`;
        }
        case 'blockquote': return `> ${content.trim()}\n\n`;
        case 'img': {
          const alt = el.getAttribute('alt') || '';
          const src = el.getAttribute('src') || '';
          if (src && isValidUrl(src)) {
            const escapedSrc = escapeUrlParentheses(src);
            return `![${alt}](${escapedSrc})`;
          }
          return '';
        }
        default: return content;
      }
    }
    
    return processNode(mainContent!).trim();
  }

  const markdown = convertToMarkdown();

  const headings = Array.from(
    document.querySelectorAll('h1, h2, h3, h4, h5, h6')
  )
    .map((h) => h.textContent?.trim())
    .filter(Boolean)
    .filter((text) => text!.length > 0)
    .slice(0, 20) as string[];

  const links = Array.from(document.querySelectorAll('a[href]'))
    .filter((a) => {
      const href = (a as HTMLAnchorElement).href;
      return href && !href.startsWith('javascript:') && !href.startsWith('#');
    })
    .slice(0, 50)
    .map((a) => ({
      text: (a.textContent?.trim() || '').slice(0, 100),
      href: (a as HTMLAnchorElement).href,
    }));

  const images = Array.from(document.querySelectorAll('img[src]'))
    .slice(0, 20)
    .map(img => ({
      alt: (img.getAttribute('alt') || '').slice(0, 100),
      src: (img as HTMLImageElement).src.slice(0, 200)
    }));

  const ogImageMeta = document.querySelector('meta[property="og:image"]');
  const ogImage = ogImageMeta?.getAttribute('content') || undefined;

  return {
    url: window.location.href,
    title: document.title,
    domain: window.location.hostname,
    ogImage,
    content: {
      mainText: markdown,
      headings,
      links,
      images,
    },
    timestamp: Date.now(),
  };
}

/**
 * Get selected text from current page
 */
export async function captureSelection(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    return null;
  }

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() || null,
    });

    return result.result ?? null;
  } catch (error) {
    console.error('[PageCapture] Failed to capture selection:', error);
    return null;
  }
}

