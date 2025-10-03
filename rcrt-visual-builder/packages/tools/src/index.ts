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

// Import LLM tools
import { OpenRouterTool, OllamaTool } from './llm-tools/index.js';

// Export tool loader for RCRT-native mode
export { ToolLoader } from './tool-loader.js';
export { bootstrapTools } from './bootstrap-tools.js';

// Export LLM tools for external use
export { OpenRouterTool, OllamaTool, SimpleLLMTool, OpenRouterModelsCatalog } from './llm-tools/index.js';

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
            { title: 'Get Secret', code: 'const key = await getSecret("OPENROUTER_API_KEY", "LLM task");' },
            { title: 'Use with Tool', code: 'await invokeTool("openrouter", { messages: [...] });' }
          ],
          next_steps: ['Check tool configurations for secret mappings', 'Use secrets UI on dashboard']
        };
      } else if (query.includes('tool')) {
        guidance = {
          summary: 'How to invoke tools and handle responses',
          detailed_explanation: 'Tools extend agent capabilities. Use invokeTool(name, input) to invoke them.',
          code_examples: [
            { title: 'Calculator', code: 'await invokeTool("calculator", { expression: "2+2" });' },
            { title: 'LLM', code: 'await invokeTool("openrouter", { messages: [...] });' }
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
        echo: { type: 'string', description: 'The echoed message' }
      }
    },
    async (input) => ({ echo: input.message }),
    {
      category: 'general',
      examples: [
        {
          title: 'Simple echo',
          input: { message: 'Hello, RCRT!' },
          output: { echo: 'Hello, RCRT!' },
          explanation: 'Access with result.echo'
        },
        {
          title: 'For testing tool chains',
          input: { message: 'Test message' },
          output: { echo: 'Test message' },
          explanation: 'Useful for testing tool communication'
        }
      ]
    }
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
        waited: { type: 'number', description: 'Number of seconds waited' },
        message: { type: 'string', description: 'Confirmation message' }
      }
    },
    async (input) => {
      await new Promise(resolve => setTimeout(resolve, input.seconds * 1000));
      return { waited: input.seconds, message: `Waited ${input.seconds} seconds` };
    },
    {
      category: 'general',
      examples: [
        {
          title: 'Short delay',
          input: { seconds: 2 },
          output: { waited: 2, message: 'Waited 2 seconds' },
          explanation: 'Access duration with result.waited'
        },
        {
          title: 'For workflow delays',
          input: { seconds: 5 },
          output: { waited: 5, message: 'Waited 5 seconds' },
          explanation: 'Useful for adding delays between workflow steps'
        }
      ]
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
        numbers: { type: 'array', items: { type: 'number' }, description: 'Array of generated random numbers' }
      }
    },
    async (input) => {
      const { min = 0, max = 100, count = 1 } = input;
      const numbers = Array.from({ length: count }, () => 
        Math.floor(Math.random() * (max - min + 1)) + min
      );
      return { numbers };
    },
    {
      category: 'general',
      examples: [
        {
          title: 'Single random number',
          input: { min: 1, max: 10 },
          output: { numbers: [7] },
          explanation: 'Access the number with result.numbers[0]'
        },
        {
          title: 'Multiple random numbers',
          input: { min: 0, max: 100, count: 3 },
          output: { numbers: [42, 73, 15] },
          explanation: 'Access with result.numbers[0], result.numbers[1], etc.'
        },
        {
          title: 'For use in workflows',
          input: { min: 1, max: 100 },
          output: { numbers: [84] },
          explanation: 'In workflow steps, use ${stepId.numbers[0]}'
        }
      ]
    }
  ),

  // Calculator tool
  calculator: createTool(
    'calculator',
    'Perform mathematical calculations - supports basic arithmetic, parentheses, and common math functions',
    {
      type: 'object',
      properties: {
        expression: { 
          type: 'string', 
          description: 'Mathematical expression to evaluate (e.g., "2 + 2", "(5 * 3) / 2", "Math.sqrt(16)")' 
        }
      },
      required: ['expression']
    },
    {
      type: 'object',
      properties: {
        result: { type: 'number', description: 'The calculated result' },
        expression: { type: 'string', description: 'The original expression' },
        formatted: { type: 'string', description: 'Formatted result string' }
      },
      required: ['result', 'expression']
    },
    async (input) => {
      const { expression } = input;
      
      try {
        // Create a safer eval context with Math functions
        const mathContext = {
          // Basic Math constants
          PI: Math.PI,
          E: Math.E,
          // Basic Math functions
          abs: Math.abs,
          acos: Math.acos,
          asin: Math.asin,
          atan: Math.atan,
          atan2: Math.atan2,
          ceil: Math.ceil,
          cos: Math.cos,
          exp: Math.exp,
          floor: Math.floor,
          log: Math.log,
          max: Math.max,
          min: Math.min,
          pow: Math.pow,
          random: Math.random,
          round: Math.round,
          sin: Math.sin,
          sqrt: Math.sqrt,
          tan: Math.tan
        };
        
        // Build function with math context
        const mathKeys = Object.keys(mathContext);
        const mathValues = Object.values(mathContext);
        
        // Sanitize expression - remove potentially dangerous patterns
        const sanitized = expression
          .replace(/[^0-9+\-*/().,\s\w]/g, '') // Only allow basic math chars
          .replace(/\bMath\./g, ''); // Remove Math. prefix for cleaner syntax
        
        // Create function with math context
        const evalFunction = new Function(...mathKeys, `"use strict"; return (${sanitized})`);
        const result = evalFunction(...mathValues);
        
        // Validate result
        if (typeof result !== 'number' || !isFinite(result)) {
          throw new Error('Expression did not evaluate to a valid number');
        }
        
        // Format result nicely
        const formatted = result % 1 === 0 
          ? result.toString() 
          : result.toFixed(10).replace(/\.?0+$/, ''); // Remove trailing zeros
        
        return {
          result,
          expression,
          formatted: `${expression} = ${formatted}`
        };
      } catch (error: any) {
        throw new Error(`Failed to evaluate expression: ${error.message}`);
      }
    },
    {
      category: 'general',
      examples: [
        {
          title: 'Basic arithmetic',
          input: { expression: '2 + 2' },
          output: { result: 4, expression: '2 + 2', formatted: '2 + 2 = 4' },
          explanation: 'Access the result with result.result'
        },
        {
          title: 'Complex expression',
          input: { expression: '(10 * 5) + 25' },
          output: { result: 75, expression: '(10 * 5) + 25', formatted: '(10 * 5) + 25 = 75' },
          explanation: 'Supports parentheses and order of operations'
        },
        {
          title: 'Math functions',
          input: { expression: 'Math.sqrt(16)' },
          output: { result: 4, expression: 'Math.sqrt(16)', formatted: 'Math.sqrt(16) = 4' },
          explanation: 'Use Math.functionName for advanced operations like sqrt, sin, cos, etc.'
        }
      ]
    }
  ),

  // File Storage Tool
  'file-storage': new FileStorageTool(),

  // Agent Loader Tool  
  'agent-loader': new AgentLoaderTool(),

  // Workflow Orchestrator Tool
  'workflow': workflowOrchestrator,
  
  // LLM Tools
  'openrouter': new OpenRouterTool(),
  'ollama_local': new OllamaTool(),
  
  // Breadcrumb CRUD Tool
  'breadcrumb-crud': createTool(
    'breadcrumb-crud',
    'Query, create, update, and delete breadcrumbs',
    {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['query', 'search', 'create', 'get', 'update', 'delete', 'list-tags'],
          description: 'CRUD operation to perform (search and query are the same)'
        },
        // For query
        schema_name: { type: 'string', description: 'Filter by schema name' },
        tag: { type: 'string', description: 'Filter by tag' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by multiple tags' },
        limit: { type: 'number', default: 10, description: 'Maximum results' },
        // For get/update/delete
        id: { type: 'string', description: 'Breadcrumb ID (required for get/update/delete)' },
        // For create/update
        title: { type: 'string', description: 'Breadcrumb title' },
        context: { type: 'object', description: 'Breadcrumb context data' },
        new_tags: { type: 'array', items: { type: 'string' }, description: 'Tags for breadcrumb' }
      },
      required: ['action']
    },
    {
      type: 'object',
      properties: {
        action: { type: 'string' },
        success: { type: 'boolean' },
        breadcrumb: { type: 'object', description: 'Single breadcrumb result (for get)' },
        breadcrumbs: { type: 'array', description: 'Multiple breadcrumb results (for query/search)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'List of tags (for list-tags)' },
        count: { type: 'number', description: 'Number of results' },
        breadcrumbs_scanned: { type: 'number', description: 'Number of breadcrumbs checked (for list-tags)' },
        error: { type: 'string' }
      }
    },
    async (input, context) => {
      const { action } = input;
      
      try {
        switch (action) {
          case 'query':
          case 'search': {
            const params: any = {};
            if (input.schema_name) params.schema_name = input.schema_name;
            if (input.tag) params.tag = input.tag;
            if (input.tags) params.tags = input.tags;
            
            const results = await context.rcrtClient.searchBreadcrumbs(params);
            const limited = results.slice(0, input.limit || 10);
            
            // Fetch full breadcrumb details for each result
            const fullBreadcrumbs = await Promise.all(
              limited.map(async (bc) => {
                try {
                  return await context.rcrtClient.getBreadcrumb(bc.id);
                } catch (error) {
                  console.warn(`Failed to fetch breadcrumb ${bc.id}:`, error);
                  return bc; // Return minimal if fetch fails
                }
              })
            );
            
            return {
              action: action,
              success: true,
              breadcrumbs: fullBreadcrumbs,
              count: fullBreadcrumbs.length
            };
          }
          
          case 'get': {
            if (!input.id) throw new Error('id required for get action');
            
            const breadcrumb = await context.rcrtClient.getBreadcrumb(input.id);
            return {
              action: 'get',
              success: true,
              breadcrumb
            };
          }
          
          case 'create': {
            if (!input.title) throw new Error('title required for create action');
            if (!input.context) throw new Error('context required for create action');
            
            const created = await context.rcrtClient.createBreadcrumb({
              title: input.title,
              context: input.context,
              tags: input.new_tags || [],
              schema_name: input.schema_name
            });
            
            return {
              action: 'create',
              success: true,
              breadcrumb: created
            };
          }
          
          case 'update': {
            if (!input.id) throw new Error('id required for update action');
            
            const current = await context.rcrtClient.getBreadcrumb(input.id);
            const updates: any = {};
            if (input.title) updates.title = input.title;
            if (input.context) updates.context = input.context;
            if (input.new_tags) updates.tags = input.new_tags;
            
            await context.rcrtClient.updateBreadcrumb(input.id, current.version, updates);
            
            return {
              action: 'update',
              success: true
            };
          }
          
          case 'delete': {
            if (!input.id) throw new Error('id required for delete action');
            
            await context.rcrtClient.deleteBreadcrumb(input.id);
            
            return {
              action: 'delete',
              success: true
            };
          }
          
          case 'list-tags': {
            // Get all breadcrumbs and extract unique tags
            const params: any = {};
            if (input.schema_name) params.schema_name = input.schema_name;
            
            const results = await context.rcrtClient.searchBreadcrumbs(params);
            const limited = results.slice(0, input.limit || 100);
            
            // Extract all tags
            const allTags = new Set<string>();
            for (const bc of limited) {
              if (bc.tags && Array.isArray(bc.tags)) {
                bc.tags.forEach(tag => allTags.add(tag));
              }
            }
            
            const sortedTags = Array.from(allTags).sort();
            
            return {
              action: 'list-tags',
              success: true,
              tags: sortedTags,
              count: sortedTags.length,
              breadcrumbs_scanned: limited.length
            };
          }
          
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      } catch (error) {
        return {
          action,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    },
    {
      category: 'system',
      examples: [
        {
          title: 'Search breadcrumbs by tag',
          input: { 
            action: 'search',
            tag: 'user:message',
            limit: 5
          },
          output: {
            action: 'search',
            success: true,
            breadcrumbs: [
              { 
                id: 'uuid-123', 
                title: 'User message', 
                tags: ['user:message'],
                context: { message: 'Hello world' },
                version: 1,
                updated_at: '2025-10-03T00:00:00Z'
              }
            ],
            count: 1
          },
          explanation: 'Search for breadcrumbs by tag. Returns FULL breadcrumbs with context in result.breadcrumbs array.'
        },
        {
          title: 'Create a breadcrumb',
          input: {
            action: 'create',
            title: 'My Note',
            context: { note: 'Important information' },
            new_tags: ['note', 'important'],
            schema_name: 'note.v1'
          },
          output: {
            action: 'create',
            success: true,
            breadcrumb: { id: 'new-uuid', title: 'My Note' }
          },
          explanation: 'Creates a breadcrumb. Returns the created breadcrumb with its ID.'
        },
        {
          title: 'Get breadcrumb details',
          input: {
            action: 'get',
            id: 'breadcrumb-uuid'
          },
          output: {
            action: 'get',
            success: true,
            breadcrumb: { id: 'breadcrumb-uuid', title: 'Example', context: { data: 'value' } }
          },
          explanation: 'Retrieves full breadcrumb. Returns breadcrumb field with all data.'
        },
        {
          title: 'Update a breadcrumb',
          input: {
            action: 'update',
            id: 'breadcrumb-uuid',
            context: { updated: 'data' }
          },
          output: {
            action: 'update',
            success: true
          },
          explanation: 'Updates breadcrumb fields. Only provide fields you want to change.'
        },
        {
          title: 'Delete a breadcrumb',
          input: {
            action: 'delete',
            id: 'breadcrumb-uuid'
          },
          output: {
            action: 'delete',
            success: true
          },
          explanation: 'Deletes a breadcrumb permanently.'
        },
        {
          title: 'List all available tags',
          input: {
            action: 'list-tags',
            limit: 100
          },
          output: {
            action: 'list-tags',
            success: true,
            tags: [
              'agent:def',
              'tool:calculator',
              'tool:random',
              'user:message',
              'workspace:tools'
            ],
            count: 5,
            breadcrumbs_scanned: 42
          },
          explanation: 'Lists all unique tags in the system. Use result.tags array to see all tags.'
        }
      ]
    }
  )
};
