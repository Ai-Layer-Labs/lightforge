#!/usr/bin/env node
/**
 * Breadcrumb Structure Migration Script
 * Migrates bootstrap files from old structure to optimized structure
 * 
 * Changes:
 * - context.description → description (top-level)
 * - context.version → semantic_version (top-level)
 * - context.schema_version → semantic_version (top-level)
 * - context.llm_hints → llm_hints (top-level)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bootstrapDir = path.join(__dirname, '..', 'bootstrap-breadcrumbs');

function migrateBreadcrumb(data) {
  const migrated = { ...data };
  const { context } = data;
  
  if (!context) return migrated;
  
  // Move description to top-level
  if (context.description && !migrated.description) {
    migrated.description = context.description;
    delete context.description;
  }
  
  // Move version/schema_version to semantic_version (top-level)
  if (context.version && !migrated.semantic_version) {
    migrated.semantic_version = context.version;
    delete context.version;
  }
  if (context.schema_version && !migrated.semantic_version) {
    migrated.semantic_version = context.schema_version;
    delete context.schema_version;
  }
  
  // Move llm_hints to top-level  
  if (context.llm_hints && !migrated.llm_hints) {
    migrated.llm_hints = context.llm_hints;
    delete context.llm_hints;
  }
  
  // Add standard llm_hints for tools if missing
  if (migrated.schema_name === 'tool.code.v1' && !migrated.llm_hints) {
    migrated.llm_hints = {
      include: ["name", "description", "input_schema", "output_schema", "examples"],
      exclude: ["code", "permissions", "limits", "ui_schema", "bootstrap"]
    };
  }
  
  migrated.context = context;
  return migrated;
}

function migrateDirectory(dirPath, filePattern = /\.json$/) {
  console.log(`\n📂 Migrating ${dirPath}...`);
  
  if (!fs.existsSync(dirPath)) {
    console.log(`   ⏭️  Directory not found, skipping`);
    return 0;
  }
  
  const files = fs.readdirSync(dirPath).filter(f => filePattern.test(f));
  let migrated = 0;
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    
    try {
      // Read original
      const original = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      // Check if already migrated
      if (original.semantic_version && original.description) {
        console.log(`   ⏭️  ${file} - Already migrated`);
        continue;
      }
      
      // Migrate
      const updated = migrateBreadcrumb(original);
      
      // Check if anything changed
      if (JSON.stringify(original) === JSON.stringify(updated)) {
        console.log(`   ⏭️  ${file} - No changes needed`);
        continue;
      }
      
      // Backup original
      const backupPath = filePath + '.backup';
      fs.writeFileSync(backupPath, JSON.stringify(original, null, 2));
      
      // Write migrated
      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
      
      console.log(`   ✅ ${file} - Migrated (backup: ${file}.backup)`);
      migrated++;
    } catch (error) {
      console.error(`   ❌ ${file} - Error:`, error.message);
    }
  }
  
  return migrated;
}

console.log('🚀 Breadcrumb Structure Migration');
console.log('=====================================');

let totalMigrated = 0;

// Migrate tools
totalMigrated += migrateDirectory(path.join(bootstrapDir, 'tools-self-contained'));

// Migrate schemas
totalMigrated += migrateDirectory(path.join(bootstrapDir, 'schemas'));

// Migrate system files
totalMigrated += migrateDirectory(path.join(bootstrapDir, 'system'));

// Migrate templates
totalMigrated += migrateDirectory(path.join(bootstrapDir, 'templates'));

// Migrate knowledge
totalMigrated += migrateDirectory(path.join(bootstrapDir, 'knowledge'));

// Migrate pages
totalMigrated += migrateDirectory(path.join(bootstrapDir, 'pages'));

// Migrate states
totalMigrated += migrateDirectory(path.join(bootstrapDir, 'states'));

// Migrate themes
totalMigrated += migrateDirectory(path.join(bootstrapDir, 'themes'));

console.log('\n📊 Migration Summary:');
console.log(`   Total files migrated: ${totalMigrated}`);
console.log(`   Backups created: ${totalMigrated} (.backup files)`);
console.log('');
console.log('✅ Migration complete!');
console.log('');
console.log('Next steps:');
console.log('1. Review changes: git diff bootstrap-breadcrumbs/');
console.log('2. Test bootstrap: cd bootstrap-breadcrumbs && node bootstrap.js');
console.log('3. If successful, delete .backup files');
console.log('4. If issues, restore: find bootstrap-breadcrumbs -name "*.backup" -exec bash -c \'mv "$0" "${0%.backup}"\' {} \\;');

