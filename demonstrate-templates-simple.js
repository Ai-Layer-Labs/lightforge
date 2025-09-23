// Simple demonstration of template usage without SDK dependency
import fetch from 'node-fetch';

async function demonstrateTemplateUsage() {
  console.log('🎭 Demonstrating Template Usage\n');
  
  const config = {
    rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
    ownerId: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
    agentId: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000AAA',
  };

  // Get token
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
  console.log('🔐 Got JWT token\n');

  // Helper to make API calls
  async function api(path, options = {}) {
    const resp = await fetch(`${config.rcrtBaseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    return resp.json();
  }

  // 1. Discover Templates
  console.log('1️⃣ Discovering Templates\n');
  
  const templates = await api('/breadcrumbs?tag=template:');
  console.log(`Found ${templates.length} templates:`);
  templates.forEach(t => {
    console.log(`  - ${t.title}`);
  });

  // 2. Get a specific template with context view
  console.log('\n2️⃣ Examining Tool Catalog Template\n');
  
  const toolTemplate = templates.find(t => t.title.includes('Tool Catalog Template'));
  if (toolTemplate) {
    // Get context view (llm_hints applied)
    const contextView = await api(`/breadcrumbs/${toolTemplate.id}`);
    console.log('Context View (what LLMs see):');
    console.log(JSON.stringify(contextView.context, null, 2));
  }

  // 3. Create a breadcrumb following template pattern
  console.log('\n3️⃣ Creating Catalog with llm_hints\n');
  
  const newCatalog = {
    schema_name: 'demo.catalog.v1',
    title: 'Demo Catalog with Transform',
    tags: ['demo:catalog', 'has:llm-hints'],
    context: {
      items: [
        { name: 'Item A', status: 'active', details: 'Complex details...' },
        { name: 'Item B', status: 'pending', details: 'More details...' },
        { name: 'Item C', status: 'active', details: 'Even more...' }
      ],
      metadata: {
        created: new Date().toISOString(),
        internal_id: 'INTERNAL-123'
      }
    },
    llm_hints: {
      transform: {
        summary: {
          type: 'template',
          template: '{{context.items.length}} items: {{#each context.items}}{{name}} ({{status}}){{#unless @last}}, {{/unless}}{{/each}}'
        },
        active_count: {
          type: 'literal',
          literal: 2
        }
      },
      exclude: ['metadata.internal_id'],
      mode: 'replace'
    }
  };

  const created = await api('/breadcrumbs', {
    method: 'POST',
    body: JSON.stringify(newCatalog)
  });
  console.log(`✅ Created: ${created.id}`);

  // 4. Fetch and compare views
  console.log('\n4️⃣ Comparing Views\n');
  
  // Context view (with transforms)
  const contextView = await api(`/breadcrumbs/${created.id}`);
  console.log('Context View (transformed):');
  console.log(JSON.stringify(contextView.context, null, 2));
  
  // Note: Full view requires curator access
  console.log('\n(Full view would show original data + llm_hints)');

  // 5. Show transform pattern
  console.log('\n5️⃣ Transform Pattern Summary\n');
  console.log('The llm_hints transformed:');
  console.log('  - 3 full item objects → concise summary string');
  console.log('  - Excluded internal_id from metadata');
  console.log('  - Added computed active_count field');
  console.log('\nThis reduces tokens while preserving key information!');
}

// Run demonstration
demonstrateTemplateUsage().catch(console.error);
