/**
 * RCRT SDK for Visual Builder
 * Full-featured SDK with all CRUD operations and SSE support
 */
import EventSource from 'eventsource';
export var SecretScope;
(function (SecretScope) {
    SecretScope["WORKSPACE"] = "workspace";
    SecretScope["TENANT"] = "tenant";
    SecretScope["GLOBAL"] = "global";
})(SecretScope || (SecretScope = {}));
/**
 * Enhanced RCRT Client with full feature support
 */
export class RcrtClientEnhanced {
    baseUrl;
    defaultHeaders;
    eventSource;
    constructor(baseUrl = 'http://localhost:8081', authMode = 'disabled', authToken) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
        if (authMode === 'jwt' && authToken) {
            this.defaultHeaders['Authorization'] = `Bearer ${authToken}`;
        }
        else if (authMode === 'key' && authToken) {
            this.defaultHeaders['X-API-Key'] = authToken;
        }
    }
    // ============ Breadcrumb Operations ============
    async createBreadcrumb(body, idempotencyKey) {
        const headers = { ...this.defaultHeaders };
        if (idempotencyKey) {
            headers['Idempotency-Key'] = idempotencyKey;
        }
        const response = await fetch(`${this.baseUrl}/breadcrumbs`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create breadcrumb: ${error}`);
        }
        return response.json();
    }
    async getBreadcrumb(id, view = 'context') {
        // Use /full endpoint to get complete, untransformed data
        // The llm_hints transformation should only happen at context-builder level
        const response = await fetch(`${this.baseUrl}/breadcrumbs/${id}/full`, {
            headers: this.defaultHeaders,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to get breadcrumb: ${error}`);
        }
        return response.json();
    }
    async getBreadcrumbFull(id) {
        // Now just an alias since getBreadcrumb uses /full by default
        return this.getBreadcrumb(id);
    }
    async updateBreadcrumb(id, version, updates) {
        const response = await fetch(`${this.baseUrl}/breadcrumbs/${id}`, {
            method: 'PUT',
            headers: {
                ...this.defaultHeaders,
                'If-Match': version.toString(),
            },
            body: JSON.stringify(updates),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to update breadcrumb: ${error}`);
        }
        return response.json();
    }
    async deleteBreadcrumb(id, version) {
        const headers = { ...this.defaultHeaders };
        if (version !== undefined) {
            headers['If-Match'] = version.toString();
        }
        const response = await fetch(`${this.baseUrl}/breadcrumbs/${id}`, {
            method: 'DELETE',
            headers,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to delete breadcrumb: ${error}`);
        }
    }
    async getBreadcrumbHistory(id) {
        const response = await fetch(`${this.baseUrl}/breadcrumbs/${id}/history`, {
            headers: this.defaultHeaders,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to get breadcrumb history: ${error}`);
        }
        return response.json();
    }
    // ============ Search Operations ============
    async searchBreadcrumbs(params) {
        const queryParams = new URLSearchParams();
        if ('any_tags' in params || 'all_tags' in params) {
            // It's a Selector
            const response = await fetch(`${this.baseUrl}/search`, {
                method: 'POST',
                headers: this.defaultHeaders,
                body: JSON.stringify(params),
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Failed to search breadcrumbs: ${error}`);
            }
            return response.json();
        }
        else {
            // It's SearchParams
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined) {
                    if (Array.isArray(value)) {
                        value.forEach(v => queryParams.append(key, String(v)));
                    }
                    else {
                        queryParams.append(key, String(value));
                    }
                }
            });
            const response = await fetch(`${this.baseUrl}/breadcrumbs?${queryParams}`, {
                headers: this.defaultHeaders,
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Failed to search breadcrumbs: ${error}`);
            }
            return response.json();
        }
    }
    async vectorSearch(params) {
        const response = await fetch(`${this.baseUrl}/search/vector`, {
            method: 'POST',
            headers: this.defaultHeaders,
            body: JSON.stringify(params),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to perform vector search: ${error}`);
        }
        return response.json();
    }
    // ============ Agent CRUD Operations ============
    async listAgents() {
        const response = await fetch(`${this.baseUrl}/agents`, {
            headers: this.defaultHeaders,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to list agents: ${error}`);
        }
        return response.json();
    }
    async getAgent(agentId) {
        const response = await fetch(`${this.baseUrl}/agents/${agentId}`, {
            headers: this.defaultHeaders,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to get agent: ${error}`);
        }
        return response.json();
    }
    async createOrUpdateAgent(agentId, roles) {
        const response = await fetch(`${this.baseUrl}/agents/${agentId}`, {
            method: 'PUT',
            headers: this.defaultHeaders,
            body: JSON.stringify({ roles }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create/update agent: ${error}`);
        }
        return { ok: true };
    }
    async deleteAgent(agentId) {
        const response = await fetch(`${this.baseUrl}/agents/${agentId}`, {
            method: 'DELETE',
            headers: this.defaultHeaders,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to delete agent: ${error}`);
        }
        return { ok: true };
    }
    // ============ Tenant CRUD Operations ============
    async listTenants() {
        const response = await fetch(`${this.baseUrl}/tenants`, {
            headers: this.defaultHeaders,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to list tenants: ${error}`);
        }
        return response.json();
    }
    async getTenant(tenantId) {
        const response = await fetch(`${this.baseUrl}/tenants/${tenantId}`, {
            headers: this.defaultHeaders,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to get tenant: ${error}`);
        }
        return response.json();
    }
    async createOrUpdateTenant(tenantId, name) {
        const response = await fetch(`${this.baseUrl}/tenants/${tenantId}`, {
            method: 'PUT',
            headers: this.defaultHeaders,
            body: JSON.stringify({ name }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create/update tenant: ${error}`);
        }
        return { ok: true };
    }
    async deleteTenant(tenantId) {
        const response = await fetch(`${this.baseUrl}/tenants/${tenantId}`, {
            method: 'DELETE',
            headers: this.defaultHeaders,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to delete tenant: ${error}`);
        }
        return { ok: true };
    }
    // ============ ACL Operations ============
    async listAcls() {
        const response = await fetch(`${this.baseUrl}/acls`, {
            headers: this.defaultHeaders,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to list ACLs: ${error}`);
        }
        return response.json();
    }
    // ============ DLQ Operations ============
    async listDlq() {
        const response = await fetch(`${this.baseUrl}/dlq`, {
            headers: this.defaultHeaders,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to list DLQ: ${error}`);
        }
        return response.json();
    }
    async deleteDlqItem(dlqId) {
        const response = await fetch(`${this.baseUrl}/dlq/${dlqId}`, {
            method: 'DELETE',
            headers: this.defaultHeaders,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to delete DLQ item: ${error}`);
        }
        return { ok: true };
    }
    async retryDlqItem(dlqId) {
        const response = await fetch(`${this.baseUrl}/dlq/${dlqId}/retry`, {
            method: 'POST',
            headers: this.defaultHeaders,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to retry DLQ item: ${error}`);
        }
        return response.json();
    }
    // ============ Secrets Operations ============
    async createSecret(name, value, scope) {
        const response = await fetch(`${this.baseUrl}/secrets`, {
            method: 'POST',
            headers: this.defaultHeaders,
            body: JSON.stringify({ name, value, scope }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create secret: ${error}`);
        }
        return response.json();
    }
    async getSecret(secretId) {
        const response = await fetch(`${this.baseUrl}/secrets/${secretId}`, {
            headers: this.defaultHeaders,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to get secret: ${error}`);
        }
        return response.json();
    }
    async listSecrets(scope) {
        const params = scope ? `?scope=${scope}` : '';
        const response = await fetch(`${this.baseUrl}/secrets${params}`, {
            headers: this.defaultHeaders,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to list secrets: ${error}`);
        }
        return response.json();
    }
    async updateSecret(secretId, value) {
        const response = await fetch(`${this.baseUrl}/secrets/${secretId}`, {
            method: 'PUT',
            headers: this.defaultHeaders,
            body: JSON.stringify({ value }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to update secret: ${error}`);
        }
        return { ok: true };
    }
    async deleteSecret(secretId) {
        const response = await fetch(`${this.baseUrl}/secrets/${secretId}`, {
            method: 'DELETE',
            headers: this.defaultHeaders,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to delete secret: ${error}`);
        }
        return { ok: true };
    }
    async getSecretsFromVault(vaultIdOrTag, reason) {
        const response = await fetch(`${this.baseUrl}/secrets/vault/${vaultIdOrTag}`, {
            headers: {
                ...this.defaultHeaders,
                'X-Access-Reason': reason,
            },
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to get secrets from vault: ${error}`);
        }
        return response.json();
    }
    // ============ SSE Subscriptions ============
    startEventStream(onEvent, options) {
        const reconnectDelay = options?.reconnectDelay || 5000;
        let shouldReconnect = true;
        const connect = () => {
            if (!shouldReconnect)
                return;
            const url = new URL(`${this.baseUrl}/events`);
            if (options?.agentId) {
                url.searchParams.append('agent_id', options.agentId);
            }
            if (options?.filters) {
                url.searchParams.append('filters', JSON.stringify(options.filters));
            }
            const es = new EventSource(url.toString(), {
                headers: this.defaultHeaders,
            });
            this.eventSource = es;
            es.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    onEvent(data);
                }
                catch (error) {
                    console.error('Failed to parse SSE event:', error);
                }
            };
            es.onerror = (error) => {
                console.error('SSE connection error:', error);
                es.close();
                if (shouldReconnect) {
                    setTimeout(connect, reconnectDelay);
                }
            };
            es.addEventListener('ping', () => {
                // Handle ping events to keep connection alive
            });
        };
        connect();
        // Return cleanup function
        return () => {
            shouldReconnect = false;
            if (this.eventSource) {
                this.eventSource.close();
                this.eventSource = undefined;
            }
        };
    }
    // ============ Batch Operations ============
    async batchCreate(breadcrumbs) {
        const results = await Promise.all(breadcrumbs.map((b, i) => this.createBreadcrumb(b, `batch-${Date.now()}-${i}`)));
        return results;
    }
    async batchGet(ids, view = 'context') {
        const results = await Promise.all(ids.map(id => this.getBreadcrumb(id, view)));
        return results;
    }
    // ============ Helper Methods ============
    async getWorkspaceBreadcrumbs(workspaceTag) {
        return this.searchBreadcrumbs({ tag: workspaceTag });
    }
    async getAgentDefinitions(workspaceTag) {
        const params = { schema_name: 'agent.def.v1' };
        if (workspaceTag) {
            params.tag = workspaceTag;
        }
        return this.searchBreadcrumbs(params);
    }
    async getFlowDefinitions(workspaceTag) {
        const params = { schema_name: 'flow.definition.v1' };
        if (workspaceTag) {
            params.tag = workspaceTag;
        }
        return this.searchBreadcrumbs(params);
    }
}
//# sourceMappingURL=index.js.map