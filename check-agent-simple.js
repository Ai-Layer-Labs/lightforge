async function checkAgent() {
  try {
    // Get JWT token
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

    // Get agent definitions with schema_name filter
    const agentsResp = await fetch('http://localhost:8081/breadcrumbs?schema_name=agent.def.v1', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const agents = await agentsResp.json();
    console.log(`\n📋 Found ${agents.length} agent definitions`);
    
    for (const agent of agents) {
      console.log(`\nAgent: ${agent.title} (${agent.id})`);
      
      // Get full definition
      const fullResp = await fetch(`http://localhost:8081/breadcrumbs/${agent.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const fullAgent = await fullResp.json();
      console.log('Context keys:', Object.keys(fullAgent.context));
      console.log('Has agent_id?', 'agent_id' in fullAgent.context);
      
      // Check structure
      if (fullAgent.context.agent_id) {
        console.log('✅ agent_id found:', fullAgent.context.agent_id);
      } else {
        console.log('❌ No agent_id in context!');
        console.log('Context:', JSON.stringify(fullAgent.context, null, 2));
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAgent();
