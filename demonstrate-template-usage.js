import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Demonstrates how agents discover and use template breadcrumbs
 */
async function demonstrateTemplateUsage() {
  console.log('🎭 Demonstrating Template Usage\n');
  
  // Setup client
  const config = {
    rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
    ownerId: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
    agentId: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000AAA',
  };

  // Get token and create client
  const tokenResp = await fetch(`${config.rcrtBaseUrl}/auth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      owner_id: config.ownerId,
      agent_id: config.agentId,
      roles: ['curator', 'emitter', 'subscriber']
    })
  });

  const { token: jwtToken } = await tokenResp.json();
  const client = new RcrtClientEnhanced(config.rcrtBaseUrl, 'jwt', jwtToken);

  // 1. Discover Templates
  console.log('1️⃣ Discovering Templates\n');
  
  const templates = await client.searchBreadcrumbs({
    any_tags: ['template:', 'guide:']
  });
  
  console.log(`Found ${templates.length} templates:`);
  templates.forEach(t => {
    console.log(`  - ${t.title} (${t.schema_name})`);
  });

  // 2. Analyze a Specific Template
  console.log('\n2️⃣ Analyzing Tool Catalog Template\n');
  
  const toolTemplate = templates.find(t => t.tags.includes('template:tool-catalog'));
  if (toolTemplate) {
    // Get the context view (with llm_hints applied)
    const contextView = await client.getBreadcrumb(toolTemplate.id);
    console.log('Context View (LLM-optimized):');
    console.log(JSON.stringify(contextView.context, null, 2));
    
    // Compare with full view
    try {
      const fullView = await client.getBreadcrumbFull(toolTemplate.id);
      console.log('\nFull View has these top-level keys:');
      console.log(Object.keys(fullView.context));
    } catch (e) {
      console.log('\n(Full view requires curator access)');
    }
  }

  // 3. Apply Template Pattern
  console.log('\n3️⃣ Creating Breadcrumb Using Template Pattern\n');
  
  // Create a tool catalog following the template
  const newCatalog = {
    schema_name: 'tool.catalog.v1',
    title: 'Demo Tool Catalog',
    tags: ['workspace:demo', 'tool:catalog'],
    context: {
      tools: [
        {
          name: 'demo-tool',
          description: 'A demonstration tool',
          category: 'demo',
          inputSchema: { type: 'object', properties: {} }
        }
      ],
      totalTools: 1,
      activeTools: 1,
      lastUpdated: new Date().toISOString()
    },
    // Apply llm_hints pattern from template
    llm_hints: {
      transform: {
        tool_summary: {
          type: 'template',
          template: '{{context.activeTools}} tool available: {{#each context.tools}}{{name}} ({{category}}){{/each}}'
        },
        instruction: {
          type: 'literal',
          literal: 'To use this tool, create a tool.request.v1 breadcrumb'
        }
      },
      mode: 'replace'
    }
  };

  console.log('Creating catalog with llm_hints...');
  const created = await client.createBreadcrumb(newCatalog);
  console.log(`✅ Created: ${created.id}`);

  // 4. Fetch and Show Transform Result
  console.log('\n4️⃣ Viewing Transformed Result\n');
  
  const transformed = await client.getBreadcrumb(created.id);
  console.log('What LLMs will see:');
  console.log(JSON.stringify(transformed.context, null, 2));

  // 5. Learning Summary
  console.log('\n5️⃣ Learning Summary\n');
  console.log('Agents can:');
  console.log('  ✓ Discover templates via tags');
  console.log('  ✓ Analyze template structure');
  console.log('  ✓ Apply patterns when creating breadcrumbs');
  console.log('  ✓ Use llm_hints for self-documenting data');
  console.log('\nThis creates a self-improving system where:');
  console.log('  - Best practices spread through templates');
  console.log('  - Data becomes self-describing for LLMs');
  console.log('  - Patterns evolve based on usage');
}

// Run demonstration
demonstrateTemplateUsage().catch(console.error);
