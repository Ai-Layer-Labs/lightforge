async function checkCatalog() {
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
    console.log('✅ Got JWT token');

    // Get the catalog breadcrumb
    const catalogId = '44c5d1e6-6247-431b-bfd6-65c49d00a37e';
    const response = await fetch(`http://localhost:8081/breadcrumbs/${catalogId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      console.error('Failed to get breadcrumb:', response.statusText);
      return;
    }

    const breadcrumb = await response.json();
    console.log('\n📋 Catalog Breadcrumb Details:');
    console.log('ID:', breadcrumb.id);
    console.log('Schema:', breadcrumb.schema_name);
    console.log('Title:', breadcrumb.title);
    console.log('Tags:', breadcrumb.tags);
    console.log('Context:', JSON.stringify(breadcrumb.context, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

checkCatalog();
