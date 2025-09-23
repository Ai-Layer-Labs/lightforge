async function deleteBadAgent() {
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

    // Delete the bad agent
    const badAgentId = 'b5172a95-11cc-4cef-b9e3-9e031cb0920d';
    
    const deleteResp = await fetch(`http://localhost:8081/breadcrumbs/${badAgentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (deleteResp.ok) {
      console.log('✅ Deleted bad agent definition');
    } else {
      console.log('❌ Failed to delete:', await deleteResp.text());
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

deleteBadAgent();
