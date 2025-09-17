/**
 * Dashboard State Management
 * Centralized state store for the RCRT dashboard
 */

export class DashboardState {
    constructor() {
        // Core data
        this.breadcrumbs = [];
        this.filteredBreadcrumbs = [];
        this.agents = [];
        this.agentDefinitions = [];
        this.subscriptions = [];
        this.availableTools = [];
        this.secrets = [];
        this.connections = [];
        
        // UI state
        this.selectedBreadcrumb = null;
        this.selectedBreadcrumbDetails = null;
        this.selectedAgent = null;
        this.selectedAgentDetails = null;
        this.selectedAgentDefinition = null;
        this.selectedSecret = null;
        this.selectedTool = null;
        
        // Canvas state
        this.nodePositions = [];
        this.agentPositions = [];
        this.agentDefinitionPositions = [];
        this.toolPositions = [];
        this.secretPositions = [];
        this.customNodePositions = new Map();
        this.customAgentPositions = new Map();
        this.customAgentDefinitionPositions = new Map();
        this.customToolPositions = new Map();
        this.customSecretPositions = new Map();
        
        // Interaction state
        this.isDragging = false;
        this.isDraggingNode = false;
        this.draggedNode = null;
        this.draggedNodeType = null;
        this.draggedNodeIndex = -1;
        this.lastUserInteraction = Date.now();
        
        // Canvas transform
        this.canvasOffset = { x: 0, y: 0 };
        this.scale = 1;
        
        // UI elements
        this.newTags = [];
        this.editTags = [];
        this.editAgentRoles = [];
        this.selectedTagFilters = [];
        this.allAvailableTags = [];
        
        // Event stream
        this.eventSource = null;
        this.eventLog = [];
        this.maxEventLogSize = 100;
        this.autoScroll = true;
        this.streamPaused = false;
        this.hidePings = false;
        this.eventFilters = new Set(['all']);
        
        // Chat interface
        this.chatTags = [];
        this.availableWorkspaces = new Set();
        this.breadcrumbTemplates = new Map();
        
        // 3D visualization
        this.is3DMode = false;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.nodeObjects3D = new Map();
        this.agentObjects3D = new Map();
        this.toolObjects3D = new Map();
        this.secretObjects3D = new Map();
        
        // UI layout
        this.leftPanelWidth = 350;
        this.rightPanelWidth = 350;
        this.collapsedSections = new Set();
        
        // RCRT connection
        this.rcrtJwtToken = null;
        this.rcrtBaseUrl = 'http://localhost:8081';
        
        // Data loading flag
        this.dataLoaded = false;
        
        // Subscribe to changes (simple observer pattern)
        this.listeners = new Map();
    }
    
    /**
     * Subscribe to state changes
     * @param {string} key - State property to watch
     * @param {function} callback - Function to call when state changes
     */
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.listeners.get(key) || [];
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        };
    }
    
    /**
     * Notify listeners of state changes
     * @param {string} key - State property that changed
     * @param {any} value - New value
     */
    notify(key, value) {
        const callbacks = this.listeners.get(key) || [];
        callbacks.forEach(callback => {
            try {
                callback(value, key);
            } catch (error) {
                console.error(`Error in state listener for ${key}:`, error);
            }
        });
    }
    
    /**
     * Update state with change notification
     * @param {string} key - State property to update
     * @param {any} value - New value
     */
    setState(key, value) {
        const oldValue = this[key];
        this[key] = value;
        
        // Only notify if value actually changed
        if (oldValue !== value) {
            this.notify(key, value);
        }
    }
    
    /**
     * Get current state value
     * @param {string} key - State property to get
     * @returns {any} Current value
     */
    getState(key) {
        return this[key];
    }
    
    /**
     * Clear all selections
     */
    clearSelections() {
        this.setState('selectedBreadcrumb', null);
        this.setState('selectedBreadcrumbDetails', null);
        this.setState('selectedAgent', null);
        this.setState('selectedAgentDetails', null);
    }
    
    /**
     * Clear all filters
     */
    clearFilters() {
        this.setState('filteredBreadcrumbs', []);
        this.setState('selectedTagFilters', []);
    }
    
    /**
     * Update user interaction timestamp
     */
    trackUserInteraction() {
        this.setState('lastUserInteraction', Date.now());
    }
    
    /**
     * Save UI state to localStorage
     */
    saveUIState() {
        const uiState = {
            leftPanelWidth: this.leftPanelWidth,
            rightPanelWidth: this.rightPanelWidth,
            collapsedSections: Array.from(this.collapsedSections),
            customNodePositions: Array.from(this.customNodePositions.entries()),
            customAgentPositions: Array.from(this.customAgentPositions.entries()),
            customToolPositions: Array.from(this.customToolPositions.entries())
        };
        
        try {
            localStorage.setItem('rcrt-dashboard-ui-state', JSON.stringify(uiState));
        } catch (error) {
            console.error('Failed to save UI state:', error);
        }
    }
    
    /**
     * Load UI state from localStorage
     */
    loadUIState() {
        try {
            const saved = localStorage.getItem('rcrt-dashboard-ui-state');
            if (saved) {
                const uiState = JSON.parse(saved);
                
                this.leftPanelWidth = uiState.leftPanelWidth || 350;
                this.rightPanelWidth = uiState.rightPanelWidth || 350;
                this.collapsedSections = new Set(uiState.collapsedSections || []);
                
                // Restore custom positions
                if (uiState.customNodePositions) {
                    this.customNodePositions = new Map(uiState.customNodePositions);
                }
                if (uiState.customAgentPositions) {
                    this.customAgentPositions = new Map(uiState.customAgentPositions);
                }
                if (uiState.customToolPositions) {
                    this.customToolPositions = new Map(uiState.customToolPositions);
                }
            }
        } catch (error) {
            console.error('Failed to load UI state:', error);
        }
    }
}

// Create singleton instance
export const dashboardState = new DashboardState();
