/**
 * RCRT Dashboard - Main Entry Point
 * Modern ES6 modular dashboard replacing the monolithic dashboard.js
 */

import { dashboardController } from './modules/dashboard-controller.js';
import { dashboardState } from './modules/state.js';
import { apiClient } from './modules/api-client.js';
import { secretsManager } from './modules/secrets-manager.js';
import { superAgentChat } from './modules/super-agent-chat.js';

// ============ MAIN INITIALIZATION ============

class DashboardApplication {
    constructor() {
        this.controller = dashboardController;
        this.eventStreamModule = null;
        this.adminModule = null;
        this.chatModule = null;
        this.threeDModule = null;
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Starting RCRT Dashboard v2.0 (Modular)');
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeModules());
        } else {
            await this.initializeModules();
        }
    }
    
    async initializeModules() {
        try {
            // Core controller is already initialized via import
            console.log('✅ Core dashboard controller loaded');
            
            // Load additional modules on demand
            await this.loadEventStreamModule();
            await this.loadUIModules();
            
            // Initialize global dashboard reference for legacy compatibility
            window.dashboard = this.createLegacyAPI();
            
            // Set up global wrapper functions for HTML onclick handlers
            this.setupGlobalWrappers();
            
            console.log('🎯 Dashboard application fully initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize dashboard:', error);
            this.showInitializationError(error);
        }
    }
    
    async loadEventStreamModule() {
        try {
            const { EventStreamManager } = await import('./modules/event-stream.js');
            this.eventStreamModule = new EventStreamManager();
            console.log('✅ Event stream module loaded');
        } catch (error) {
            console.warn('⚠️ Event stream module failed to load:', error);
        }
    }
    
    async loadUIModules() {
        try {
            // Load UI management modules
            const { UIManager } = await import('./modules/ui-manager.js');
            this.uiManager = new UIManager();
            console.log('✅ UI management modules loaded');
            
            // Load CRUD module (needed for form operations)
            await this.loadCrudModule();
            console.log('✅ CRUD module loaded');
            
            // Load chat module (needed for chat interface)
            await this.loadChatModule();
            console.log('✅ Chat module loaded');
            
            // Load admin module (needed for hygiene button)
            await this.loadAdminModule();
            console.log('✅ Admin module loaded');
            
        } catch (error) {
            console.warn('⚠️ UI modules failed to load:', error);
        }
    }
    
    // Create legacy API for backward compatibility with HTML onclick handlers
    createLegacyAPI() {
        return {
            // Core functions
            selectBreadcrumbForDetails: (id) => this.controller.selectBreadcrumbForDetails(id),
            selectAgentForDetails: (agent) => this.controller.selectAgentForDetails(agent),
            refreshData: () => this.controller.refreshData(),
            
            // Canvas functions
            resetView: () => this.controller.canvasEngine.resetView(),
            resetNodePositions: () => this.controller.canvasEngine.resetNodePositions(),
            centerView: () => this.controller.canvasEngine.centerViewOnContent(),
            
            // Filter functions (these would be in UI manager)
            toggleTagFilter: (tag) => this.toggleTagFilter(tag),
            clearFilters: () => this.clearFilters(),
            applyFilters: () => this.applyFilters(),
            
            // CRUD operations (these would be in CRUD manager)
            editBreadcrumbById: (id) => this.editBreadcrumbById(id),
            editAgentById: (id) => this.editAgentById(id),
            
            // Admin functions (load on demand)
            showAdminPanel: async () => {
                const adminModule = await this.loadAdminModule();
                adminModule.showAdminPanel();
            },
            
            // 3D functions (load on demand)
            toggle3DView: async () => {
                const threeDModule = await this.load3DModule();
                threeDModule.toggle3DView();
            },
            
            // State access
            state: dashboardState,
            api: apiClient
        };
    }
    
    async loadAdminModule() {
        if (!this.adminModule) {
            const { AdminManager } = await import('./modules/admin-manager.js');
            this.adminModule = new AdminManager();
        }
        return this.adminModule;
    }
    
    async loadChatModule() {
        if (!this.chatModule) {
            const { ChatManager } = await import('./modules/chat-manager.js');
            this.chatModule = new ChatManager();
        }
        return this.chatModule;
    }
    
    async load3DModule() {
        if (!this.threeDModule) {
            const { ThreeDEngine } = await import('./modules/3d-engine.js');
            this.threeDModule = new ThreeDEngine();
        }
        return this.threeDModule;
    }
    
    async loadCrudModule() {
        if (!this.crudModule) {
            const { CrudManager } = await import('./modules/crud-manager.js');
            this.crudModule = new CrudManager();
        }
        return this.crudModule;
    }
    
    // Setup global wrapper functions for HTML onclick handlers
    setupGlobalWrappers() {
        // These functions handle module integration for HTML onclick handlers
        
        // 3D View toggle - only this one stays lazy loaded
        window.toggle3DView = () => {
            this.load3DModule().then(async (threeDModule) => {
                await threeDModule.toggle3DView();
            }).catch(error => {
                console.error('Failed to load 3D module:', error);
                alert('Failed to load 3D visualization: ' + error.message);
            });
        };
        
        // Canvas functions - available immediately
        window.resetView = () => this.controller.canvasEngine.resetView();
        window.resetNodePositions = () => this.controller.canvasEngine.resetNodePositions();
        window.refreshBreadcrumbs = () => this.controller.refreshData();
        
        // Panel toggle functions - available immediately via UI manager
        window.togglePanel = () => {
            if (this.uiManager) this.uiManager.togglePanel();
        };
        window.toggleRightPanel = () => {
            if (this.uiManager) this.uiManager.toggleRightPanel();
        };
        window.toggleSectionCollapse = (sectionId) => {
            if (this.uiManager) this.uiManager.toggleSectionCollapse(sectionId);
        };
        
        // Filter functions - delegate to main app
        window.applyFilters = () => this.applyFilters();
        window.clearFilters = () => this.clearFilters();
        window.showAllBreadcrumbs = () => this.clearFilters();
        window.showRecentBreadcrumbs = () => this.showRecentBreadcrumbs();
        
        // CRUD functions - available immediately (modules loaded on startup)
        this.setupCrudWrappers();
        
        // Chat functions - available immediately (modules loaded on startup)
        this.setupChatWrappers();
        
        // Admin functions - available immediately (modules loaded on startup)
        this.setupAdminWrappers();
        
        // Secrets management functions - available immediately
        this.setupSecretsWrappers();
        
        // Super agent chat functions - available immediately
        this.setupSuperAgentChatWrappers();
        
        
        console.log('🌐 Global wrapper functions set up for HTML compatibility');
    }
    
    
    setupCrudWrappers() {
        // Breadcrumb CRUD operations - modules already loaded
        window.createBreadcrumb = () => this.crudModule?.createBreadcrumb();
        window.updateBreadcrumb = () => this.crudModule?.updateBreadcrumb();
        window.deleteBreadcrumb = () => this.crudModule?.deleteBreadcrumb();
        window.deleteAllFiltered = () => this.crudModule?.deleteAllFiltered();
        
        // Agent CRUD operations
        window.updateAgent = () => this.crudModule?.updateAgent();
        window.deleteAgent = () => this.crudModule?.deleteAgent();
        
        // Form management
        window.clearForm = () => this.crudModule?.clearForm();
        window.enterEditMode = () => this.crudModule?.enterEditMode();
        window.cancelEdit = () => this.crudModule?.cancelEdit();
        window.enterAgentEditMode = () => this.crudModule?.enterAgentEditMode();
        window.cancelAgentEdit = () => this.crudModule?.cancelAgentEdit();
        
        // Selection functions
        window.deselectBreadcrumb = () => this.crudModule?.deselectBreadcrumb();
        window.deselectAgent = () => this.crudModule?.deselectAgent();
        
        // Edit by ID functions
        window.editBreadcrumbById = (id) => this.crudModule?.editBreadcrumbById(id);
        window.editAgentById = (id) => this.crudModule?.editAgentById(id);
        
        // Tag input handling
        window.handleTagInput = (event) => this.crudModule?.handleTagInput(event);
        window.handleEditTagInput = (event) => this.crudModule?.handleEditTagInput(event);
        window.handleAgentRoleInput = (event) => this.crudModule?.handleAgentRoleInput(event);
        
        // Focus functions
        window.focusTagInput = () => document.getElementById('tagInput')?.focus();
        window.focusEditTagInput = () => document.getElementById('editTagInput')?.focus();
        window.focusAgentRoleInput = () => document.getElementById('agentRoleInput')?.focus();
        
        // Tag removal functions
        window.removeTag = (containerId, tag) => this.crudModule?.removeTag(containerId, tag);
    }
    
    setupChatWrappers() {
        // Quick test functions - modules already loaded
        window.sendEchoTest = () => this.chatModule?.sendEchoTest();
        window.sendLLMTest = () => this.chatModule?.sendLLMTest();
        window.sendRandomTest = () => this.chatModule?.sendRandomTest();
        
        // Template functions
        window.updateBreadcrumbTemplate = () => this.chatModule?.updateBreadcrumbTemplate();
        window.updateWorkspaceOptions = () => this.chatModule?.updateWorkspaceOptions();
        
        // Chat form functions
        window.sendChatBreadcrumb = () => this.chatModule?.sendChatBreadcrumb();
        window.clearChatForm = () => this.chatModule?.clearChatForm();
        
        // Chat tag functions
        window.handleChatTagInput = (event) => this.chatModule?.handleChatTagInput(event);
        window.focusChatTagInput = () => this.chatModule?.focusChatTagInput();
        window.removeChatTag = (tag) => this.chatModule?.removeChatTag(tag);
    }
    
    setupAdminWrappers() {
        // Admin panel management - modules already loaded
        window.showAdminPanel = () => this.adminModule?.showAdminPanel();
        window.hideAdminPanel = () => this.adminModule?.hideAdminPanel();
        window.showAdminTab = (tabName) => this.adminModule?.showAdminTab(tabName);
        
        // Hygiene functions
        window.triggerHygieneCleanup = () => this.adminModule?.triggerHygieneCleanup();
        
        // Individual admin entity refresh functions
        window.refreshAgents = () => this.adminModule?.refreshAgents();
        window.refreshSubscriptions = () => this.adminModule?.refreshSubscriptions();
        window.refreshTenants = () => this.adminModule?.refreshTenants();
        window.refreshSecrets = () => this.adminModule?.refreshSecrets();
        window.refreshAcl = () => this.adminModule?.refreshAcl();
        window.refreshWebhooks = () => this.adminModule?.refreshWebhooks();
        
        // Admin action functions
        window.viewAgent = (id) => this.adminModule?.viewAgent(id);
        window.viewAgentWebhooks = (agentId) => this.adminModule?.viewAgentWebhooks(agentId);
        window.viewTenant = (id) => this.adminModule?.viewTenant(id);
        window.viewSecret = (id) => this.adminModule?.viewSecret(id);
        window.revokeAcl = (id) => this.adminModule?.revokeAcl(id);
        window.viewSubscription = (id) => this.adminModule?.viewSubscription(id);
        window.deleteSubscription = (id) => this.adminModule?.deleteSubscription(id);
        window.showCreateSubscription = () => this.adminModule?.showCreateSubscription();
        window.subscribeToThisBreadcrumb = () => this.adminModule?.subscribeToThisBreadcrumb();
    }
    
    setupSecretsWrappers() {
        // Make secrets manager available globally
        window.secretsManager = secretsManager;
        
        // Secrets CRUD operations
        window.createNewSecret = () => secretsManager.createNewSecret();
        window.updateSecret = () => secretsManager.updateSecret();
        window.deleteSecret = () => secretsManager.deleteSecret();
        window.decryptSecret = () => secretsManager.decryptSecret();
        
        // Secret form management
        window.clearSecretForm = () => secretsManager.clearSecretForm();
        window.enterSecretEditMode = () => secretsManager.enterSecretEditMode();
        window.cancelSecretEdit = () => secretsManager.cancelSecretEdit();
        window.deselectSecret = () => secretsManager.deselectSecret();
        
        // Tool configuration functions
        window.enterToolConfigMode = () => secretsManager.enterToolConfigMode();
        window.saveToolConfiguration = () => secretsManager.saveToolConfiguration();
        window.cancelToolConfig = () => secretsManager.cancelToolConfig();
        window.testTool = () => secretsManager.testTool();
        window.deselectTool = () => secretsManager.deselectTool();
    }
    
    setupSuperAgentChatWrappers() {
        // Make super agent chat manager available globally
        window.superAgentChat = superAgentChat;
        
        // Chat interface functions
        window.sendChatMessage = () => superAgentChat.sendMessage();
        window.toggleChatInterface = () => superAgentChat.toggleChatInterface();
        window.clearChatHistory = () => superAgentChat.clearChatHistory();
        window.handleChatInput = (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                superAgentChat.sendMessage();
            }
        };
    }
    
    showRecentBreadcrumbs() {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const dateFromFilter = document.getElementById('dateFromFilter');
        const dateToFilter = document.getElementById('dateToFilter');
        
        if (dateFromFilter) dateFromFilter.value = sevenDaysAgo.toISOString().split('T')[0];
        if (dateToFilter) dateToFilter.value = new Date().toISOString().split('T')[0];
        
        this.applyFilters();
    }
    
    // Legacy compatibility functions - these should be moved to appropriate modules
    toggleTagFilter(tag) {
        dashboardState.trackUserInteraction();
        
        const index = dashboardState.selectedTagFilters.indexOf(tag);
        if (index === -1) {
            dashboardState.selectedTagFilters.push(tag);
        } else {
            dashboardState.selectedTagFilters.splice(index, 1);
        }
        
        this.applyFilters();
        this.updateTagFilterDisplay();
    }
    
    applyFilters() {
        dashboardState.trackUserInteraction();
        
        const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
        const dateFrom = document.getElementById('dateFromFilter')?.value || '';
        const dateTo = document.getElementById('dateToFilter')?.value || '';
        
        const filtered = dashboardState.breadcrumbs.filter(breadcrumb => {
            // Search filter
            const matchesSearch = !searchTerm || breadcrumb.title.toLowerCase().includes(searchTerm);
            
            // Tag filter
            const matchesTags = dashboardState.selectedTagFilters.length === 0 || 
                dashboardState.selectedTagFilters.every(filterTag => breadcrumb.tags.includes(filterTag));
            
            // Date filter
            let matchesDate = true;
            if (dateFrom || dateTo) {
                const breadcrumbDate = new Date(breadcrumb.updated_at).toDateString();
                const fromDate = dateFrom ? new Date(dateFrom).toDateString() : null;
                const toDate = dateTo ? new Date(dateTo).toDateString() : null;
                
                if (fromDate && breadcrumbDate < fromDate) matchesDate = false;
                if (toDate && breadcrumbDate > toDate) matchesDate = false;
            }
            
            return matchesSearch && matchesTags && matchesDate;
        });
        
        dashboardState.setState('filteredBreadcrumbs', filtered);
        this.controller.updateStats();
    }
    
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
        this.controller.updateStats();
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
    
    editBreadcrumbById(id) {
        // This would be handled by a CRUD manager module
        console.log('Edit breadcrumb:', id);
        alert('CRUD operations module not yet implemented in this refactor demo');
    }
    
    editAgentById(id) {
        // This would be handled by a CRUD manager module
        console.log('Edit agent:', id);
        alert('CRUD operations module not yet implemented in this refactor demo');
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showInitializationError(error) {
        document.body.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #ff6b6b;">
                <h1>Dashboard Initialization Error</h1>
                <p>Failed to load the dashboard application:</p>
                <pre style="background: #1a1a1a; padding: 1rem; border-radius: 8px; text-align: left;">${error.message}</pre>
                <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem;">Reload Page</button>
            </div>
        `;
    }
}

// Initialize the application
const app = new DashboardApplication();

// Export for testing and debugging
export { app as dashboardApp };
