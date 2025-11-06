/**
 * Text utility functions
 */

/**
 * Strip HTML tags and normalize whitespace
 * @param content Content with potential HTML
 * @param maxLength Maximum length to truncate to (default: 2000)
 * @returns Cleaned text
 */
export function stripHtml(content: string, maxLength: number = 2000): string {
  return content
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Truncate text with ellipsis
 * @param text Text to truncate
 * @param maxLength Maximum length (default: 100)
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Format date in a human-readable way
 */
export function formatDate(timestamp: number | string): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  // Less than 1 minute
  if (diff < 60000) return 'just now';
  
  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  
  // Less than 1 day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  
  // Less than 1 week
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  
  // Otherwise show date
  return date.toLocaleDateString();
}

