/**
 * RCRT Dashboard Chat Manager
 * Handles chat interface, breadcrumb templates, and test functions
 */

import { dashboardState } from './state.js';
import { apiClient } from './api-client.js';

export class ChatManager {
    constructor() {
        this.breadcrumbTemplates = new Map();
        this.chatTags = [];
        
        this.init();
    }
    
    init() {
        this.initializeBreadcrumbTemplates();
        // Note: Global functions are set up by the main dashboard app
        console.log('💬 Chat Manager initialized');
    }
    
    // ============ BREADCRUMB TEMPLATES ============
    
    initializeBreadcrumbTemplates() {
        this.breadcrumbTemplates.set('tool.request.v1', {
            title: 'Tool Request Test',
            context: {
                tool: 'openrouter',
                input: {
                    messages: [
                        { role: 'user', content: 'Hello! Please respond with: TEST_SUCCESS' }
                    ],
                    model: 'google/gemini-2.5-flash',
                    temperature: 0.7,
                    max_tokens: 50
                }
            },
            tags: ['tool:request']
        });
        
        this.breadcrumbTemplates.set('agent.def.v1', {
            title: 'Test Agent Definition',
            context: {
                agent_id: 'test-agent-' + Date.now(),
                thinking_llm_tool: 'openrouter',
                model: 'google/gemini-2.5-flash',
                system_prompt: 'You are a helpful test agent.',
                capabilities: ['reasoning', 'analysis'],
                max_runs: 5
            },
            tags: ['agent:def', 'agent:temporary']
        });
        
        this.breadcrumbTemplates.set('prompt.system.v1', {
            title: 'Test System Prompt',
            context: {
                role: 'system',
                content: 'You are a specialized AI assistant for testing purposes.',
                parameters: {
                    temperature: 0.7,
                    max_tokens: 1000
                },
                category: 'testing'
            },
            tags: ['prompt:system', 'test']
        });
        
        this.breadcrumbTemplates.set('ui.plan.v1', {
            title: 'Test UI Plan',
            context: {
                actions: [
                    {
                        type: 'create_instance',
                        region: 'main',
                        instance: {
                            component_ref: 'TestCard',
                            props: {
                                title: 'Test Component',
                                description: 'A test UI component'
                            }
                        }
                    }
                ]
            },
            tags: ['ui:plan', 'test']
        });
        
        // Update state reference
        dashboardState.breadcrumbTemplates = this.breadcrumbTemplates;
    }
    
    // ============ WORKSPACE MANAGEMENT ============
    
    updateWorkspaceOptions() {
        // Collect unique workspaces from existing breadcrumbs
        const workspaces = new Set(['workspace:tools', 'workspace:agents', 'workspace:ui', 'workspace:test']);
        
        dashboardState.breadcrumbs.forEach(breadcrumb => {
            breadcrumb.tags.forEach(tag => {
                if (tag.startsWith('workspace:')) {
                    workspaces.add(tag);
                }
            });
        });
        
        const workspaceSelect = document.getElementById('workspaceSelect');
        if (workspaceSelect) {
            const currentValue = workspaceSelect.value;
            workspaceSelect.innerHTML = Array.from(workspaces).sort().map(ws => {
                const icon = ws.includes('tools') ? '🛠️' : ws.includes('agents') ? '🤖' : ws.includes('ui') ? '🎨' : '🧪';
                return `<option value="${ws}">${icon} ${ws}</option>`;
            }).join('');
            
            // Restore selection if it still exists
            if (Array.from(workspaces).includes(currentValue)) {
                workspaceSelect.value = currentValue;
            }
        }
    }
    
    // ============ QUICK TEST FUNCTIONS ============
    
    async sendEchoTest() {
        const workspaceSelect = document.getElementById('workspaceSelect');
        const workspace = workspaceSelect ? workspaceSelect.value : 'workspace:test';
        
        const testData = {
            schema_name: 'tool.request.v1',
            title: 'Echo Test from Dashboard',
            tags: [workspace, 'tool:request', 'test:echo'],
            context: {
                tool: 'echo',
                input: {
                    message: 'Dashboard echo test: ' + new Date().toLocaleTimeString()
                }
            }
        };
        
        await this.sendBreadcrumb(testData);
    }
    
