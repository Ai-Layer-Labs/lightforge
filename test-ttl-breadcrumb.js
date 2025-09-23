// Test script to verify TTL is working on breadcrumbs
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

async function createTestBreadcrumbs() {
    try {
        const token = await getJWTToken();
        console.log('✅ Got JWT token');

        // Create a test breadcrumb with very short TTL for testing
        const oneMinuteFromNow = new Date(Date.now() + 60 * 1000).toISOString(); // 1 minute from now
        const testBreadcrumb = {
            schema_name: 'test.ttl.v1',
            title: 'Test TTL Breadcrumb',
            tags: ['test', 'ttl', 'hygiene'],
            ttl: oneMinuteFromNow,  // Expires 1 minute from now
            context: {
                message: 'This breadcrumb should expire in 1 minute',
                created_at: new Date().toISOString()
            }
        };

        console.log('\n📝 Creating test breadcrumb with 1 minute TTL...');
        const createResponse = await fetch(`${RCRT_BASE_URL}/breadcrumbs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testBreadcrumb)
        });

        if (!createResponse.ok) {
            throw new Error(`Failed to create breadcrumb: ${createResponse.statusText}`);
        }

        const createData = await createResponse.json();
        console.log('✅ Created breadcrumb with ID:', createData.id);

        // Create an error breadcrumb to simulate agent error with TTL
        const twoMinutesFromNow = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 minutes from now
        const errorBreadcrumb = {
            schema_name: 'agent.error.v1',
            title: 'Test Error',
            tags: ['agent:test', 'agent:error', 'workspace:agents'],
            ttl: twoMinutesFromNow,  // Expires 2 minutes from now
            context: {
                agent_id: 'test-agent',
                error: 'This is a test error',
                timestamp: new Date().toISOString(),
                creator: {
                    type: 'agent',
                    agent_id: 'test-agent'
                }
            }
        };

        console.log('\n📝 Creating test error breadcrumb with 2 minute TTL...');
        const errorResponse = await fetch(`${RCRT_BASE_URL}/breadcrumbs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(errorBreadcrumb)
        });

        if (!errorResponse.ok) {
            throw new Error(`Failed to create error breadcrumb: ${errorResponse.statusText}`);
        }

        const errorData = await errorResponse.json();
        console.log('✅ Created error breadcrumb with ID:', errorData.id);

        console.log('\n⏳ These breadcrumbs should be automatically cleaned up by hygiene:');
        console.log('   - Test TTL breadcrumb: in 1 minute');
        console.log('   - Error breadcrumb: in 2 minutes');
        console.log('\n📊 Monitor with: docker logs breadcrums-rcrt-1 -f | grep hygiene');

    } catch (error) {
        console.error('Error:', error);
    }
}

createTestBreadcrumbs();
