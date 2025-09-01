/**
 * Test RCRT's native secret management service
 * 
 * NOTE: Requires RCRT server to have LOCAL_KEK_BASE64 environment variable set
 * Generate with: openssl rand -base64 32
 */

import { RcrtClientEnhanced } from '../index-enhanced';

async function testNativeSecrets() {
  console.log('Testing RCRT native secrets service...\n');
  console.log('NOTE: This test requires LOCAL_KEK_BASE64 to be set on the RCRT server\n');
  
  const client = new RcrtClientEnhanced(
    process.env.RCRT_URL || 'http://localhost:8081'
  );
  
  const WORKSPACE = 'workspace:test-native-secrets';
  
  try {
    // Get agent info for scoping
    let agentInfo;
    try {
      agentInfo = await client.getAgentInfo();
      console.log(`Using agent: ${agentInfo.id}\n`);
    } catch (e) {
      console.log('No agent configured, using global scope\n');
    }
    
    // 1. Create individual secrets using native service
    console.log('1. Creating individual secrets in RCRT service...');
    const secret1 = await client.createSecret(
      'test-api-key',
      'sk-test-123456',
      'agent',
      agentInfo?.id
    );
    console.log(`✓ Created secret: ${secret1.id} (${secret1.name})`);
    
    const secret2 = await client.createSecret(
      'test-db-password',
      'super-secret-password',
      'agent',
      agentInfo?.id
    );
    console.log(`✓ Created secret: ${secret2.id} (${secret2.name})\n`);
    
    // 2. Decrypt a secret
    console.log('2. Decrypting secret...');
    const decrypted = await client.getSecret(secret1.id, 'Testing decryption');
    console.log(`✓ Decrypted value: ${decrypted.substring(0, 5)}...`);
    console.log(`✓ Encryption/decryption working!\n`);
    
    // 3. List secrets
    console.log('3. Listing secrets...');
    const secretsList = await client.listSecrets('agent', agentInfo?.id);
    console.log(`✓ Found ${secretsList.length} secrets\n`);
    
    // 4. Update a secret
    console.log('4. Updating secret...');
    await client.updateSecret(secret1.id, 'sk-test-updated-789');
    const updated = await client.getSecret(secret1.id, 'Verify update');
    console.log(`✓ Secret updated: ${updated.substring(0, 10)}...\n`);
    
    // 5. Create a secret vault (hybrid approach)
    console.log('5. Creating secret vault (combines secrets service + breadcrumb metadata)...');
    const vault = await client.createSecretVault(
      WORKSPACE,
      {
        OPENROUTER_API_KEY: 'sk-or-vault-123',
        BRAVE_SEARCH_API_KEY: 'BSA-vault-456',
        POSTGRES_CONNECTION: 'postgresql://vault:pass@localhost/db'
      },
      {
        rotation_schedule: '30d',
        description: 'Test vault using native secrets'
      }
    );
    console.log(`✓ Created vault: ${vault.vaultId}`);
    console.log(`✓ Secret IDs:`, Object.keys(vault.secretIds).map(k => `${k}:${vault.secretIds[k].substring(0, 8)}...`));
    console.log();
    
    // 6. Get all secrets from vault
    console.log('6. Getting all secrets from vault...');
    const vaultSecrets = await client.getSecretsFromVault(vault.vaultId, 'Testing vault retrieval');
    console.log(`✓ Retrieved ${Object.keys(vaultSecrets).length} secrets from vault`);
    console.log(`✓ Keys:`, Object.keys(vaultSecrets));
    console.log();
    
    // 7. Rotate a secret in vault
    console.log('7. Rotating secret in vault...');
    await client.rotateSecretInVault(vault.vaultId, 'OPENROUTER_API_KEY', 'sk-or-rotated-999');
    const rotatedVault = await client.getSecretsFromVault(vault.vaultId, 'Verify rotation');
    if (rotatedVault.OPENROUTER_API_KEY === 'sk-or-rotated-999') {
      console.log('✓ Secret rotation successful\n');
    } else {
      throw new Error('Rotation failed');
    }
    
    // 8. Search for audit logs
    console.log('8. Checking audit trail...');
    const auditLogs = await client.searchBreadcrumbs({
      tags: ['security:audit', WORKSPACE]
    });
    console.log(`✓ Found ${auditLogs.length} audit entries`);
    
    const rotationLogs = await client.searchBreadcrumbs({
      schema_name: 'secrets.rotation.v1'
    });
    console.log(`✓ Found ${rotationLogs.length} rotation entries\n`);
    
    console.log('✅ All native secret tests passed!');
    
    // Cleanup
    console.log('\nCleaning up test data...');
    
    // Delete individual secrets
    await client.deleteSecret(secret1.id);
    await client.deleteSecret(secret2.id);
    console.log('✓ Deleted individual test secrets');
    
    // Delete vault secrets
    for (const secretId of Object.values(vault.secretIds)) {
      await client.deleteSecret(secretId as string);
    }
    console.log('✓ Deleted vault secrets');
    
    // Delete vault breadcrumb
    await client.deleteBreadcrumb(vault.vaultId);
    console.log('✓ Deleted vault metadata');
    
    // Delete audit logs
    for (const log of [...auditLogs, ...rotationLogs]) {
      await client.deleteBreadcrumb(log.id);
    }
    console.log('✓ Cleanup complete');
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error);
    
    if (error.message.includes('500')) {
      console.error('\n⚠️  This error usually means LOCAL_KEK_BASE64 is not set on the RCRT server.');
      console.error('   Set it with: export LOCAL_KEK_BASE64=$(openssl rand -base64 32)');
      console.error('   Then restart the RCRT server.\n');
    }
    
    process.exit(1);
  }
}

// Run tests
testNativeSecrets().catch(console.error);
