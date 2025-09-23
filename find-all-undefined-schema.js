async function findUndefinedSchema() {
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

    // Get ALL breadcrumbs
    const response = await fetch('http://localhost:8081/breadcrumbs?limit=100', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const breadcrumbs = await response.json();
    
    console.log(`\n📋 Checking ${breadcrumbs.length} breadcrumbs for undefined schemas:\n`);

    const undefinedSchemas = breadcrumbs.filter(b => !b.schema_name || b.schema_name === 'undefined');
    
    for (const b of undefinedSchemas) {
      console.log(`❌ Undefined schema found:`);
      console.log(`   ID: ${b.id}`);
      console.log(`   Title: ${b.title}`);
      console.log(`   Tags: ${b.tags.join(', ')}`);
      console.log(`   Created: ${b.created_at}`);
      console.log('');
    }

    if (undefinedSchemas.length === 0) {
      console.log('✅ No breadcrumbs with undefined schema found');
    } else {
      console.log(`❌ Found ${undefinedSchemas.length} breadcrumbs with undefined schema`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

findUndefinedSchema();
