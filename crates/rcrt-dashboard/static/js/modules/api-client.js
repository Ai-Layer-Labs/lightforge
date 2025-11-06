/**
 * RCRT Dashboard API Client
 * Handles all HTTP requests to the RCRT API
 */

export class ApiClient {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
    }
    
    /**
     * Generic fetch wrapper with error handling and timeout
     */
    async request(url, options = {}) {
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        // Add timeout to prevent hanging requests
        const timeoutMs = options.timeout || 30000; // 30 second default timeout
        const controller = new AbortController();
        config.signal = controller.signal;
        
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, timeoutMs);
        
        try {
            console.log(`🌐 API Request: ${url}`);
            const response = await fetch(this.baseUrl + url, config);
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // Handle empty responses
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                console.log(`✅ API Success: ${url} (${Array.isArray(data) ? data.length + ' items' : 'object'})`);
                return data;
            }
            
            const text = await response.text();
            console.log(`✅ API Success: ${url} (text response)`);
            return text;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.error(`⏰ API Timeout: ${url} (${timeoutMs}ms)`);
                throw new Error(`Request timeout: ${url}`);
            }
            console.error(`❌ API Failed: ${url}`, error);
            throw error;
        }
    }
    
    // ============ BREADCRUMB OPERATIONS ============
    
    /**
     * Load all breadcrumbs
     */
    async loadBreadcrumbs() {
        return await this.request('/api/breadcrumbs');
    }
    
    /**
     * Load specific breadcrumb details
     * @param {string} id - Breadcrumb ID
     */
    async loadBreadcrumbDetails(id) {
        return await this.request(`/api/breadcrumbs/${id}/full`);
    }
    
    /**
     * Create new breadcrumb
     * @param {object} breadcrumbData - Breadcrumb data
     */
    async createBreadcrumb(breadcrumbData) {
        return await this.request('/api/breadcrumbs', {
            method: 'POST',
            body: JSON.stringify(breadcrumbData)
        });
    }
    
    /**
     * Update existing breadcrumb
     * @param {string} id - Breadcrumb ID
     * @param {object} breadcrumbData - Updated data
     * @param {number} version - Current version for optimistic locking
     */
    async updateBreadcrumb(id, breadcrumbData, version) {
        return await this.request(`/api/breadcrumbs/${id}`, {
            method: 'PATCH',
            headers: {
                'If-Match': version.toString()
            },
            body: JSON.stringify(breadcrumbData)
        });
    }
    
    /**
     * Delete breadcrumb
     * @param {string} id - Breadcrumb ID
     */
    async deleteBreadcrumb(id) {
        return await this.request(`/api/breadcrumbs/${id}`, {
            method: 'DELETE'
        });
    }
    
    // ============ AGENT OPERATIONS ============
    
    /**
     * Load all agents
     */
    async loadAgents() {
        return await this.request('/api/agents');
    }
    
    /**
     * Load agent definitions from breadcrumbs
     */
    async loadAgentDefinitions() {
        const breadcrumbs = await this.request('/api/breadcrumbs');
        const agentDefBreadcrumbs = breadcrumbs.filter(b => 
            b.tags && b.tags.includes('agent:definition')
        );
        
        // Fetch full context for each agent definition
        const agentDefinitions = [];
        for (const breadcrumb of agentDefBreadcrumbs) {
            try {
                const fullContext = await this.request(`/api/breadcrumbs/${breadcrumb.id}/full`);
                agentDefinitions.push(fullContext);
            } catch (error) {
                console.warn(`Failed to load context for agent definition ${breadcrumb.id}:`, error);
                // Include the breadcrumb without context as fallback
                agentDefinitions.push(breadcrumb);
            }
        }
        
        return agentDefinitions;
    }
    
    /**
     * Create a new agent definition
     */
    async createAgentDefinition(agentDef) {
        return await this.request('/api/breadcrumbs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: agentDef.title,
                tags: ['agent:definition', 'workspace:agents', `agent:${agentDef.agent_name}`],
                context: {
                    schema_name: 'agent.definition.v1',
                    agent_name: agentDef.agent_name,
                    agent_entity_id: agentDef.agent_entity_id,
                    category: agentDef.category || 'general',
                    description: agentDef.description,
                    execution: agentDef.execution || { type: 'javascript', code: '// Agent code here' },
                    subscriptions: agentDef.subscriptions || [],
                    triggers: agentDef.triggers || [],
                    version: '1.0.0'
                }
            })
        });
    }
    
    /**
     * Update an agent definition
     */
    async updateAgentDefinition(id, agentDef) {
        return await this.request(`/api/breadcrumbs/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: agentDef.title,
                tags: ['agent:definition', 'workspace:agents', `agent:${agentDef.agent_name}`],
                context: {
                    schema_name: 'agent.definition.v1',
                    agent_name: agentDef.agent_name,
                    agent_entity_id: agentDef.agent_entity_id,
                    category: agentDef.category || 'general',
                    description: agentDef.description,
                    execution: agentDef.execution,
                    subscriptions: agentDef.subscriptions || [],
                    triggers: agentDef.triggers || [],
                    version: agentDef.version || '1.0.0'
                }
            })
        });
    }
    
    /**
     * Delete an agent definition
     */
    async deleteAgentDefinition(id) {
        return await this.request(`/api/breadcrumbs/${id}`, {
            method: 'DELETE'
        });
    }
    
    /**
     * Update agent roles
     * @param {string} id - Agent ID
     * @param {array} roles - New roles array
     */
    async updateAgent(id, roles) {
        return await this.request(`/api/agents/${id}`, {
            method: 'POST',
            body: JSON.stringify({ roles })
        });
    }
    
    /**
     * Delete agent
     * @param {string} id - Agent ID
     */
    async deleteAgent(id) {
        return await this.request(`/api/agents/${id}`, {
            method: 'DELETE'
        });
    }
    
    /**
     * Load agent webhooks
     * @param {string} id - Agent ID
     */
    async loadAgentWebhooks(id) {
        return await this.request(`/api/agents/${id}/webhooks`);
    }
    
    // ============ SUBSCRIPTION OPERATIONS ============
    
    /**
     * Load all subscriptions
     */
    async loadSubscriptions() {
        return await this.request('/api/subscriptions');
    }
    
    /**
     * Delete subscription
     * @param {string} id - Subscription ID
     */
    async deleteSubscription(id) {
        return await this.request(`/api/subscriptions/${id}`, {
            method: 'DELETE'
        });
    }
    
    // ============ AUTHENTICATION ============
    
    /**
     * Get JWT token for direct RCRT connection
     */
    async getAuthToken() {
        return await this.request('/api/auth/token');
    }
    
    // ============ ADMIN OPERATIONS ============
    
    /**
     * Trigger hygiene cleanup
     */
    async triggerHygiene() {
        return await this.request('/api/admin/purge', {
            method: 'POST'
        });
    }
    
    /**
     * Load admin entities (tenants, secrets, acl, etc.)
     * @param {string} entityType - Type of entity to load
     */
    async loadAdminEntities(entityType) {
        return await this.request(`/api/${entityType}`);
    }
    
    // ============ SECRETS OPERATIONS ============
    
    /**
     * Load all secrets
     */
    async loadSecrets() {
        return await this.request('/api/secrets');
    }
    
    /**
     * Create new secret
     * @param {object} secretData - Secret data
     */
    async createSecret(secretData) {
        return await this.request('/api/secrets', {
            method: 'POST',
            body: JSON.stringify(secretData)
        });
    }
    
    /**
     * Update existing secret
     * @param {string} id - Secret ID
     * @param {object} secretData - Updated data
     */
    async updateSecret(id, secretData) {
        return await this.request(`/api/secrets/${id}`, {
            method: 'PUT',
            body: JSON.stringify(secretData)
        });
    }
    
    /**
     * Delete secret
     * @param {string} id - Secret ID
     */
    async deleteSecret(id) {
        return await this.request(`/api/secrets/${id}`, {
            method: 'DELETE'
        });
    }
    
    /**
     * Decrypt secret value (requires curator role)
     * @param {string} id - Secret ID
     * @param {string} reason - Reason for decryption (for audit)
     */
    async decryptSecret(id, reason = '') {
        return await this.request(`/api/secrets/${id}/decrypt`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
    }
    
    // ============ TOOLS OPERATIONS ============
    
    /**
     * Load available tools from tool catalog breadcrumb
     * @param {array} breadcrumbs - All breadcrumbs to search
     */
    async loadAvailableTools(breadcrumbs) {
        try {
            // Find the tool catalog breadcrumb
            const toolCatalog = breadcrumbs.find(b => 
                b.tags?.includes('tool:catalog') && 
                b.title?.includes('Tool Catalog')
            );
            
            if (!toolCatalog) {
                console.warn('🛠️ No tool catalog breadcrumb found');
                return [];
            }
            
            console.log('🛠️ Found tool catalog breadcrumb:', toolCatalog.id);
            
            // Get full context to see the tools list
            const catalogData = await this.loadBreadcrumbDetails(toolCatalog.id);
            
            if (catalogData.context && catalogData.context.tools) {
                return catalogData.context.tools.map((tool, index) => ({
                    name: tool.name,
                    description: tool.description,
                    category: tool.category,
                    status: tool.status,
                    id: `tool-${tool.name}`,
                    index: index
                }));
            } else {
                console.warn('🛠️ Tool catalog found but no tools in context');
                return [];
            }
        } catch (error) {
            console.error('🛠️ Failed to load tools:', error);
            return [];
        }
    }
    
    // ============ BULK OPERATIONS ============
    
    /**
     * Delete multiple breadcrumbs in parallel
     * @param {array} breadcrumbs - Array of breadcrumb objects
     * @param {function} progressCallback - Optional progress callback
     */
    async bulkDeleteBreadcrumbs(breadcrumbs, progressCallback) {
        let successCount = 0;
        let failedCount = 0;
        
        const deletePromises = breadcrumbs.map(async (breadcrumb, index) => {
            try {
                await this.deleteBreadcrumb(breadcrumb.id);
                successCount++;
                
                if (progressCallback) {
                    progressCallback({
                        processed: index + 1,
                        total: breadcrumbs.length,
                        successes: successCount,
                        failures: failedCount
                    });
                }
            } catch (error) {
                failedCount++;
                console.error(`Failed to delete breadcrumb ${breadcrumb.id}:`, error);
                
                if (progressCallback) {
                    progressCallback({
                        processed: index + 1,
                        total: breadcrumbs.length,
                        successes: successCount,
                        failures: failedCount,
                        error: error.message
                    });
                }
            }
        });
        
        await Promise.all(deletePromises);
        
        return { successCount, failedCount };
    }
}

// Create singleton instance
export const apiClient = new ApiClient();
