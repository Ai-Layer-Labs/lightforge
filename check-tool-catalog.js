// Check tool catalog

async function checkToolCatalog() {
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
    
    // Search for tool catalog
    const catalogResp = await fetch('http://localhost:8081/breadcrumbs?schema_name=tool.catalog.v1&tag=workspace:tools', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const catalogs = await catalogResp.json();
    console.log(`📚 Found ${catalogs.length} tool catalogs`);
    
    if (catalogs.length > 0) {
      // Get the full catalog
      const fullResp = await fetch(`http://localhost:8081/breadcrumbs/${catalogs[0].id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const catalog = await fullResp.json();
      
      console.log('\n📋 Tool Catalog Details:');
      console.log('ID:', catalog.id);
      console.log('Title:', catalog.title);
      console.log('Schema:', catalog.schema_name || 'MISSING');
      console.log('Tags:', catalog.tags);
      console.log('\nContext:', JSON.stringify(catalog.context, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkToolCatalog();
