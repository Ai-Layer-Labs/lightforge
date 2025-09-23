// Script to clean up accumulated agent error breadcrumbs
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

async function cleanupErrors() {
    try {
        const token = await getJWTToken();
        console.log('✅ Got JWT token');

        const schemasToClean = [
            'agent.error.v1',
            'agent.metrics.v1'
        ];
        
        let totalDeleted = 0;
        let totalFailed = 0;

        for (const schema of schemasToClean) {
            console.log(`\n🔍 Searching for ${schema} breadcrumbs...`);
            
            const response = await fetch(`${RCRT_BASE_URL}/breadcrumbs?schema_name=${schema}&limit=1000`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                console.error(`Failed to search ${schema}: ${response.statusText}`);
                continue;
            }
            
            const breadcrumbs = await response.json();
            console.log(`Found ${breadcrumbs.length} ${schema} breadcrumbs`);

            if (breadcrumbs.length === 0) continue;

            console.log(`🗑️  Deleting ${breadcrumbs.length} ${schema} breadcrumbs...`);
            
            // Delete in parallel batches of 10
            const batchSize = 10;
            for (let i = 0; i < breadcrumbs.length; i += batchSize) {
                const batch = breadcrumbs.slice(i, i + batchSize);
                
                await Promise.all(batch.map(async (bc) => {
                    try {
                        const deleteResp = await fetch(`${RCRT_BASE_URL}/breadcrumbs/${bc.id}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'If-Match': bc.version.toString()
                            }
                        });
                        
                        if (deleteResp.ok) {
                            totalDeleted++;
                        } else {
                            console.error(`Failed to delete ${bc.id}: ${deleteResp.statusText}`);
                            totalFailed++;
                        }
                    } catch (error) {
                        console.error(`Error deleting ${bc.id}:`, error);
                        totalFailed++;
                    }
                }));
                
                // Progress update
                console.log(`Progress: ${Math.min(i + batchSize, breadcrumbs.length)}/${breadcrumbs.length}`);
            }
        }
        
        console.log('\n📊 Cleanup Summary:');
        console.log(`✅ Deleted: ${totalDeleted} breadcrumbs`);
        console.log(`❌ Failed: ${totalFailed} breadcrumbs`);
        
        // Get updated count
        console.log('\n🔍 Checking remaining breadcrumb count...');
        const countResp = await fetch(`${RCRT_BASE_URL}/breadcrumbs?limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (countResp.ok) {
            const totalCountHeader = countResp.headers.get('x-total-count');
            console.log(`📊 Total breadcrumbs remaining: ${totalCountHeader || 'Unknown'}`);
        }

    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

// Run the cleanup
console.log('🧹 Starting agent error cleanup...\n');
cleanupErrors();
