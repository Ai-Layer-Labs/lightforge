/**
 * Virtual scrolling hook for large lists
 */

import { useState, useEffect } from 'react';

export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 });

  useEffect(() => {
    const overscan = 5; // Render 5 extra items above and below
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(items.length, start + visibleCount + overscan * 2);

    setVisibleRange({ start, end });
  }, [scrollTop, items.length, itemHeight, containerHeight]);

  const visibleItems = items.slice(visibleRange.start, visibleRange.end);
  const offsetY = visibleRange.start * itemHeight;
  const totalHeight = items.length * itemHeight;

  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  return {
    visibleItems,
    offsetY,
    totalHeight,
    onScroll
  };
}

