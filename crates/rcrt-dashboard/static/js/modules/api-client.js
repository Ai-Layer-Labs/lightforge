/**
 * RCRT Dashboard API Client
 * Handles all HTTP requests to the RCRT API
 */

export class ApiClient {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
    }
    
    /**
     * Generic fetch wrapper with error handling
     */
    async request(url, options = {}) {
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        try {
            const response = await fetch(this.baseUrl + url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // Handle empty responses
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
        } catch (error) {
            console.error(`API request failed: ${url}`, error);
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
        return await this.request(`/api/breadcrumbs/${id}`);
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
