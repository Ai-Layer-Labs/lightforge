/**
 * RCRT Dashboard Admin Manager
 * Handles admin panel functionality, entity management, and system operations
 */

import { dashboardState } from './state.js';
import { apiClient } from './api-client.js';

export class AdminManager {
    constructor() {
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        // Note: Global functions are set up by the main dashboard app
        console.log('🛠️ Admin Manager initialized');
    }
    
    // ============ ADMIN PANEL MANAGEMENT ============
    
    showAdminPanel() {
        document.getElementById('adminModal').style.display = 'block';
        
        // First, check current agent permissions
        this.checkCurrentAgentPermissions().then(() => {
            // Load initial data for current tab
            const activeTab = document.querySelector('.admin-tab.active').textContent.toLowerCase().includes('agents') ? 'agents' : 'tenants';
            this.loadAdminData(activeTab);
        });
    }
    
    hideAdminPanel() {
        document.getElementById('adminModal').style.display = 'none';
    }
    
    showAdminTab(tabName) {
        // Update tab visuals
        document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.admin-panel').forEach(panel => panel.classList.remove('active'));
        
        event.target.classList.add('active');
        document.getElementById(tabName + 'Panel').classList.add('active');
        
        // Load data for the selected tab
        this.loadAdminData(tabName);
    }
    
    async checkCurrentAgentPermissions() {
        try {
            // Get current agent info by trying to access a simple endpoint
            const agents = await apiClient.loadAgents();
            console.log('Current agent permissions check - agents loaded:', agents.length);
            
            // Add permission info to admin panel header
            const header = document.querySelector('.admin-content h2');
            if (header) {
                header.innerHTML = `🛠️ Admin Management <small style="color: rgba(255,255,255,0.6); font-size: 0.7rem;">(Current agent roles: checking...)</small>`;
            }
        } catch (error) {
            console.error('Error checking permissions:', error);
        }
    }
    
    // ============ ADMIN DATA MANAGEMENT ============
    
    async loadAdminData(entityType) {
        console.log('Loading admin data for:', entityType);
        
        try {
            let data = [];
            let error = null;
            
            // Special handling for different entity types
            if (entityType === 'webhooks') {
                // For now, show placeholder since webhooks are per-agent
                error = 'Select "Agents" tab to view agent-specific webhooks';
            } else {
                try {
                    data = await apiClient.loadAdminEntities(entityType);
                } catch (apiError) {
                    if (apiError.message.includes('403')) {
                        error = `Access Denied: Requires curator role for ${entityType}`;
                    } else {
                        error = `Error: ${apiError.message}`;
                    }
                }
            }
            
            this.renderAdminEntity(entityType, data, error);
        } catch (error) {
            console.error(`Failed to load ${entityType}:`, error);
            this.renderAdminEntity(entityType, [], `Network Error: ${error.message}`);
        }
    }
    
    renderAdminEntity(entityType, data, error = null) {
        const listContainer = document.getElementById(entityType + 'List');
        if (!listContainer) {
            console.error(`Admin list container not found: ${entityType}List`);
            return;
        }
        
        if (error) {
            listContainer.innerHTML = `<div style="padding: 2rem; text-align: center; color: #ff6b6b;">${error}</div>`;
            return;
        }
        
        if (!data || data.length === 0) {
            listContainer.innerHTML = `<div style="padding: 2rem; text-align: center; color: rgba(255,255,255,0.6);">No ${entityType} found.</div>`;
            return;
        }
        
        listContainer.innerHTML = data.map(item => this.renderEntityItem(entityType, item)).join('');
    }
    
