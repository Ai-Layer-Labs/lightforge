// Test RCRT Server Transform Support
import fetch from 'node-fetch';

async function testTransforms() {
  const config = {
    rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
    ownerId: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
    agentId: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000AAA',
  };

  console.log('🧪 Testing RCRT Transform Support\n');

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
    console.log('🔐 Got JWT token\n');

    // Helper to make API calls
    async function api(method, path, body = null) {
      const options = {
        method,
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      };
      if (body) options.body = JSON.stringify(body);
      
      const resp = await fetch(`${config.rcrtBaseUrl}${path}`, options);
      return resp;
    }

    // 1. Create a test breadcrumb with llm_hints
    console.log('1️⃣ Creating test breadcrumb with transforms...\n');

    const testData = {
      schema_name: 'test.transform.v1',
      title: 'Transform Test Breadcrumb',
      tags: ['test:transform', 'has:llm-hints'],
      context: {
        items: [
          { name: 'Item 1', status: 'active', details: 'Complex details here...' },
          { name: 'Item 2', status: 'inactive', details: 'More complex data...' },
          { name: 'Item 3', status: 'active', details: 'Even more details...' }
        ],
        metadata: {
          created: new Date().toISOString(),
          internal_id: 'INTERNAL-123-SECRET',
          public_info: 'This is public'
        },
        llm_hints: {
          transform: {
            summary: {
              type: 'template',
              template: '{{context.items.length}} items total. Active items: Item 1, Item 3'
            },
            active_count: {
              type: 'literal',
              literal: 2
            },
            item_names: {
              type: 'extract',
              value: '$.items[*].name'
            },
            instruction: {
              type: 'literal',
              literal: 'Use this data for analysis'
            }
          },
          exclude: ['metadata.internal_id'],
          mode: 'replace'
        }
      }
    };

    const createResp = await api('POST', '/breadcrumbs', testData);
    const created = await createResp.json();
    console.log(`✅ Created breadcrumb: ${created.id}\n`);

    // 2. Fetch context view (should have transforms applied)
    console.log('2️⃣ Fetching context view (transforms should be applied)...\n');
    
    const contextResp = await api('GET', `/breadcrumbs/${created.id}`);
    const contextView = await contextResp.json();
    
    console.log('Context View:');
    console.log(JSON.stringify(contextView.context, null, 2));
    console.log();

    // 3. Verify transforms were applied
    console.log('3️⃣ Verification:\n');
    
    const hasTransformFields = contextView.context.summary && 
                               contextView.context.active_count &&
                               contextView.context.item_names &&
                               contextView.context.instruction;
    
    const excludedInternalId = !contextView.context.metadata?.internal_id;
    const replacedOriginalData = !contextView.context.items;
    
    console.log(`✅ Transform fields present: ${hasTransformFields ? 'YES' : 'NO'}`);
    console.log(`✅ Internal ID excluded: ${excludedInternalId ? 'YES' : 'NO'}`);
    console.log(`✅ Original data replaced: ${replacedOriginalData ? 'YES' : 'NO'}`);
    console.log();

    // 4. Test template transform
    console.log('4️⃣ Testing specific transforms...\n');
    
    if (contextView.context.summary) {
      console.log(`Template transform: "${contextView.context.summary}"`);
    }
    
    if (contextView.context.item_names) {
      console.log(`Extract transform: ${JSON.stringify(contextView.context.item_names)}`);
    }
    
    if (contextView.context.active_count) {
      console.log(`Literal transform: ${contextView.context.active_count}`);
    }
    
    console.log();

    // 5. Compare with full view (requires curator role)
    console.log('5️⃣ Comparing with full view (if accessible)...\n');
    
    try {
      const fullResp = await api('GET', `/breadcrumbs/${created.id}/full`);
      if (fullResp.ok) {
        const fullView = await fullResp.json();
        console.log('Full view has llm_hints:', !!fullView.context.llm_hints);
        console.log('Full view has original items:', !!fullView.context.items);
      } else {
        console.log('(Full view requires curator role)');
      }
    } catch (e) {
      console.log('(Could not fetch full view)');
    }

    // 6. Test tool catalog transform
    console.log('\n6️⃣ Testing tool catalog transform...\n');
    
    const catalogs = await api('GET', '/breadcrumbs?schema_name=tool.catalog.v1');
    const catalogList = await catalogs.json();
    
    if (catalogList.length > 0) {
      const catalogResp = await api('GET', `/breadcrumbs/${catalogList[0].id}`);
      const catalogView = await catalogResp.json();
      
      console.log('Tool Catalog Context:');
      console.log(JSON.stringify(catalogView.context, null, 2).substring(0, 500) + '...');
      
      // Check if it has transform applied
      const hasToolSummary = !!catalogView.context.tool_summary;
      console.log(`\n✅ Tool catalog has transforms: ${hasToolSummary ? 'YES' : 'NO'}`);
    } else {
      console.log('No tool catalog found');
    }

    console.log('\n🎉 Transform Support Test Complete!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test
testTransforms().catch(console.error);
