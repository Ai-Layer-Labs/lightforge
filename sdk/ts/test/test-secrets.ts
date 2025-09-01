/**
 * Test secret management functionality in enhanced SDK
 */

import { RcrtClientEnhanced } from '../index-enhanced';

async function testSecretManagement() {
  console.log('Testing secret management...\n');
  
  const client = new RcrtClientEnhanced(
    process.env.RCRT_URL || 'http://localhost:8081'
  );
  
  const WORKSPACE = 'workspace:test-secrets';
  
  try {
    // 1. Create a secrets vault
    console.log('1. Creating secrets vault...');
    const vault = await client.createSecretVault(
      WORKSPACE,
      {
        OPENROUTER_API_KEY: 'sk-or-test-123',
        BRAVE_SEARCH_API_KEY: 'BSA-test-456',
        POSTGRES_CONNECTION: 'postgresql://test:test@localhost/testdb',
        STRIPE_SECRET_KEY: 'sk_test_789'
      },
      {
        rotation_schedule: '30d',
        encryption: 'aes-256-gcm'
      }
    );
    console.log(`✓ Created vault: ${vault.id}\n`);
    
    // 2. Retrieve secrets by workspace
    console.log('2. Retrieving secrets by workspace...');
    const secrets = await client.getSecrets({
      workspace_tag: WORKSPACE
    });
    console.log(`✓ Found ${Object.keys(secrets).length} secrets:`, Object.keys(secrets), '\n');
    
    // 3. Retrieve secrets by ID
    console.log('3. Retrieving secrets by ID...');
    const secretsById = await client.getSecrets({
      breadcrumb_id: vault.id
    });
    console.log(`✓ Retrieved secrets by ID\n`);
    
    // 4. Log secret access (audit trail)
    console.log('4. Logging secret access...');
    await client.logSecretAccess(
      'test-node-001',
      ['OPENROUTER_API_KEY', 'BRAVE_SEARCH_API_KEY', 'NONEXISTENT_KEY'],
      ['OPENROUTER_API_KEY', 'BRAVE_SEARCH_API_KEY'],
      WORKSPACE
    );
    console.log('✓ Logged secret access\n');
    
    // 5. Update secrets (add new key)
    console.log('5. Adding new secret...');
    const vaultBreadcrumb = await client.getBreadcrumb(vault.id);
    const updated = await client.updateSecrets(
      vault.id,
      vaultBreadcrumb.version,
      {
        add: {
          TWILIO_AUTH_TOKEN: 'auth-token-xyz'
        }
      }
    );
    console.log(`✓ Added new secret, version: ${updated.version}\n`);
    
    // 6. Rotate a secret
    console.log('6. Rotating a secret...');
    const rotated = await client.rotateSecret(
      vault.id,
      updated.version,
      'OPENROUTER_API_KEY',
      'sk-or-new-rotated-456'
    );
    console.log(`✓ Rotated secret, new version: ${rotated.version}\n`);
    
    // 7. Remove secrets
    console.log('7. Removing secrets...');
    const removed = await client.updateSecrets(
      vault.id,
      rotated.version,
      {
        remove: ['STRIPE_SECRET_KEY']
      }
    );
    console.log(`✓ Removed secret, version: ${removed.version}\n`);
    
    // 8. Verify final state
    console.log('8. Verifying final state...');
    const finalSecrets = await client.getSecrets({
      breadcrumb_id: vault.id
    });
    console.log('Final secrets:', Object.keys(finalSecrets));
    
    // Verify rotation worked
    if (finalSecrets.OPENROUTER_API_KEY === 'sk-or-new-rotated-456') {
      console.log('✓ Secret rotation verified');
    } else {
      throw new Error('Secret rotation failed');
    }
    
    // Verify removal worked
    if (!finalSecrets.STRIPE_SECRET_KEY) {
      console.log('✓ Secret removal verified');
    } else {
      throw new Error('Secret removal failed');
    }
    
    // 9. Search for audit logs
    console.log('\n9. Searching for audit logs...');
    const auditLogs = await client.searchBreadcrumbs({
      tags: ['security:audit', WORKSPACE]
    });
    console.log(`✓ Found ${auditLogs.length} audit log entries\n`);
    
    // 10. Test error handling
    console.log('10. Testing error handling...');
    try {
      await client.getSecrets({
        workspace_tag: 'workspace:nonexistent'
      });
      throw new Error('Should have thrown error for missing vault');
    } catch (e: any) {
      if (e.message === 'No secrets vault found') {
        console.log('✓ Error handling works correctly\n');
      } else {
        throw e;
      }
    }
    
    console.log('✅ All secret management tests passed!');
    
    // Cleanup
    console.log('\nCleaning up test data...');
    await client.deleteBreadcrumb(vault.id);
    const cleanupAudits = await client.searchBreadcrumbs({
      tags: ['security:audit', WORKSPACE]
    });
    for (const audit of cleanupAudits) {
      await client.deleteBreadcrumb(audit.id);
    }
    console.log('✓ Cleanup complete');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testSecretManagement().catch(console.error);
