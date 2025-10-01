/**
 * RCRT-Native Tool Loader
 * Loads tool implementations from breadcrumb references
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { RCRTTool } from './index.js';

export interface ToolImplementation {
  type: 'builtin' | 'module' | 'http' | 'breadcrumb' | 'container';
  runtime: string;
  module?: string;
  export?: string;
  instantiate?: boolean;
  constructor_args?: any[];
  endpoint?: string;
  method?: string;
  auth?: {
    type: string;
    secret?: string;
  };
  breadcrumb_id?: string;
  handler?: string;
  image?: string;
  port?: number;
  path?: string;
}

export class ToolLoader {
  constructor(
    private client: RcrtClientEnhanced,
    private workspace: string
  ) {}

  /**
   * Load a tool from its breadcrumb definition
   */
  async loadToolFromBreadcrumb(breadcrumbId: string): Promise<RCRTTool | null> {
    try {
      const breadcrumb = await this.client.getBreadcrumb(breadcrumbId);
      if (breadcrumb.schema_name !== 'tool.v1') {
        console.error(`[ToolLoader] Breadcrumb ${breadcrumbId} is not a tool.v1`);
        return null;
      }
      
      const { implementation } = breadcrumb.context;
      if (!implementation) {
        console.error(`[ToolLoader] Tool ${breadcrumb.context.name} has no implementation reference`);
        return null;
      }
      
      return await this.loadImplementation(implementation, breadcrumb.context);
    } catch (error) {
      console.error(`[ToolLoader] Failed to load tool from breadcrumb ${breadcrumbId}:`, error);
      return null;
    }
  }

  /**
   * Load tool by name
   */
  async loadToolByName(toolName: string): Promise<RCRTTool | null> {
    try {
      // Search for tool.v1 breadcrumb
      const toolBreadcrumbs = await this.client.searchBreadcrumbs({
        schema_name: 'tool.v1',
        tag: `tool:${toolName}`,
        workspace: this.workspace,
        limit: 1
      });
      
      if (toolBreadcrumbs.length === 0) {
        console.error(`[ToolLoader] No tool.v1 breadcrumb found for ${toolName}`);
        return null;
      }
      
      return await this.loadToolFromBreadcrumb(toolBreadcrumbs[0].id);
    } catch (error) {
      console.error(`[ToolLoader] Failed to load tool ${toolName}:`, error);
      return null;
    }
  }

  /**
   * Load the actual tool implementation
   */
  private async loadImplementation(
    implementation: ToolImplementation, 
    toolContext: any
  ): Promise<RCRTTool | null> {
    console.log(`[ToolLoader] Loading ${implementation.type} implementation for ${toolContext.name}`);
    
    switch (implementation.type) {
      case 'builtin':
        return await this.loadBuiltinTool(implementation, toolContext);
        
      case 'module':
        return await this.loadModuleTool(implementation, toolContext);
        
      case 'http':
        return this.createHttpTool(implementation, toolContext);
        
      case 'breadcrumb':
        return await this.loadBreadcrumbTool(implementation, toolContext);
        
      case 'container':
        return this.createContainerTool(implementation, toolContext);
        
      default:
        console.error(`[ToolLoader] Unknown implementation type: ${implementation.type}`);
        return null;
    }
  }

  /**
   * Load builtin tools that ship with the tools package
   */
  private async loadBuiltinTool(
    implementation: ToolImplementation,
    toolContext: any
  ): Promise<RCRTTool | null> {
    try {
      let toolModule: any;
      
      // Map module names to imports
      switch (implementation.module) {
        case '@rcrt-builder/tools':
          toolModule = await import('./index.js');
          break;
        case '@rcrt-builder/tools/llm-tools':
          toolModule = await import('./llm-tools/index.js');
          break;
        case '@rcrt-builder/tools/file-tools':
          toolModule = await import('./file-tools/index.js');
          break;
        default:
          console.error(`[ToolLoader] Unknown builtin module: ${implementation.module}`);
          return null;
      }
      
      // Navigate to the export
      let tool = toolModule;
      if (implementation.export) {
        const parts = implementation.export.split('.');
        for (const part of parts) {
          tool = tool[part];
          if (!tool) {
            console.error(`[ToolLoader] Export path ${implementation.export} not found`);
            return null;
          }
        }
      }
      
      // Instantiate if needed
      if (implementation.instantiate) {
        const args = implementation.constructor_args || [];
        tool = new tool(...args);
      }
      
      // Ensure we have a valid RCRTTool
      if (!tool.execute || typeof tool.execute !== 'function') {
        console.error(`[ToolLoader] Invalid tool - missing execute function`, {
          hasTool: !!tool,
          hasExecute: !!tool.execute,
          executeType: typeof tool.execute,
          toolKeys: tool ? Object.keys(tool) : [],
          toolProto: tool ? Object.getPrototypeOf(tool) : null
        });
        return null;
      }
      
      // Return the tool directly if it's already an instance (don't spread it)
      // Spreading loses class methods that aren't enumerable
      if (tool && typeof tool === 'object' && tool.constructor && tool.constructor.name !== 'Object') {
        console.log(`[ToolLoader] Loaded class instance: ${tool.constructor.name}`);
        
        // Update metadata on the instance
        tool.name = toolContext.name || tool.name;
        tool.description = toolContext.description || tool.description;
        tool.category = toolContext.category || tool.category;
        tool.version = toolContext.version || tool.version;
        tool.examples = toolContext.definition?.examples || tool.examples || [];
        
        return tool;
      }
      
      // For plain objects (function-based tools), spread is fine
      return {
        ...tool,
        name: toolContext.name,
        description: toolContext.description,
        category: toolContext.category,
        version: toolContext.version,
        inputSchema: toolContext.definition?.inputSchema || tool.inputSchema,
        outputSchema: toolContext.definition?.outputSchema || tool.outputSchema,
        examples: toolContext.definition?.examples || tool.examples || []
      };
      
    } catch (error) {
      console.error(`[ToolLoader] Failed to load builtin tool:`, error);
      return null;
    }
  }

  /**
   * Load external npm module tools
   */
  private async loadModuleTool(
    implementation: ToolImplementation,
    toolContext: any
  ): Promise<RCRTTool | null> {
    try {
      // Dynamic import of external module
      const toolModule = await import(implementation.module!);
      
      let tool = toolModule;
      if (implementation.export) {
        tool = toolModule[implementation.export];
      }
      
      if (implementation.instantiate) {
        const args = implementation.constructor_args || [];
        tool = new tool(...args);
      }
      
      return {
        ...tool,
        name: toolContext.name,
        description: toolContext.description,
        category: toolContext.category,
        version: toolContext.version,
        inputSchema: toolContext.definition?.inputSchema || tool.inputSchema,
        outputSchema: toolContext.definition?.outputSchema || tool.outputSchema,
        examples: toolContext.definition?.examples || tool.examples || []
      };
      
    } catch (error) {
      console.error(`[ToolLoader] Failed to load module tool:`, error);
      return null;
    }
  }

  /**
   * Create HTTP-based tool wrapper
   */
  private createHttpTool(
    implementation: ToolImplementation,
    toolContext: any
  ): RCRTTool {
    return {
      name: toolContext.name,
      description: toolContext.description,
      category: toolContext.category,
      version: toolContext.version,
      inputSchema: toolContext.definition?.inputSchema || {},
      outputSchema: toolContext.definition?.outputSchema || {},
      examples: toolContext.definition?.examples || [],
      
      execute: async (input: any) => {
        const response = await fetch(implementation.endpoint!, {
          method: implementation.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(implementation.auth?.type === 'bearer' ? {
              'Authorization': `Bearer ${implementation.auth.secret}`
            } : {})
          },
          body: JSON.stringify(input)
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      }
    };
  }

  /**
   * Load JavaScript from breadcrumb
   */
  private async loadBreadcrumbTool(
    implementation: ToolImplementation,
    toolContext: any
  ): Promise<RCRTTool | null> {
    try {
      const codeBreadcrumb = await this.client.getBreadcrumb(implementation.breadcrumb_id!);
      const code = codeBreadcrumb.context.code;
      
      // Create function from code
      const AsyncFunction = (async function() {}).constructor as any;
      const toolFunction = new AsyncFunction('input', 'context', code);
      
      return {
        name: toolContext.name,
        description: toolContext.description,
        category: toolContext.category,
        version: toolContext.version,
        inputSchema: toolContext.definition?.inputSchema || {},
        outputSchema: toolContext.definition?.outputSchema || {},
        examples: toolContext.definition?.examples || [],
        execute: toolFunction
      };
      
    } catch (error) {
      console.error(`[ToolLoader] Failed to load breadcrumb tool:`, error);
      return null;
    }
  }

  /**
   * Create container-based tool wrapper
   */
  private createContainerTool(
    implementation: ToolImplementation,
    toolContext: any
  ): RCRTTool {
    const endpoint = `http://localhost:${implementation.port}${implementation.path || '/execute'}`;
    
    return {
      name: toolContext.name,
      description: toolContext.description,
      category: toolContext.category,
      version: toolContext.version,
      inputSchema: toolContext.definition?.inputSchema || {},
      outputSchema: toolContext.definition?.outputSchema || {},
      examples: toolContext.definition?.examples || [],
      
      execute: async (input: any) => {
        console.log(`[ToolLoader] Calling container tool at ${endpoint}`);
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input)
        });
        
        if (!response.ok) {
          throw new Error(`Container returned ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      }
    };
  }

  /**
   * Discover all available tools
   */
  async discoverTools(): Promise<Array<{ id: string; name: string; description: string; category: string }>> {
    try {
      const toolBreadcrumbs = await this.client.searchBreadcrumbs({
        schema_name: 'tool.v1',
        workspace: this.workspace,
        limit: 1000
      });
      
      const tools = await Promise.all(
        toolBreadcrumbs.map(async (tb) => {
          try {
            const breadcrumb = await this.client.getBreadcrumb(tb.id);
            return {
              id: tb.id,
              name: breadcrumb.context.name,
              description: breadcrumb.context.description,
              category: breadcrumb.context.category || 'general'
            };
          } catch {
            return null;
          }
        })
      );
      
      return tools.filter(t => t !== null) as any[];
      
    } catch (error) {
      console.error('[ToolLoader] Failed to discover tools:', error);
      return [];
    }
  }
}

