/**
 * Bootstrap script to create tool.v1 breadcrumbs for all builtin tools
 * DYNAMIC DISCOVERY: Scans tool folders for definition.json files
 */

import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { builtinTools } from './index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Handle both bundled and unbundled code
const getDirname = () => {
  try {
    if (typeof import.meta.url !== 'undefined') {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch (e) {
    // Fallback for bundled code
  }
  // For bundled code, __dirname is available
  return typeof __dirname !== 'undefined' ? __dirname : process.cwd();
};

const toolsDir = getDirname();

export async function bootstrapTools(client: RcrtClientEnhanced, workspace: string): Promise<void> {
  console.log('🔧 Dynamically discovering tools from folders...');
  
  // Scan tool folders for definition.json files
  const entries = fs.readdirSync(toolsDir, { withFileTypes: true });
  const toolDirs = entries.filter(dirent => dirent.isDirectory());
  
  let toolsDiscovered = 0;
  
  for (const dir of toolDirs) {
    const definitionPath = path.join(toolsDir, dir.name, 'definition.json');
    
    // Also check for definition-*.json pattern (for multi-tool folders like llm-tools)
    const definitionFiles = fs.existsSync(definitionPath) 
      ? [definitionPath]
      : fs.readdirSync(path.join(toolsDir, dir.name))
          .filter(f => f.match(/^definition.*\.json$/))
          .map(f => path.join(toolsDir, dir.name, f));
    
    if (definitionFiles.length === 0) continue;
    
    for (const defPath of definitionFiles) {
      try {
        const toolDef = JSON.parse(fs.readFileSync(defPath, 'utf-8'));
        
        if (toolDef.schema_name !== 'tool.v1') {
          console.log(`⏭️  Skipping ${path.basename(defPath)} - not tool.v1`);
          continue;
        }
        
        const toolName = toolDef.context?.name;
        if (!toolName) {
          console.log(`⏭️  Skipping ${path.basename(defPath)} - no name in context`);
          continue;
        }
        
        // Check if tool breadcrumb already exists
        const existing = await client.searchBreadcrumbs({
          schema_name: 'tool.v1',
          tag: `tool:${toolName}`
        });
      
      if (existing.length > 0) {
        // Update existing tool breadcrumb
        const existingBreadcrumb = await client.getBreadcrumb(existing[0].id);
        await client.updateBreadcrumb(existing[0].id, existingBreadcrumb.version, {
          title: toolDef.title,
          tags: toolDef.tags,
          context: toolDef.context
        });
        console.log(`✅ Updated tool: ${toolName} (from ${dir.name}/)`);
      } else {
        // Create new tool breadcrumb from definition.json
        await client.createBreadcrumb(toolDef);
        console.log(`✅ Discovered tool: ${toolName} (from ${dir.name}/)`);
        toolsDiscovered++;
      }
      } catch (error) {
        console.error(`❌ Failed to discover tool from ${path.basename(defPath)}:`, error);
      }
    }
  }
  
  console.log(`📊 Total tools discovered: ${toolsDiscovered}`);
  
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
