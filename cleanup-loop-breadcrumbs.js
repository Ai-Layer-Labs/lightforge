// Clean up breadcrumbs from the infinite loop

async function cleanupLoopBreadcrumbs() {
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

    // Get error breadcrumbs
    const errorResp = await fetch('http://localhost:8081/breadcrumbs?schema_name=agent.error.v1&limit=100', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const errors = await errorResp.json();
    console.log(`Found ${errors.length} error breadcrumbs`);

    // Get metrics breadcrumbs  
    const metricsResp = await fetch('http://localhost:8081/breadcrumbs?schema_name=agent.metrics.v1&limit=100', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const metrics = await metricsResp.json();
    console.log(`Found ${metrics.length} metrics breadcrumbs`);

    // Get agent responses
    const responseResp = await fetch('http://localhost:8081/breadcrumbs?schema_name=agent.response.v1&limit=100', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const responses = await responseResp.json();
    console.log(`Found ${responses.length} agent response breadcrumbs`);

    // Delete them all
    const allToDelete = [...errors, ...metrics, ...responses];
    console.log(`\n🗑️  Deleting ${allToDelete.length} breadcrumbs from the loop...`);

    let deleted = 0;
    for (const breadcrumb of allToDelete) {
      try {
        // Get current version
        const getResp = await fetch(`http://localhost:8081/breadcrumbs/${breadcrumb.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!getResp.ok) continue;
        
        const current = await getResp.json();
        
        // Delete it
        const deleteResp = await fetch(`http://localhost:8081/breadcrumbs/${breadcrumb.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'If-Match': current.version.toString()
          }
        });
        
        if (deleteResp.ok) {
          deleted++;
          if (deleted % 10 === 0) {
            process.stdout.write('.');
          }
        }
      } catch (e) {
        // Skip errors
      }
    }

    console.log(`\n✅ Deleted ${deleted} breadcrumbs`);

  } catch (error) {
    console.error('Error:', error);
  }
}

cleanupLoopBreadcrumbs();