    async sendLLMTest() {
        const workspaceSelect = document.getElementById('workspaceSelect');
        const workspace = workspaceSelect ? workspaceSelect.value : 'workspace:test';
        
        const testData = {
            schema_name: 'tool.request.v1',
            title: 'LLM Test from Dashboard',
            tags: [workspace, 'tool:request', 'test:llm'],
            context: {
                tool: 'openrouter',
                input: {
                    messages: [
                        { role: 'user', content: 'Please respond with: DASHBOARD_LLM_SUCCESS' }
                    ],
                    model: 'google/gemini-2.5-flash',
                    temperature: 0.1,
                    max_tokens: 20
                }
            }
        };
        
        await this.sendBreadcrumb(testData);
    }
    
    async sendRandomTest() {
        const workspaceSelect = document.getElementById('workspaceSelect');
        const workspace = workspaceSelect ? workspaceSelect.value : 'workspace:test';
        
        const testData = {
            schema_name: 'tool.request.v1', 
            title: 'Random Number Test',
            tags: [workspace, 'tool:request', 'test:random'],
            context: {
                tool: 'random',
                input: {
                    min: 1,
                    max: 100,
                    count: 3
                }
            }
        };
        
        await this.sendBreadcrumb(testData);
    }
    
    // ============ TEMPLATE MANAGEMENT ============
    
    updateBreadcrumbTemplate() {
        const breadcrumbType = document.getElementById('breadcrumbType');
        if (!breadcrumbType) return;
        
        const selectedType = breadcrumbType.value;
        
        if (selectedType === 'custom') {
            // Clear for custom entry
            this.setChatField('chatTitle', '');
            this.setChatField('chatContext', '{}');
            this.chatTags = [];
            this.updateChatTagDisplay();
            return;
        }
        
        const template = this.breadcrumbTemplates.get(selectedType);
        if (template) {
            this.setChatField('chatTitle', template.title);
            this.setChatField('chatContext', JSON.stringify(template.context, null, 2));
            this.chatTags = [...template.tags];
            this.updateChatTagDisplay();
        }
    }
    
