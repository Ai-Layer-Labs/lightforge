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
            e.target.classList.contains('agent-definition-node') || 
            e.target.classList.contains('tool-node') || 
            e.target.classList.contains('secret-node') || 
            e.target.closest('.breadcrumb-node') || 
            e.target.closest('.agent-node') || 
            e.target.closest('.agent-definition-node') || 
            e.target.closest('.tool-node') || 
            e.target.closest('.secret-node')) {
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
        let nodeX, nodeY;
        if (dashboardState.draggedNodeType === 'agent') {
            nodeX = canvasX - 50;  // Agent nodes are 100x100, center at 50,50
            nodeY = canvasY - 50;
        } else if (dashboardState.draggedNodeType === 'tool') {
            nodeX = canvasX - 50;  // Tool nodes are 100x100, center at 50,50
            nodeY = canvasY - 50;
        } else if (dashboardState.draggedNodeType === 'secret') {
            nodeX = canvasX - 60;  // Secret nodes are 120x80, center at 60,40
            nodeY = canvasY - 40;
        } else {
            nodeX = canvasX - 150; // Breadcrumb nodes are 320x200, center at 160,100
            nodeY = canvasY - 100;
        }
        
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
            
        } else if (dashboardState.draggedNodeType === 'agentDefinition' && dashboardState.agentDefinitionPositions[draggedNodeIndex]) {
            const agentDefId = dashboardState.agentDefinitionPositions[draggedNodeIndex].id;
            dashboardState.agentDefinitionPositions[draggedNodeIndex].x = canvasX;
            dashboardState.agentDefinitionPositions[draggedNodeIndex].y = canvasY;
            
            // Save custom position for persistence (center coordinates)
            dashboardState.customAgentDefinitionPositions.set(agentDefId, { x: canvasX, y: canvasY });
            
        } else if (dashboardState.draggedNodeType === 'tool' && dashboardState.toolPositions[draggedNodeIndex]) {
            const toolId = dashboardState.toolPositions[draggedNodeIndex].id;
            dashboardState.toolPositions[draggedNodeIndex].x = canvasX;
            dashboardState.toolPositions[draggedNodeIndex].y = canvasY;
            
            // Save custom position for persistence (center coordinates)
            dashboardState.customToolPositions.set(toolId, { x: canvasX, y: canvasY });
            
        } else if (dashboardState.draggedNodeType === 'secret' && dashboardState.secretPositions[draggedNodeIndex]) {
            const secretId = dashboardState.secretPositions[draggedNodeIndex].id;
            dashboardState.secretPositions[draggedNodeIndex].x = canvasX;
            dashboardState.secretPositions[draggedNodeIndex].y = canvasY;
            
            // Save custom position for persistence (center coordinates)
            dashboardState.customSecretPositions.set(secretId, { x: canvasX, y: canvasY });
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
        const allPositions = [...dashboardState.nodePositions, ...dashboardState.agentPositions, ...dashboardState.agentDefinitionPositions, ...dashboardState.toolPositions, ...dashboardState.secretPositions];
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
        const allPositions = [...dashboardState.nodePositions, ...dashboardState.agentPositions, ...dashboardState.agentDefinitionPositions, ...dashboardState.toolPositions, ...dashboardState.secretPositions];
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
            dashboardState.customAgentDefinitionPositions.clear();
            dashboardState.customToolPositions.clear();
            dashboardState.customSecretPositions.clear();
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
                } else if (conn.type === 'secret-usage') {
                    // Secret → tool connection
                    const secretPos = dashboardState.secretPositions.find(pos => pos.id === conn.secret);
                    const toolPos = dashboardState.toolPositions.find(pos => pos.id === conn.tool);
                    
                    if (secretPos && toolPos) {
                        this.updateConnectionLine(conn.line, secretPos, toolPos);
                    }
                } else if (conn.type === 'secret-access') {
                    // Secret → agent connection
                    const secretPos = dashboardState.secretPositions.find(pos => pos.id === conn.secret);
                    const agentPos = dashboardState.agentPositions.find(pos => pos.id === conn.agent);
                    
                    if (secretPos && agentPos) {
                        this.updateConnectionLine(conn.line, secretPos, agentPos);
                    }
                } else if (conn.type === 'agent-definition') {
                    // Agent entity → agent definition connection
                    const agentPos = dashboardState.agentPositions.find(pos => pos.id === conn.from);
                    const defPos = dashboardState.agentDefinitionPositions.find(pos => pos.id === conn.to);
                    
                    if (agentPos && defPos) {
                        this.updateConnectionLine(conn.line, agentPos, defPos);
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
    
    createSecretConnectionLine(secretPos, targetPos, secret, target) {
        const line = document.createElement('div');
        line.className = 'connection-line secret-connection';
        
        // Calculate line position and length
        const deltaX = targetPos.x - secretPos.x;
        const deltaY = targetPos.y - secretPos.y;
        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX);
        
        // Position line at secret center
        line.style.left = `${secretPos.x}px`;
        line.style.top = `${secretPos.y}px`;
        line.style.width = `${length}px`;
        line.style.transform = `rotate(${angle}rad)`;
        
        // Add tooltip with secret usage details
        if (target) {
            line.title = `🔐 ${secret.name} → 🛠️ ${target.name}`;
        } else {
            line.title = `🔐 ${secret.name} → 🤖 Agent Access`;
        }
        
        return line;
    }
    
    createAgentDefinitionConnectionLine(agentPos, defPos, agentId, agentDef) {
        const line = document.createElement('div');
        line.className = 'connection-line agent-definition-connection';
        
        // Calculate line position and rotation
        const deltaX = defPos.x - agentPos.x;
        const deltaY = defPos.y - agentPos.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
        
        // Position line at agent center
        line.style.left = `${agentPos.x}px`;
        line.style.top = `${agentPos.y}px`;
        line.style.width = `${distance}px`;
        line.style.height = '2px';
        line.style.transformOrigin = '0 50%';
        line.style.transform = `rotate(${angle}deg)`;
        line.style.background = 'linear-gradient(90deg, rgba(255, 165, 0, 0.6) 0%, rgba(138, 43, 226, 0.6) 100%)';
        line.style.position = 'absolute';
        line.style.zIndex = '5';
        line.style.opacity = '0.7';
        line.style.pointerEvents = 'none';
        
        // Add tooltip
        const agentName = agentDef.context?.agent_name || 'unknown';
        line.title = `Agent Entity ${agentId.substring(30)} → Definition: ${agentName}`;
        
        return line;
    }
    
    // ============ UTILITY FUNCTIONS ============
    
    clear() {
        this.canvas.innerHTML = '';
        dashboardState.setState('nodePositions', []);
        dashboardState.setState('agentPositions', []);
        dashboardState.setState('agentDefinitionPositions', []);
        dashboardState.setState('toolPositions', []);
        dashboardState.setState('secretPositions', []);
        dashboardState.setState('connections', []);
    }
    
    showLoading(message = 'Loading...') {
        this.canvas.innerHTML = `<div class="loading"><div class="spinner"></div>${message}</div>`;
    }
    
    showError(message) {
        this.canvas.innerHTML = `<div class="error">Error: ${message}</div>`;
    }
}