    renderEntityItem(entityType, item) {
        switch (entityType) {
            case 'agents':
                return `
                    <div class="entity-item">
                        <div class="entity-info">
                            <div class="entity-title">🤖 Agent ${item.id.substring(0, 8)}...</div>
                            <div class="entity-meta">
                                <strong>Roles:</strong> ${item.roles.join(', ')}<br>
                                <strong>Created:</strong> ${new Date(item.created_at).toLocaleString()}<br>
                                <strong>Full ID:</strong> <code style="font-size:0.7rem;">${item.id}</code>
                            </div>
                        </div>
                        <div class="entity-actions">
                            <button class="btn-small" onclick="adminManager.viewAgent('${item.id}')">Details</button>
                            <button class="btn-small" onclick="adminManager.viewAgentWebhooks('${item.id}')">Webhooks</button>
                        </div>
                    </div>
                `;
                
            case 'subscriptions':
                return `
                    <div class="entity-item">
                        <div class="entity-info">
                            <div class="entity-title">📡 Subscription ${item.id.substring(0, 8)}...</div>
                            <div class="entity-meta">
                                <strong>Agent:</strong> ${item.agent_id.substring(0, 8)}...<br>
                                <strong>Tags (any):</strong> ${item.selector.any_tags ? item.selector.any_tags.join(', ') : 'None'}<br>
                                <strong>Tags (all):</strong> ${item.selector.all_tags ? item.selector.all_tags.join(', ') : 'None'}<br>
                                ${item.selector.schema_name ? `<strong>Schema:</strong> ${item.selector.schema_name}<br>` : ''}
                            </div>
                        </div>
                        <div class="entity-actions">
                            <button class="btn-small" onclick="adminManager.viewSubscription('${item.id}')">Details</button>
                            <button class="btn-small btn-danger" onclick="adminManager.deleteSubscription('${item.id}')">Delete</button>
                        </div>
                    </div>
                `;
                
            case 'tenants':
                return `
                    <div class="entity-item">
                        <div class="entity-info">
                            <div class="entity-title">${this.escapeHtml(item.name)}</div>
                            <div class="entity-meta">ID: ${item.id} | Created: ${new Date(item.created_at).toLocaleDateString()}</div>
                        </div>
                        <div class="entity-actions">
                            <button class="btn-small" onclick="adminManager.viewTenant('${item.id}')">View</button>
                        </div>
                    </div>
                `;
                
            case 'secrets':
                return `
                    <div class="entity-item">
                        <div class="entity-info">
                            <div class="entity-title">🔐 ${this.escapeHtml(item.name)}</div>
                            <div class="entity-meta">Scope: ${item.scope_type} | Created: ${new Date(item.created_at).toLocaleDateString()}</div>
                        </div>
                        <div class="entity-actions">
                            <button class="btn-small btn-danger" onclick="adminManager.viewSecret('${item.id}')">Decrypt</button>
                        </div>
                    </div>
                `;
                
            case 'acl':
                return `
                    <div class="entity-item">
                        <div class="entity-info">
                            <div class="entity-title">ACL ${item.id.substring(0, 8)}...</div>
                            <div class="entity-meta">Breadcrumb: ${item.breadcrumb_id.substring(0, 8)}... | Actions: ${item.actions.join(', ')}</div>
                        </div>
                        <div class="entity-actions">
                            <button class="btn-small btn-danger" onclick="adminManager.revokeAcl('${item.id}')">Revoke</button>
                        </div>
                    </div>
                `;
                
            default:
                return '';
        }
    }
    
    // ============ ADMIN ACTIONS ============
    
    async viewAgent(id) {
        try {
            const response = await fetch(`/api/agents/${id}`);
            const agent = await response.json();
            const details = `
Agent Details:

ID: ${agent.id}
Roles: ${agent.roles.join(', ')}  
Created: ${new Date(agent.created_at).toLocaleString()}

This agent can:
${agent.roles.includes('curator') ? '✅ Manage system (curator)' : '❌ No curator access'}
${agent.roles.includes('emitter') ? '✅ Create breadcrumbs (emitter)' : '❌ Cannot create breadcrumbs'}
${agent.roles.includes('subscriber') ? '✅ Subscribe to events (subscriber)' : '❌ Cannot subscribe'}
            `.trim();
            alert(details);
        } catch (error) {
            alert(`Error loading agent: ${error.message}`);
        }
    }
    
    async viewAgentWebhooks(agentId) {
        try {
            const webhooks = await apiClient.loadAgentWebhooks(agentId);
            const details = webhooks.length > 0 
                ? webhooks.map(w => `• ${w.url}`).join('\n')
                : 'No webhooks configured';
            alert(`Webhooks for Agent ${agentId.substring(0, 8)}...\n\n${details}`);
        } catch (error) {
            if (error.message.includes('403') || error.message.includes('404')) {
                alert(`Error: Cannot load webhooks for this agent`);
            } else {
                alert(`Error loading webhooks: ${error.message}`);
            }
        }
    }
    
    viewTenant(id) {
        alert(`Tenant Management:\n\nID: ${id}\n\n⚠️ Curator role required for tenant operations.\n\nAvailable operations:\n• View tenant details\n• Update tenant name\n• Delete tenant (dangerous!)`);
    }
    
    viewSecret(id) {
        if (confirm('⚠️ This will decrypt and display the secret value!\n\nThis action is audited and requires curator privileges.\n\nProceed?')) {
            alert(`Secret Decryption:\n\nID: ${id}\n\n🔐 Secret decryption would require:\n1. Curator role verification\n2. Audit log entry\n3. Reason for access\n\n(Full decrypt implementation coming soon)`);
        }
    }
    
    revokeAcl(id) {
        if (confirm('⚠️ Revoke this ACL entry?\n\nThis will remove access permissions and cannot be undone easily.')) {
            alert(`ACL Management:\n\nID: ${id}\n\n🛡️ ACL operations require curator role.\n\nThis would revoke specific permissions for accessing breadcrumbs.\n\n(Full implementation coming soon)`);
        }
    }
    
