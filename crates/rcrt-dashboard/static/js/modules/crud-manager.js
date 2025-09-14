/**
 * RCRT Dashboard CRUD Manager
 * Handles Create, Read, Update, Delete operations for breadcrumbs and agents
 */

import { dashboardState } from './state.js';
import { apiClient } from './api-client.js';

export class CrudManager {
    constructor() {
        this.init();
    }
    
    init() {
        // Note: Global functions are set up by the main dashboard app
        // This prevents conflicts and ensures proper initialization order
        console.log('🗂️ CRUD Manager initialized');
    }
    
    // ============ BREADCRUMB CRUD OPERATIONS ============
    
    async createBreadcrumb() {
        const title = document.getElementById('newTitle')?.value.trim() || '';
        const contextText = document.getElementById('newContext')?.value.trim() || '{}';
        
        if (!title) {
            alert('Please enter a title');
            return;
        }
        
        let context;
        try {
            context = contextText ? JSON.parse(contextText) : {};
        } catch (e) {
            alert('Invalid JSON in context field');
            return;
        }
        
        const breadcrumbData = {
            title: title,
            context: context,
            tags: [...dashboardState.newTags]
        };
        
        try {
            // Show loading state if dashboard controller is available
            if (window.dashboard?.showLoading) {
                window.dashboard.showLoading('Creating breadcrumb...');
            }
            
            const result = await apiClient.createBreadcrumb(breadcrumbData);
            
            this.clearForm();
            
            // Refresh the dashboard
            if (window.dashboard?.refreshData) {
                await window.dashboard.refreshData();
            }
            
            console.log('Breadcrumb created:', result.id);
            
        } catch (error) {
            console.error('Error creating breadcrumb:', error);
            alert('Error creating breadcrumb: ' + error.message);
        }
    }
    
    async updateBreadcrumb() {
        if (!dashboardState.selectedBreadcrumb) {
            alert('No breadcrumb selected');
            return;
        }
        
        const title = document.getElementById('editTitle')?.value.trim() || '';
        const contextText = document.getElementById('editContext')?.value.trim() || '{}';
        
        if (!title) {
            alert('Please enter a title');
            return;
        }
        
        let context;
        try {
            context = contextText ? JSON.parse(contextText) : {};
        } catch (e) {
            alert('Invalid JSON in context field');
            return;
        }
        
        const breadcrumbData = {
            title: title,
            context: context,
            tags: [...dashboardState.editTags]
        };
        
        try {
            // Show loading state if dashboard controller is available
            if (window.dashboard?.showLoading) {
                window.dashboard.showLoading('Updating breadcrumb...');
            }
            
            await apiClient.updateBreadcrumb(
                dashboardState.selectedBreadcrumb.id,
                breadcrumbData,
                dashboardState.selectedBreadcrumb.version
            );
            
            // Clear selection and reload
            this.deselectBreadcrumb();
            
            // Refresh the dashboard
            if (window.dashboard?.refreshData) {
                await window.dashboard.refreshData();
            }
            
        } catch (error) {
            console.error('Error updating breadcrumb:', error);
            alert('Error updating breadcrumb: ' + error.message);
        }
    }
    
    async deleteBreadcrumb() {
        if (!dashboardState.selectedBreadcrumb) {
            alert('No breadcrumb selected');
            return;
        }
        
        if (!confirm(`Are you sure you want to delete "${dashboardState.selectedBreadcrumb.title}"?`)) {
            return;
        }
        
        try {
            // Show loading state
            if (window.dashboard?.showLoading) {
                window.dashboard.showLoading('Deleting breadcrumb...');
            }
            
            await apiClient.deleteBreadcrumb(dashboardState.selectedBreadcrumb.id);
            
            // Clear all UI state
            this.deselectBreadcrumb();
            this.clearFilters();
            
            // Refresh the dashboard
            if (window.dashboard?.refreshData) {
                await window.dashboard.refreshData();
            }
            
            console.log('Breadcrumb deleted successfully');
            
        } catch (error) {
            console.error('Error deleting breadcrumb:', error);
            alert('Error deleting breadcrumb: ' + error.message);
            
            // Restore UI on error
            if (window.dashboard?.renderContent) {
                window.dashboard.renderContent();
            }
        }
    }
    
