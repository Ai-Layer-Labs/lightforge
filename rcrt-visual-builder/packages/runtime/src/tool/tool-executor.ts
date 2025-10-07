/**
 * Tool Executor - Universal Pattern
 * Extends UniversalExecutor with function execution
 */

import { UniversalExecutor, type Subscription } from '../executor/universal-executor.js';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

export interface RCRTTool {
  name: string;
  description: string;
  category?: string;
  version?: string;
  subscriptions?: {
    selectors: Subscription[];
  };
  execute(input: any, context?: any): Promise<any>;
}

export interface ToolExecutorOptions {
  tool: RCRTTool;
  rcrtClient: RcrtClientEnhanced;
  workspace: string;
}

export class ToolExecutor extends UniversalExecutor {
  private tool: RCRTTool;
  
  constructor(options: ToolExecutorOptions) {
    // Extract subscriptions from tool (if any)
    const subscriptions = options.tool.subscriptions?.selectors || [];
    
    super({
      rcrtClient: options.rcrtClient,
      workspace: options.workspace,
      subscriptions: subscriptions,
      id: options.tool.name
    });
    
    this.tool = options.tool;
    
    console.log(`🛠️ [ToolExecutor] Initialized: ${this.tool.name}`);
    console.log(`📡 Subscriptions: ${this.subscriptions.length}`);
    this.subscriptions.forEach(sub => {
      console.log(`  - ${sub.schema_name} (role: ${sub.role}, key: ${sub.key || sub.schema_name})`);
    });
  }
  
  /**
   * Execute: Run tool function with assembled context
   */
  protected async execute(trigger: any, context: Record<string, any>): Promise<any> {
    console.log(`🛠️ [${this.tool.name}] Executing tool function...`);
    
    // Extract tool input from trigger
    const toolInput = trigger.context?.input || trigger.context;
    
    // Execute tool with full context
    // Context now includes ALL subscribed breadcrumbs!
    const result = await this.tool.execute(toolInput, {
      rcrtClient: this.rcrtClient,
      workspace: this.workspace,
      requestId: trigger.id,
      metadata: {
        trigger_schema: trigger.schema_name,
        trigger_id: trigger.id
      },
      
      // ✅ Pass ALL assembled context from subscriptions!
      // Each key is defined by the subscription
      ...context
    });
    
    console.log(`✅ [${this.tool.name}] Tool executed successfully`);
    
    return result;
  }
  
  /**
   * Create tool response breadcrumb
   */
  protected async respond(trigger: any, result: any): Promise<void> {
    const requestId = trigger.context?.requestId || trigger.id;
    
    await this.rcrtClient.createBreadcrumb({
      schema_name: 'tool.response.v1',
      title: `Response: ${this.tool.name}`,
      tags: [this.workspace, 'tool:response', `request:${requestId}`],
      context: {
        request_id: requestId,
        tool: this.tool.name,
        status: 'success',
        output: result,
        timestamp: new Date().toISOString()
      }
    });
    
    console.log(`📤 [${this.tool.name}] Response created`);
  }
  
  /**
   * Get tool info
   */
  getTool() {
    return this.tool;
  }
}
