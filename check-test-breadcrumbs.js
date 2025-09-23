// Check if test breadcrumbs still exist
import fetch from 'node-fetch';

const RCRT_BASE_URL = 'http://localhost:8081';
const OWNER_ID = '00000000-0000-0000-0000-000000000001';
const AGENT_ID = '00000000-0000-0000-0000-000000000AAA';

async function getJWTToken() {
    const response = await fetch(`${RCRT_BASE_URL}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            owner_id: OWNER_ID,
            agent_id: AGENT_ID,
            roles: ['curator', 'emitter', 'subscriber']
        })
    });
    if (!response.ok) {
        throw new Error(`Failed to get JWT token: ${response.statusText}`);
    }
    const data = await response.json();
    return data.token;
}

async function checkBreadcrumbs() {
    try {
        const token = await getJWTToken();
        console.log('✅ Got JWT token\n');

        // IDs from the test script
        const testIds = [
            { id: 'd6d3ec7c-c940-4d6f-8abc-7f6d5dce26e2', name: 'Test TTL breadcrumb (1 min)' },
            { id: '10024f5d-3786-4587-85e3-7df46160d013', name: 'Error breadcrumb (2 min)' }
        ];

        console.log('🔍 Checking if test breadcrumbs still exist...\n');
        
        for (const test of testIds) {
            try {
                const response = await fetch(`${RCRT_BASE_URL}/breadcrumbs/${test.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const breadcrumb = await response.json();
                    console.log(`✅ ${test.name} - STILL EXISTS`);
                    console.log(`   TTL: ${breadcrumb.ttl || 'Not set'}`);
                    console.log(`   Created: ${breadcrumb.context?.created_at || 'Unknown'}\n`);
                } else if (response.status === 404) {
                    console.log(`🗑️  ${test.name} - CLEANED UP BY HYGIENE ✨\n`);
                } else {
                    console.log(`❓ ${test.name} - Status: ${response.status}\n`);
                }
            } catch (error) {
                console.error(`Error checking ${test.name}:`, error);
            }
        }

        // Also check total breadcrumb count for test schemas
        const schemas = ['test.ttl.v1', 'agent.error.v1'];
        for (const schema of schemas) {
            const listResp = await fetch(`${RCRT_BASE_URL}/breadcrumbs?schema_name=${schema}&limit=100`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const breadcrumbs = await listResp.json();
            console.log(`📊 Total ${schema} breadcrumbs: ${breadcrumbs.length}`);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

checkBreadcrumbs();
