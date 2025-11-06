/**
 * Enhanced Page Capture
 * Combines Think Extension's superior markdown conversion 
 * with RCRT's interactive elements tracking
 */

import type { TabContext } from '../lib/types';

export interface CaptureConfig {
  maxTextLength: number;
  maxInteractiveElements: number;
  maxLinks: number;
  maxImages: number;
}

/**
 * Enhanced capture function that runs in page context
 * This combines:
 * - Think Extension's smart content detection and markdown conversion
 * - RCRT's interactive elements with XPath for automation
 */
export function capturePageEnhanced(config: CaptureConfig): TabContext {
  // ========== THINK EXTENSION'S SUPERIOR CONTENT EXTRACTION ==========
  
  // Smart selector prioritization for main content
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

  // Convert to proper markdown (Think Extension's logic)
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
    
    const markdown = processNode(mainContent!).trim();
    return markdown.slice(0, config.maxTextLength);
  }

  const markdown = convertToMarkdown();

  // ========== RCRT'S INTERACTIVE ELEMENTS ==========

  // Capture interactive elements with XPath for automation
  const allInteractive = Array.from(document.querySelectorAll(
    'button, a[href], input, select, textarea, [onclick], [role="button"], [role="link"]'
  )).filter(el => (el as HTMLElement).offsetParent !== null);

  const interactiveElements: Record<string, any> = {};
  
  allInteractive.slice(0, config.maxInteractiveElements).forEach((el, index) => {
    const getXPath = (element: Element): string => {
      if (element.id) return `//*[@id="${element.id}"]`;
      
      const parts: string[] = [];
      let current: Element | null = element;
      
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let idx = 0;
        let sibling = current.previousSibling;
        
        while (sibling) {
          if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === current.nodeName) {
            idx++;
          }
          sibling = sibling.previousSibling;
        }
        
        const tagName = current.nodeName.toLowerCase();
        const nth = idx > 0 ? `[${idx + 1}]` : '';
        parts.unshift(tagName + nth);
        current = current.parentNode as Element;
      }
      
      return '/' + parts.join('/');
    };

    const htmlEl = el as HTMLElement;
    interactiveElements[index] = {
      tag: htmlEl.tagName.toLowerCase(),
      type: (htmlEl as any).type || '',
      text: (htmlEl.textContent || (htmlEl as any).value || '').trim().slice(0, 100),
      href: (htmlEl as any).href || '',
      id: htmlEl.id || '',
      classes: Array.from(htmlEl.classList).slice(0, 5),
      xpath: getXPath(htmlEl),
      ariaLabel: htmlEl.getAttribute('aria-label') || '',
      placeholder: (htmlEl as any).placeholder || ''
    };
  });

  // ========== METADATA EXTRACTION ==========

  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    .slice(0, 20)
    .map(h => h.textContent?.trim())
    .filter(Boolean) as string[];

  const links = Array.from(document.querySelectorAll('a[href]'))
    .filter(a => (a as HTMLElement).offsetParent !== null)
    .slice(0, config.maxLinks)
    .map(a => ({
      text: (a.textContent?.trim() || '').slice(0, 80),
      href: (a as HTMLAnchorElement).href
    }));

  const images = Array.from(document.querySelectorAll('img[src]'))
    .filter(img => (img as HTMLElement).offsetParent !== null)
    .slice(0, config.maxImages)
    .map(img => ({
      alt: (img.getAttribute('alt') || '').slice(0, 100),
      src: (img as HTMLImageElement).src.slice(0, 200)
    }));

  const getMeta = (name: string) => {
    const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    return el?.getAttribute('content') || '';
  };

  // ========== RETURN STRUCTURED CONTEXT ==========

  return {
    url: window.location.href,
    domain: window.location.hostname,
    title: document.title,
    favicon: document.querySelector('link[rel~="icon"]')?.getAttribute('href') || '',
    
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      devicePixelRatio: window.devicePixelRatio
    },
    
    // RCRT: Actionable DOM data with automation support
    dom: {
      interactiveCount: allInteractive.length,
      interactiveElements: interactiveElements
    },
    
    // Think Extension: Quality markdown content
    content: {
      mainText: markdown,
      headings,
      links,
      images
    },
    
    // Metadata
    meta: {
      description: getMeta('description'),
      keywords: getMeta('keywords').split(',').map(s => s.trim()).filter(Boolean),
      ogTitle: getMeta('og:title'),
      ogImage: getMeta('og:image'),
      ogDescription: getMeta('og:description')
    }
  };
}

