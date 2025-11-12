#!/usr/bin/env node
/**
 * Update all knowledge and tool files with pointer tags
 * Part of pointer-tag unification project
 */

const fs = require('fs');
const path = require('path');

// Tag mappings for different file types
const KNOWLEDGE_POINTER_TAGS = {
  'validation-rules-v1.json': ['validation', 'security', 'code-analysis', 'pattern-matching', 'deno', 'typescript'],
  'tool-validation-rules.json': ['validation', 'security', 'code-analysis', 'tools'],
  'astral-browser-automation.json': ['browser-automation', 'playwright', 'puppeteer', 'web-scraping', 'testing', 'security'],
  'how-to-create-tools.json': ['tool-creation', 'documentation', 'guide', 'typescript', 'deno'],
  'creating-tools-with-agent.json': ['tool-creation', 'agent-coordination', 'workflow', 'documentation'],
  'breadcrumb-system.json': ['breadcrumbs', 'documentation', 'architecture', 'database'],
  'context-builder-explained.json': ['context-assembly', 'semantic-search', 'graph', 'architecture'],
  'event-driven-architecture.json': ['events', 'architecture', 'sse', 'nats', 'real-time'],
  'fire-and-forget-pattern.json': ['architecture', 'patterns', 'async', 'scalability'],
  'how-agents-work.json': ['agents', 'documentation', 'architecture', 'llm-integration'],
  'llm-hints-deep-dive.json': ['llm-integration', 'optimization', 'documentation', 'transform'],
  'multi-agent-coordination.json': ['agents', 'coordination', 'workflow', 'architecture'],
  'rcrt-quick-start.json': ['documentation', 'quickstart', 'guide', 'getting-started'],
  'session-management.json': ['sessions', 'conversations', 'state-management', 'documentation'],
  'common-patterns.json': ['patterns', 'documentation', 'best-practices', 'examples'],
  'vector-search-semantic.json': ['semantic-search', 'vector', 'embeddings', 'search']
};

function updateKnowledgeFile(filePath) {
  const fileName = path.basename(filePath);
  
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    const pointerTags = KNOWLEDGE_POINTER_TAGS[fileName] || ['documentation', 'knowledge'];
    
    // Update tags: workspace:knowledge + pointer tags
    const newTags = ['workspace:knowledge', ...pointerTags];
    content.tags = newTags;
    
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
    console.log(`✅ Updated ${fileName}: ${pointerTags.length} pointer tags`);
  } catch (error) {
    console.error(`❌ Failed to update ${fileName}: ${error.message}`);
  }
}

function updateToolFile(filePath) {
  const fileName = path.basename(filePath);
  
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  // Remove 'self-contained' tag (all tool.code.v1 are self-contained)
  const filteredTags = content.tags.filter(t => t !== 'self-contained');
  
  // Add pointer tags based on tool type
  const toolPointers = {
    'openrouter.json': ['llm-integration', 'api-calling', 'openai', 'anthropic'],
    'venice.json': ['llm-integration', 'api-calling', 'venice'],
    'breadcrumb-create.json': ['rcrt-api', 'crud-operations', 'database'],
    'breadcrumb-update.json': ['rcrt-api', 'crud-operations', 'database'],
    'breadcrumb-search.json': ['rcrt-api', 'search', 'query'],
    'echo.json': ['testing', 'demo'],
    'random.json': ['testing', 'demo', 'utility'],
    'timer.json': ['utility', 'async', 'scheduling'],
    'calculator.json': ['utility', 'math'],
    'scheduler.json': ['scheduling', 'async', 'automation'],
    'openrouter-models-sync.json': ['llm-integration', 'catalog', 'sync']
  };
  
  const pointers = toolPointers[fileName] || [];
  
  // Rebuild tags
  const workspaceTags = filteredTags.filter(t => t.startsWith('workspace:'));
  const toolTags = filteredTags.filter(t => t.startsWith('tool:'));
  const stateTags = filteredTags.filter(t => ['approved', 'validated', 'bootstrap'].includes(t));
  const otherTags = filteredTags.filter(t => 
    !t.startsWith('workspace:') && 
    !t.startsWith('tool:') && 
    !['approved', 'validated', 'bootstrap', 'self-contained'].includes(t)
  );
  
  content.tags = [
    'tool',
    ...workspaceTags,
    ...toolTags,
    ...stateTags,
    ...pointers,
    ...otherTags
  ];
  
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
  console.log(`✅ Updated ${fileName}: removed self-contained, added ${pointers.length} pointer tags`);
  } catch (error) {
    console.error(`❌ Failed to update ${fileName}: ${error.message}`);
  }
}

// Main execution
const knowledgeDir = 'bootstrap-breadcrumbs/knowledge';
const toolsDir = 'bootstrap-breadcrumbs/tools-self-contained';

console.log('📚 Updating knowledge files...');
fs.readdirSync(knowledgeDir)
  .filter(f => f.endsWith('.json'))
  .forEach(f => updateKnowledgeFile(path.join(knowledgeDir, f)));

console.log('\n🔧 Updating tool files...');
fs.readdirSync(toolsDir)
  .filter(f => f.endsWith('.json'))
  .forEach(f => updateToolFile(path.join(toolsDir, f)));

console.log('\n✅ Pointer tag update complete!');

