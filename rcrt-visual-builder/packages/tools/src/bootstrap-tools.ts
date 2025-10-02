/**
 * Bootstrap script to create tool.v1 breadcrumbs for all builtin tools
 * Run this on startup to ensure all tools are discoverable
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { builtinTools } from './index.js';

export async function bootstrapTools(client: RcrtClientEnhanced, workspace: string): Promise<void> {
  console.log('🔧 Bootstrapping RCRT tools...');
  
  for (const [name, tool] of Object.entries(builtinTools)) {
    try {
      // Check if tool breadcrumb already exists
      const existing = await client.searchBreadcrumbs({
        schema_name: 'tool.v1',
        tag: `tool:${name}`
      });
      
      if (existing.length > 0) {
        console.log(`✓ Tool ${name} already exists`);
        continue;
      }
      
      // Determine implementation details based on tool type
      let implementation: any;
      
      // Check if it's a class instance (has a constructor that's not Object)
      if (tool.constructor && tool.constructor.name && tool.constructor.name !== 'Object') {
        // Class-based tool (already instantiated in builtinTools)
        console.log(`Tool ${name} is a class instance: ${tool.constructor.name}`);
        implementation = {
          type: 'builtin',
          runtime: 'nodejs',
          module: '@rcrt-builder/tools',
          export: `builtinTools.${name}`,
          // Note: Already an instance, don't re-instantiate
          instantiate: false
        };
      } else if (typeof tool === 'object' && tool.execute) {
        // Simple function-based tool
        implementation = {
          type: 'builtin',
          runtime: 'nodejs',
          module: '@rcrt-builder/tools',
          export: `builtinTools.${name}`
        };
      } else {
        console.warn(`Unable to determine implementation type for tool ${name}`);
        implementation = {
          type: 'builtin',
          runtime: 'nodejs',
          module: '@rcrt-builder/tools',
          export: `builtinTools.${name}`
        };
      }
      
      // Create tool breadcrumb
      const toolDef = {
        schema_name: 'tool.v1',
        title: tool.name,
        tags: [
          'tool',
          `tool:${tool.name}`,
          `category:${tool.category || 'general'}`,
          workspace
        ],
        context: {
          name: tool.name,
          version: tool.version || '1.0.0',
          description: tool.description,
          category: tool.category || 'general',
          
          implementation,
          
          definition: {
            inputSchema: tool.inputSchema,
            outputSchema: tool.outputSchema,
            examples: tool.examples || []
          },
          
          configuration: {
            configurable: !!tool.configSchema,
            configSchema: tool.configSchema,
            defaults: tool.configDefaults || {},
            currentConfig: {}
          },
          
          capabilities: {
            async: true,
            timeout: 30000,
            retries: 0,
            rateLimit: tool.rateLimit
          },
          
          metadata: {
            author: 'system',
            created: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            executionCount: 0
          }
        }
      };
      
      await client.createBreadcrumb(toolDef);
      console.log(`✅ Created tool breadcrumb for ${name}`);
      
    } catch (error) {
      console.error(`❌ Failed to bootstrap tool ${name}:`, error);
    }
  }
  
  // Create/update catalog
  await updateToolCatalog(client, workspace);
}

async function updateToolCatalog(client: RcrtClientEnhanced, workspace: string): Promise<void> {
  try {
    // Search for all tool.v1 breadcrumbs
    const toolBreadcrumbs = await client.searchBreadcrumbs({
      schema_name: 'tool.v1',
      tag: workspace
    });
    
    console.log(`📚 Found ${toolBreadcrumbs.length} tools`);
    
    // Fetch full details
    const tools = await Promise.all(
      toolBreadcrumbs.map(async (tb) => {
        const breadcrumb = await client.getBreadcrumb(tb.id);
        return breadcrumb.context;
      })
    );
    
    // Build catalog
    const catalog = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category || 'general',
      version: tool.version || '1.0.0',
      inputSchema: tool.definition?.inputSchema || {},
      outputSchema: tool.definition?.outputSchema || {},
      examples: tool.definition?.examples || [],
      capabilities: tool.capabilities || {
        async: true,
        timeout: 30000,
        retries: 0
      },
      status: 'active',
      lastSeen: new Date().toISOString()
    }));
    
    // Find existing catalog
    const catalogSearch = await client.searchBreadcrumbs({
      schema_name: 'tool.catalog.v1',
      tag: workspace
    });
    
    const catalogData = {
      workspace,
      tools: catalog,
      totalTools: catalog.length,
      activeTools: catalog.length,
      lastUpdated: new Date().toISOString(),
      llm_hints: {
        transform: {
          tool_list: {
            type: 'template',
            template: `You have access to {{context.activeTools}} tools:

{{#each context.tools}}
• {{this.name}} ({{this.category}}): {{this.description}}
  Output: {{#if this.outputSchema.properties}}{{#each this.outputSchema.properties}}{{@key}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}See outputSchema{{/if}}
  {{#if this.examples}}{{#if this.examples.[0]}}Example: {{this.examples.[0].explanation}}{{/if}}{{/if}}
{{/each}}

IMPORTANT: The catalog above includes examples showing exact output field names. Use the correct field access!

To invoke tools:
{
  "tool_requests": [{
    "tool": "tool-name",
    "input": { /* parameters */ },
    "requestId": "unique-id"
  }]
}`
          },
          available_tools: {
            type: 'extract',
            value: '$.tools[*].name'
          }
        },
        mode: 'merge'
      }
    };
    
    if (catalogSearch.length > 0) {
      // Update existing
      const existing = await client.getBreadcrumb(catalogSearch[0].id);
      await client.updateBreadcrumb(
        catalogSearch[0].id,
        existing.version,
        {
          title: `${workspace} Tool Catalog`,
          context: catalogData
        }
      );
      console.log('📚 Updated tool catalog');
    } else {
      // Create new
      await client.createBreadcrumb({
        schema_name: 'tool.catalog.v1',
        title: `${workspace} Tool Catalog`,
        tags: [workspace, 'tool:catalog'],
        context: catalogData
      });
      console.log('📚 Created tool catalog');
    }
    
  } catch (error) {
    console.error('Failed to update catalog:', error);
  }
}
