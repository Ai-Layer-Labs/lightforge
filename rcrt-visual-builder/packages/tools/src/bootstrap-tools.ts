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
  console.log('✨ RCRT WAY: Agents and Dashboard query tool.code.v1 directly - NO catalog aggregation!');
  console.log('✨ Each tool.code.v1 has llm_hints from schema.def.v1 (excludes code, includes schemas)');
  
  // Count tools for logging
  const toolCount = await client.searchBreadcrumbs({
    schema_name: 'tool.code.v1',
    tag: workspace
  });
  console.log(`✅ ${toolCount.length} tool.code.v1 breadcrumbs available for direct discovery`);
}

// CATALOG AGGREGATION REMOVED!
// Previous pattern: Aggregate tool.code.v1 → tool.catalog.v1 → Agents/Dashboard read catalog
// RCRT pattern: Agents/Dashboard query tool.code.v1 directly with schema llm_hints applied
// Benefits:
//   - No aggregation code to maintain
//   - No hardcoded llm_hints
//   - Always current (instant updates)
//   - Single source of truth (schema.def.v1)
//   - Fail fast (no hidden fallbacks)
