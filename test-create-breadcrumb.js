async function testCreateBreadcrumb() {
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

    // Create a test breadcrumb
    const testBreadcrumb = {
      schema_name: 'test.schema.v1',
      title: 'Test Breadcrumb',
      tags: ['test', 'debug'],
      context: {
        message: 'This is a test',
        timestamp: new Date().toISOString()
      }
    };

    console.log('\n📝 Creating breadcrumb:', JSON.stringify(testBreadcrumb, null, 2));

    const createResp = await fetch('http://localhost:8081/breadcrumbs', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testBreadcrumb)
    });

    if (!createResp.ok) {
      console.error('Failed to create:', await createResp.text());
      return;
    }

    const created = await createResp.json();
    console.log('\n✅ Created breadcrumb:', created);

    // Now fetch it back
    const getResp = await fetch(`http://localhost:8081/breadcrumbs/${created.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const fetched = await getResp.json();
    console.log('\n📋 Fetched breadcrumb:');
    console.log('  ID:', fetched.id);
    console.log('  Schema:', fetched.schema_name);
    console.log('  Title:', fetched.title);
    console.log('  Tags:', fetched.tags);

  } catch (error) {
    console.error('Error:', error);
  }
}

testCreateBreadcrumb();
