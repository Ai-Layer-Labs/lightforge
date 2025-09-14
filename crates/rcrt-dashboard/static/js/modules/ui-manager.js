/**
 * RCRT Dashboard UI Manager
 * Handles UI interactions, panels, and form management
 */

import { dashboardState } from './state.js';

export class UIManager {
    constructor() {
        this.init();
    }
    
    init() {
        this.initializePanelResize();
        this.setupGlobalFunctions();
        this.applyUIState();
    }
    
    // ============ PANEL MANAGEMENT ============
    
    initializePanelResize() {
        this.addResizeHandle('left');
        this.addResizeHandle('right');
    }
    
    addResizeHandle(side) {
        const panel = document.getElementById(`${side}Panel`);
        if (!panel) return;
        
        const handle = document.createElement('div');
        handle.className = `resize-handle resize-handle-${side}`;
        handle.innerHTML = '⋮';
        panel.appendChild(handle);
        
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        
        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = side === 'left' ? dashboardState.leftPanelWidth : dashboardState.rightPanelWidth;
            e.preventDefault();
            
            document.body.style.cursor = 'col-resize';
            handle.style.background = 'rgba(0, 245, 255, 0.3)';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const deltaX = side === 'left' ? (e.clientX - startX) : (startX - e.clientX);
            const newWidth = Math.max(200, Math.min(800, startWidth + deltaX));
            
            if (side === 'left') {
                dashboardState.leftPanelWidth = newWidth;
            } else {
                dashboardState.rightPanelWidth = newWidth;
            }
            
            this.applyPanelWidths();
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                handle.style.background = '';
                dashboardState.saveUIState();
            }
        });
    }
    
    applyUIState() {
        this.applyPanelWidths();
        this.applyCollapsedSections();
    }
    
    applyPanelWidths() {
        const leftPanel = document.getElementById('leftPanel');
        const rightPanel = document.getElementById('rightPanel');
        
        if (leftPanel) {
            leftPanel.style.width = `${dashboardState.leftPanelWidth}px`;
        }
        if (rightPanel) {
            rightPanel.style.width = `${dashboardState.rightPanelWidth}px`;
        }
    }
    
    applyCollapsedSections() {
        dashboardState.collapsedSections.forEach(sectionId => {
            const section = document.querySelector(`[data-section="${sectionId}"]`);
            if (section) {
                section.classList.add('collapsed');
                const button = section.querySelector('.section-collapse-btn');
                if (button) {
                    button.textContent = button.textContent.includes('▼') ? '▶' : '▼';
                }
            }
        });
    }
    
    togglePanel() {
        const panel = document.getElementById('leftPanel');
        const toggle = panel.querySelector('.panel-toggle');
        
        panel.classList.toggle('collapsed');
        toggle.textContent = panel.classList.contains('collapsed') ? '▶' : '◀';
    }
    
    toggleRightPanel() {
        const panel = document.getElementById('rightPanel');
        const toggle = panel.querySelector('.panel-toggle');
        
        panel.classList.toggle('collapsed');
        toggle.textContent = panel.classList.contains('collapsed') ? '◀' : '▶';
    }
    
    toggleSectionCollapse(sectionId) {
        const section = document.querySelector(`[data-section="${sectionId}"]`);
        const button = event.target;
        
        if (!section) return;
        
        const isCollapsed = section.classList.contains('collapsed');
        
        if (isCollapsed) {
            section.classList.remove('collapsed');
            button.textContent = '▼';
            dashboardState.collapsedSections.delete(sectionId);
        } else {
            section.classList.add('collapsed');
            button.textContent = '▶';
            dashboardState.collapsedSections.add(sectionId);
        }
        
        dashboardState.saveUIState();
    }
    
    // ============ FORM MANAGEMENT ============
    
    setupTagInput(inputId, tagsArray, displayId) {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                const tag = input.value.trim();
                if (tag && !tagsArray.includes(tag)) {
                    tagsArray.push(tag);
                    this.updateTagDisplay(displayId, tagsArray);
                    input.value = '';
                }
            } else if (event.key === 'Backspace' && input.value === '') {
                if (tagsArray.length > 0) {
                    tagsArray.pop();
                    this.updateTagDisplay(displayId, tagsArray);
                }
            }
        });
    }
    
    updateTagDisplay(containerId, tags) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = tags.map(tag => 
            `<span class="tag-chip">
                ${this.escapeHtml(tag)}
                <span class="remove-tag" onclick="removeTag('${containerId}', '${tag}')">×</span>
            </span>`
        ).join('');
    }
    
    removeTag(containerId, tag) {
        if (containerId === 'newTags') {
            const index = dashboardState.newTags.indexOf(tag);
            if (index > -1) dashboardState.newTags.splice(index, 1);
            this.updateTagDisplay('newTags', dashboardState.newTags);
        } else if (containerId === 'editTags') {
            const index = dashboardState.editTags.indexOf(tag);
            if (index > -1) dashboardState.editTags.splice(index, 1);
            this.updateTagDisplay('editTags', dashboardState.editTags);
        }
    }
    
    // ============ MODAL MANAGEMENT ============
    
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
        }
    }
    
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    // ============ GLOBAL FUNCTIONS FOR HTML COMPATIBILITY ============
    
    setupGlobalFunctions() {
        // Panel functions
        window.togglePanel = () => this.togglePanel();
        window.toggleRightPanel = () => this.toggleRightPanel();
        window.toggleSectionCollapse = (sectionId) => this.toggleSectionCollapse(sectionId);
        
        // Tag management functions
        window.removeTag = (containerId, tag) => this.removeTag(containerId, tag);
        window.focusTagInput = () => document.getElementById('tagInput')?.focus();
        window.focusEditTagInput = () => document.getElementById('editTagInput')?.focus();
        
        // Modal functions
        window.showModal = (modalId) => this.showModal(modalId);
        window.hideModal = (modalId) => this.hideModal(modalId);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                // Close any open modals
                document.querySelectorAll('.modal').forEach(modal => {
                    if (modal.style.display === 'block') {
                        modal.style.display = 'none';
                    }
                });
            }
        });
        
        // Modal background click handlers
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
    }
    
    // ============ UTILITY FUNCTIONS ============
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showNotification(message, type = 'info') {
        // Simple notification system
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem;
            background: ${type === 'error' ? '#ff6b6b' : type === 'success' ? '#00ff88' : '#00f5ff'};
            color: black;
            border-radius: 8px;
            z-index: 10000;
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    showLoadingOverlay(message = 'Loading...') {
        const overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            color: white;
            font-size: 1.2rem;
        `;
        overlay.innerHTML = `
            <div style="text-align: center;">
                <div class="spinner" style="margin: 0 auto 1rem;"></div>
                ${message}
            </div>
        `;
        
        document.body.appendChild(overlay);
    }
    
    hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.parentNode.removeChild(overlay);
        }
    }
}
