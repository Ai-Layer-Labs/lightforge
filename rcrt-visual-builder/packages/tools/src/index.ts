/**
 * RCRT Tool System - Base interfaces and wrappers
 * Enables any tool to integrate with RCRT via breadcrumbs and SSE
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { BreadcrumbEvent } from '@rcrt-builder/core';

// JSON Schema type for tool input/output validation
export interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  description?: string;
}

// Base interface all RCRT tools must implement
export interface RCRTTool {
  name: string;
  description: string;
  category?: string;
  version?: string;
  // Declare required secret names (RCRT Secrets). Registry ensures/provisions them at registration time.
  requiredSecrets?: string[];
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  
  // Execute the tool with given input and context
  execute(input: any, context?: any): Promise<any>;
  
  // Optional: validate input before execution
  validateInput?(input: any): boolean | string;
  
  // Optional: cleanup resources
  cleanup?(): Promise<void>;
}

// Context passed to tools from breadcrumb events
export interface ToolExecutionContext {
  requestId: string;
  workspace: string;
  agentId?: string;
  metadata?: Record<string, any>;
  rcrtClient: RcrtClientEnhanced;
}

// Tool request/response schemas
export interface ToolRequest {
  tool: string;
  input: any;
  context?: any;
  timeout?: number;
}

export interface ToolResponse {
  tool: string;
  requestId: string;
  result: any;
  executionTime?: number;
  metadata?: Record<string, any>;
}

export interface ToolError {
  tool: string;
  requestId: string;
  error: string;
  code?: string;
  metadata?: Record<string, any>;
}

// Main wrapper class that integrates tools with RCRT
export class RCRTToolWrapper {
  private stopStream?: () => void;

  constructor(
    private tool: RCRTTool,
    private client: RcrtClientEnhanced,
    private workspace: string,
    private options: {
      enableUI?: boolean;
      timeout?: number;
      retries?: number;
      applyClient?: RcrtClientEnhanced;
    } = {}  
  ) {}

  async start(): Promise<void> {
    console.log(`[${this.tool.name}] Starting tool wrapper for workspace: ${this.workspace}`);
    
    // Subscribe to tool requests
    this.stopStream = this.client.startEventStream(async (evt: BreadcrumbEvent) => {
      if (evt.type === 'created' || evt.type === 'updated') {
        // Fetch the full breadcrumb to get schema and context
        try {
          const breadcrumb = await this.client.getBreadcrumb(evt.breadcrumb_id!);
          if (breadcrumb.schema_name === 'tool.request.v1' && 
              breadcrumb.context?.tool === this.tool.name) {
            await this.handleRequest({ ...evt, ...breadcrumb });
          }
        } catch (error) {
          console.error(`[${this.tool.name}] Failed to fetch breadcrumb:`, error);
        }
      }
    }, { 
      filters: { any_tags: [this.workspace, 'tool:request'] } 
    });

    // Tool availability is managed by the central registry catalog
    // Individual tool definitions are no longer published

    // Optionally create UI components
    if (this.options.enableUI) {
      await this.createToolUI();
    }
  }

  async stop(): Promise<void> {
    console.log(`[${this.tool.name}] Stopping tool wrapper`);
    
    if (this.stopStream) {
      this.stopStream();
      this.stopStream = undefined;
    }
    
    if (this.tool.cleanup) {
      await this.tool.cleanup();
    }
  }

  private async handleRequest(evt: any): Promise<void> {
    const startTime = Date.now();
    const requestId = evt.id || `req-${Date.now()}`;
    const context: ToolExecutionContext = {
      requestId,
      workspace: this.workspace,
      agentId: evt.context?.agentId,
      metadata: evt.context?.metadata,
      rcrtClient: this.client
    };

    console.log(`[${this.tool.name}] Handling request: ${requestId}`);

    try {
      // Validate input if tool provides validation
      if (this.tool.validateInput) {
        const validation = this.tool.validateInput(evt.context?.input);
        if (validation !== true) {
          throw new Error(typeof validation === 'string' ? validation : 'Invalid input');
        }
      }

      // Execute with timeout
      const timeout = this.options.timeout || 30000;
      const result = await Promise.race([
        this.tool.execute(evt.context?.input, context),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Tool execution timeout')), timeout)
        )
      ]);

      const executionTime = Date.now() - startTime;

      // Write success result
      await this.client.createBreadcrumb({
        schema_name: 'tool.response.v1',
        title: `${this.tool.name} Result`,
        tags: [this.workspace, 'tool:response', `tool:${this.tool.name}`],
        context: {
          tool: this.tool.name,
          requestId,
          result,
          executionTime,
          metadata: context.metadata
        } as ToolResponse
      });

      console.log(`[${this.tool.name}] Request ${requestId} completed in ${executionTime}ms`);

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error?.message || String(error);
      
      console.error(`[${this.tool.name}] Request ${requestId} failed:`, errorMessage);

      // Write error result
      await this.client.createBreadcrumb({
        schema_name: 'tool.error.v1',
        title: `${this.tool.name} Error`,
        tags: [this.workspace, 'tool:error', `tool:${this.tool.name}`],
        context: {
          tool: this.tool.name,
          requestId,
          error: errorMessage,
          code: error?.code || 'EXECUTION_ERROR',
          metadata: { ...context.metadata, executionTime }
        } as ToolError
      });
    }
  }

  // Tool definitions are now managed centrally by the ToolRegistry
  // Individual tools no longer publish separate definition breadcrumbs

  private async createToolUI(): Promise<void> {
    // Create a UI component for this tool
    const plan = {
      schema_name: 'ui.plan.v1',
      title: `Create ${this.tool.name} UI`,
      tags: [this.workspace, 'ui:plan'],
      context: {
        actions: [{
          type: 'create_instance',
          region: 'tools',
          instance: {
            component_ref: 'ToolCard',
            props: {
              title: this.tool.name,
              description: this.tool.description,
              schema: this.tool.inputSchema,
              onSubmit: {
                action: 'emit_breadcrumb',
                payload: {
                  schema_name: 'tool.request.v1',
                  tags: [this.workspace, 'tool:request'],
                  context: {
                    tool: this.tool.name,
                    input: '${formData}'
                  }
                }
              }
            },
            order: 0
          }
        }]
      }
    };

    // Apply the plan to create UI (prefer a dedicated applyClient that targets builder proxy)
    try {
      const targetClient: any = this.options.applyClient || (this.client as any);
      if (targetClient && typeof targetClient.applyPlan === 'function') {
        await targetClient.applyPlan(plan);
      } else {
        // Fallback: create the plan as a breadcrumb for manual application
        await this.client.createBreadcrumb(plan);
      }
      console.log(`[${this.tool.name}] UI component created`);
    } catch (error) {
      console.warn(`[${this.tool.name}] Failed to create UI:`, error);
    }
  }
}

// Helper to create a simple tool from a function
export function createTool(
  name: string,
  description: string,
  inputSchema: JSONSchema,
  outputSchema: JSONSchema,
  execute: (input: any, context?: ToolExecutionContext) => Promise<any>
): RCRTTool {
  return {
    name,
    description,
    inputSchema,
    outputSchema,
    execute
  };
}

// Built-in simple tools
export const builtinTools = {
  // Echo tool for testing
  echo: createTool(
    'echo',
    'Returns the input unchanged',
    {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message to echo' }
      },
      required: ['message']
    },
    {
      type: 'object',
      properties: {
        echo: { type: 'string' }
      }
    },
    async (input) => ({ echo: input.message })
  ),

  // Timer tool
  timer: createTool(
    'timer',
    'Wait for a specified number of seconds',
    {
      type: 'object',
      properties: {
        seconds: { type: 'number', description: 'Seconds to wait', minimum: 0, maximum: 60 }
      },
      required: ['seconds']
    },
    {
      type: 'object',
      properties: {
        waited: { type: 'number' },
        message: { type: 'string' }
      }
    },
    async (input) => {
      await new Promise(resolve => setTimeout(resolve, input.seconds * 1000));
      return { waited: input.seconds, message: `Waited ${input.seconds} seconds` };
    }
  ),

  // Random number generator
  random: createTool(
    'random',
    'Generate random numbers',
    {
      type: 'object',
      properties: {
        min: { type: 'number', description: 'Minimum value', default: 0 },
        max: { type: 'number', description: 'Maximum value', default: 100 },
        count: { type: 'number', description: 'How many numbers', default: 1, minimum: 1, maximum: 10 }
      }
    },
    {
      type: 'object',
      properties: {
        numbers: { type: 'array', items: { type: 'number' } }
      }
    },
    async (input) => {
      const { min = 0, max = 100, count = 1 } = input;
      const numbers = Array.from({ length: count }, () => 
        Math.floor(Math.random() * (max - min + 1)) + min
      );
      return { numbers };
    }
  )
};
