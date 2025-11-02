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
  
  // Examples showing tool usage and output field access
  examples?: Array<{
    title: string;
    input: any;
    output: any;
    explanation: string;
  }>;
  
  // Optional: configuration schema for tool settings
  configSchema?: JSONSchema;
  configDefaults?: Record<string, any>;
  
  // Optional: rate limit configuration
  rateLimit?: {
    requests: number;
    window: string; // e.g., "1m", "1h"
  };
  
  // Execute the tool with given input and context
  execute(input: any, context?: any): Promise<any>;
  
  // Optional: validate input before execution
  validateInput?(input: any): boolean | string;
  
  // Optional: cleanup resources
  cleanup?(): Promise<void>;
  
  // Optional: initialize tool (e.g., create catalogs, load data)
  initialize?(context: ToolExecutionContext): Promise<void>;
}

// Context passed to tools from breadcrumb events
export interface ToolExecutionContext {
  requestId: string;
  workspace: string;
  agentId?: string;
  metadata?: Record<string, any>;
  rcrtClient: RcrtClientEnhanced;
  
  // RCRT-Native: Wait for events instead of polling
  waitForEvent?: (criteria: any, timeout?: number) => Promise<any>;
}


// Helper to create a simple tool from a function
export function createTool(
  name: string,
  description: string,
  inputSchema: JSONSchema,
  outputSchema: JSONSchema,
  execute: (input: any, context?: ToolExecutionContext) => Promise<any>,
  options?: {
    examples?: Array<{
      title: string;
      input: any;
      output: any;
      explanation: string;
    }>;
    category?: string;
    version?: string;
    configSchema?: JSONSchema;
    configDefaults?: Record<string, any>;
    rateLimit?: {
      requests: number;
      window: string;
    };
  }
): RCRTTool {
  return {
    name,
    description,
    inputSchema,
    outputSchema,
    execute,
    ...options
  };
}

// Import file tools
import { FileStorageTool, AgentLoaderTool } from './file-tools/index.js';

// Import workflow orchestrator
import { workflowOrchestrator } from './workflow-orchestrator.js';

// Import browser tools
import { browserContextCaptureTool } from './browser-tools/index.js';

// Export tool loader for RCRT-native mode
export { ToolLoader } from './tool-loader.js';
export { bootstrapTools } from './bootstrap-tools.js';

// Export new Deno runtime (Phase 1)
export { DenoToolRuntime } from './deno-runtime';
export { DenoExecutor } from './deno-executor';
export { ContextSerializer } from './context-serializer';
export { CodeValidator } from './validation/code-validator';
export { SchemaValidator } from './validation/schema-validator';
export { PermissionValidator } from './validation/permission-validator';
export { ExecutionQueue } from './utils/execution-queue';
export { ProcessManager } from './utils/process-manager';

// Export types for new runtime
export type { ToolCodeBreadcrumb, ToolExecutionRequest } from './deno-runtime';
export type { ExecutionResult, ToolCode, ToolLimits, ToolPermissions } from './deno-executor';
export type { ToolExecutionContext as DenoToolExecutionContext } from './context-serializer';

// Built-in simple tools
export const builtinTools = {
  // Agent Helper tool for system guidance
  'agent-helper': createTool(
    'agent-helper',
    'Provides system guidance and documentation for LLM-based agents',
    {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What do you need help with?' },
        topic: { type: 'string', enum: ['breadcrumbs', 'tools', 'secrets', 'search', 'patterns', 'examples', 'overview'] },
        detail_level: { type: 'string', enum: ['quick', 'detailed', 'examples'], default: 'detailed' }
      },
      required: ['query']
    },
    {
      type: 'object',
      properties: {
        guidance: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            detailed_explanation: { type: 'string' },
            code_examples: { type: 'array' },
            related_documentation: { type: 'array' },
            next_steps: { type: 'array' }
          }
        }
      }
    },
    async (input, context) => {
      const query = input.query.toLowerCase();
      
      // Search for system documentation
      const searchParams = new URLSearchParams({
        q: `${query} system documentation agent guide`,
        limit: '5'
      });
      
      const response = await fetch(`${context.rcrtClient.baseUrl}/breadcrumbs/search?${searchParams}`, {
        headers: { 'Authorization': `Bearer ${context.rcrtClient.token}` }
      });
      
      const systemDocs = response.ok ? await response.json() : [];
      
      // Generate guidance based on query
      let guidance;
      
      if (query.includes('secret')) {
        guidance = {
          summary: 'How to access and use secrets in RCRT agents',
          detailed_explanation: 'Secrets store encrypted credentials. Use getSecret(name, reason) to access them securely.',
          code_examples: [
            { title: 'Get Secret', code: 'const apiKey = await getSecret("MY_API_KEY", "External API task");' },
            { title: 'Use with Tool', code: 'await invokeTool("my-tool", { config: {...} });' }
          ],
          next_steps: ['Check tool configurations for secret mappings', 'Use secrets UI on dashboard']
        };
      } else if (query.includes('tool')) {
        guidance = {
          summary: 'How to invoke tools and handle responses',
          detailed_explanation: 'Tools extend agent capabilities. Use invokeTool(name, input) to invoke them.',
          code_examples: [
            { title: 'Calculator', code: 'await invokeTool("calculator", { expression: "2+2" });' },
            { title: 'Generic Tool', code: 'await invokeTool("my-tool", { input: {...} });' }
          ],
          next_steps: ['Check tool catalog for available tools', 'Monitor tool:response breadcrumbs']
        };
      } else if (query.includes('breadcrumb')) {
        guidance = {
          summary: 'How to create effective breadcrumbs',
          detailed_explanation: 'Breadcrumbs store semantic content. Use rich context, proper tags, and reference relationships.',
          code_examples: [
            { title: 'Basic Creation', code: 'await createBreadcrumb({ title: "Analysis", context: { result } });' },
            { title: 'With References', code: 'context: { analysis, triggered_by: triggerBreadcrumb.id }' }
          ],
          next_steps: ['Use descriptive titles', 'Tag for discoverability', 'Include rich context']
        };
      } else {
        guidance = {
          summary: 'RCRT system overview and general guidance',
          detailed_explanation: 'RCRT is a semantic knowledge graph. Core workflow: search context → use tools → create responses.',
          code_examples: [
            { title: 'Search Pattern', code: 'const context = await searchBreadcrumbs(query, { tags: ["relevant"] });' },
            { title: 'Response Pattern', code: 'await createBreadcrumb({ title: "Response", context: { result } });' }
          ],
          next_steps: ['Explore system documentation', 'Check agent examples', 'Try the interactive help']
        };
      }
      
      // Add documentation references
      guidance.related_documentation = systemDocs.map(doc => ({
        id: doc.id,
        title: doc.title,
        relevance: 'System documentation and API reference'
      }));
      
      return { guidance };
    }
  ),

  // File Storage Tool
  'file-storage': new FileStorageTool(),

  // Agent Loader Tool  
  'agent-loader': new AgentLoaderTool(),

  // Workflow Orchestrator Tool
  'workflow': workflowOrchestrator,
  
  // Browser Tools
  'browser-context-capture': browserContextCaptureTool
};