    setChatField(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = value;
        }
    }
    
    // ============ CHAT TAG MANAGEMENT ============
    
    handleChatTagInput(event) {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            const input = event.target;
            const tag = input.value.trim();
            if (tag && !this.chatTags.includes(tag)) {
                this.chatTags.push(tag);
                this.updateChatTagDisplay();
                input.value = '';
            }
        } else if (event.key === 'Backspace' && event.target.value === '') {
            if (this.chatTags.length > 0) {
                this.chatTags.pop();
                this.updateChatTagDisplay();
            }
        }
    }
    
    focusChatTagInput() {
        const input = document.getElementById('chatTagInput');
        if (input) {
            input.focus();
        }
    }
    
    updateChatTagDisplay() {
        const container = document.getElementById('chatTags');
        if (!container) return;
        
        container.innerHTML = this.chatTags.map(tag => 
            `<span class="tag-chip">
                ${this.escapeHtml(tag)}
                <span class="remove-tag" onclick="chatManager.removeChatTag('${tag}')">×</span>
            </span>`
        ).join('');
    }
    
    removeChatTag(tag) {
        this.chatTags = this.chatTags.filter(t => t !== tag);
        this.updateChatTagDisplay();
    }
    
    // ============ BREADCRUMB SENDING ============
    
    async sendChatBreadcrumb() {
        const type = this.getChatFieldValue('breadcrumbType');
        const workspace = this.getChatFieldValue('workspaceSelect');
        const title = this.getChatFieldValue('chatTitle').trim();
        const contextText = this.getChatFieldValue('chatContext').trim();
        
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
        
        // Combine workspace with additional tags
        const allTags = [workspace, ...this.chatTags];
        
        const breadcrumbData = {
            schema_name: type === 'custom' ? undefined : type,
            title: title,
            context: context,
            tags: allTags
        };
        
        await this.sendBreadcrumb(breadcrumbData);
    }
    
    getChatFieldValue(fieldId) {
        const field = document.getElementById(fieldId);
        return field ? field.value : '';
    }
    
    async sendBreadcrumb(data) {
        try {
            const result = await apiClient.createBreadcrumb(data);
            console.log('Breadcrumb sent via chat:', result.id);
            
            // Add success event to log if event stream manager is available
            if (window.eventStreamManager?.addEventToLog) {
                window.eventStreamManager.addEventToLog({
                    type: 'breadcrumb.sent',
                    breadcrumb_id: result.id,
                    title: data.title,
                    schema_name: data.schema_name,
                    tags: data.tags,
                    timestamp: new Date().toISOString(),
                    source: 'dashboard_chat'
                });
            }
            
            // Refresh breadcrumbs list after delay
            setTimeout(() => {
                if (window.dashboard?.refreshData) {
                    window.dashboard.refreshData();
                }
            }, 1000);
            
        } catch (error) {
            console.error('Error sending breadcrumb:', error);
            alert(`Failed to send breadcrumb: ${error.message}`);
        }
    }
    
    // ============ FORM MANAGEMENT ============
    
    clearChatForm() {
        this.setChatField('chatTitle', '');
        this.setChatField('chatContext', '{}');
        this.chatTags = [];
        this.updateChatTagDisplay();
        
        const breadcrumbType = document.getElementById('breadcrumbType');
        if (breadcrumbType) {
            breadcrumbType.selectedIndex = 0;
        }
        
        this.updateBreadcrumbTemplate();
    }
    
    // ============ EVENT FILTERING (Legacy from original) ============
    
    toggleEventFilter(filterType) {
        const button = document.getElementById('filter' + filterType.charAt(0).toUpperCase() + filterType.slice(1));
        
        if (filterType === 'all') {
            dashboardState.eventFilters.clear();
            dashboardState.eventFilters.add('all');
            
            // Update all button states
            document.querySelectorAll('[id^="filter"]').forEach(btn => {
                btn.classList.remove('btn-primary');
            });
            if (button) button.classList.add('btn-primary');
        } else {
            if (dashboardState.eventFilters.has('all')) {
                dashboardState.eventFilters.clear();
                const filterAll = document.getElementById('filterAll');
                if (filterAll) filterAll.classList.remove('btn-primary');
            }
            
            if (dashboardState.eventFilters.has(filterType)) {
                dashboardState.eventFilters.delete(filterType);
                if (button) button.classList.remove('btn-primary');
            } else {
                dashboardState.eventFilters.add(filterType);
                if (button) button.classList.add('btn-primary');
            }
            
            // If no specific filters, default back to all
            if (dashboardState.eventFilters.size === 0) {
                dashboardState.eventFilters.add('all');
                const filterAll = document.getElementById('filterAll');
                if (filterAll) filterAll.classList.add('btn-primary');
            }
        }
        
        // Re-render event log with new filters if event stream manager is available
        if (window.eventStreamManager?.renderEventLog) {
            window.eventStreamManager.renderEventLog();
        }
    }
    
    shouldShowEvent(event) {
        if (dashboardState.eventFilters.has('all')) {
            return true;
        }
        
        // Filter by event type patterns
        const eventType = event.type || 'unknown';
        const schema = event.schema_name || '';
        const tags = event.tags || [];
        
        if (dashboardState.eventFilters.has('tool') && (
            eventType.includes('tool') || 
            schema.includes('tool.') ||
            tags.some(tag => tag.includes('tool'))
        )) {
            return true;
        }
        
        if (dashboardState.eventFilters.has('agent') && (
            eventType.includes('agent') || 
            schema.includes('agent.') ||
            tags.some(tag => tag.includes('agent'))
        )) {
            return true;
        }
        
        if (dashboardState.eventFilters.has('ui') && (
            eventType.includes('ui') || 
            schema.includes('ui.') ||
            tags.some(tag => tag.includes('ui'))
        )) {
            return true;
        }
        
        if (dashboardState.eventFilters.has('ping') && eventType === 'ping') {
            return true;
        }
        
        return false;
    }
    
    // ============ MODULE INTEGRATION ============
    
    // Make this manager available for the main app to use
    static getInstance() {
        if (!ChatManager.instance) {
            ChatManager.instance = new ChatManager();
        }
        return ChatManager.instance;
    }
    
    // ============ UTILITY FUNCTIONS ============
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
