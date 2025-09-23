// Test Tool Catalog Transform
import fetch from 'node-fetch';

async function testToolCatalog() {
  const config = {
    rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
    ownerId: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
    agentId: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000AAA',
  };

  console.log('🛠️ Testing Tool Catalog Transform\n');

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

    // Helper to make API calls
    async function api(path) {
      const resp = await fetch(`${config.rcrtBaseUrl}${path}`, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      });
      return resp.json();
    }

    // Find tool catalogs
    console.log('1️⃣ Finding tool catalogs...\n');
    const catalogs = await api('/breadcrumbs?schema_name=tool.catalog.v1');
    console.log(`Found ${catalogs.length} tool catalogs\n`);

    for (const catalog of catalogs) {
      console.log(`📋 Tool Catalog: ${catalog.title} (${catalog.id})`);
      console.log(`   Tags: ${catalog.tags.join(', ')}`);
      
      // Get context view (with transforms)
      const contextView = await api(`/breadcrumbs/${catalog.id}`);
      
      console.log('\n   Context View (with transforms):');
      console.log('   ' + JSON.stringify(contextView.context, null, 2).split('\n').join('\n   '));
      
      // Check what transforms were applied
      const hasToolSummary = !!contextView.context.tool_summary;
      const hasAvailableTools = !!contextView.context.available_tools;
      const hasCategories = !!contextView.context.categories;
      const hasOriginalTools = !!contextView.context.tools;
      
      console.log('\n   Transform Results:');
      console.log(`   ✅ tool_summary: ${hasToolSummary ? 'YES' : 'NO'}`);
      console.log(`   ✅ available_tools: ${hasAvailableTools ? 'YES' : 'NO'}`);
      console.log(`   ✅ categories: ${hasCategories ? 'YES' : 'NO'}`);
      console.log(`   ✅ Original tools array: ${hasOriginalTools ? 'Still present (mode not replace?)' : 'Removed (good!)'}`);
      
      if (hasToolSummary) {
        console.log('\n   Tool Summary Preview:');
        console.log('   ' + contextView.context.tool_summary.split('\n').slice(0, 3).join('\n   ') + '...');
      }
      
      console.log('\n   ---\n');
    }

    console.log('🎉 Tool Catalog Transform Test Complete!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test
testToolCatalog().catch(console.error);
