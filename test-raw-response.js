async function testRawResponse() {
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

    // Get the test breadcrumb
    const testId = '1d06a30c-2f0d-4040-997e-c3b80fc393c4';
    
    // First get context view
    const contextResp = await fetch(`http://localhost:8081/breadcrumbs/${testId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const contextData = await contextResp.json();
    console.log('\n📋 Context view response:');
    console.log(JSON.stringify(contextData, null, 2));

    // Then get full view
    const fullResp = await fetch(`http://localhost:8081/breadcrumbs/${testId}/full`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const fullData = await fullResp.json();
    console.log('\n📋 Full view response:');
    console.log(JSON.stringify(fullData, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

testRawResponse();
