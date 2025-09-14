/**
 * RCRT Dashboard 2D Canvas Engine
 * Handles all 2D canvas rendering and interactions
 */

import { dashboardState } from './state.js';

export class CanvasEngine {
    constructor(canvasElement, containerElement) {
        this.canvas = canvasElement;
        this.canvasContainer = containerElement;
        this.CANVAS_BUFFER = 1000; // Buffer around content in pixels
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Pan functionality - only when not dragging a node
        this.canvasContainer.addEventListener('mousedown', this.handleCanvasMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Zoom functionality  
        this.canvasContainer.addEventListener('wheel', this.handleWheel.bind(this));
    }
    
    handleCanvasMouseDown(e) {
        // Track user interaction
        dashboardState.trackUserInteraction();
        
        // Don't start canvas pan if clicking on a node
        if (e.target.classList.contains('breadcrumb-node') || 
            e.target.classList.contains('agent-node') || 
            e.target.closest('.breadcrumb-node') || 
            e.target.closest('.agent-node')) {
            return;
        }
        
        dashboardState.setState('isDragging', true);
        const dragStart = {
            x: e.clientX - dashboardState.canvasOffset.x,
            y: e.clientY - dashboardState.canvasOffset.y
        };
        dashboardState.dragStart = dragStart;
        e.preventDefault();
    }
    
    handleMouseMove(e) {
        if (dashboardState.isDraggingNode && dashboardState.draggedNode) {
            this.handleNodeDrag(e);
        } else if (dashboardState.isDragging) {
            this.handleCanvasPan(e);
        }
    }
    
    handleNodeDrag(e) {
        // Get mouse position relative to the canvas container
        const rect = this.canvasContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Get the canvas element's current position and transform
        const canvasLeft = parseFloat(this.canvas.style.left) || 0;
        const canvasTop = parseFloat(this.canvas.style.top) || 0;
        
        // Convert to canvas coordinate space
        const canvasX = ((mouseX - canvasLeft) - dashboardState.canvasOffset.x) / dashboardState.scale;
        const canvasY = ((mouseY - canvasTop) - dashboardState.canvasOffset.y) / dashboardState.scale;
        
        // Position the node so it appears under the cursor
        const nodeX = canvasX - (dashboardState.draggedNodeType === 'agent' ? 50 : 150);
        const nodeY = canvasY - (dashboardState.draggedNodeType === 'agent' ? 50 : 100);
        
        // Update DOM position
        dashboardState.draggedNode.style.left = `${nodeX}px`;
        dashboardState.draggedNode.style.top = `${nodeY}px`;
        
        // Update position tracking arrays and save custom positions
        this.updateNodePosition(nodeX, canvasX, nodeY, canvasY);
        
        // Update connection lines in real-time
        this.redrawConnections();
    }
    
    updateNodePosition(nodeX, canvasX, nodeY, canvasY) {
        const draggedNodeIndex = dashboardState.draggedNodeIndex;
        
        if (dashboardState.draggedNodeType === 'breadcrumb' && dashboardState.nodePositions[draggedNodeIndex]) {
            const breadcrumbId = dashboardState.nodePositions[draggedNodeIndex].id;
            dashboardState.nodePositions[draggedNodeIndex].x = nodeX;
            dashboardState.nodePositions[draggedNodeIndex].y = nodeY;
            
            // Save custom position for persistence
            dashboardState.customNodePositions.set(breadcrumbId, { x: nodeX, y: nodeY });
            
        } else if (dashboardState.draggedNodeType === 'agent' && dashboardState.agentPositions[draggedNodeIndex]) {
            const agentId = dashboardState.agentPositions[draggedNodeIndex].id;
            dashboardState.agentPositions[draggedNodeIndex].x = canvasX;
            dashboardState.agentPositions[draggedNodeIndex].y = canvasY;
            
            // Save custom position for persistence (center coordinates)
            dashboardState.customAgentPositions.set(agentId, { x: canvasX, y: canvasY });
            
        } else if (dashboardState.draggedNodeType === 'tool' && dashboardState.toolPositions[draggedNodeIndex]) {
            const toolId = dashboardState.toolPositions[draggedNodeIndex].id;
            dashboardState.toolPositions[draggedNodeIndex].x = canvasX;
            dashboardState.toolPositions[draggedNodeIndex].y = canvasY;
            
            // Save custom position for persistence (center coordinates)
            dashboardState.customToolPositions.set(toolId, { x: canvasX, y: canvasY });
        }
    }
    
    handleCanvasPan(e) {
        dashboardState.canvasOffset.x = e.clientX - dashboardState.dragStart.x;
        dashboardState.canvasOffset.y = e.clientY - dashboardState.dragStart.y;
        this.updateCanvasTransform();
    }
    
    handleMouseUp() {
        dashboardState.setState('isDragging', false);
        dashboardState.setState('isDraggingNode', false);
        dashboardState.setState('draggedNode', null);
        dashboardState.setState('draggedNodeType', null);
        dashboardState.setState('draggedNodeIndex', -1);
        
        // Update canvas size after node movement
        if (dashboardState.isDraggingNode) {
            setTimeout(() => {
                this.updateCanvasSize();
            }, 10);
        }
    }
    
    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const oldScale = dashboardState.scale;
        const newScale = Math.max(0.1, Math.min(3, dashboardState.scale * delta));
        dashboardState.setState('scale', newScale);
        
        // Get mouse position relative to canvas container
        const rect = this.canvasContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Get canvas element positioning
        const canvasLeft = parseFloat(this.canvas.style.left) || 0;
        const canvasTop = parseFloat(this.canvas.style.top) || 0;
        
        // Calculate the point in canvas coordinates before zoom
        const canvasPointX = ((mouseX - canvasLeft) - dashboardState.canvasOffset.x) / oldScale;
        const canvasPointY = ((mouseY - canvasTop) - dashboardState.canvasOffset.y) / oldScale;
        
        // Calculate new offset to keep the same canvas point under the mouse
        dashboardState.canvasOffset.x = (mouseX - canvasLeft) - (canvasPointX * newScale);
        dashboardState.canvasOffset.y = (mouseY - canvasTop) - (canvasPointY * newScale);
        
        this.updateCanvasTransform();
    }
    
