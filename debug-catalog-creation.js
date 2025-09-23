// Let's trace the catalog creation issue

import { RcrtClient } from './rcrt-visual-builder/packages/sdk/dist/index.js';

async function debugCatalogCreation() {
  try {
    // Get auth token
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
    
    // Initialize SDK
    const client = new RcrtClient({
      baseUrl: 'http://localhost:8081',
      token
    });

    console.log('🧪 Testing SDK createBreadcrumb with explicit schema_name...\n');

    // Test creating a breadcrumb with SDK
    const testBreadcrumb = await client.createBreadcrumb({
      schema_name: 'test.catalog.v1',
      title: 'Test Catalog via SDK',
      tags: ['test', 'catalog'],
      context: {
        test: true,
        created_via: 'SDK'
      }
    });

    console.log('✅ Created breadcrumb:', testBreadcrumb);

    // Now fetch it back
    const fetched = await client.getBreadcrumb(testBreadcrumb.id);
    console.log('\n📋 Fetched breadcrumb:');
    console.log('  ID:', fetched.id);
    console.log('  Schema:', fetched.schema_name);
    console.log('  Title:', fetched.title);

  } catch (error) {
    console.error('Error:', error);
  }
}

debugCatalogCreation();
