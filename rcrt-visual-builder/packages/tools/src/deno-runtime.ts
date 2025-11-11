/**
 * Deno Tool Runtime
 * Main runtime for loading and executing self-contained tools
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { DenoExecutor, ExecutionResult, ToolCode, ToolLimits, ToolPermissions } from './deno-executor';
import { ContextSerializer, ToolExecutionContext } from './context-serializer';
import { ExecutionQueue } from './utils/execution-queue';
// Validation now done by validation-specialist agent, not hardcoded!
// import { CodeValidator } from './validation/code-validator';
// import { SchemaValidator } from './validation/schema-validator';
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
    ui_schema?: {
      configurable?: boolean;
      config_fields?: Array<any>;
      description?: string;
    };
    bootstrap?: {
      enabled: boolean;
      mode: 'once' | 'continuous' | 'disabled';
      priority?: number;
      wait_for?: string[];
      input?: any;
    };
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
    
    // Load security policy from breadcrumbs (THE RCRT WAY)
    console.log('[DenoToolRuntime] Loading tool security policy...');
    await PermissionValidator.loadTrustedTools(this.client);
    
    // Load tool definitions from breadcrumbs
    await this.loadTools();
    
    console.log(`[DenoToolRuntime] Loaded ${this.tools.size} tools`);
  }
  
  /**
   * Load tool definitions from breadcrumbs
   * THE RCRT WAY: Only load tools approved by validation-specialist agent!
   */
  async loadTools(): Promise<void> {
    try {
      // Only load tools with "approved" tag (validation-specialist adds this)
      const breadcrumbs = await this.client.searchBreadcrumbs({
        schema_name: 'tool.code.v1',
        tag: this.workspace,
        limit: 100
      });
      
      console.log(`[DenoToolRuntime] Found ${breadcrumbs.length} total tools`);

      for (const breadcrumb of breadcrumbs) {
        try {
          const fullBreadcrumb = await this.client.getBreadcrumb(breadcrumb.id);
          const tool = fullBreadcrumb as unknown as ToolCodeBreadcrumb;

          if (!tool.context || !tool.context.code) {
            console.error(`[DenoToolRuntime] Skipping tool ${breadcrumb.id} - missing context or code`);
            continue;
          }
          
          // Check if approved by validation-specialist
          if (!tool.tags || !tool.tags.includes('approved')) {
            console.log(`[DenoToolRuntime] Skipping ${tool.context.name} - awaiting validation-specialist approval`);
            continue;
          }

          this.tools.set(tool.context.name, tool);
          console.log(`[DenoToolRuntime] Registered approved tool: ${tool.context.name}`);
        } catch (error) {
          console.error('[DenoToolRuntime] Failed to load tool breadcrumb:', breadcrumb.id, error);
        }
      }
      
      console.log(`[DenoToolRuntime] Loaded ${this.tools.size} approved tools (${breadcrumbs.length - this.tools.size} awaiting approval)`);
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
   * Get tools configured for bootstrap execution
   * Returns tools sorted by priority (highest first)
   */
  getBootstrapTools(): ToolCodeBreadcrumb[] {
    const bootstrapTools = Array.from(this.tools.values())
      .filter(tool => tool.context.bootstrap?.enabled === true);
    
    // Sort by priority (descending) then by name
    bootstrapTools.sort((a, b) => {
      const priorityA = a.context.bootstrap?.priority ?? 50;
      const priorityB = b.context.bootstrap?.priority ?? 50;
      
      if (priorityB !== priorityA) {
        return priorityB - priorityA; // Higher priority first
      }
      
      return a.context.name.localeCompare(b.context.name);
    });
    
    return bootstrapTools;
  }
  
  /**
   * Check if tool dependencies are satisfied
   */
  private checkDependencies(tool: ToolCodeBreadcrumb, completedTools: Set<string>): boolean {
    const waitFor = tool.context.bootstrap?.wait_for || [];
    return waitFor.every(dep => completedTools.has(dep));
  }
  
  /**
   * Execute bootstrap tools in correct order
   */
  async executeBootstrap(): Promise<{ successful: number; failed: number; skipped: number }> {
    const bootstrapTools = this.getBootstrapTools();
    
    if (bootstrapTools.length === 0) {
      console.log('[Bootstrap] No bootstrap tools found');
      return { successful: 0, failed: 0, skipped: 0 };
    }
    
    console.log(`[Bootstrap] Found ${bootstrapTools.length} bootstrap tool(s)`);
    
    const completedTools = new Set<string>();
    const failedTools = new Set<string>();
    const skippedTools = new Set<string>();
    
    // Separate once vs continuous tools
    const onceTools = bootstrapTools.filter(t => t.context.bootstrap?.mode === 'once');
    const continuousTools = bootstrapTools.filter(t => t.context.bootstrap?.mode === 'continuous');
    
    // Execute "once" tools sequentially
    for (const tool of onceTools) {
      // Check dependencies
      if (!this.checkDependencies(tool, completedTools)) {
        console.warn(`[Bootstrap] Skipping ${tool.context.name} - dependencies not met`);
        skippedTools.add(tool.context.name);
        continue;
      }
      
      try {
        console.log(`[Bootstrap] Executing ${tool.context.name} (priority: ${tool.context.bootstrap?.priority ?? 50})...`);
        
        const input = tool.context.bootstrap?.input || {};
        const result = await this.executeTool({
          tool_name: tool.context.name,
          input,
          request_id: `bootstrap-${tool.context.name}-${Date.now()}`,
          agent_id: 'bootstrap',
          workspace: this.workspace,
          trigger_event: {
            schema_name: 'system.startup.v1',
            timestamp: new Date().toISOString()
          }
        });
        
        if (result.success) {
          console.log(`[Bootstrap] ✅ ${tool.context.name} completed`);
          completedTools.add(tool.context.name);
        } else {
          console.error(`[Bootstrap] ❌ ${tool.context.name} failed:`, result.error);
          failedTools.add(tool.context.name);
        }
      } catch (error) {
        console.error(`[Bootstrap] ❌ ${tool.context.name} threw error:`, error);
        failedTools.add(tool.context.name);
      }
    }
    
    // Note: Continuous tools are NOT executed here
    // They should be started by the tools-runner main loop
    if (continuousTools.length > 0) {
      console.log(`[Bootstrap] Found ${continuousTools.length} continuous tool(s) - these will be started separately`);
      continuousTools.forEach(t => {
        console.log(`   - ${t.context.name} (priority: ${t.context.bootstrap?.priority ?? 50})`);
      });
    }
    
    return {
      successful: completedTools.size,
      failed: failedTools.size,
      skipped: skippedTools.size
    };
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
   * Load a single approved tool (called when tool gets "approved" tag)
   */
  async loadSingleTool(tool: ToolCodeBreadcrumb): Promise<void> {
    if (!tool.context || !tool.context.code) {
      console.error(`[DenoToolRuntime] Invalid tool - missing context or code`);
      return;
    }
    
    if (!tool.tags || !tool.tags.includes('approved')) {
      console.warn(`[DenoToolRuntime] Tool ${tool.context.name} not approved - skipping`);
      return;
    }
    
    this.tools.set(tool.context.name, tool);
    console.log(`[DenoToolRuntime] Loaded approved tool: ${tool.context.name}`);
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
  
  /**
   * Add a tool by loading it from breadcrumb ID
   */
  async addToolById(breadcrumbId: string): Promise<void> {
    try {
      const tool = await this.client.getBreadcrumb(breadcrumbId) as unknown as ToolCodeBreadcrumb;
      await this.loadSingleTool(tool);
    } catch (error) {
      console.error(`[DenoToolRuntime] Failed to add tool ${breadcrumbId}:`, error);
    }
  }
}