    async viewSubscription(id) {
        try {
            const subscriptions = await apiClient.loadSubscriptions();
            const sub = subscriptions.find(s => s.id === id);
            
            if (sub) {
                let details = `Subscription Details:\n\nID: ${sub.id}\nAgent: ${sub.agent_id}\n\n`;
                details += `SELECTOR CRITERIA:\n`;
                details += `• Any Tags: ${sub.selector.any_tags ? sub.selector.any_tags.join(', ') : 'None'}\n`;
                details += `• All Tags: ${sub.selector.all_tags ? sub.selector.all_tags.join(', ') : 'None'}\n`;
                details += `• Schema: ${sub.selector.schema_name || 'Any'}\n`;
                
                if (sub.selector.context_match) {
                    details += `\nCONTEXT MATCHES:\n`;
                    sub.selector.context_match.forEach(match => {
                        details += `• ${match.path} ${match.op} ${JSON.stringify(match.value)}\n`;
                    });
                }
                
                details += `\n📡 This agent receives events when breadcrumbs match these criteria.`;
                alert(details);
            } else {
                alert('Subscription not found');
            }
        } catch (error) {
            alert(`Error loading subscription: ${error.message}`);
        }
    }
    
    deleteSubscription(id) {
        if (confirm('Delete this subscription?\n\nThe agent will stop receiving events for matching breadcrumbs.')) {
            alert(`Subscription Deletion:\n\nID: ${id}\n\n📡 Would unsubscribe agent from matching breadcrumb events.\n\n(Full implementation coming soon)`);
        }
    }
    
    showCreateSubscription() {
        alert(`Create Subscription:\n\n📡 Subscriptions use "selectors" to match breadcrumbs:\n\n• ANY_TAGS: ["workspace:demo", "urgent"] - matches breadcrumbs with either tag\n• ALL_TAGS: ["ui:instance"] - matches breadcrumbs with all specified tags\n• SCHEMA_NAME: "user.profile.v1" - matches specific schema\n• CONTEXT_MATCH: $.priority == "high" - matches JSON path conditions\n\nWhen breadcrumbs match, agents get real-time events!\n\n(Full creation UI coming soon)`);
    }
    
    async subscribeToThisBreadcrumb() {
        if (!dashboardState.selectedBreadcrumbDetails) {
            alert('No breadcrumb selected');
            return;
        }
        
        const confirmed = confirm(`📡 Subscribe to Breadcrumb Updates?\n\nID: ${dashboardState.selectedBreadcrumbDetails.id}\nTitle: "${dashboardState.selectedBreadcrumbDetails.title}"\n\nYour agent will receive events when THIS specific breadcrumb is updated.\n\nProceed?`);
        
        if (confirmed) {
            try {
                alert(`📡 Breadcrumb Subscription:\n\nWould subscribe to: ${dashboardState.selectedBreadcrumbDetails.id}\n\nReal-time updates for:\n• Title changes\n• Context modifications  \n• Tag updates\n• Version increments\n\nEvents delivered via:\n• SSE stream (right panel)\n• Webhooks (if configured)\n• NATS JetStream\n\n(Direct ID subscription implementation coming soon)\n\nFor now, use Selector Subscriptions in Admin panel!`);
            } catch (error) {
                alert(`Subscription error: ${error.message}`);
            }
        }
    }
    
    // ============ HYGIENE MANAGEMENT ============
    
    async triggerHygieneCleanup() {
        if (!confirm('🧹 Run hygiene cleanup?\n\nThis will remove expired breadcrumbs including:\n- Health checks older than 5 minutes\n- System pings older than 10 minutes\n- Agent thinking data older than 6 hours\n- Other expired temporary data\n\nProceed?')) {
            return;
        }
        
        try {
            console.log('Triggering hygiene cleanup...');
            
            const result = await apiClient.triggerHygiene();
            const totalCleaned = result.ttl_purged + result.health_checks_purged + result.expired_purged;
            
            alert(`✅ Hygiene cleanup completed!\n\nCleaned up:\n- TTL expired: ${result.ttl_purged}\n- Health checks: ${result.health_checks_purged}\n- Other expired: ${result.expired_purged}\n\nTotal: ${totalCleaned} breadcrumbs removed`);
            
            // Notify the main dashboard to refresh
            if (window.dashboard && window.dashboard.refreshData) {
                await window.dashboard.refreshData();
            }
            
        } catch (error) {
            console.error('Hygiene cleanup error:', error);
            alert(`❌ Hygiene cleanup error: ${error.message}`);
        }
    }
    
    // ============ REFRESH FUNCTIONS ============
    
    refreshAgents() { this.loadAdminData('agents'); }
    refreshSubscriptions() { this.loadAdminData('subscriptions'); }
    refreshTenants() { this.loadAdminData('tenants'); }
    refreshSecrets() { this.loadAdminData('secrets'); }
    refreshAcl() { this.loadAdminData('acl'); }
    refreshWebhooks() { this.loadAdminData('webhooks'); }
    
    // ============ EVENT LISTENERS ============
    
    setupEventListeners() {
        // Close modal on escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.hideAdminPanel();
            }
        });
        
        // Close modal on background click
        const adminModal = document.getElementById('adminModal');
        if (adminModal) {
            adminModal.addEventListener('click', (event) => {
                if (event.target === adminModal) {
                    this.hideAdminPanel();
                }
            });
        }
    }
    
    // ============ MODULE INTEGRATION ============
    
    // Make this manager available for the main app to use
    static getInstance() {
        if (!AdminManager.instance) {
            AdminManager.instance = new AdminManager();
        }
        return AdminManager.instance;
    }
    
    // ============ UTILITY FUNCTIONS ============
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
