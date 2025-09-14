/**
 * RCRT Dashboard Node Renderer
 * Creates and manages breadcrumb, agent, and tool nodes
 */

import { dashboardState } from './state.js';

export class NodeRenderer {
    constructor() {
        this.escapeHtml = this.escapeHtml.bind(this);
    }
    
    // ============ BREADCRUMB NODES ============
    
    createBreadcrumbNode(breadcrumb, index, onSelectCallback) {
        const node = document.createElement('div');
        node.className = 'breadcrumb-node';
        
        // Check if we have a custom position for this breadcrumb
        let x, y;
        const nodeWidth = 320;
        const nodeHeight = 200;
        const spacing = 20;
        
        if (dashboardState.customNodePositions.has(breadcrumb.id)) {
            // Use saved custom position
            const saved = dashboardState.customNodePositions.get(breadcrumb.id);
            x = saved.x;
            y = saved.y;
            console.log(`Using saved position for breadcrumb ${breadcrumb.id.substring(0,8)}: ${x}, ${y}`);
        } else {
            // Use default grid position
            const cols = 6;
            x = (index % cols) * (nodeWidth + spacing);
            y = Math.floor(index / cols) * (nodeHeight + spacing);
        }
        
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        
        // Store position for canvas sizing
        dashboardState.nodePositions.push({
            id: breadcrumb.id,
            x: x,
            y: y,
            width: nodeWidth,
            height: nodeHeight
        });
        
        const updatedAt = new Date(breadcrumb.updated_at).toLocaleString();
        
        node.innerHTML = `
            <div class="node-title">${this.escapeHtml(breadcrumb.title)}</div>
            <div class="node-tags">
                ${breadcrumb.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
            </div>
            <div class="node-meta">
                <span>Updated: ${updatedAt}</span>
                <span class="version-badge">v${breadcrumb.version}</span>
            </div>
        `;
        
        // Make breadcrumb node draggable and clickable
        this.makeBreadcrumbInteractive(node, breadcrumb, index, onSelectCallback);
        
        return node;
    }
    
    makeBreadcrumbInteractive(node, breadcrumb, index, onSelectCallback) {
        let nodeMouseDown = false;
        
        node.addEventListener('mousedown', (e) => {
            nodeMouseDown = true;
            setTimeout(() => {
                if (nodeMouseDown) {
                    dashboardState.setState('isDraggingNode', true);
                    dashboardState.setState('draggedNode', node);
                    dashboardState.setState('draggedNodeType', 'breadcrumb');
                    dashboardState.setState('draggedNodeIndex', index);
                    e.stopPropagation();
                }
            }, 150); // 150ms delay to distinguish click from drag
        });
        
        node.addEventListener('mouseup', (e) => {
            if (!dashboardState.isDraggingNode && nodeMouseDown) {
                // This was a click, not a drag
                onSelectCallback(breadcrumb.id);
            }
            nodeMouseDown = false;
        });
        
        // Prevent text selection during drag
        node.addEventListener('dragstart', (e) => e.preventDefault());
    }
    
    // ============ AGENT NODES ============
    
    createAgentNode(agent, index, onSelectCallback) {
        const node = document.createElement('div');
        node.className = 'agent-node';
        
        // Check if we have a custom position for this agent
        let x, y;
        const nodeSize = 120;
        
        if (dashboardState.customAgentPositions.has(agent.id)) {
            // Use saved custom position
            const saved = dashboardState.customAgentPositions.get(agent.id);
            x = saved.x - 50; // Convert from center back to top-left
            y = saved.y - 50;
            console.log(`Using saved position for agent ${agent.id.substring(30)}: center at ${saved.x}, ${saved.y}`);
        } else {
            // Use default grid position
            const cols = 3;
            const startX = 50;
            const startY = 100;
            x = startX + (index % cols) * nodeSize;
            y = startY + Math.floor(index / cols) * nodeSize;
        }
        
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        
        // Store position for connections (center coordinates)
        dashboardState.agentPositions.push({
            id: agent.id,
            x: x + 50, // Center of circle
            y: y + 50, // Center of circle  
            width: 100,
            height: 100
        });
        
        // Get role-based icon
        const hasRole = (role) => agent.roles.includes(role);
        const icon = hasRole('curator') ? '👑' : hasRole('emitter') ? '✍️' : '👀';
        const agentName = agent.id.substring(30); // Show last few chars
        
        node.innerHTML = `
            <div class="agent-icon">${icon}</div>
            <div class="agent-name">Agent ${agentName}</div>
            <div class="agent-roles">${agent.roles.slice(0,2).join(', ')}</div>
        `;
        
        // Make agent node draggable and clickable
        this.makeAgentInteractive(node, agent, index, onSelectCallback);
        
        return node;
    }
    
    makeAgentInteractive(node, agent, index, onSelectCallback) {
        let agentMouseDown = false;
        
        node.addEventListener('mousedown', (e) => {
            agentMouseDown = true;
            setTimeout(() => {
                if (agentMouseDown) {
                    dashboardState.setState('isDraggingNode', true);
                    dashboardState.setState('draggedNode', node);
                    dashboardState.setState('draggedNodeType', 'agent');
                    dashboardState.setState('draggedNodeIndex', index);
                    e.stopPropagation();
                }
            }, 150); // 150ms delay to distinguish click from drag
        });
        
        node.addEventListener('mouseup', (e) => {
            if (!dashboardState.isDraggingNode && agentMouseDown) {
                // This was a click, not a drag
                onSelectCallback(agent);
            }
            agentMouseDown = false;
        });
        
        // Prevent text selection during drag
        node.addEventListener('dragstart', (e) => e.preventDefault());
    }
    