    async deleteAllFiltered() {
        const toDelete = dashboardState.filteredBreadcrumbs.length > 0 ? 
            dashboardState.filteredBreadcrumbs : dashboardState.breadcrumbs;
        
        if (toDelete.length === 0) {
            alert('No breadcrumbs to delete');
            return;
        }
        
        const filterText = dashboardState.filteredBreadcrumbs.length > 0 ? 'filtered ' : '';
        const message = `Are you sure you want to delete all ${toDelete.length} ${filterText}breadcrumbs?\n\nThis action cannot be undone!`;
        
        if (!confirm(message)) {
            return;
        }
        
        try {
            // Show progress loading state
            if (window.dashboard?.showLoading) {
                window.dashboard.showLoading(`Deleting ${toDelete.length} breadcrumbs...`);
            }
            
            // Use API client's bulk delete with progress tracking
            const { successCount, failedCount } = await apiClient.bulkDeleteBreadcrumbs(toDelete, (progress) => {
                if (window.dashboard?.showLoading) {
                    window.dashboard.showLoading(`Deleting ${progress.processed}/${progress.total} breadcrumbs...`);
                }
            });
            
            // Clear all UI state
            this.deselectBreadcrumb();
            this.clearFilters();
            
            // Refresh the dashboard
            if (window.dashboard?.refreshData) {
                await window.dashboard.refreshData();
            }
            
            // Show completion message
            if (failedCount > 0) {
                alert(`Bulk delete completed.\nSuccessful: ${successCount}\nFailed: ${failedCount}`);
            } else {
                console.log(`Successfully deleted ${successCount} breadcrumbs`);
            }
            
        } catch (error) {
            console.error('Error during bulk delete:', error);
            alert('Error occurred during bulk delete operation: ' + error.message);
            
            // Restore UI on error
            if (window.dashboard?.renderContent) {
                window.dashboard.renderContent();
            }
        }
    }
    
    // ============ AGENT CRUD OPERATIONS ============
    
    async updateAgent() {
        if (!dashboardState.selectedAgent || dashboardState.editAgentRoles.length === 0) {
            alert('Please select valid roles');
            return;
        }
        
        try {
            // Show loading state
            if (window.dashboard?.showLoading) {
                window.dashboard.showLoading('Updating agent...');
            }
            
            await apiClient.updateAgent(dashboardState.selectedAgent.id, dashboardState.editAgentRoles);
            
            // Clear selection and reload
            this.deselectAgent();
            
            // Force reload of agents data
            dashboardState.setState('dataLoaded', false);
            
            // Refresh the dashboard
            if (window.dashboard?.refreshData) {
                await window.dashboard.refreshData();
            }
            
        } catch (error) {
            console.error('Error updating agent:', error);
            alert('Error updating agent: ' + error.message);
        }
    }
    
    async deleteAgent() {
        if (!dashboardState.selectedAgent) {
            alert('No agent selected');
            return;
        }
        
        if (!confirm(`⚠️ Delete Agent?\n\nID: ${dashboardState.selectedAgent.id}\nRoles: ${dashboardState.selectedAgent.roles.join(', ')}\n\nThis will remove the agent and all its subscriptions.\n\nProceed?`)) {
            return;
        }
        
        try {
            // Show loading state
            if (window.dashboard?.showLoading) {
                window.dashboard.showLoading('Deleting agent...');
            }
            
            await apiClient.deleteAgent(dashboardState.selectedAgent.id);
            
            // Clear all UI state
            this.deselectAgent();
            this.deselectBreadcrumb();
            this.clearFilters();
            
            // Clear positions and data
            dashboardState.setState('nodePositions', []);
            dashboardState.setState('agentPositions', []);
            dashboardState.setState('connections', []);
            dashboardState.setState('dataLoaded', false); // Force reload
            
            // Refresh the dashboard
            if (window.dashboard?.refreshData) {
                await window.dashboard.refreshData();
            }
            
            console.log('Agent deleted successfully');
            
        } catch (error) {
            console.error('Error deleting agent:', error);
            alert('Error deleting agent: ' + error.message);
            
            // Restore UI on error
            if (window.dashboard?.renderContent) {
                window.dashboard.renderContent();
            }
        }
    }
    
    // ============ FORM MANAGEMENT ============
    
    clearForm() {
        const newTitle = document.getElementById('newTitle');
        const newContext = document.getElementById('newContext');
        
        if (newTitle) newTitle.value = '';
        if (newContext) newContext.value = '';
        
        dashboardState.setState('newTags', []);
        this.updateTagDisplay('newTags', dashboardState.newTags);
    }
    