    updateCanvasSize() {
        const allPositions = [...dashboardState.nodePositions, ...dashboardState.agentPositions, ...dashboardState.toolPositions];
        if (allPositions.length === 0) return;
        
        // Calculate bounding box of all nodes
        const minX = Math.min(...allPositions.map(p => p.x));
        const maxX = Math.max(...allPositions.map(p => p.x + p.width));
        const minY = Math.min(...allPositions.map(p => p.y));
        const maxY = Math.max(...allPositions.map(p => p.y + p.height));
        
        // Canvas size includes buffer on all sides
        const canvasWidth = (maxX - minX) + (this.CANVAS_BUFFER * 2);
        const canvasHeight = (maxY - minY) + (this.CANVAS_BUFFER * 2);
        
        // Position canvas so content starts after the buffer
        const canvasLeft = minX - this.CANVAS_BUFFER;
        const canvasTop = minY - this.CANVAS_BUFFER;
        
        // Update canvas size and position
        this.canvas.style.width = `${canvasWidth}px`;
        this.canvas.style.height = `${canvasHeight}px`;
        this.canvas.style.left = `${canvasLeft}px`;
        this.canvas.style.top = `${canvasTop}px`;
    }
    
    updateCanvasTransform() {
        this.canvas.style.transform = `translate(${dashboardState.canvasOffset.x}px, ${dashboardState.canvasOffset.y}px) scale(${dashboardState.scale})`;
    }
    
    centerViewOnContent() {
        const allPositions = [...dashboardState.nodePositions, ...dashboardState.agentPositions, ...dashboardState.toolPositions];
        if (allPositions.length === 0) return;
        
        const containerWidth = this.canvasContainer.clientWidth;
        const containerHeight = this.canvasContainer.clientHeight;
        
        // Calculate content bounds including breadcrumbs, agents, and tools
        const minX = Math.min(...allPositions.map(p => p.x));
        const maxX = Math.max(...allPositions.map(p => p.x + p.width));
        const minY = Math.min(...allPositions.map(p => p.y));
        const maxY = Math.max(...allPositions.map(p => p.y + p.height));
        
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        const contentCenterX = (minX + maxX) / 2;
        const contentCenterY = (minY + maxY) / 2;
        
        // Center the content in the viewport, accounting for canvas position
        const canvasLeft = parseFloat(this.canvas.style.left) || 0;
        const canvasTop = parseFloat(this.canvas.style.top) || 0;
        
        dashboardState.canvasOffset.x = (containerWidth / 2) - contentCenterX - canvasLeft;
        dashboardState.canvasOffset.y = (containerHeight / 2) - contentCenterY - canvasTop;
        
        this.updateCanvasTransform();
    }
    
    resetView() {
        dashboardState.setState('scale', 1);
        this.centerViewOnContent();
    }
    
