async function cleanBadAgents() {
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

    // Get all agent definitions
    const agentsResp = await fetch('http://localhost:8081/breadcrumbs?schema_name=agent.def.v1&tag=workspace:agents', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const agents = await agentsResp.json();
    
    // Delete agents without agent_id
    for (const agent of agents) {
      if (agent.title !== 'Default Chat Agent') {
        console.log(`🗑️  Deleting: ${agent.title} (${agent.id})`);
        
        const deleteResp = await fetch(`http://localhost:8081/breadcrumbs/${agent.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (deleteResp.ok) {
          console.log('   ✅ Deleted');
        } else {
          console.log('   ❌ Failed:', await deleteResp.text());
        }
      }
    }
    
    console.log('\n✅ Cleanup complete');
  } catch (error) {
    console.error('Error:', error);
  }
}

cleanBadAgents();
