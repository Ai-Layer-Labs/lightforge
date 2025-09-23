import fetch from 'node-fetch';

async function getAgentDefinition() {
  const config = {
    rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
    ownerId: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
    agentId: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000AAA',
  };

  try {
    // Get JWT token
    const tokenResp = await fetch(`${config.rcrtBaseUrl}/auth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        owner_id: config.ownerId,
        agent_id: config.agentId,
        roles: ['curator', 'emitter', 'subscriber']
      })
    });

    const { token: jwtToken } = await tokenResp.json();

    // Get agent definitions
    const agentsResp = await fetch(`${config.rcrtBaseUrl}/breadcrumbs?schema_name=agent.def.v1`, {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });

    const agents = await agentsResp.json();
    
    if (agents.length > 0) {
      console.log('Found', agents.length, 'agent definitions');
      
      // Get full definition of first agent
      const fullResp = await fetch(`${config.rcrtBaseUrl}/breadcrumbs/${agents[0].id}`, {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      
      const fullAgent = await fullResp.json();
      console.log('\nFull agent definition:');
      console.log(JSON.stringify(fullAgent, null, 2));
    } else {
      console.log('No agent definitions found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

getAgentDefinition();
