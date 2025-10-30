/**
 * Deno Tool Runtime
 * Main runtime for loading and executing self-contained tools
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { DenoExecutor, ExecutionResult, ToolCode, ToolLimits, ToolPermissions } from './deno-executor';
import { ContextSerializer, ToolExecutionContext } from './context-serializer';
import { ExecutionQueue } from './utils/execution-queue';
import { CodeValidator } from './validation/code-validator';
import { SchemaValidator } from './validation/schema-validator';
import { PermissionValidator } from './validation/permission-validator';

export interface ToolCodeBreadcrumb {
  id: string;
  schema_name: 'tool.code.v1';
  title: string;
  tags: string[];
  context: {
    name: string;
    description: string;
    version: string;
    code: ToolCode;
    input_schema: any;
    output_schema: any;
    permissions: ToolPermissions;
    limits: ToolLimits;
    dependencies?: Record<string, string>;
    required_secrets?: string[];
    examples?: Array<{
      description: string;
      input: any;
      output: any;
      explanation?: string;
    }>;
    subscriptions?: Array<{
      schema_name?: string;
      tag?: string;
      context_match?: Array<{
        path: string;
        op: string;
        value: any;
      }>;
    }>;
  };
}

export interface ToolExecutionRequest {
  tool_name: string;
  input: any;
  request_id: string;
  agent_id?: string;
  workspace: string;
  trigger_event?: any;
}

export class DenoToolRuntime {
  private executor: DenoExecutor;
  private contextSerializer: ContextSerializer;
  private executionQueue: ExecutionQueue;
  private tools: Map<string, ToolCodeBreadcrumb> = new Map();
  
  constructor(
    private client: RcrtClientEnhanced,
    private workspace: string,
    private maxConcurrentExecutions: number = 5,
    denoPath: string = 'deno'
  ) {
    this.executor = new DenoExecutor(denoPath);
    this.contextSerializer = new ContextSerializer(client, workspace);
    this.executionQueue = new ExecutionQueue(maxConcurrentExecutions);
  }
  
  /**
   * Initialize runtime and load tools
   */
  async initialize(): Promise<void> {
    console.log('[DenoToolRuntime] Initializing...');
    
    // Check Deno availability
    const denoAvailable = await this.executor.checkDeno();
    if (!denoAvailable) {
      throw new Error('Deno not found. Please install Deno: https://deno.land/');
    }
    
    const version = await this.executor.getDenoVersion();
    console.log(`[DenoToolRuntime] Deno version: ${version}`);
    
    // Load tool definitions from breadcrumbs
    await this.loadTools();
    
    console.log(`[DenoToolRuntime] Loaded ${this.tools.size} tools`);
  }
  
  /**
   * Load tool definitions from breadcrumbs
   */
  async loadTools(): Promise<void> {
    try {
      const breadcrumbs = await this.client.searchBreadcrumbs({
        schema_name: 'tool.code.v1',
        tag: this.workspace,
        limit: 100
      });

      for (const breadcrumb of breadcrumbs) {
        try {
          const fullBreadcrumb = await this.client.getBreadcrumb(breadcrumb.id);
          const tool = fullBreadcrumb as unknown as ToolCodeBreadcrumb;

          if (!tool.context || !tool.context.code) {
            console.error(`[DenoToolRuntime] Skipping tool ${breadcrumb.id} - missing context or code`);
            continue;
          }

          const validation = await this.validateTool(tool);
          if (!validation.valid) {
            console.error(`[DenoToolRuntime] Invalid tool ${tool.context.name}:`, validation.errors);
            continue;
          }

          this.tools.set(tool.context.name, tool);
          console.log(`[DenoToolRuntime] Registered tool: ${tool.context.name}`);
        } catch (error) {
          console.error('[DenoToolRuntime] Failed to load tool breadcrumb:', breadcrumb.id, error);
        }
      }
    } catch (error) {
      console.error('[DenoToolRuntime] Failed to load tools:', error);
      throw error;
    }
  }
  
  /**
   * Reload tools (for hot-reload)
   */
  async reloadTools(): Promise<void> {
    this.tools.clear();
    await this.loadTools();
  }
  
  /**
   * Execute a tool
   */
  async executeTool(request: ToolExecutionRequest): Promise<ExecutionResult> {
    const { tool_name, input, request_id, agent_id, workspace, trigger_event } = request;
    
    // Find tool
    const tool = this.tools.get(tool_name);
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${tool_name}`,
        metadata: {
          duration_ms: 0,
          timedOut: false,
          exitCode: null
        }
      };
    }
    
    // Queue execution (respect concurrency limits)
    return this.executionQueue.execute(async () => {
      return await this.executeToolInternal(tool, input, request_id, agent_id, trigger_event);
    });
  }
  
  /**
   * Internal tool execution
   */
  private async executeToolInternal(
    tool: ToolCodeBreadcrumb,
    input: any,
    requestId: string,
    agentId: string | undefined,
    triggerEvent: any
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Build execution context
      const context = await this.contextSerializer.buildContext(
        requestId,
        agentId,
        tool.context.required_secrets || [],
        triggerEvent
      );
      
      // Execute in Deno
      const result = await this.executor.execute(
        tool.context.name,
        tool.context.code,
        input,
        context,
        tool.context.permissions,
        tool.context.limits
      );
      
      return result;
    } catch (error: any) {
      const duration_ms = Date.now() - startTime;
      
      return {
        success: false,
        error: `Tool execution failed: ${error.message}`,
        metadata: {
          duration_ms,
          timedOut: false,
          exitCode: null
        }
      };
    }
  }
  
  /**
   * Validate a tool
   */
  async validateTool(tool: ToolCodeBreadcrumb): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate code
    const codeValidation = CodeValidator.validate(
      tool.context.code.source,
      tool.context.name
    );
    errors.push(...codeValidation.errors);
    warnings.push(...codeValidation.warnings);
    
    // Validate input schema
    const inputValidation = SchemaValidator.validate(
      tool.context.input_schema,
      'input'
    );
    errors.push(...inputValidation.errors);
    
    // Validate output schema
    const outputValidation = SchemaValidator.validate(
      tool.context.output_schema,
      'output'
    );
    errors.push(...outputValidation.errors);
    
    // Validate permissions
    const permissionValidation = PermissionValidator.validate(
      tool.context.permissions
    );
    errors.push(...permissionValidation.errors);
    warnings.push(...permissionValidation.warnings);
    
    // Validate examples
    if (tool.context.examples && tool.context.examples.length > 0) {
      const exampleValidation = SchemaValidator.validateExamples(
        tool.context.examples,
        tool.context.input_schema,
        tool.context.output_schema
      );
      errors.push(...exampleValidation.errors);
    } else {
      warnings.push('No examples provided');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Get tool by name
   */
  getTool(name: string): ToolCodeBreadcrumb | undefined {
    return this.tools.get(name);
  }
  
  /**
   * Get all tools
   */
  getAllTools(): ToolCodeBreadcrumb[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * Get tools that subscribe to an event
   */
  getToolsForEvent(event: any): ToolCodeBreadcrumb[] {
    const matching: ToolCodeBreadcrumb[] = [];
    
    for (const tool of this.tools.values()) {
      if (!tool.context.subscriptions) continue;
      
      for (const subscription of tool.context.subscriptions) {
        if (this.eventMatchesSubscription(event, subscription)) {
          matching.push(tool);
          break; // Don't add same tool multiple times
        }
      }
    }
    
    return matching;
  }
  
  /**
   * Check if event matches subscription
   */
  private eventMatchesSubscription(event: any, subscription: any): boolean {
    // Check schema_name
    if (subscription.schema_name && event.schema_name !== subscription.schema_name) {
      return false;
    }
    
    // Check tag
    if (subscription.tag) {
      if (!event.tags || !event.tags.includes(subscription.tag)) {
        return false;
      }
    }
    
    // Check context_match (JSONPath-like matching)
    if (subscription.context_match) {
      for (const match of subscription.context_match) {
        if (!this.evaluateContextMatch(event.context, match)) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Evaluate context match (simplified JSONPath)
   */
  private evaluateContextMatch(context: any, match: any): boolean {
    // Simple implementation - can be enhanced with full JSONPath
    const { path, op, value } = match;
    
    // Extract value from context using path (e.g., "$.field" or "field")
    const actualValue = this.getValueByPath(context, path);
    
    // Compare using operator
    switch (op) {
      case 'eq':
        return actualValue === value;
      case 'ne':
        return actualValue !== value;
      case 'gt':
        return actualValue > value;
      case 'lt':
        return actualValue < value;
      case 'contains':
        return String(actualValue).includes(String(value));
      case 'exists':
        return actualValue !== undefined;
      default:
        return false;
    }
  }
  
  /**
   * Get value by path (simplified)
   */
  private getValueByPath(obj: any, path: string): any {
    // Remove leading "$." if present
    const cleanPath = path.replace(/^\$\./, '');
    
    // Split by "." and traverse
    const parts = cleanPath.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }
  
  /**
   * Get execution queue status
   */
  getQueueStatus(): { running: number; queued: number; maxConcurrent: number } {
    return this.executionQueue.getStatus();
  }
}