    enterEditMode() {
        if (!dashboardState.selectedBreadcrumbDetails) return;
        
        const editTitle = document.getElementById('editTitle');
        const editContext = document.getElementById('editContext');
        
        if (editTitle) editTitle.value = dashboardState.selectedBreadcrumbDetails.title;
        if (editContext) editContext.value = JSON.stringify(dashboardState.selectedBreadcrumbDetails.context, null, 2);
        
        dashboardState.setState('editTags', [...dashboardState.selectedBreadcrumbDetails.tags]);
        this.updateTagDisplay('editTags', dashboardState.editTags);
        
        const selectedSection = document.getElementById('selectedSection');
        const editSection = document.getElementById('editSection');
        
        if (selectedSection) selectedSection.style.display = 'none';
        if (editSection) {
            editSection.style.display = 'block';
            editSection.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    cancelEdit() {
        dashboardState.setState('editTags', []);
        
        const editSection = document.getElementById('editSection');
        const selectedSection = document.getElementById('selectedSection');
        
        if (editSection) editSection.style.display = 'none';
        
        // Show selected section again if we have a selection
        if (dashboardState.selectedBreadcrumb && selectedSection) {
            selectedSection.style.display = 'block';
        }
    }
    
    enterAgentEditMode() {
        if (!dashboardState.selectedAgentDetails) return;
        
        const editAgentId = document.getElementById('editAgentId');
        if (editAgentId) editAgentId.value = dashboardState.selectedAgentDetails.id;
        
        dashboardState.setState('editAgentRoles', [...dashboardState.selectedAgentDetails.roles]);
        this.updateTagDisplay('editAgentRoles', dashboardState.editAgentRoles);
        
        const selectedAgentSection = document.getElementById('selectedAgentSection');
        const editAgentSection = document.getElementById('editAgentSection');
        
        if (selectedAgentSection) selectedAgentSection.style.display = 'none';
        if (editAgentSection) {
            editAgentSection.style.display = 'block';
            editAgentSection.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    cancelAgentEdit() {
        dashboardState.setState('editAgentRoles', []);
        
        const editAgentSection = document.getElementById('editAgentSection');
        const selectedAgentSection = document.getElementById('selectedAgentSection');
        
        if (editAgentSection) editAgentSection.style.display = 'none';
        
        // Show selected section again if we have a selection
        if (dashboardState.selectedAgent && selectedAgentSection) {
            selectedAgentSection.style.display = 'block';
        }
    }
    
    // ============ SELECTION MANAGEMENT ============
    
    deselectBreadcrumb() {
        dashboardState.setState('selectedBreadcrumb', null);
        dashboardState.setState('selectedBreadcrumbDetails', null);
        dashboardState.setState('editTags', []);
        
        const selectedSection = document.getElementById('selectedSection');
        const editSection = document.getElementById('editSection');
        const editTitle = document.getElementById('editTitle');
        const editContext = document.getElementById('editContext');
        
        if (selectedSection) selectedSection.style.display = 'none';
        if (editSection) editSection.style.display = 'none';
        if (editTitle) editTitle.value = '';
        if (editContext) editContext.value = '';
        
        this.updateTagDisplay('editTags', dashboardState.editTags);
        
        // Remove visual selection from list and canvas
        document.querySelectorAll('.breadcrumb-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelectorAll('.breadcrumb-node').forEach(node => {
            node.style.borderColor = 'rgba(0, 245, 255, 0.3)';
        });
    }
    
    deselectAgent() {
        dashboardState.setState('selectedAgent', null);
        dashboardState.setState('selectedAgentDetails', null);
        dashboardState.setState('editAgentRoles', []);
        
        const selectedAgentSection = document.getElementById('selectedAgentSection');
        const editAgentSection = document.getElementById('editAgentSection');
        const editAgentId = document.getElementById('editAgentId');
        
        if (selectedAgentSection) selectedAgentSection.style.display = 'none';
        if (editAgentSection) editAgentSection.style.display = 'none';
        if (editAgentId) editAgentId.value = '';
        
        this.updateTagDisplay('editAgentRoles', dashboardState.editAgentRoles);
        
        // Remove visual selection
        document.querySelectorAll('#agentList .breadcrumb-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelectorAll('.agent-node').forEach(node => {
            node.style.borderColor = 'rgba(255, 165, 0, 0.4)';
        });
    }
    
    // ============ FILTER MANAGEMENT ============
    
    clearFilters() {
        const searchInput = document.getElementById('searchInput');
        const dateFromFilter = document.getElementById('dateFromFilter');
        const dateToFilter = document.getElementById('dateToFilter');
        
        if (searchInput) searchInput.value = '';
        if (dateFromFilter) dateFromFilter.value = '';
        if (dateToFilter) dateToFilter.value = '';
        
        dashboardState.setState('selectedTagFilters', []);
        dashboardState.setState('filteredBreadcrumbs', []);
        
        this.updateTagFilterDisplay();
        
        if (window.dashboard?.updateStats) {
            window.dashboard.updateStats();
        }
    }
    
    // ============ UI HELPER FUNCTIONS ============
    
    updateTagDisplay(containerId, tags) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = tags.map(tag => 
            `<span class="tag-chip">
                ${this.escapeHtml(tag)}
                <span class="remove-tag" onclick="crudManager.removeTag('${containerId}', '${tag}')">×</span>
            </span>`
        ).join('');
    }
    
    updateTagFilterDisplay() {
        const container = document.getElementById('availableTags');
        if (container) {
            container.innerHTML = dashboardState.allAvailableTags.map(tag => `
                <span class="tag-filter-chip ${dashboardState.selectedTagFilters.includes(tag) ? 'active' : ''}" 
                      onclick="dashboard.toggleTagFilter('${tag}')">
                    ${this.escapeHtml(tag)}
                </span>
            `).join('');
        }
    }
    
    removeTag(containerId, tag) {
        if (containerId === 'newTags') {
            const newTags = dashboardState.newTags.filter(t => t !== tag);
            dashboardState.setState('newTags', newTags);
            this.updateTagDisplay('newTags', newTags);
        } else if (containerId === 'editTags') {
            const editTags = dashboardState.editTags.filter(t => t !== tag);
            dashboardState.setState('editTags', editTags);
            this.updateTagDisplay('editTags', editTags);
        } else if (containerId === 'editAgentRoles') {
            const editAgentRoles = dashboardState.editAgentRoles.filter(t => t !== tag);
            dashboardState.setState('editAgentRoles', editAgentRoles);
            this.updateTagDisplay('editAgentRoles', editAgentRoles);
        }
    }
    
    editBreadcrumbById(id) {
        // This is called from double-click in list
        if (window.dashboard?.selectBreadcrumbForDetails) {
            window.dashboard.selectBreadcrumbForDetails(id).then(() => {
                // After loading details, enter edit mode
                setTimeout(() => this.enterEditMode(), 100);
            });
        }
    }
    
    editAgentById(agentId) {
        const agent = dashboardState.agents.find(a => a.id === agentId);
        if (!agent) return;
        
        if (window.dashboard?.selectAgentForDetails) {
            window.dashboard.selectAgentForDetails(agent);
            setTimeout(() => this.enterAgentEditMode(), 100);
        }
    }
    
    // ============ TAG INPUT HANDLING ============
    
    handleTagInput(event) {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            const input = event.target;
            const tag = input.value.trim();
            if (tag && !dashboardState.newTags.includes(tag)) {
                const newTags = [...dashboardState.newTags, tag];
                dashboardState.setState('newTags', newTags);
                this.updateTagDisplay('newTags', newTags);
                input.value = '';
            }
        } else if (event.key === 'Backspace' && event.target.value === '') {
            if (dashboardState.newTags.length > 0) {
                const newTags = [...dashboardState.newTags];
                newTags.pop();
                dashboardState.setState('newTags', newTags);
                this.updateTagDisplay('newTags', newTags);
            }
        }
    }
    
