async function cleanupAgentDefs() {
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
    const response = await fetch('http://localhost:8081/breadcrumbs?schema_name=agent.def.v1&limit=2000', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const agentDefs = await response.json();
    console.log(`Found ${agentDefs.length} agent definitions`);

    let deleted = 0;
    let kept = 0;

    for (const def of agentDefs) {
      // Only keep the default chat agent
      if (def.title === 'Default Chat Agent') {
        kept++;
        console.log(`✅ Keeping: ${def.title}`);
      } else {
        try {
          await fetch(`http://localhost:8081/breadcrumbs/${def.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          deleted++;
          if (deleted % 100 === 0) console.log(`Deleted ${deleted} definitions...`);
        } catch (e) {
          console.error(`Failed to delete ${def.id}:`, e.message);
        }
      }
    }

    console.log(`\n✅ Cleanup complete:`);
    console.log(`   Deleted: ${deleted} agent definitions`);
    console.log(`   Kept: ${kept} agent definitions`);

  } catch (error) {
    console.error('Error:', error);
  }
}

cleanupAgentDefs();
