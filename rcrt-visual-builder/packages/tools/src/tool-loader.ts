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
   * Supports both tool.v1 (old) and tool.code.v1 (new)
   */
  async loadToolFromBreadcrumb(breadcrumbId: string): Promise<RCRTTool | null> {
    try {
      const breadcrumb = await this.client.getBreadcrumb(breadcrumbId);
      
      // Support both old and new schemas
      if (breadcrumb.schema_name === 'tool.v1') {
        const { implementation } = breadcrumb.context;
        if (!implementation) {
          console.error(`[ToolLoader] Tool ${breadcrumb.context.name} has no implementation reference`);
          return null;
        }
        
        return await this.loadImplementation(implementation, breadcrumb.context);
      } else if (breadcrumb.schema_name === 'tool.code.v1') {
        // New self-contained tool format
        return await this.loadSelfContainedTool(breadcrumb);
      } else {
        console.error(`[ToolLoader] Breadcrumb ${breadcrumbId} is neither tool.v1 nor tool.code.v1`);
        return null;
      }
    } catch (error) {
      console.error(`[ToolLoader] Failed to load tool from breadcrumb ${breadcrumbId}:`, error);
      return null;
    }
  }

  /**
   * Load tool by name
   * Searches both tool.v1 (old) and tool.code.v1 (new)
   * Prefers tool.code.v1 if both exist
   */
  async loadToolByName(toolName: string): Promise<RCRTTool | null> {
    try {
      console.log(`[ToolLoader] Searching for tool: ${toolName} with tag tool:${toolName}`);
      
      // First try tool.code.v1 (new self-contained format)
      const newToolBreadcrumbs = await this.client.searchBreadcrumbs({
        schema_name: 'tool.code.v1',
        tag: `tool:${toolName}`
      });
      
      if (newToolBreadcrumbs.length > 0) {
        console.log(`[ToolLoader] Found tool.code.v1 for ${toolName}`);
        return await this.loadToolFromBreadcrumb(newToolBreadcrumbs[0].id);
      }
      
      // Fallback to tool.v1 (old format)
      const oldToolBreadcrumbs = await this.client.searchBreadcrumbs({
        schema_name: 'tool.v1',
        tag: `tool:${toolName}`
      });
      
      console.log(`[ToolLoader] Found ${oldToolBreadcrumbs.length} tool.v1 breadcrumbs for ${toolName}`);
      
      if (oldToolBreadcrumbs.length === 0) {
        console.error(`[ToolLoader] No tool breadcrumb found for ${toolName}`);
        console.error(`[ToolLoader] Searched for both tool.v1 and tool.code.v1 with tag tool:${toolName}`);
        return null;
      }
      
      console.log(`[ToolLoader] Loading tool from breadcrumb: ${oldToolBreadcrumbs[0].id}`);
      return await this.loadToolFromBreadcrumb(oldToolBreadcrumbs[0].id);
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
      
      // Navigate to the export (handle various notations)
      let tool = toolModule;
      if (implementation.export) {
        const exportPath = implementation.export;
        console.log(`[ToolLoader] Navigating export path: ${exportPath}`);
        
        // Try bracket notation first: builtinTools['context-builder']
        const bracketMatch = exportPath.match(/^(\w+)\['([^']+)'\]$/);
        if (bracketMatch) {
          const [, obj, key] = bracketMatch;
          tool = toolModule[obj]?.[key];
          console.log(`[ToolLoader] Bracket notation: toolModule.${obj}['${key}']`);
          if (!tool) {
            console.error(`[ToolLoader] Not found via bracket notation`);
            console.error(`[ToolLoader] Available in ${obj}:`, Object.keys(toolModule[obj] || {}));
            return null;
          }
        } else {
          // Use dot notation: builtinTools.calculator
          const parts = exportPath.split('.');
          console.log(`[ToolLoader] Dot notation parts:`, parts);
          
          for (const part of parts) {
            if (!tool) {
              console.error(`[ToolLoader] Tool is null at part: ${part}`);
              return null;
            }
            tool = tool[part];
            console.log(`[ToolLoader] After ${part}: ${tool ? 'found' : 'not found'}`);
            if (!tool) {
              console.error(`[ToolLoader] Export path ${exportPath} not found at part: ${part}`);
              console.error(`[ToolLoader] Available keys:`, Object.keys(toolModule));
              return null;
            }
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
   * Load self-contained tool from tool.code.v1 breadcrumb
   * Note: This creates a stub RCRTTool. Actual execution happens in DenoToolRuntime.
   */
  private async loadSelfContainedTool(breadcrumb: any): Promise<RCRTTool | null> {
    try {
      const { name, description, input_schema, output_schema, examples } = breadcrumb.context;
      
      // Create a stub tool that will be recognized by the tool registry
      // but won't actually execute here - execution happens in DenoToolRuntime
      return {
        name,
        description,
        category: 'self-contained',
        version: breadcrumb.context.version,
        inputSchema: input_schema,
        outputSchema: output_schema,
        examples: examples || [],
        
        // Stub execute - actual execution routed through DenoToolRuntime
        execute: async (input: any, context?: any) => {
          throw new Error(
            `Tool ${name} is a self-contained Deno tool. ` +
            `It should be executed via DenoToolRuntime, not directly. ` +
            `This is a configuration error in tools-runner.`
          );
        }
      };
    } catch (error) {
      console.error('[ToolLoader] Failed to load self-contained tool:', error);
      return null;
    }
  }

  /**
   * Discover all available tools
   * Searches both tool.v1 and tool.code.v1
   */
  async discoverTools(): Promise<Array<{ id: string; name: string; description: string; category: string; schema: string }>> {
    try {
      // Get both old and new format tools
      const [oldToolBreadcrumbs, newToolBreadcrumbs] = await Promise.all([
        this.client.searchBreadcrumbs({
          schema_name: 'tool.v1',
          tag: this.workspace
        }),
        this.client.searchBreadcrumbs({
          schema_name: 'tool.code.v1',
          tag: this.workspace
        })
      ]);
      
      console.log(`[ToolLoader] Discovered ${oldToolBreadcrumbs.length} tool.v1 and ${newToolBreadcrumbs.length} tool.code.v1`);
      
      const allBreadcrumbs = [
        ...oldToolBreadcrumbs.map(tb => ({ ...tb, _schema: 'tool.v1' })),
        ...newToolBreadcrumbs.map(tb => ({ ...tb, _schema: 'tool.code.v1' }))
      ];
      
      const tools = await Promise.all(
        allBreadcrumbs.map(async (tb) => {
          try {
            const breadcrumb = await this.client.getBreadcrumb(tb.id);
            return {
              id: tb.id,
              name: breadcrumb.context.name,
              description: breadcrumb.context.description,
              category: breadcrumb.context.category || 'general',
              schema: tb._schema
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

