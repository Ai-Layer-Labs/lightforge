/**
 * RCRT Dashboard Secrets Manager
 * Handles secrets management, tool configuration, and UI interactions
 */

import { dashboardState } from './state.js';
import { apiClient } from './api-client.js';

export class SecretsManager {
    constructor() {
        this.init();
    }
    
    init() {
        console.log('🔐 Secrets Manager initialized');
    }
    
    // ============ SECRETS CRUD OPERATIONS ============
    
    async loadSecrets() {
        try {
            const secrets = await apiClient.loadSecrets();
            dashboardState.secrets = secrets;
            this.updateSecretsCount();
            this.renderSecretsList();
            return secrets;
        } catch (error) {
            console.error('Failed to load secrets:', error);
            this.showError('Failed to load secrets: ' + error.message);
            return [];
        }
    }
    
    async createNewSecret() {
        const name = document.getElementById('newSecretName').value.trim();
        const scope = document.getElementById('newSecretScope').value;
        const value = document.getElementById('newSecretValue').value.trim();
        
        if (!name || !value) {
            this.showError('Please provide both name and value for the secret');
            return;
        }
        
        try {
            const secretData = {
                name: name,
                scope_type: scope,
                scope_id: scope === 'agent' ? dashboardState.selectedAgent?.id : null,
                value: value
            };
            
            await apiClient.createSecret(secretData);
            this.clearSecretForm();
            await this.loadSecrets();
            this.showSuccess('Secret created successfully');
            
            // Refresh the canvas to show new secret node
            if (window.dashboard && window.dashboard.refreshCanvas) {
                window.dashboard.refreshCanvas();
            }
        } catch (error) {
            console.error('Failed to create secret:', error);
            this.showError('Failed to create secret: ' + error.message);
        }
    }
    
    async updateSecret() {
        if (!dashboardState.selectedSecret) {
            this.showError('No secret selected');
            return;
        }
        
        const value = document.getElementById('editSecretValue').value.trim();
        if (!value) {
            this.showError('Please provide a new value for the secret');
            return;
        }
        
        try {
            await apiClient.updateSecret(dashboardState.selectedSecret.id, { value });
            this.cancelSecretEdit();
            await this.loadSecrets();
            this.showSuccess('Secret updated successfully');
        } catch (error) {
            console.error('Failed to update secret:', error);
            this.showError('Failed to update secret: ' + error.message);
        }
    }
    
    async deleteSecret() {
        if (!dashboardState.selectedSecret) {
            this.showError('No secret selected');
            return;
        }
        
        const confirmed = confirm(`Delete secret "${dashboardState.selectedSecret.name}"?\n\nThis action cannot be undone and may break tools that depend on this secret.`);
        if (!confirmed) return;
        
        try {
            await apiClient.deleteSecret(dashboardState.selectedSecret.id);
            this.deselectSecret();
            await this.loadSecrets();
            this.showSuccess('Secret deleted successfully');
            
            // Refresh the canvas to remove the secret node
            if (window.dashboard && window.dashboard.refreshCanvas) {
                window.dashboard.refreshCanvas();
            }
        } catch (error) {
            console.error('Failed to delete secret:', error);
            this.showError('Failed to delete secret: ' + error.message);
        }
    }
    
    async decryptSecret() {
        if (!dashboardState.selectedSecret) {
            this.showError('No secret selected');
            return;
        }
        
        const reason = prompt('Reason for decrypting this secret (for audit log):', 'Configuration check');
        if (reason === null) return; // User cancelled
        
        try {
            const result = await apiClient.decryptSecret(dashboardState.selectedSecret.id, reason);
            
            // Show decrypted value in a secure way
            const message = `Secret: ${dashboardState.selectedSecret.name}\nDecrypted Value: ${result.value}\n\n⚠️ This value is now visible. Please handle securely.`;
            alert(message);
            
            this.showSuccess('Secret decrypted (check console for audit log)');
        } catch (error) {
            console.error('Failed to decrypt secret:', error);
            this.showError('Failed to decrypt secret: ' + error.message);
        }
    }
    
    // ============ TOOL CONFIGURATION ============
    
    selectTool(tool) {
        dashboardState.selectedTool = tool;
        this.showToolDetails(tool);
        this.hideOtherSelectionPanels();
        document.getElementById('selectedToolSection').style.display = 'block';
    }
    
