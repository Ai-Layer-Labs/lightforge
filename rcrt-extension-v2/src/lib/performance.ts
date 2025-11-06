/**
 * Performance Optimization Utilities
 * Debounce, caching, lazy loading
 */

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Simple LRU cache
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Delete oldest (first) entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }
}

/**
 * Breadcrumb cache with TTL
 */
export class BreadcrumbCache {
  private cache: Map<string, { breadcrumb: any; timestamp: number }> = new Map();
  private ttl: number;
  private maxSize: number;

  constructor(ttlMs: number = 60000, maxSize: number = 100) {
    this.ttl = ttlMs;
    this.maxSize = maxSize;
  }

  get(id: string): any | null {
    const cached = this.cache.get(id);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(id);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(id);
    this.cache.set(id, cached);

    return cached.breadcrumb;
  }

  set(id: string, breadcrumb: any): void {
    // Check size limit
    if (this.cache.size >= this.maxSize && !this.cache.has(id)) {
      // Delete oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(id, {
      breadcrumb,
      timestamp: Date.now()
    });
  }

  invalidate(id: string): void {
    this.cache.delete(id);
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Lazy load hook
 */
export function createLazyLoader<T>(
  loadFn: () => Promise<T>
): {
  load: () => Promise<T>;
  isLoaded: () => boolean;
  get: () => T | null;
} {
  let cached: T | null = null;
  let loading = false;
  let promise: Promise<T> | null = null;

  return {
    load: async () => {
      if (cached) return cached;
      if (loading && promise) return promise;

      loading = true;
      promise = loadFn().then(result => {
        cached = result;
        loading = false;
        return result;
      });

      return promise;
    },
    isLoaded: () => cached !== null,
    get: () => cached
  };
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Batch operations
 */
export class BatchProcessor<T> {
  private queue: T[] = [];
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private processor: (items: T[]) => Promise<void>;
  private batchSize: number;
  private batchDelay: number;

  constructor(
    processor: (items: T[]) => Promise<void>,
    options: { batchSize?: number; batchDelay?: number } = {}
  ) {
    this.processor = processor;
    this.batchSize = options.batchSize || 10;
    this.batchDelay = options.batchDelay || 1000;
  }

  add(item: T): void {
    this.queue.push(item);

    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else {
      this.scheduleBatch();
    }
  }

  private scheduleBatch(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    this.timeout = setTimeout(() => {
      this.flush();
    }, this.batchDelay);
  }

  async flush(): Promise<void> {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.queue.length);
    
    try {
      await this.processor(batch);
    } catch (error) {
      console.error('[BatchProcessor] Error processing batch:', error);
    }
  }
}

