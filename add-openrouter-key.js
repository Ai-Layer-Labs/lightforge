// Script to add OpenRouter API key to RCRT secrets
import fetch from 'node-fetch';

async function addOpenRouterKey() {
  const config = {
    rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
    ownerId: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
    agentId: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000AAA',
    openRouterKey: process.env.OPENROUTER_API_KEY
  };

  if (!config.openRouterKey) {
    console.error('❌ OPENROUTER_API_KEY environment variable not set!');
    console.log('\nPlease set it first:');
    console.log('export OPENROUTER_API_KEY=sk-or-v1-your-key-here');
    process.exit(1);
  }

  console.log('🔐 Adding OpenRouter API key to RCRT secrets...\n');

  try {
    // Get JWT token with curator role
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
    console.log('🔑 Got JWT token\n');

    // Check if secret already exists
    const listResp = await fetch(`${config.rcrtBaseUrl}/secrets?scope_type=tool`, {
      headers: {
        'Authorization': `Bearer ${jwtToken}`
      }
    });

    const existingSecrets = await listResp.json();
    const existingOpenRouterKey = existingSecrets.find(s => s.name === 'OPENROUTER_API_KEY');

    if (existingOpenRouterKey) {
      console.log('⚠️  OPENROUTER_API_KEY already exists!');
      console.log('   ID:', existingOpenRouterKey.id);
      console.log('\nTo update it, first delete the existing one:');
      console.log(`DELETE ${config.rcrtBaseUrl}/secrets/${existingOpenRouterKey.id}`);
      return;
    }

    // Create the secret
    const createResp = await fetch(`${config.rcrtBaseUrl}/secrets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'OPENROUTER_API_KEY',
        scope_type: 'tool',  // Scoped to tools
        value: config.openRouterKey
      })
    });

    if (!createResp.ok) {
      const error = await createResp.text();
      throw new Error(`Failed to create secret: ${error}`);
    }

    const result = await createResp.json();
    console.log('✅ OpenRouter API key created successfully!');
    console.log('   Secret ID:', result.id);
    console.log('   Name: OPENROUTER_API_KEY');
    console.log('   Scope: tool');

    // Restart tools-runner to pick up the new secret
    console.log('\n📌 Next steps:');
    console.log('1. Restart the tools-runner to pick up the new secret:');
    console.log('   docker compose restart tools-runner');
    console.log('\n2. The OpenRouter tool will now use this key automatically!');

  } catch (error) {
    console.error('❌ Failed to add OpenRouter key:', error);
  }
}

// Run the script
addOpenRouterKey();