    showToolDetails(tool) {
        const detailsContainer = document.getElementById('toolDetails');
        
        // Find any existing configuration for this tool
        const existingConfig = this.getToolConfiguration(tool.name);
        
        detailsContainer.innerHTML = `
            <div class="detail-item">
                <strong>Name:</strong> ${this.escapeHtml(tool.name)}
            </div>
            <div class="detail-item">
                <strong>Description:</strong> ${this.escapeHtml(tool.description || 'No description')}
            </div>
            <div class="detail-item">
                <strong>Category:</strong> ${this.escapeHtml(tool.category || 'tool')}
            </div>
            <div class="detail-item">
                <strong>Status:</strong> <span style="color: ${tool.status === 'active' ? '#00ff88' : '#ffaa00'}">${tool.status}</span>
            </div>
            ${existingConfig ? `
                <div class="detail-item">
                    <strong>API Key Secret:</strong> ${this.escapeHtml(existingConfig.secret_name || 'Not configured')}
                </div>
                <div class="detail-item">
                    <strong>Endpoint:</strong> ${this.escapeHtml(existingConfig.endpoint || 'Default')}
                </div>
            ` : '<div class="detail-item"><em>No configuration found</em></div>'}
        `;
    }
    
    enterToolConfigMode() {
        if (!dashboardState.selectedTool) {
            this.showError('No tool selected');
            return;
        }
        
        const tool = dashboardState.selectedTool;
        const existingConfig = this.getToolConfiguration(tool.name);
        
        // Populate form
        document.getElementById('configToolName').value = tool.name;
        document.getElementById('configToolApiKey').value = existingConfig?.secret_id || '';
        document.getElementById('configToolEndpoint').value = existingConfig?.endpoint || '';
        
        // Populate secret options
        this.populateSecretOptions();
        
        // Show config form
        document.getElementById('selectedToolSection').style.display = 'none';
        document.getElementById('configToolSection').style.display = 'block';
    }
    
    populateSecretOptions() {
        const select = document.getElementById('configToolApiKey');
        select.innerHTML = '<option value="">Select a secret...</option>';
        
        dashboardState.secrets.forEach(secret => {
            const option = document.createElement('option');
            option.value = secret.id;
            option.textContent = `${secret.name} (${secret.scope_type})`;
            select.appendChild(option);
        });
    }
    
    async saveToolConfiguration() {
        if (!dashboardState.selectedTool) {
            this.showError('No tool selected');
            return;
        }
        
        const toolName = dashboardState.selectedTool.name;
        const secretId = document.getElementById('configToolApiKey').value;
        const endpoint = document.getElementById('configToolEndpoint').value.trim();
        
        try {
            // For now, we'll store tool configurations as breadcrumbs with a special schema
            // In a real implementation, this might be stored differently
            const configData = {
                title: `Tool Configuration: ${toolName}`,
                context: {
                    tool_name: toolName,
                    secret_id: secretId || null,
                    secret_name: secretId ? dashboardState.secrets.find(s => s.id === secretId)?.name : null,
                    endpoint: endpoint || null,
                    configured_at: new Date().toISOString()
                },
                tags: ['tool:config', `tool:${toolName}`, 'workspace:tools'],
                schema_name: 'tool.config.v1'
            };
            
            await apiClient.createBreadcrumb(configData);
            this.cancelToolConfig();
            this.showSuccess(`Tool "${toolName}" configured successfully`);
            
            // Refresh tool details
            this.showToolDetails(dashboardState.selectedTool);
            document.getElementById('selectedToolSection').style.display = 'block';
            
        } catch (error) {
            console.error('Failed to save tool configuration:', error);
            this.showError('Failed to save tool configuration: ' + error.message);
        }
    }
    
    getToolConfiguration(toolName) {
        // Look for existing configuration breadcrumbs
        const configBreadcrumb = dashboardState.breadcrumbs.find(b => 
            b.tags?.includes('tool:config') && 
            b.tags?.includes(`tool:${toolName}`) &&
            b.context?.tool_name === toolName
        );
        
        return configBreadcrumb?.context || null;
    }
    
    async testTool() {
        if (!dashboardState.selectedTool) {
            this.showError('No tool selected');
            return;
        }
        
        const tool = dashboardState.selectedTool;
        
        // Create a test breadcrumb for the tool
        try {
            const testData = {
                title: `Test ${tool.name}`,
                context: {
                    tool_name: tool.name,
                    test_request: true,
                    timestamp: new Date().toISOString()
                },
                tags: ['tool:test', `tool:${tool.name}`, 'workspace:test'],
                schema_name: 'tool.test.v1'
            };
            
            await apiClient.createBreadcrumb(testData);
            this.showSuccess(`Test request sent for ${tool.name}`);
            
        } catch (error) {
            console.error('Failed to test tool:', error);
            this.showError('Failed to test tool: ' + error.message);
        }
    }
    
    // ============ SECRET SELECTION AND UI ============
    
    selectSecret(secret) {
        dashboardState.selectedSecret = secret;
        this.showSecretDetails(secret);
        this.hideOtherSelectionPanels();
        document.getElementById('selectedSecretSection').style.display = 'block';
    }
    