    resetNodePositions() {
        if (confirm('Reset all node positions to default grid layout?\n\nThis will clear your custom arrangement.')) {
            console.log('Resetting all node positions');
            dashboardState.customNodePositions.clear();
            dashboardState.customAgentPositions.clear();
            dashboardState.customToolPositions.clear();
            // Trigger re-render - this would be handled by the main controller
            dashboardState.notify('positionsReset', true);
        }
    }
    
    // ============ CONNECTION LINE RENDERING ============
    
    redrawConnections() {
        // Quickly redraw all connection lines with current positions
        dashboardState.connections.forEach(conn => {
            if (conn.line && conn.line.parentNode) {
                if (conn.type === 'tool-creation') {
                    // Tool → breadcrumb connection
                    const toolPos = dashboardState.toolPositions.find(pos => pos.id === conn.tool);
                    const breadcrumbIndex = dashboardState.breadcrumbs.findIndex(b => b.id === conn.breadcrumb);
                    
                    if (toolPos && breadcrumbIndex >= 0 && dashboardState.nodePositions[breadcrumbIndex]) {
                        const breadcrumbPos = dashboardState.nodePositions[breadcrumbIndex];
                        this.updateConnectionLine(conn.line, toolPos, breadcrumbPos);
                    }
                } else {
                    // Agent subscription connection
                    const agentPos = dashboardState.agentPositions.find(pos => pos.id === conn.agent);
                    const breadcrumbIndex = dashboardState.breadcrumbs.findIndex(b => b.id === conn.breadcrumb);
                    
                    if (agentPos && breadcrumbIndex >= 0 && dashboardState.nodePositions[breadcrumbIndex]) {
                        const breadcrumbPos = dashboardState.nodePositions[breadcrumbIndex];
                        this.updateConnectionLine(conn.line, agentPos, breadcrumbPos);
                    }
                }
            }
        });
    }
    
    updateConnectionLine(line, agentPos, breadcrumbPos) {
        // Calculate line position and length
        const deltaX = breadcrumbPos.x - agentPos.x;
        const deltaY = breadcrumbPos.y - agentPos.y;
        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX);
        
        // Update line position and transform
        line.style.left = `${agentPos.x}px`;
        line.style.top = `${agentPos.y}px`;
        line.style.width = `${length}px`;
        line.style.transform = `rotate(${angle}rad)`;
    }
    
    createConnectionLine(agentPos, breadcrumbPos, subscription) {
        const line = document.createElement('div');
        line.className = 'connection-line';
        
        // Calculate line position and length
        const deltaX = breadcrumbPos.x - agentPos.x;
        const deltaY = breadcrumbPos.y - agentPos.y;
        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX);
        
        // Position line at agent center
        line.style.left = `${agentPos.x}px`;
        line.style.top = `${agentPos.y}px`;
        line.style.width = `${length}px`;
        line.style.transform = `rotate(${angle}rad)`;
        
        // Add hover tooltip with selector details
        let tooltipText = `Agent ${subscription.agent_id.substring(30)} subscription:\n`;
        if (subscription.selector.any_tags) tooltipText += `Any tags: ${subscription.selector.any_tags.join(', ')}\n`;
        if (subscription.selector.all_tags) tooltipText += `All tags: ${subscription.selector.all_tags.join(', ')}\n`;
        if (subscription.selector.schema_name) tooltipText += `Schema: ${subscription.selector.schema_name}\n`;
        line.title = tooltipText;
        
        return line;
    }
    
    createToolConnectionLine(toolPos, breadcrumbPos, tool) {
        const line = document.createElement('div');
        line.className = 'connection-line tool-connection';
        
        // Calculate line position and length
        const deltaX = breadcrumbPos.x - toolPos.x;
        const deltaY = breadcrumbPos.y - toolPos.y;
        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX);
        
        // Position line at tool center
        line.style.left = `${toolPos.x}px`;
        line.style.top = `${toolPos.y}px`;
        line.style.width = `${length}px`;
        line.style.transform = `rotate(${angle}rad)`;
        
        // Add tooltip with tool creation details
        line.title = `🛠️ ${tool.name} created this breadcrumb`;
        
        return line;
    }
    
    // ============ UTILITY FUNCTIONS ============
    
    clear() {
        this.canvas.innerHTML = '';
        dashboardState.setState('nodePositions', []);
        dashboardState.setState('agentPositions', []);
        dashboardState.setState('toolPositions', []);
        dashboardState.setState('connections', []);
    }
    
    showLoading(message = 'Loading...') {
        this.canvas.innerHTML = `<div class="loading"><div class="spinner"></div>${message}</div>`;
    }
    
    showError(message) {
        this.canvas.innerHTML = `<div class="error">Error: ${message}</div>`;
    }
}
