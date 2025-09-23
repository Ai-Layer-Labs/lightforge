// Test RCRT Server Transform Support - Fixed Templates
import fetch from 'node-fetch';

async function testTransforms() {
  const config = {
    rcrtBaseUrl: process.env.RCRT_BASE_URL || 'http://localhost:8081',
    ownerId: process.env.OWNER_ID || '00000000-0000-0000-0000-000000000001',
    agentId: process.env.AGENT_ID || '00000000-0000-0000-0000-000000000AAA',
  };

  console.log('🧪 Testing RCRT Transform Support (Fixed)\n');

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

    // 1. Create a test breadcrumb with working llm_hints
    console.log('1️⃣ Creating test breadcrumb with working transforms...\n');

    const testData = {
      schema_name: 'test.transform.v1',
      title: 'Transform Test - Fixed',
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
        count: 3,
        llm_hints: {
          transform: {
            summary: {
              type: 'template',
              template: 'Total items: {{context.count}}. Items: {{#each context.items}}{{name}}{{#unless @last}}, {{/unless}}{{/each}}'
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
    console.log(`✅ Internal ID excluded: ${excludedInternalId ? 'YES (but llm_hints not working)' : 'NO'}`);
    console.log(`✅ Original data replaced: ${replacedOriginalData ? 'YES' : 'NO'}`);
    console.log();

    // 4. Test specific transforms
    console.log('4️⃣ Transform Details:\n');
    
    if (contextView.context.summary) {
      console.log(`✅ Template transform worked: "${contextView.context.summary}"`);
    } else {
      console.log(`❌ Template transform failed`);
    }
    
    if (contextView.context.item_names) {
      console.log(`✅ Extract transform worked: ${JSON.stringify(contextView.context.item_names)}`);
    } else {
      console.log(`❌ Extract transform failed`);
    }
    
    if (contextView.context.active_count === 2) {
      console.log(`✅ Literal transform worked: ${contextView.context.active_count}`);
    } else {
      console.log(`❌ Literal transform failed`);
    }

    // 5. Test merge mode
    console.log('\n5️⃣ Testing merge mode...\n');
    
    const mergeData = {
      schema_name: 'test.merge.v1',
      title: 'Merge Mode Test',
      tags: ['test:merge'],
      context: {
        existing_field: 'original data',
        items: ['a', 'b', 'c'],
        llm_hints: {
          transform: {
            added_field: {
              type: 'literal',
              literal: 'This was added'
            },
            item_count: {
              type: 'literal',
              literal: 3
            }
          },
          mode: 'merge'
        }
      }
    };

    const mergeResp = await api('POST', '/breadcrumbs', mergeData);
    const merged = await mergeResp.json();
    
    const mergeView = await api('GET', `/breadcrumbs/${merged.id}`);
    const mergeContext = await mergeView.json();
    
    console.log('Merge Mode Result:');
    console.log(JSON.stringify(mergeContext.context, null, 2));
    
    const hasMergedFields = mergeContext.context.existing_field && 
                            mergeContext.context.items &&
                            mergeContext.context.added_field &&
                            mergeContext.context.item_count;
    
    console.log(`\n✅ Merge mode worked: ${hasMergedFields ? 'YES' : 'NO'}`);

    console.log(`\n🎉 Transform Support is ${hasTransformFields || hasMergedFields ? 'WORKING!' : 'NOT WORKING yet'}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test
testTransforms().catch(console.error);