    showSecretDetails(secret) {
        const detailsContainer = document.getElementById('secretDetails');
        const createdAt = new Date(secret.created_at).toLocaleString();
        
        detailsContainer.innerHTML = `
            <div class="detail-item">
                <strong>Name:</strong> ${this.escapeHtml(secret.name)}
            </div>
            <div class="detail-item">
                <strong>Scope:</strong> ${this.escapeHtml(secret.scope_type)}
            </div>
            <div class="detail-item">
                <strong>Created:</strong> ${createdAt}
            </div>
            <div class="detail-item">
                <strong>ID:</strong> <code style="font-size: 0.7rem;">${secret.id}</code>
            </div>
            <div class="detail-item">
                <strong>Value:</strong> <em>Encrypted (click decrypt to view)</em>
            </div>
        `;
    }
    
    enterSecretEditMode() {
        if (!dashboardState.selectedSecret) {
            this.showError('No secret selected');
            return;
        }
        
        const secret = dashboardState.selectedSecret;
        
        // Populate form
        document.getElementById('editSecretName').value = secret.name;
        document.getElementById('editSecretScope').value = secret.scope_type;
        document.getElementById('editSecretValue').value = '';
        
        // Show edit form
        document.getElementById('selectedSecretSection').style.display = 'none';
        document.getElementById('editSecretSection').style.display = 'block';
    }
    
    cancelSecretEdit() {
        document.getElementById('editSecretSection').style.display = 'none';
        if (dashboardState.selectedSecret) {
            document.getElementById('selectedSecretSection').style.display = 'block';
        }
    }
    
    cancelToolConfig() {
        document.getElementById('configToolSection').style.display = 'none';
        if (dashboardState.selectedTool) {
            document.getElementById('selectedToolSection').style.display = 'block';
        }
    }
    
    deselectSecret() {
        dashboardState.selectedSecret = null;
        document.getElementById('selectedSecretSection').style.display = 'none';
        document.getElementById('editSecretSection').style.display = 'none';
    }
    
    deselectTool() {
        dashboardState.selectedTool = null;
        document.getElementById('selectedToolSection').style.display = 'none';
        document.getElementById('configToolSection').style.display = 'none';
    }
    
    hideOtherSelectionPanels() {
        // Hide other selection panels when showing secret/tool details
        document.getElementById('selectedSection').style.display = 'none';
        document.getElementById('selectedAgentSection').style.display = 'none';
        document.getElementById('editSection').style.display = 'none';
        document.getElementById('editAgentSection').style.display = 'none';
    }
    
    // ============ UI HELPERS ============
    
    clearSecretForm() {
        document.getElementById('newSecretName').value = '';
        document.getElementById('newSecretScope').value = 'global';
        document.getElementById('newSecretValue').value = '';
    }
    
    updateSecretsCount() {
        const count = dashboardState.secrets?.length || 0;
        document.getElementById('secretCount').textContent = count;
    }
    
    renderSecretsList() {
        const listContainer = document.getElementById('secretList');
        if (!listContainer) return;
        
        if (!dashboardState.secrets || dashboardState.secrets.length === 0) {
            listContainer.innerHTML = '<div class="empty-state">No secrets found</div>';
            return;
        }
        
        listContainer.innerHTML = dashboardState.secrets.map(secret => `
            <div class="breadcrumb-item" onclick="secretsManager.selectSecret(${JSON.stringify(secret).replace(/"/g, '&quot;')})">
                <div class="breadcrumb-title">${this.escapeHtml(secret.name)}</div>
                <div class="breadcrumb-meta">
                    <span class="tag">${secret.scope_type}</span>
                    <span>Created: ${new Date(secret.created_at).toLocaleDateString()}</span>
                </div>
            </div>
        `).join('');
    }
    
    showSuccess(message) {
        // Simple success notification - in a real app you'd use a proper notification system
        console.log('✅ Success:', message);
        
        // Show temporary success message
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 255, 136, 0.1);
            border: 1px solid rgba(0, 255, 136, 0.3);
            color: #00ff88;
            padding: 1rem;
            border-radius: 8px;
            z-index: 10000;
            backdrop-filter: blur(10px);
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }
    
    showError(message) {
        console.error('❌ Error:', message);
        
        // Show temporary error message
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(255, 107, 107, 0.1);
            border: 1px solid rgba(255, 107, 107, 0.3);
            color: #ff6b6b;
            padding: 1rem;
            border-radius: 8px;
            z-index: 10000;
            backdrop-filter: blur(10px);
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ============ MODULE INTEGRATION ============
    
    static getInstance() {
        if (!SecretsManager.instance) {
            SecretsManager.instance = new SecretsManager();
        }
        return SecretsManager.instance;
    }
}

// Create singleton instance
export const secretsManager = SecretsManager.getInstance();
