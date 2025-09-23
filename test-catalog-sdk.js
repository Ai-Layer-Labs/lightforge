// Test catalog creation directly

async function testCatalogCreation() {
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
    
    console.log('🧪 Testing catalog creation with explicit schema_name...\n');

    // Create a catalog breadcrumb via API
    const createResp = await fetch('http://localhost:8081/breadcrumbs', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        schema_name: 'agent.catalog.v1',
        title: 'Test Agent Catalog',
        tags: ['workspace:test', 'agent:catalog'],
        context: {
          workspace: 'workspace:test',
          agents: [],
          totalAgents: 0,
          activeAgents: 0,
          lastUpdated: new Date().toISOString()
        }
      })
    });

    const created = await createResp.json();
    console.log('✅ Created catalog:', created);

    // Fetch it back
    const getResp = await fetch(`http://localhost:8081/breadcrumbs/${created.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const fetched = await getResp.json();
    console.log('\n📋 Fetched catalog:');
    console.log('  ID:', fetched.id);
    console.log('  Schema:', fetched.schema_name);
    console.log('  Title:', fetched.title);
    console.log('  Tags:', fetched.tags);

    // Also check how it appears in search
    const searchResp = await fetch('http://localhost:8081/breadcrumbs?schema_name=agent.catalog.v1', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const searchResults = await searchResp.json();
    console.log('\n🔍 Search results for agent.catalog.v1:', searchResults.length);

  } catch (error) {
    console.error('Error:', error);
  }
}

testCatalogCreation();
