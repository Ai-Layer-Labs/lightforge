/**
 * Execution Queue
 * Manages concurrency limits for tool executions
 */

export interface QueuedExecution<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
}

export class ExecutionQueue {
  private queue: Array<QueuedExecution<any>> = [];
  private running = 0;
  
  constructor(private maxConcurrent: number) {
    if (maxConcurrent < 1) {
      throw new Error('maxConcurrent must be at least 1');
    }
  }
  
  /**
   * Execute a function with concurrency control
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ execute: fn, resolve, reject });
      this.processQueue();
    });
  }
  
  /**
   * Process queued executions
   */
  private async processQueue(): Promise<void> {
    // Check if we can run more tasks
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;
      
      this.running++;
      
      // Execute task
      task.execute()
        .then(result => {
          task.resolve(result);
        })
        .catch(error => {
          task.reject(error);
        })
        .finally(() => {
          this.running--;
          this.processQueue(); // Process next task
        });
    }
  }
  
  /**
   * Get current queue status
   */
  getStatus(): { running: number; queued: number; maxConcurrent: number } {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent
    };
  }
  
  /**
   * Clear the queue (reject all pending tasks)
   */
  clear(): void {
    const error = new Error('Queue cleared');
    for (const task of this.queue) {
      task.reject(error);
    }
    this.queue = [];
  }
}