    handleEditTagInput(event) {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            const input = event.target;
            const tag = input.value.trim();
            if (tag && !dashboardState.editTags.includes(tag)) {
                const editTags = [...dashboardState.editTags, tag];
                dashboardState.setState('editTags', editTags);
                this.updateTagDisplay('editTags', editTags);
                input.value = '';
            }
        } else if (event.key === 'Backspace' && event.target.value === '') {
            if (dashboardState.editTags.length > 0) {
                const editTags = [...dashboardState.editTags];
                editTags.pop();
                dashboardState.setState('editTags', editTags);
                this.updateTagDisplay('editTags', editTags);
            }
        }
    }
    
    handleAgentRoleInput(event) {
        const validRoles = ['curator', 'emitter', 'subscriber'];
        
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            const input = event.target;
            const role = input.value.trim().toLowerCase();
            
            if (validRoles.includes(role) && !dashboardState.editAgentRoles.includes(role)) {
                const editAgentRoles = [...dashboardState.editAgentRoles, role];
                dashboardState.setState('editAgentRoles', editAgentRoles);
                this.updateTagDisplay('editAgentRoles', editAgentRoles);
                input.value = '';
            } else if (role && !validRoles.includes(role)) {
                alert(`Invalid role: ${role}\nValid roles are: ${validRoles.join(', ')}`);
                input.value = '';
            } else if (dashboardState.editAgentRoles.includes(role)) {
                alert(`Role "${role}" already added`);
                input.value = '';
            }
        } else if (event.key === 'Backspace' && event.target.value === '') {
            if (dashboardState.editAgentRoles.length > 0) {
                const editAgentRoles = [...dashboardState.editAgentRoles];
                editAgentRoles.pop();
                dashboardState.setState('editAgentRoles', editAgentRoles);
                this.updateTagDisplay('editAgentRoles', editAgentRoles);
            }
        }
    }
    
    // ============ MODULE INTEGRATION ============
    
    // Make this manager available for the main app to use
    static getInstance() {
        if (!CrudManager.instance) {
            CrudManager.instance = new CrudManager();
        }
        return CrudManager.instance;
    }
    
    // ============ UTILITY FUNCTIONS ============
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
