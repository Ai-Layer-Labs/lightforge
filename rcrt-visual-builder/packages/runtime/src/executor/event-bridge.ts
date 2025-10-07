/**
 * Event Bridge - Pure event-driven waiting (no polling!)
 * Same pattern as tools-runner
 */

export interface WaitCriteria {
  schema_name: string;
  request_id?: string;
  tags?: string[];
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
  
  /**
   * Called by SSE dispatcher when events arrive
   */
  handleEvent(event: any, breadcrumb: any): void {
    // Add to history
    this.eventHistory.unshift({ event, breadcrumb, timestamp: Date.now() });
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.pop();
    }
    
    // Check if any executor is waiting for this event
    const matchingWaits: number[] = [];
    
    for (let i = 0; i < this.pendingWaits.length; i++) {
      const wait = this.pendingWaits[i];
      
      if (this.matches(breadcrumb, wait.criteria)) {
        clearTimeout(wait.timeout);
        wait.resolve(breadcrumb);
        matchingWaits.push(i);
      }
    }
    
    // Remove resolved waits
    for (const index of matchingWaits.reverse()) {
      this.pendingWaits.splice(index, 1);
    }
  }
  
  /**
   * Wait for an event matching criteria (RCRT way!)
   */
  async waitForEvent(criteria: WaitCriteria, timeoutMs: number = 60000): Promise<any> {
    // Check recent history first
    for (const { breadcrumb } of this.eventHistory) {
      if (this.matches(breadcrumb, criteria)) {
        return breadcrumb;
      }
    }
    
    // Wait for future event
    return new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.pendingWaits.findIndex(w => w.resolve === resolve);
        if (index !== -1) {
          this.pendingWaits.splice(index, 1);
        }
        reject(new Error(`Timeout waiting for event: ${JSON.stringify(criteria)}`));
      }, timeoutMs);
      
      this.pendingWaits.push({
        criteria,
        resolve,
        reject,
        timeout
      });
    });
  }
  
  private matches(breadcrumb: any, criteria: WaitCriteria): boolean {
    if (criteria.schema_name && breadcrumb.schema_name !== criteria.schema_name) {
      return false;
    }
    
    if (criteria.request_id) {
      if (breadcrumb.context?.request_id !== criteria.request_id &&
          breadcrumb.context?.requestId !== criteria.request_id) {
        return false;
      }
    }
    
    if (criteria.tags) {
      for (const tag of criteria.tags) {
        if (!breadcrumb.tags?.includes(tag)) {
          return false;
        }
      }
    }
    
    return true;
  }
}
