async function listAgents() {
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
    console.log(`\n📋 Found ${agents.length} agent.def.v1 breadcrumbs:`);
    
    for (const agent of agents) {
      console.log(`\n• ${agent.title} (${agent.id})`);
      console.log(`  Tags: ${agent.tags.join(', ')}`);
      
      // Get full definition to check agent_id
      const fullResp = await fetch(`http://localhost:8081/breadcrumbs/${agent.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const fullAgent = await fullResp.json();
      console.log(`  Agent ID: ${fullAgent.context?.agent_id || 'MISSING!'}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

listAgents();
