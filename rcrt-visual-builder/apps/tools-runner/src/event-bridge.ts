/**
 * Event Bridge - Allows tools to wait for events without polling
 * RCRT-Native: Event-driven, not search-driven
 */

export interface WaitCriteria {
  schema_name: string;
  request_id?: string;
  tags?: string[];
  context_match?: Array<{
    path: string;
    op: string;
    value: any;
  }>;
}

interface PendingWait {
  criteria: WaitCriteria;
  resolve: (event: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class EventBridge {
  private pendingWaits: PendingWait[] = [];
  private eventHistory: any[] = [];
  private maxHistorySize = 100;
  
  constructor() {
    console.log('[EventBridge] Initialized');
  }
  
  /**
   * Called by SSE dispatcher when events arrive
   */
  handleEvent(event: any, breadcrumb: any): void {
    // Add to history
    this.eventHistory.unshift({ event, breadcrumb, timestamp: Date.now() });
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.pop();
    }
    
    // Check if any tool is waiting for this event
    const matchingWaits: number[] = [];
    
    for (let i = 0; i < this.pendingWaits.length; i++) {
      const wait = this.pendingWaits[i];
      
      if (this.matches(breadcrumb, wait.criteria)) {
        console.log(`[EventBridge] ✅ Event matches waiting request:`, {
          criteria: wait.criteria,
          breadcrumb_id: breadcrumb.id
        });
        
        clearTimeout(wait.timeout);
        wait.resolve(breadcrumb);
        matchingWaits.push(i);
      }
    }
    
    // Remove resolved waits
    for (const index of matchingWaits.reverse()) {
      this.pendingWaits.splice(index, 1);
    }
    
    if (matchingWaits.length > 0) {
      console.log(`[EventBridge] Resolved ${matchingWaits.length} pending waits`);
    }
  }
  
  /**
   * Wait for an event matching criteria (RCRT-Native way!)
   */
  async waitForEvent(criteria: WaitCriteria, timeoutMs: number = 60000): Promise<any> {
    console.log(`[EventBridge] Waiting for event:`, criteria);
    
    // Check if event already exists in recent history
    for (const { breadcrumb } of this.eventHistory) {
      if (this.matches(breadcrumb, criteria)) {
        console.log(`[EventBridge] ✅ Found matching event in history`);
        return breadcrumb;
      }
    }
    
    // Wait for future event
    return new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove from pending
        const index = this.pendingWaits.findIndex(w => w.resolve === resolve);
        if (index !== -1) {
          this.pendingWaits.splice(index, 1);
        }
        
        console.error(`[EventBridge] ⏰ Timeout waiting for:`, criteria);
        reject(new Error(`Timeout waiting for event: ${JSON.stringify(criteria)}`));
      }, timeoutMs);
      
      this.pendingWaits.push({
        criteria,
        resolve,
        reject,
        timeout
      });
      
      console.log(`[EventBridge] Added to pending waits (${this.pendingWaits.length} total)`);
    });
  }
  
  /**
   * Check if breadcrumb matches criteria
   */
  private matches(breadcrumb: any, criteria: WaitCriteria): boolean {
    // Schema name must match
    if (criteria.schema_name && breadcrumb.schema_name !== criteria.schema_name) {
      return false;
    }
    
    // Request ID match
    if (criteria.request_id) {
      if (breadcrumb.context?.request_id !== criteria.request_id &&
          breadcrumb.context?.requestId !== criteria.request_id) {
        return false;
      }
    }
    
    // Tag match
    if (criteria.tags && criteria.tags.length > 0) {
      const breadcrumbTags = breadcrumb.tags || [];
      for (const tag of criteria.tags) {
        if (!breadcrumbTags.includes(tag)) {
          return false;
        }
      }
    }
    
    // Context match (JSONPath-like)
    if (criteria.context_match) {
      for (const match of criteria.context_match) {
        const value = this.getValueByPath(breadcrumb.context, match.path);
        if (!this.compareValues(value, match.value, match.op)) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  private getValueByPath(obj: any, path: string): any {
    // Simple JSONPath implementation
    // $.field.nested[0]
    if (path.startsWith('$.')) {
      path = path.substring(2);
    }
    
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (!current) return undefined;
      
      // Handle array index
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        current = current[arrayMatch[1]];
        if (Array.isArray(current)) {
          current = current[parseInt(arrayMatch[2])];
        }
      } else {
        current = current[part];
      }
    }
    
    return current;
  }
  
  private compareValues(actual: any, expected: any, op: string): boolean {
    switch (op) {
      case 'eq':
        return actual === expected;
      case 'ne':
        return actual !== expected;
      case 'gt':
        return actual > expected;
      case 'lt':
        return actual < expected;
      case 'contains':
        return String(actual).includes(String(expected));
      default:
        return false;
    }
  }
  
  /**
   * Get current statistics
   */
  getStats() {
    return {
      pendingWaits: this.pendingWaits.length,
      historySize: this.eventHistory.length,
      oldestHistoryAge: this.eventHistory.length > 0 
        ? Date.now() - this.eventHistory[this.eventHistory.length - 1].timestamp
        : 0
    };
  }
}
