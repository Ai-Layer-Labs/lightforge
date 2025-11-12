#!/usr/bin/env node
/**
 * Hot-reload breadcrumb from JSON file into running RCRT system
 * 
 * Usage:
 *   node scripts/update-breadcrumb.js path/to/breadcrumb.json
 *   node scripts/update-breadcrumb.js bootstrap-breadcrumbs/system/validation-specialist-agent.json
 */

const fs = require('fs');
const path = require('path');

const RCRT_URL = process.env.RCRT_URL || 'http://localhost:8081';

async function getToken() {
  const response = await fetch(`${RCRT_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner_id: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
      agent_id: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000001',
      roles: ['curator', 'emitter', 'subscriber']
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get token: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.token;
}

async function findExistingBreadcrumb(token, breadcrumb) {
  // Search by schema + unique tag (agent:X or tool:X)
  const schema = breadcrumb.schema_name;
  
  // For agents: search by agent:{agent-id} tag
  if (schema === 'agent.def.v1' && breadcrumb.context?.agent_id) {
    const agentTag = `agent:${breadcrumb.context.agent_id}`;
    const response = await fetch(`${RCRT_URL}/breadcrumbs?schema_name=${schema}&tag=${encodeURIComponent(agentTag)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const breadcrumbs = await response.json();
      if (breadcrumbs.length > 0) {
        console.log(`   Found by tag: ${agentTag}`);
        return breadcrumbs[0];
      }
    }
  }
  
  // For tools: search by tool:{name} tag
  if (schema === 'tool.code.v1' && breadcrumb.context?.name) {
    const toolTag = `tool:${breadcrumb.context.name}`;
    const response = await fetch(`${RCRT_URL}/breadcrumbs?schema_name=${schema}&tag=${encodeURIComponent(toolTag)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const breadcrumbs = await response.json();
      if (breadcrumbs.length > 0) {
        console.log(`   Found by tag: ${toolTag}`);
        return breadcrumbs[0];
      }
    }
  }
  
  // For other schemas: search by schema + title
  const response = await fetch(`${RCRT_URL}/breadcrumbs?schema_name=${encodeURIComponent(schema)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (response.ok) {
    const breadcrumbs = await response.json();
    const existing = breadcrumbs.find(b => b.title === breadcrumb.title);
    if (existing) {
      console.log(`   Found by title: ${breadcrumb.title}`);
    }
    return existing;
  }
  
  return null;
}

async function updateBreadcrumb(filePath) {
  console.log('📄 Reading:', filePath);
  
  // Read and parse JSON file
  const content = fs.readFileSync(filePath, 'utf-8');
  const breadcrumb = JSON.parse(content);
  
  console.log('📋 Schema:', breadcrumb.schema_name);
  console.log('📌 Title:', breadcrumb.title);
  console.log('🏷️  Tags:', breadcrumb.tags.join(', '));
  
  // Get auth token
  console.log('\n🔐 Getting auth token...');
  const token = await getToken();
  console.log('✅ Authenticated');
  
  // Find existing breadcrumb
  console.log('\n🔍 Searching for existing breadcrumb...');
  const existing = await findExistingBreadcrumb(token, breadcrumb);
  
  if (existing) {
    // UPDATE existing
    console.log(`✅ Found existing: ${existing.id} (version ${existing.version})`);
    console.log('\n📝 Updating breadcrumb...');
    
    const response = await fetch(`${RCRT_URL}/breadcrumbs/${existing.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'If-Match': String(existing.version)
      },
      body: JSON.stringify({
        title: breadcrumb.title,
        description: breadcrumb.description,
        semantic_version: breadcrumb.semantic_version,
        context: breadcrumb.context,
        tags: breadcrumb.tags,
        schema_name: breadcrumb.schema_name,
        llm_hints: breadcrumb.llm_hints
      })
    });
    
    if (response.ok) {
      console.log('✅ Breadcrumb updated successfully!');
      console.log(`📍 ID: ${existing.id}`);
      console.log(`📈 Version: ${existing.version} → ${existing.version + 1}`);
      
      // For agent definitions, suggest restarting agent-runner
      if (breadcrumb.schema_name === 'agent.def.v1') {
        console.log('\n💡 Agent definition updated. Restart agent-runner to reload:');
        console.log('   docker compose restart agent-runner');
      }
      
      // For tools, they auto-reload via SSE
      if (breadcrumb.schema_name === 'tool.code.v1') {
        console.log('\n💡 Tool updated. If approved, tools-runner will auto-reload via SSE.');
      }
    } else {
      const error = await response.text();
      console.error('❌ Failed to update:', error);
      process.exit(1);
    }
  } else {
    // CREATE new
    console.log('❌ Not found - creating new breadcrumb...');
    
    const response = await fetch(`${RCRT_URL}/breadcrumbs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: breadcrumb.title,
        description: breadcrumb.description,
        semantic_version: breadcrumb.semantic_version,
        context: breadcrumb.context,
        tags: breadcrumb.tags,
        schema_name: breadcrumb.schema_name,
        llm_hints: breadcrumb.llm_hints
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Breadcrumb created successfully!');
      console.log(`📍 ID: ${result.id}`);
    } else {
      const error = await response.text();
      console.error('❌ Failed to create:', error);
      process.exit(1);
    }
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node scripts/update-breadcrumb.js <path-to-json-file>');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/update-breadcrumb.js bootstrap-breadcrumbs/system/validation-specialist-agent.json');
  console.log('  node scripts/update-breadcrumb.js bootstrap-breadcrumbs/tools-self-contained/openrouter.json');
  console.log('');
  console.log('Environment variables:');
  console.log('  RCRT_URL (default: http://localhost:8081)');
  console.log('  OWNER_ID (default: 00000000-0000-0000-0000-000000000001)');
  console.log('  AGENT_ID (default: 00000000-0000-0000-0000-000000000001)');
  process.exit(1);
}

const filePath = args[0];

if (!fs.existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  process.exit(1);
}

updateBreadcrumb(filePath)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });

