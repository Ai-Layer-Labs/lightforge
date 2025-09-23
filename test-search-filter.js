// Test schema_name filtering in search

async function testSearchFilter() {
  try {
    const tokenResp = await fetch('http://localhost:8081/auth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        owner_id: '00000000-0000-0000-0000-000000000001',
        agent_id: '00000000-0000-0000-0000-000000000AAA',
        roles: ['curator', 'emitter', 'subscriber']
      })
    });
    const { token } = await tokenResp.json();
    
    console.log('🔍 Testing search filtering by schema_name...\n');

    // Search for agent.def.v1
    const agentDefResp = await fetch('http://localhost:8081/breadcrumbs?schema_name=agent.def.v1&tag=workspace:agents', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const agentDefs = await agentDefResp.json();
    
    console.log(`📋 Found ${agentDefs.length} breadcrumbs with schema_name=agent.def.v1 and tag=workspace:agents:`);
    
    for (const def of agentDefs) {
      // Fetch full breadcrumb to see actual schema
      const fullResp = await fetch(`http://localhost:8081/breadcrumbs/${def.id}/full`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const full = await fullResp.json();
      
      console.log(`\n• ${def.title} (${def.id})`);
      console.log(`  Tags: ${def.tags.join(', ')}`);
      console.log(`  Schema in search result: ${def.schema_name || 'MISSING'}`);
      console.log(`  Schema in full view: ${full.schema_name || 'MISSING'}`);
      console.log(`  Agent ID in context: ${full.context?.agent_id || 'MISSING'}`);
    }

    // Now search for agent.catalog.v1
    console.log('\n---\n');
    const catalogResp = await fetch('http://localhost:8081/breadcrumbs?schema_name=agent.catalog.v1', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const catalogs = await catalogResp.json();
    
    console.log(`📚 Found ${catalogs.length} breadcrumbs with schema_name=agent.catalog.v1:`);
    for (const cat of catalogs.slice(0, 3)) {
      console.log(`• ${cat.title} - Schema: ${cat.schema_name || 'MISSING'}`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testSearchFilter();
