/**
 * Bootstrap script to create tool.v1 breadcrumbs for all builtin tools
 * DYNAMIC DISCOVERY: Scans tool folders for definition.json files
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { builtinTools } from './index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get tools source directory (where definition.json files live)
const getToolsSourceDir = () => {
  // In Docker: /app/packages/tools/src
  // In local dev: relative to this file
  
  // Check if we're in Docker (bundled code)
  if (fs.existsSync('/app/packages/tools/src')) {
    return '/app/packages/tools/src';
  }
  
  // Local development - use import.meta.url
  try {
    if (typeof import.meta.url !== 'undefined') {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      return currentDir; // Already in packages/tools/src/
    }
  } catch (e) {
    // Fallback
  }
  
  // Last resort - try to find it relative to process.cwd()
  const possiblePaths = [
    'packages/tools/src',
    '../packages/tools/src',
    'rcrt-visual-builder/packages/tools/src'
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return path.resolve(p);
    }
  }
  
  return process.cwd();
};

const toolsDir = getToolsSourceDir();

export async function bootstrapTools(client: RcrtClientEnhanced, workspace: string): Promise<void> {
  console.log('🔧 Legacy tool.v1 bootstrap skipped - all tools are now tool.code.v1');
  console.log('📊 Tools are loaded from bootstrap-breadcrumbs/tools-self-contained/ via bootstrap.js');
  
  // Update tool catalog to include tool.code.v1
  await updateToolCatalog(client, workspace);
}

async function updateToolCatalog(client: RcrtClientEnhanced, workspace: string): Promise<void> {
  try {
    // Search for tool.code.v1 breadcrumbs ONLY (legacy tool.v1 removed)
    const toolCodeV1Breadcrumbs = await client.searchBreadcrumbs({
      schema_name: 'tool.code.v1',
      tag: workspace
    });
    
    console.log(`📚 Found ${toolCodeV1Breadcrumbs.length} tool.code.v1 tools`);
    
    // Fetch full details for tool.code.v1
    const allTools = await Promise.all(
      toolCodeV1Breadcrumbs.map(async (tb) => {
        const breadcrumb = await client.getBreadcrumb(tb.id);
        return breadcrumb.context;
      })
    );
    
    // Build catalog from tool.code.v1 breadcrumbs
    const catalog = allTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category || 'general',
      version: tool.version || '1.0.0',
      inputSchema: tool.input_schema || {},
      outputSchema: tool.output_schema || {},
      examples: tool.examples || [],
      capabilities: tool.capabilities || {
        async: true,
        timeout: tool.limits?.timeout_ms || 30000,
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