    // ============ TOOL NODES ============
    
    createToolNode(tool, index, onSelectCallback) {
        const node = document.createElement('div');
        node.className = 'tool-node';
        
        // Check if we have a custom position for this tool
        let x, y;
        const nodeSize = 100;
        
        if (dashboardState.customToolPositions.has(tool.id)) {
            // Use saved custom position
            const saved = dashboardState.customToolPositions.get(tool.id);
            x = saved.x - 50; // Convert from center back to top-left
            y = saved.y - 50;
            console.log(`Using saved position for tool ${tool.name}: center at ${saved.x}, ${saved.y}`);
        } else {
            // Use default grid position (place tools on the right side)
            const cols = 3;
            const startX = 800; // Place tools to the right of breadcrumbs  
            const startY = 50;
            x = startX + (index % cols) * (nodeSize + 20);
            y = startY + Math.floor(index / cols) * (nodeSize + 20);
        }
        
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        
        // Store position for connections (center coordinates)
        dashboardState.toolPositions.push({
            id: tool.id,
            name: tool.name,
            x: x + 50, // Center of square
            y: y + 50, // Center of square
            width: 100,
            height: 100
        });
        
        // Get tool-specific icon and color
        const icon = this.getToolIcon(tool.name, tool.category);
        const statusColor = tool.status === 'active' ? '#00ff88' : '#ffaa00';
        
        node.innerHTML = `
            <div class="tool-icon">${icon}</div>
            <div class="tool-name">${tool.name}</div>
            <div class="tool-status" style="color: ${statusColor};">${tool.status}</div>
            <div class="tool-category">${tool.category || 'tool'}</div>
        `;
        
        // Make tool node draggable and clickable
        this.makeToolInteractive(node, tool, index, onSelectCallback);
        
        return node;
    }
    
    makeToolInteractive(node, tool, index, onSelectCallback) {
        let toolMouseDown = false;
        
        node.addEventListener('mousedown', (e) => {
            toolMouseDown = true;
            setTimeout(() => {
                if (toolMouseDown) {
                    dashboardState.setState('isDraggingNode', true);
                    dashboardState.setState('draggedNode', node);
                    dashboardState.setState('draggedNodeType', 'tool');
                    dashboardState.setState('draggedNodeIndex', index);
                    e.stopPropagation();
                }
            }, 150); // 150ms delay to distinguish click from drag
        });
        
        node.addEventListener('mouseup', (e) => {
            if (!dashboardState.isDraggingNode && toolMouseDown) {
                // This was a click, not a drag
                onSelectCallback(tool);
            }
            toolMouseDown = false;
        });
        
        // Prevent text selection during drag
        node.addEventListener('dragstart', (e) => e.preventDefault());
    }
    
    getToolIcon(toolName, category) {
        if (toolName === 'openrouter') return '🧠';
        if (toolName === 'ollama_local') return '🏠';
        if (toolName === 'echo') return '📢';
        if (toolName === 'timer') return '⏱️';
        if (toolName === 'random') return '🎲';
        if (toolName === 'calculator') return '🔢';
        if (toolName === 'web_browser') return '🌐';
        return category === 'llm' ? '🤖' : '🛠️';
    }
    
    // ============ SELECTION AND HIGHLIGHTING ============
    
    highlightBreadcrumbNode(breadcrumbId) {
        // Remove previous highlights
        document.querySelectorAll('.breadcrumb-node').forEach(node => {
            node.style.borderColor = 'rgba(0, 245, 255, 0.3)';
        });
        
        // Find and highlight the node
        const breadcrumb = dashboardState.breadcrumbs.find(b => b.id === breadcrumbId);
        if (breadcrumb) {
            const index = dashboardState.breadcrumbs.indexOf(breadcrumb);
            const nodes = document.querySelectorAll('.breadcrumb-node');
            if (nodes[index]) {
                nodes[index].style.borderColor = '#00f5ff';
                nodes[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
    
    highlightAgentNode(agentId) {
        // Remove previous highlights
        document.querySelectorAll('.agent-node').forEach(node => {
            node.style.borderColor = 'rgba(255, 165, 0, 0.4)';
        });
        
        // Find and highlight the agent node
        const agentIndex = dashboardState.agents.findIndex(a => a.id === agentId);
        const agentNodes = document.querySelectorAll('.agent-node');
        if (agentNodes[agentIndex]) {
            agentNodes[agentIndex].style.borderColor = '#ffa500';
        }
    }
    
    clearAllHighlights() {
        document.querySelectorAll('.breadcrumb-node').forEach(node => {
            node.style.borderColor = 'rgba(0, 245, 255, 0.3)';
        });
        document.querySelectorAll('.agent-node').forEach(node => {
            node.style.borderColor = 'rgba(255, 165, 0, 0.4)';
        });
    }
    
    // ============ UTILITY FUNCTIONS ============
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
