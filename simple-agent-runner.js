#!/usr/bin/env node
/**
 * Simple RCRT Agent Runner
 * Minimal service to execute agent definitions stored as breadcrumbs
 */

// Use built-in fetch (Node.js 18+)

// Configuration
const RCRT_BASE_URL = process.env.RCRT_BASE_URL || 'http://localhost:8081';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:8082';
const WORKSPACE = process.env.WORKSPACE || 'workspace:agents';

let jwtToken = null;

// Get JWT token
async function getJWTToken() {
    try {
        const response = await fetch(`${DASHBOARD_URL}/api/auth/token`);
        const data = await response.json();
        jwtToken = data.token;
        console.log('✅ Got JWT token');
        return jwtToken;
    } catch (error) {
        console.error('Failed to get JWT token:', error);
        return null;
    }
}

// Execute agent code
async function executeAgentCode(code, triggerBreadcrumb) {
    try {
        // Create execution context
        const context = {
            getSecret: async (secretName, reason) => {
                const response = await fetch(`${DASHBOARD_URL}/api/secrets`);
                const secrets = await response.json();
                const secret = secrets.find(s => s.name.toLowerCase() === secretName.toLowerCase());
                if (!secret) throw new Error(`Secret "${secretName}" not found`);
                
                const decryptResponse = await fetch(`${DASHBOARD_URL}/api/secrets/${secret.id}/decrypt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: reason || 'Agent execution' })
                });
                const decrypted = await decryptResponse.json();
                return decrypted.value;
            },
            
            invokeTool: async (toolName, toolInput) => {
                const toolRequest = await fetch(`${DASHBOARD_URL}/api/breadcrumbs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        schema_name: 'tool.request.v1',
                        title: `Agent Tool Request: ${toolName}`,
                        tags: [WORKSPACE, 'tool:request', 'agent:tool-call'],
                        context: {
                            tool: toolName,
                            input: toolInput,
                            requested_by_agent: 'super-agent'
                        }
                    })
                });
                const result = await toolRequest.json();
                return { tool_request_id: result.id, status: 'requested' };
            },
            
            searchBreadcrumbs: async (query, filters = {}) => {
                const searchParams = new URLSearchParams({
                    q: query,
                    limit: (filters.limit || 10).toString()
                });
                
                const response = await fetch(`${RCRT_BASE_URL}/breadcrumbs/search?${searchParams}`, {
                    headers: { 'Authorization': `Bearer ${jwtToken}` }
                });
                
                return response.ok ? await response.json() : [];
            },
            
            createBreadcrumb: async (breadcrumbData) => {
                const response = await fetch(`${DASHBOARD_URL}/api/breadcrumbs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        schema_name: 'agent.response.v1',
                        tags: [WORKSPACE, 'agent:response'],
                        ...breadcrumbData
                    })
                });
                return await response.json();
            },
            
            console: {
                log: (...args) => console.log('[SuperAgent]', ...args),
                warn: (...args) => console.warn('[SuperAgent]', ...args),
                error: (...args) => console.error('[SuperAgent]', ...args)
            }
        };
        
        // Execute the agent code
        const agentFunction = new Function(
            'triggerBreadcrumb', 
            'getSecret', 'invokeTool', 'searchBreadcrumbs', 'createBreadcrumb', 'console',
            `return (async function() { ${code} })();`
        );
        
        const result = await agentFunction(
            triggerBreadcrumb,
            context.getSecret,
            context.invokeTool,
            context.searchBreadcrumbs,
            context.createBreadcrumb,
            context.console
        );
        
        return result;
        
    } catch (error) {
        console.error('Agent execution failed:', error);
        throw error;
    }
}

// Process breadcrumb events
async function processEvent(eventData) {
    try {
        if (eventData.type === 'breadcrumb.created' && eventData.tags?.includes('user:chat')) {
            console.log('💬 User chat detected:', eventData.breadcrumb_id);
            
            // Get full breadcrumb
            const response = await fetch(`${RCRT_BASE_URL}/breadcrumbs/${eventData.breadcrumb_id}`, {
                headers: { 'Authorization': `Bearer ${jwtToken}` }
            });
            const breadcrumb = await response.json();
            
            // Find super agent definition
            const breadcrumbsResponse = await fetch(`${DASHBOARD_URL}/api/breadcrumbs`);
            const allBreadcrumbs = await breadcrumbsResponse.json();
            
            const superAgentDef = allBreadcrumbs.find(b => 
                b.tags?.includes('agent:super-agent') && 
                b.schema_name === 'agent.definition.v1'
            );
            
            if (superAgentDef) {
                console.log('🤖 Executing super agent...');
                
                // Get full agent definition
                const agentResponse = await fetch(`${DASHBOARD_URL}/api/breadcrumbs/${superAgentDef.id}`);
                const agentDef = await agentResponse.json();
                
                // Execute agent code
                await executeAgentCode(agentDef.context.execution.code, breadcrumb);
                
                console.log('✅ Super agent executed successfully');
            }
        }
    } catch (error) {
        console.error('Failed to process event:', error);
    }
}

// Simple SSE listener
async function startSSEListener() {
    try {
        console.log('📡 Starting SSE listener...');
        
        const response = await fetch(`${RCRT_BASE_URL}/events/stream`, {
            headers: {
                'Authorization': `Bearer ${jwtToken}`,
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`SSE connection failed: ${response.status}`);
        }
        
        console.log('✅ SSE connected');
        
        const reader = response.body.getReader();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const eventData = JSON.parse(line.slice(6));
                        if (eventData.type !== 'ping') {
                            await processEvent(eventData);
                        }
                    } catch (error) {
                        console.warn('Failed to parse event:', error);
                    }
                }
            }
        }
    } catch (error) {
        console.error('SSE error:', error);
        setTimeout(startSSEListener, 5000);
    }
}

// Main function
async function main() {
    console.log('🤖 Simple Agent Runner starting...');
    
    // Wait for services
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Get JWT token
    if (await getJWTToken()) {
        console.log('🚀 Agent runner ready');
        await startSSEListener();
    } else {
        console.error('❌ Failed to get JWT token');
        process.exit(1);
    }
}

main().catch(console.error);
