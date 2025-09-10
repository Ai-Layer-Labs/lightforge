let breadcrumbs = [];
let filteredBreadcrumbs = [];
let canvas = document.getElementById('canvas');
let canvasContainer = canvas.parentElement;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let canvasOffset = { x: 0, y: 0 };
let scale = 1;
let nodePositions = []; // Track all breadcrumb positions
const CANVAS_BUFFER = 1000; // Buffer around content in pixels
let selectedBreadcrumb = null;
let selectedBreadcrumbDetails = null;
let selectedAgent = null;
let selectedAgentDetails = null;
let newTags = [];
let editTags = [];
let editAgentRoles = [];
let selectedTagFilters = [];
let allAvailableTags = [];
let eventSource = null;
let eventLog = [];
let maxEventLogSize = 100;
let autoScroll = true;
let streamPaused = false;
let hidePings = false;
let agents = [];
let subscriptions = [];
let agentPositions = [];
let connections = [];
let customNodePositions = new Map(); // Store custom positions by ID
let customAgentPositions = new Map(); // Store custom agent positions by ID
let dataLoaded = false; // Track if we've loaded initial data
let isDraggingNode = false;
let draggedNode = null;
let draggedNodeType = null; // 'breadcrumb' or 'agent'
let draggedNodeIndex = -1;

// Pan functionality - only when not dragging a node
canvasContainer.addEventListener('mousedown', (e) => {
    // Don't start canvas pan if clicking on a node
    if (e.target.classList.contains('breadcrumb-node') || e.target.classList.contains('agent-node') || e.target.closest('.breadcrumb-node') || e.target.closest('.agent-node')) {
        return;
    }
    
    isDragging = true;
    dragStart.x = e.clientX - canvasOffset.x;
    dragStart.y = e.clientY - canvasOffset.y;
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (isDraggingNode && draggedNode) {
        // Get mouse position relative to the canvas container
        const rect = canvasContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Get the canvas element's current position and transform
        const canvasLeft = parseFloat(canvas.style.left) || 0;
        const canvasTop = parseFloat(canvas.style.top) || 0;
        
        // Convert to canvas coordinate space by reversing all transforms:
        // 1. Subtract canvas element position within container
        // 2. Reverse the CSS translate transform 
        // 3. Reverse the CSS scale transform
        const canvasX = ((mouseX - canvasLeft) - canvasOffset.x) / scale;
        const canvasY = ((mouseY - canvasTop) - canvasOffset.y) / scale;
        
        // Position the node so it appears under the cursor
        // (no additional offset needed since we want cursor at node center)
        const nodeX = canvasX - (draggedNodeType === 'agent' ? 50 : 150);
        const nodeY = canvasY - (draggedNodeType === 'agent' ? 50 : 100);
        
        // Update DOM position
        draggedNode.style.left = `${nodeX}px`;
        draggedNode.style.top = `${nodeY}px`;
        
        // Update position tracking arrays AND save custom positions
        if (draggedNodeType === 'breadcrumb' && nodePositions[draggedNodeIndex]) {
            const breadcrumbId = nodePositions[draggedNodeIndex].id;
            nodePositions[draggedNodeIndex].x = nodeX;
            nodePositions[draggedNodeIndex].y = nodeY;
            
            // Save custom position for persistence
            customNodePositions.set(breadcrumbId, { x: nodeX, y: nodeY });
            
        } else if (draggedNodeType === 'agent' && agentPositions[draggedNodeIndex]) {
            const agentId = agentPositions[draggedNodeIndex].id;
            agentPositions[draggedNodeIndex].x = canvasX;
            agentPositions[draggedNodeIndex].y = canvasY;
            
            // Save custom position for persistence (center coordinates)
            customAgentPositions.set(agentId, { x: canvasX, y: canvasY });
        }
        
        // Update connection lines in real-time
        redrawConnections();
        
    } else if (isDragging) {
        // Normal canvas pan
        canvasOffset.x = e.clientX - dragStart.x;
        canvasOffset.y = e.clientY - dragStart.y;
        updateCanvasTransform();
    }
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    isDraggingNode = false;
    draggedNode = null;
    draggedNodeType = null;
    draggedNodeIndex = -1;
    
    // Update canvas size after node movement
    if (isDraggingNode) {
        setTimeout(() => {
            updateCanvasSize();
        }, 10);
    }
});

// Zoom functionality  
canvasContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const oldScale = scale;
    scale = Math.max(0.1, Math.min(3, scale * delta));
    
    // Get mouse position relative to canvas container
    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Get canvas element positioning
    const canvasLeft = parseFloat(canvas.style.left) || 0;
    const canvasTop = parseFloat(canvas.style.top) || 0;
    
    // Calculate the point in canvas coordinates before zoom (reverse all transforms)
    const canvasPointX = ((mouseX - canvasLeft) - canvasOffset.x) / oldScale;
    const canvasPointY = ((mouseY - canvasTop) - canvasOffset.y) / oldScale;
    
    // Calculate new offset to keep the same canvas point under the mouse
    canvasOffset.x = (mouseX - canvasLeft) - (canvasPointX * scale);
    canvasOffset.y = (mouseY - canvasTop) - (canvasPointY * scale);
    
    updateCanvasTransform();
});

function updateCanvasSize() {
    const allPositions = [...nodePositions, ...agentPositions];
    if (allPositions.length === 0) return;
    
    // Calculate bounding box of all nodes (breadcrumbs + agents)
    const minX = Math.min(...allPositions.map(p => p.x));
    const maxX = Math.max(...allPositions.map(p => p.x + p.width));
    const minY = Math.min(...allPositions.map(p => p.y));
    const maxY = Math.max(...allPositions.map(p => p.y + p.height));
    
    // Canvas size includes buffer on all sides
    const canvasWidth = (maxX - minX) + (CANVAS_BUFFER * 2);
    const canvasHeight = (maxY - minY) + (CANVAS_BUFFER * 2);
    
    // Position canvas so content starts after the buffer
    const canvasLeft = minX - CANVAS_BUFFER;
    const canvasTop = minY - CANVAS_BUFFER;
    
    // Update canvas size and position
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    canvas.style.left = `${canvasLeft}px`;
    canvas.style.top = `${canvasTop}px`;
}

function updateCanvasTransform() {
    canvas.style.transform = `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${scale})`;
}

async function loadBreadcrumbs() {
    try {
        const response = await fetch('/api/breadcrumbs');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        breadcrumbs = await response.json();
        
        // Clear any stale filtered results
        filteredBreadcrumbs = [];
        
        // Only load agents and subscriptions on first load, not on every refresh
        if (!dataLoaded) {
            await loadAgentsAndSubscriptions();
            dataLoaded = true;
        }
        
        renderBreadcrumbs();
        updateStats();
    } catch (error) {
        console.error('Failed to load breadcrumbs:', error);
        canvas.innerHTML = `<div class="error">Failed to load breadcrumbs: ${error.message}</div>`;
    }
}

async function loadAgentsAndSubscriptions() {
    try {
        // Load agents
        const agentsResponse = await fetch('/api/agents');
        if (agentsResponse.ok) {
            agents = await agentsResponse.json();
            console.log('Loaded agents:', agents.length);
        }
        
        // Load subscriptions  
        const subsResponse = await fetch('/api/subscriptions');
        if (subsResponse.ok) {
            subscriptions = await subsResponse.json();
            console.log('Loaded subscriptions:', subscriptions.length);
        }
    } catch (error) {
        console.error('Failed to load agents/subscriptions:', error);
        // Continue without agent visualization if this fails
        agents = [];
        subscriptions = [];
    }
}

function renderBreadcrumbs() {
    canvas.innerHTML = '';
    nodePositions = []; // Reset positions
    agentPositions = []; // Reset agent positions
    connections = []; // Reset connections
    
    const toRender = filteredBreadcrumbs.length > 0 ? filteredBreadcrumbs : breadcrumbs;
    
    // Render breadcrumb nodes
    toRender.forEach((breadcrumb, index) => {
        const node = createBreadcrumbNode(breadcrumb, index);
        canvas.appendChild(node);
    });
    
    // Render agent nodes
    agents.forEach((agent, index) => {
        const node = createAgentNode(agent, index);
        canvas.appendChild(node);
    });
    
    // Render connection lines
    renderConnections();
    
    // Update canvas size to fit all nodes plus buffer
    updateCanvasSize();
    
    // Center the view on the content initially if this is the first load
    if (canvasOffset.x === 0 && canvasOffset.y === 0 && nodePositions.length > 0) {
        centerViewOnContent();
    }
    
    // Update breadcrumb and agent lists in left panel
    updateBreadcrumbList();
    updateAgentList();
    updateAvailableTags();
}

function createBreadcrumbNode(breadcrumb, index) {
    const node = document.createElement('div');
    node.className = 'breadcrumb-node';
    
    // Check if we have a custom position for this breadcrumb
    let x, y;
    const nodeWidth = 320;
    const nodeHeight = 200;
    const spacing = 20;
    
    if (customNodePositions.has(breadcrumb.id)) {
        // Use saved custom position
        const saved = customNodePositions.get(breadcrumb.id);
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
    nodePositions.push({
        id: breadcrumb.id,
        x: x,
        y: y,
        width: nodeWidth,
        height: nodeHeight
    });
    
    const updatedAt = new Date(breadcrumb.updated_at).toLocaleString();
    
    node.innerHTML = `
        <div class="node-title">${escapeHtml(breadcrumb.title)}</div>
        <div class="node-tags">
            ${breadcrumb.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
        <div class="node-meta">
            <span>Updated: ${updatedAt}</span>
            <span class="version-badge">v${breadcrumb.version}</span>
        </div>
    `;
    
    // Make breadcrumb node draggable
    let nodeMouseDown = false;
    
    node.addEventListener('mousedown', (e) => {
        nodeMouseDown = true;
        setTimeout(() => {
            if (nodeMouseDown) {
                isDraggingNode = true;
                draggedNode = node;
                draggedNodeType = 'breadcrumb';
                draggedNodeIndex = index;
                e.stopPropagation();
            }
        }, 150); // 150ms delay to distinguish click from drag
    });
    
    node.addEventListener('mouseup', (e) => {
        if (!isDraggingNode && nodeMouseDown) {
            // This was a click, not a drag
            selectBreadcrumbForDetails(breadcrumb.id);
        }
        nodeMouseDown = false;
    });
    
    // Prevent text selection during drag
    node.addEventListener('dragstart', (e) => e.preventDefault());
    
    return node;
}

function createAgentNode(agent, index) {
    const node = document.createElement('div');
    node.className = 'agent-node';
    
    // Check if we have a custom position for this agent
    let x, y;
    const nodeSize = 120;
    
    if (customAgentPositions.has(agent.id)) {
        // Use saved custom position
        const saved = customAgentPositions.get(agent.id);
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
    agentPositions.push({
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
    
    // Make agent node draggable
    let agentMouseDown = false;
    
    node.addEventListener('mousedown', (e) => {
        agentMouseDown = true;
        setTimeout(() => {
            if (agentMouseDown) {
                isDraggingNode = true;
                draggedNode = node;
                draggedNodeType = 'agent';
                draggedNodeIndex = index;
                e.stopPropagation();
            }
        }, 150); // 150ms delay to distinguish click from drag
    });
    
    node.addEventListener('mouseup', (e) => {
        if (!isDraggingNode && agentMouseDown) {
            // This was a click, not a drag
            viewAgentDetails(agent);
        }
        agentMouseDown = false;
    });
    
    // Prevent text selection during drag
    node.addEventListener('dragstart', (e) => e.preventDefault());
    
    return node;
}

function renderConnections() {
    console.log('🔗 Rendering connections...');
    console.log('Subscriptions:', subscriptions.length);
    console.log('Agent positions:', agentPositions.length);
    console.log('Node positions:', nodePositions.length);
    
    // Remove old connection lines
    connections.forEach(conn => {
        if (conn.line && conn.line.parentNode) {
            conn.line.parentNode.removeChild(conn.line);
        }
    });
    connections = [];
    
    // Create connection lines between agents and subscribed breadcrumbs
    subscriptions.forEach((subscription, subIndex) => {
        console.log(`📡 Processing subscription ${subIndex + 1}:`, {
            agent: subscription.agent_id.substring(30),
            selector: subscription.selector
        });
        
        // Find agent position
        const agentPos = agentPositions.find(pos => pos.id === subscription.agent_id);
        if (!agentPos) {
            console.log(`❌ Agent not found in positions:`, subscription.agent_id.substring(30));
            return;
        }
        
        console.log(`✅ Found agent position:`, agentPos);
        
        // Find matching breadcrumbs for this subscription
        const matchingBreadcrumbs = findMatchingBreadcrumbs(subscription.selector);
        
        console.log(`🎯 Found ${matchingBreadcrumbs.length} matching breadcrumbs`);
        
        matchingBreadcrumbs.forEach((breadcrumb, breadIndex) => {
            // Find breadcrumb position in current render
            const breadcrumbPos = nodePositions.find(pos => pos.id === breadcrumb.id);
            
            if (breadcrumbPos) {
                console.log(`🔗 Creating connection: ${subscription.agent_id.substring(30)} → ${breadcrumb.title}`);
                
                // Create connection line
                const line = createConnectionLine(agentPos, breadcrumbPos, subscription);
                canvas.appendChild(line);
                
                connections.push({
                    agent: subscription.agent_id,
                    breadcrumb: breadcrumb.id,
                    line: line
                });
            } else {
                console.log(`❌ Breadcrumb position not found for: ${breadcrumb.title}`);
            }
        });
    });
    
    console.log(`✅ Created ${connections.length} connection lines`);
}

function redrawConnections() {
    // Quickly redraw all connection lines with current positions
    connections.forEach(conn => {
        if (conn.line && conn.line.parentNode) {
            const agentPos = agentPositions.find(pos => pos.id === conn.agent);
            const breadcrumbIndex = breadcrumbs.findIndex(b => b.id === conn.breadcrumb);
            
            if (agentPos && breadcrumbIndex >= 0 && nodePositions[breadcrumbIndex]) {
                const breadcrumbPos = nodePositions[breadcrumbIndex];
                updateConnectionLine(conn.line, agentPos, breadcrumbPos);
            }
        }
    });
}

function updateConnectionLine(line, agentPos, breadcrumbPos) {
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

function findMatchingBreadcrumbs(selector) {
    const toCheck = filteredBreadcrumbs.length > 0 ? filteredBreadcrumbs : breadcrumbs;
    
    const matches = toCheck.filter(breadcrumb => {
        // Check any_tags: breadcrumb must have at least one of these tags
        const anyTagsMatch = !selector.any_tags || 
            selector.any_tags.some(tag => breadcrumb.tags.includes(tag));
        
        // Check all_tags: breadcrumb must have all of these tags
        const allTagsMatch = !selector.all_tags || 
            selector.all_tags.every(tag => breadcrumb.tags.includes(tag));
        
        // Check schema_name
        const schemaMatch = !selector.schema_name || 
            (breadcrumb.schema_name === selector.schema_name);
        
        const result = anyTagsMatch && allTagsMatch && schemaMatch;
        
        if (result) {
            console.log(`✅ Breadcrumb ${breadcrumb.title} matches selector:`, {
                tags: breadcrumb.tags,
                schema: breadcrumb.schema_name,
                selector: selector,
                anyTagsMatch,
                allTagsMatch, 
                schemaMatch
            });
        }
        
        return result;
    });
    
    console.log(`Found ${matches.length} matching breadcrumbs for selector:`, selector);
    return matches;
}

function createConnectionLine(agentPos, breadcrumbPos, subscription) {
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

function viewAgentDetails(agent) {
    // Show agent details in left panel instead of alert
    selectAgentForDetails(agent);
}

function selectAgentForDetails(agent) {
    selectedAgent = agent;
    selectedAgentDetails = agent;
    
    displayAgentDetails(agent);
    selectAgent(agent.id);
}

function displayAgentDetails(agent) {
    const agentSubs = subscriptions.filter(s => s.agent_id === agent.id);
    const subsCount = agentSubs.length;
    const detailsContainer = document.getElementById('agentDetails');
    const updatedAt = new Date(agent.created_at).toLocaleString();
    
    let subscriptionDetails = '';
    if (subsCount > 0) {
        subscriptionDetails = agentSubs.map((sub, i) => {
            let criteria = [];
            if (sub.selector.any_tags) criteria.push(`Any: ${sub.selector.any_tags.join(', ')}`);
            if (sub.selector.all_tags) criteria.push(`All: ${sub.selector.all_tags.join(', ')}`);
            if (sub.selector.schema_name) criteria.push(`Schema: ${sub.selector.schema_name}`);
            return `${i + 1}. ${criteria.join(' | ')}`;
        }).join('<br>');
        
        const matchingCount = agentSubs.reduce((total, sub) => {
            return total + findMatchingBreadcrumbs(sub.selector).length;
        }, 0);
        subscriptionDetails += `<br><strong>Matches ${matchingCount} breadcrumbs</strong>`;
    } else {
        subscriptionDetails = 'No active subscriptions';
    }
    
    detailsContainer.innerHTML = `
        <div class="detail-field">
            <div class="detail-label">ID</div>
            <div class="detail-value">${agent.id}</div>
        </div>
        <div class="detail-field">
            <div class="detail-label">Roles</div>
            <div class="detail-value">${agent.roles.join(', ')}</div>
        </div>
        <div class="detail-field">
            <div class="detail-label">Created</div>
            <div class="detail-value">${updatedAt}</div>
        </div>
        <div class="detail-field">
            <div class="detail-label">Subscriptions (${subsCount})</div>
            <div class="detail-value">${subscriptionDetails}</div>
        </div>
    `;
    
    document.getElementById('selectedAgentSection').style.display = 'block';
    document.getElementById('selectedAgentSection').scrollIntoView({ behavior: 'smooth' });
}

async function selectBreadcrumbForDetails(id) {
    try {
        const response = await fetch(`/api/breadcrumbs/${id}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const details = await response.json();
        
        selectedBreadcrumb = breadcrumbs.find(b => b.id === id);
        selectedBreadcrumbDetails = details;
        
        displayBreadcrumbDetails(details);
        selectBreadcrumb(id);
        
    } catch (error) {
        console.error('Failed to load breadcrumb details:', error);
        alert('Failed to load breadcrumb details');
    }
}

function displayBreadcrumbDetails(details) {
    const detailsContainer = document.getElementById('breadcrumbDetails');
    const updatedAt = new Date(details.updated_at).toLocaleString();
    
    detailsContainer.innerHTML = `
        <div class="detail-field">
            <div class="detail-label">ID</div>
            <div class="detail-value">${details.id}</div>
        </div>
        <div class="detail-field">
            <div class="detail-label">Title</div>
            <div class="detail-value">${escapeHtml(details.title)}</div>
        </div>
        <div class="detail-field">
            <div class="detail-label">Tags</div>
            <div class="detail-value">${details.tags.join(', ')}</div>
        </div>
        <div class="detail-field">
            <div class="detail-label">Version</div>
            <div class="detail-value">${details.version}</div>
        </div>
        <div class="detail-field">
            <div class="detail-label">Updated</div>
            <div class="detail-value">${updatedAt}</div>
        </div>
        <div class="detail-field">
            <div class="detail-label">Context</div>
            <div class="detail-value">${JSON.stringify(details.context, null, 2)}</div>
        </div>
    `;
    
    document.getElementById('selectedSection').style.display = 'block';
    document.getElementById('selectedSection').scrollIntoView({ behavior: 'smooth' });
}

function updateStats() {
    const stats = document.getElementById('stats');
    stats.textContent = `${breadcrumbs.length} breadcrumbs`;
}

function refreshBreadcrumbs() {
    canvas.innerHTML = '<div class="loading"><div class="spinner"></div>Refreshing...</div>';
    
    // Clear any selections and filters for a fresh start
    deselectBreadcrumb();
    
    // Force reload of agents and subscriptions to pick up changes
    dataLoaded = false;
    
    loadBreadcrumbs().then(() => {
        // Force a complete re-render after loading
        setTimeout(() => {
            renderBreadcrumbs();
            updateStats();
        }, 100);
    });
}

function resetNodePositions() {
    if (confirm('Reset all node positions to default grid layout?\n\nThis will clear your custom arrangement.')) {
        console.log('Resetting all node positions');
        customNodePositions.clear();
        customAgentPositions.clear();
        renderBreadcrumbs();
    }
}

function centerViewOnContent() {
    const allPositions = [...nodePositions, ...agentPositions];
    if (allPositions.length === 0) return;
    
    const containerWidth = canvasContainer.clientWidth;
    const containerHeight = canvasContainer.clientHeight;
    
    // Calculate content bounds including both breadcrumbs and agents
    const minX = Math.min(...allPositions.map(p => p.x));
    const maxX = Math.max(...allPositions.map(p => p.x + p.width));
    const minY = Math.min(...allPositions.map(p => p.y));
    const maxY = Math.max(...allPositions.map(p => p.y + p.height));
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;
    
    // Center the content in the viewport, accounting for canvas position
    const canvasLeft = parseFloat(canvas.style.left) || 0;
    const canvasTop = parseFloat(canvas.style.top) || 0;
    
    canvasOffset.x = (containerWidth / 2) - contentCenterX - canvasLeft;
    canvasOffset.y = (containerHeight / 2) - contentCenterY - canvasTop;
    
    updateCanvasTransform();
}

function resetView() {
    scale = 1;
    centerViewOnContent();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Agent Management Functions
function selectAgent(agentId) {
    // Update visual selection in agent list
    document.querySelectorAll('#agentList .breadcrumb-item').forEach(item => {
        item.classList.remove('selected');
    });
    document.querySelector(`#agentList [data-id="${agentId}"]`)?.classList.add('selected');
    
    // Highlight on canvas
    highlightAgentOnCanvas(agentId);
}

function highlightAgentOnCanvas(agentId) {
    // Remove previous highlights
    document.querySelectorAll('.agent-node').forEach(node => {
        node.style.borderColor = 'rgba(255, 165, 0, 0.4)';
    });
    
    // Find and highlight the agent node
    const agentIndex = agents.findIndex(a => a.id === agentId);
    const agentNodes = document.querySelectorAll('.agent-node');
    if (agentNodes[agentIndex]) {
        agentNodes[agentIndex].style.borderColor = '#ffa500';
    }
}

function deselectAgent() {
    selectedAgent = null;
    selectedAgentDetails = null;
    document.getElementById('selectedAgentSection').style.display = 'none';
    document.getElementById('editAgentSection').style.display = 'none';
    
    // Clear edit form
    editAgentRoles = [];
    document.getElementById('editAgentId').value = '';
    updateTagDisplay('editAgentRoles', editAgentRoles);
    
    // Remove visual selection
    document.querySelectorAll('#agentList .breadcrumb-item').forEach(item => {
        item.classList.remove('selected');
    });
    document.querySelectorAll('.agent-node').forEach(node => {
        node.style.borderColor = 'rgba(255, 165, 0, 0.4)';
    });
}

function enterAgentEditMode() {
    if (!selectedAgentDetails) return;
    
    document.getElementById('editAgentId').value = selectedAgentDetails.id;
    editAgentRoles = [...selectedAgentDetails.roles];
    updateTagDisplay('editAgentRoles', editAgentRoles);
    
    document.getElementById('selectedAgentSection').style.display = 'none';
    document.getElementById('editAgentSection').style.display = 'block';
    document.getElementById('editAgentSection').scrollIntoView({ behavior: 'smooth' });
}

function editAgentById(agentId) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    
    selectAgentForDetails(agent);
    setTimeout(enterAgentEditMode, 100);
}

function cancelAgentEdit() {
    editAgentRoles = [];
    document.getElementById('editAgentSection').style.display = 'none';
    
    // Show selected section again if we have a selection
    if (selectedAgent) {
        document.getElementById('selectedAgentSection').style.display = 'block';
    }
}

// Agent role input handling
function handleAgentRoleInput(event) {
    const validRoles = ['curator', 'emitter', 'subscriber'];
    
    if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        const input = event.target;
        const role = input.value.trim().toLowerCase();
        
        if (validRoles.includes(role) && !editAgentRoles.includes(role)) {
            editAgentRoles.push(role);
            updateTagDisplay('editAgentRoles', editAgentRoles);
            input.value = '';
        } else if (role && !validRoles.includes(role)) {
            alert(`Invalid role: ${role}\nValid roles are: ${validRoles.join(', ')}`);
            input.value = '';
        } else if (editAgentRoles.includes(role)) {
            alert(`Role "${role}" already added`);
            input.value = '';
        }
    } else if (event.key === 'Backspace' && event.target.value === '') {
        if (editAgentRoles.length > 0) {
            editAgentRoles.pop();
            updateTagDisplay('editAgentRoles', editAgentRoles);
        }
    }
}

function focusAgentRoleInput() {
    document.getElementById('agentRoleInput').focus();
}

async function updateAgent() {
    if (!selectedAgent || editAgentRoles.length === 0) {
        alert('Please select valid roles');
        return;
    }
    
    try {
        const response = await fetch(`/api/agents/${selectedAgent.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                roles: editAgentRoles
            })
        });
        
        if (response.ok) {
            // Show loading state
            canvas.innerHTML = '<div class="loading"><div class="spinner"></div>Updating agent...</div>';
            
            // Clear selection and reload
            deselectAgent();
            dataLoaded = false; // Force reload of agents
            await loadBreadcrumbs();
            
            // Force a complete re-render
            setTimeout(() => {
                renderBreadcrumbs();
                updateStats();
            }, 100);
        } else {
            const errorText = await response.text();
            alert(`Failed to update agent: ${response.status} ${errorText}`);
        }
    } catch (error) {
        console.error('Error updating agent:', error);
        alert('Error updating agent');
    }
}

async function deleteAgent() {
    if (!selectedAgent) return;
    
    if (!confirm(`⚠️ Delete Agent?\n\nID: ${selectedAgent.id}\nRoles: ${selectedAgent.roles.join(', ')}\n\nThis will remove the agent and all its subscriptions.\n\nProceed?`)) {
        return;
    }
    
    // Show immediate loading state
    canvas.innerHTML = '<div class="loading"><div class="spinner"></div>Deleting agent...</div>';
    
    try {
        const response = await fetch(`/api/agents/${selectedAgent.id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Clear all UI state
            deselectAgent();
            deselectBreadcrumb();
            clearFilters();
            
            // Clear positions and data
            nodePositions = [];
            agentPositions = [];
            connections = [];
            dataLoaded = false; // Force reload
            
            // Reload fresh data from API
            await loadBreadcrumbs();
            
            setTimeout(() => {
                renderBreadcrumbs();
                updateStats();
            }, 200);
            
            console.log('Agent deleted and UI refreshed');
        } else {
            const errorText = await response.text();
            alert(`Failed to delete agent: ${response.status} ${errorText}`);
            // Restore previous content on error
            renderBreadcrumbs();
        }
    } catch (error) {
        console.error('Error deleting agent:', error);
        alert('Error deleting agent');
        // Restore previous content on error
        renderBreadcrumbs();
    }
}

// Panel and UI Functions
function togglePanel() {
    const panel = document.getElementById('leftPanel');
    const toggle = panel.querySelector('.panel-toggle');
    
    panel.classList.toggle('collapsed');
    toggle.textContent = panel.classList.contains('collapsed') ? '▶' : '◀';
}

// Tag Input Handling
function handleTagInput(event) {
    if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        const input = event.target;
        const tag = input.value.trim();
        if (tag && !newTags.includes(tag)) {
            newTags.push(tag);
            updateTagDisplay('newTags', newTags);
            input.value = '';
        }
    } else if (event.key === 'Backspace' && event.target.value === '') {
        if (newTags.length > 0) {
            newTags.pop();
            updateTagDisplay('newTags', newTags);
        }
    }
}

function handleEditTagInput(event) {
    if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        const input = event.target;
        const tag = input.value.trim();
        if (tag && !editTags.includes(tag)) {
            editTags.push(tag);
            updateTagDisplay('editTags', editTags);
            input.value = '';
        }
    } else if (event.key === 'Backspace' && event.target.value === '') {
        if (editTags.length > 0) {
            editTags.pop();
            updateTagDisplay('editTags', editTags);
        }
    }
}

function updateTagDisplay(containerId, tags) {
    const container = document.getElementById(containerId);
    container.innerHTML = tags.map(tag => 
        `<span class="tag-chip">
            ${escapeHtml(tag)}
            <span class="remove-tag" onclick="removeTag('${containerId}', '${tag}')">×</span>
        </span>`
    ).join('');
}

function removeTag(containerId, tag) {
    if (containerId === 'newTags') {
        newTags = newTags.filter(t => t !== tag);
        updateTagDisplay('newTags', newTags);
    } else if (containerId === 'editTags') {
        editTags = editTags.filter(t => t !== tag);
        updateTagDisplay('editTags', editTags);
    }
}

function focusTagInput() {
    document.getElementById('tagInput').focus();
}

function focusEditTagInput() {
    document.getElementById('editTagInput').focus();
}

// Filtering Functions
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const dateFrom = document.getElementById('dateFromFilter').value;
    const dateTo = document.getElementById('dateToFilter').value;
    
    filteredBreadcrumbs = breadcrumbs.filter(breadcrumb => {
        // Search filter
        const matchesSearch = !searchTerm || breadcrumb.title.toLowerCase().includes(searchTerm);
        
        // Tag filter - breadcrumb must have ALL selected tags
        const matchesTags = selectedTagFilters.length === 0 || 
            selectedTagFilters.every(filterTag => breadcrumb.tags.includes(filterTag));
        
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
    
    renderBreadcrumbs();
    updateStats();
}

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('dateFromFilter').value = '';
    document.getElementById('dateToFilter').value = '';
    selectedTagFilters = [];
    updateTagFilterDisplay();
    filteredBreadcrumbs = [];
    renderBreadcrumbs();
    updateStats();
}

function showRecentBreadcrumbs() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    document.getElementById('dateFromFilter').value = sevenDaysAgo.toISOString().split('T')[0];
    document.getElementById('dateToFilter').value = new Date().toISOString().split('T')[0];
    
    applyFilters();
}

function updateAvailableTags() {
    // Collect all unique tags from breadcrumbs
    const tagSet = new Set();
    breadcrumbs.forEach(breadcrumb => {
        breadcrumb.tags.forEach(tag => tagSet.add(tag));
    });
    
    allAvailableTags = Array.from(tagSet).sort();
    
    const container = document.getElementById('availableTags');
    container.innerHTML = allAvailableTags.map(tag => `
        <span class="tag-filter-chip ${selectedTagFilters.includes(tag) ? 'active' : ''}" 
              onclick="toggleTagFilter('${tag}')">
            ${escapeHtml(tag)}
        </span>
    `).join('');
}

function toggleTagFilter(tag) {
    const index = selectedTagFilters.indexOf(tag);
    if (index === -1) {
        selectedTagFilters.push(tag);
    } else {
        selectedTagFilters.splice(index, 1);
    }
    
    updateTagFilterDisplay();
    applyFilters();
}

function updateTagFilterDisplay() {
    const container = document.getElementById('availableTags');
    container.innerHTML = allAvailableTags.map(tag => `
        <span class="tag-filter-chip ${selectedTagFilters.includes(tag) ? 'active' : ''}" 
              onclick="toggleTagFilter('${tag}')">
            ${escapeHtml(tag)}
        </span>
    `).join('');
}

function showAllBreadcrumbs() {
    clearFilters();
}

// CRUD Operations
async function createBreadcrumb() {
    const title = document.getElementById('newTitle').value.trim();
    const contextText = document.getElementById('newContext').value.trim();
    
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
        tags: [...newTags]
    };
    
    try {
        const response = await fetch('/api/breadcrumbs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(breadcrumbData)
        });
        
        if (response.ok) {
            clearForm();
            
            // Show loading state and refresh
            canvas.innerHTML = '<div class="loading"><div class="spinner"></div>Loading new breadcrumb...</div>';
            await loadBreadcrumbs();
            
            // Force a complete re-render
            setTimeout(() => {
                renderBreadcrumbs();
                updateStats();
            }, 100);
        } else {
            alert('Failed to create breadcrumb');
        }
    } catch (error) {
        console.error('Error creating breadcrumb:', error);
        alert('Error creating breadcrumb');
    }
}

async function updateBreadcrumb() {
    if (!selectedBreadcrumb) return;
    
    const title = document.getElementById('editTitle').value.trim();
    const contextText = document.getElementById('editContext').value.trim();
    
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
        tags: [...editTags]
    };
    
    try {
        const response = await fetch(`/api/breadcrumbs/${selectedBreadcrumb.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'If-Match': selectedBreadcrumb.version.toString()
            },
            body: JSON.stringify(breadcrumbData)
        });
        
        if (response.ok) {
            // Show loading state
            canvas.innerHTML = '<div class="loading"><div class="spinner"></div>Updating breadcrumb...</div>';
            
            // Clear selection and reload
            deselectBreadcrumb();
            await loadBreadcrumbs();
            
            // Force a complete re-render
            setTimeout(() => {
                renderBreadcrumbs();
                updateStats();
            }, 100);
        } else {
            alert('Failed to update breadcrumb');
        }
    } catch (error) {
        console.error('Error updating breadcrumb:', error);
        alert('Error updating breadcrumb');
    }
}

async function deleteBreadcrumb() {
    if (!selectedBreadcrumb) return;
    
    if (!confirm(`Are you sure you want to delete "${selectedBreadcrumb.title}"?`)) {
        return;
    }
    
    // Show immediate loading state
    canvas.innerHTML = '<div class="loading"><div class="spinner"></div>Deleting breadcrumb...</div>';
    
    try {
        const response = await fetch(`/api/breadcrumbs/${selectedBreadcrumb.id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Clear all UI state
            deselectBreadcrumb();
            clearFilters();
            
            // Clear canvas and positions completely
            canvas.innerHTML = '<div class="loading"><div class="spinner"></div>Refreshing...</div>';
            nodePositions = [];
            filteredBreadcrumbs = [];
            
            // Reload fresh data from API
            await loadBreadcrumbs();
            
            // Force a complete re-render with delay to ensure DOM updates
            setTimeout(() => {
                renderBreadcrumbs();
                updateStats();
                updateAvailableTags();
                updateBreadcrumbList();
            }, 200);
            
            console.log('Breadcrumb deleted and UI refreshed');
        } else {
            const errorText = await response.text();
            alert(`Failed to delete breadcrumb: ${response.status} ${errorText}`);
            // Restore previous content on error
            renderBreadcrumbs();
        }
    } catch (error) {
        console.error('Error deleting breadcrumb:', error);
        alert('Error deleting breadcrumb');
        // Restore previous content on error
        renderBreadcrumbs();
    }
}

async function deleteAllFiltered() {
    const toDelete = filteredBreadcrumbs.length > 0 ? filteredBreadcrumbs : breadcrumbs;
    
    if (toDelete.length === 0) {
        alert('No breadcrumbs to delete');
        return;
    }
    
    const filterText = filteredBreadcrumbs.length > 0 ? 'filtered ' : '';
    const message = `Are you sure you want to delete all ${toDelete.length} ${filterText}breadcrumbs?\n\nThis action cannot be undone!`;
    
    if (!confirm(message)) {
        return;
    }
    
    // Show progress loading state
    canvas.innerHTML = `<div class="loading"><div class="spinner"></div>Deleting ${toDelete.length} breadcrumbs...</div>`;
    
    let successCount = 0;
    let failedCount = 0;
    
    try {
        // Delete all breadcrumbs in parallel for better performance
        const deletePromises = toDelete.map(async (breadcrumb) => {
            try {
                const response = await fetch(`/api/breadcrumbs/${breadcrumb.id}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    successCount++;
                } else {
                    failedCount++;
                    console.error(`Failed to delete breadcrumb ${breadcrumb.id}: ${response.status}`);
                }
            } catch (error) {
                failedCount++;
                console.error(`Error deleting breadcrumb ${breadcrumb.id}:`, error);
            }
        });
        
        // Wait for all deletions to complete
        await Promise.all(deletePromises);
        
        // Show completion status
        canvas.innerHTML = `<div class="loading"><div class="spinner"></div>Deleted ${successCount} breadcrumbs. Refreshing...</div>`;
        
        // Clear all UI state
        deselectBreadcrumb();
        clearFilters();
        nodePositions = [];
        filteredBreadcrumbs = [];
        
        // Reload fresh data
        await loadBreadcrumbs();
        
        // Force complete re-render
        setTimeout(() => {
            renderBreadcrumbs();
            updateStats();
            updateAvailableTags();
            updateBreadcrumbList();
        }, 200);
        
        // Show completion message
        if (failedCount > 0) {
            alert(`Bulk delete completed.\nSuccessful: ${successCount}\nFailed: ${failedCount}`);
        } else {
            console.log(`Successfully deleted ${successCount} breadcrumbs`);
        }
        
    } catch (error) {
        console.error('Error during bulk delete:', error);
        alert('Error occurred during bulk delete operation');
        // Restore UI on error
        renderBreadcrumbs();
    }
}

function clearForm() {
    document.getElementById('newTitle').value = '';
    document.getElementById('newContext').value = '';
    newTags = [];
    updateTagDisplay('newTags', newTags);
}

function enterEditMode() {
    if (!selectedBreadcrumbDetails) return;
    
    document.getElementById('editTitle').value = selectedBreadcrumbDetails.title;
    document.getElementById('editContext').value = JSON.stringify(selectedBreadcrumbDetails.context, null, 2);
    editTags = [...selectedBreadcrumbDetails.tags];
    updateTagDisplay('editTags', editTags);
    
    document.getElementById('selectedSection').style.display = 'none';
    document.getElementById('editSection').style.display = 'block';
    document.getElementById('editSection').scrollIntoView({ behavior: 'smooth' });
}

function editBreadcrumbById(id) {
    // This is called from double-click in list
    selectBreadcrumbForDetails(id).then(() => {
        // After loading details, enter edit mode
        setTimeout(enterEditMode, 100);
    });
}

function cancelEdit() {
    editTags = [];
    document.getElementById('editSection').style.display = 'none';
    
    // Show selected section again if we have a selection
    if (selectedBreadcrumb) {
        document.getElementById('selectedSection').style.display = 'block';
    }
}

function deselectBreadcrumb() {
    selectedBreadcrumb = null;
    selectedBreadcrumbDetails = null;
    document.getElementById('selectedSection').style.display = 'none';
    document.getElementById('editSection').style.display = 'none';
    
    // Clear edit form
    editTags = [];
    document.getElementById('editTitle').value = '';
    document.getElementById('editContext').value = '';
    updateTagDisplay('editTags', editTags);
    
    // Remove visual selection from list and canvas
    document.querySelectorAll('.breadcrumb-item').forEach(item => {
        item.classList.remove('selected');
    });
    document.querySelectorAll('.breadcrumb-node').forEach(node => {
        node.style.borderColor = 'rgba(0, 245, 255, 0.3)';
    });
}

function selectBreadcrumb(id) {
    // Update visual selection in list
    document.querySelectorAll('.breadcrumb-item').forEach(item => {
        item.classList.remove('selected');
    });
    document.querySelector(`[data-id="${id}"]`)?.classList.add('selected');
    
    // Highlight on canvas
    highlightNodeOnCanvas(id);
}

function highlightNodeOnCanvas(id) {
    // Remove previous highlights
    document.querySelectorAll('.breadcrumb-node').forEach(node => {
        node.style.borderColor = 'rgba(0, 245, 255, 0.3)';
    });
    
    // Find and highlight the node
    const nodes = document.querySelectorAll('.breadcrumb-node');
    const breadcrumb = breadcrumbs.find(b => b.id === id);
    if (breadcrumb) {
        const index = breadcrumbs.indexOf(breadcrumb);
        if (nodes[index]) {
            nodes[index].style.borderColor = '#00f5ff';
            nodes[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

function updateBreadcrumbList() {
    const listContainer = document.getElementById('breadcrumbList');
    const toShow = filteredBreadcrumbs.length > 0 ? filteredBreadcrumbs : breadcrumbs;
    
    listContainer.innerHTML = toShow.map(breadcrumb => `
        <div class="breadcrumb-item ${selectedBreadcrumb && selectedBreadcrumb.id === breadcrumb.id ? 'selected' : ''}" 
             data-id="${breadcrumb.id}" 
             onclick="selectBreadcrumbForDetails('${breadcrumb.id}')" 
             ondblclick="editBreadcrumbById('${breadcrumb.id}')">
            <div class="breadcrumb-item-title">${escapeHtml(breadcrumb.title)}</div>
            <div class="breadcrumb-item-meta">
                v${breadcrumb.version} • ${breadcrumb.tags.join(', ')} • ${new Date(breadcrumb.updated_at).toLocaleDateString()}
            </div>
        </div>
    `).join('');
    
    document.getElementById('breadcrumbCount').textContent = toShow.length;
}

function updateAgentList() {
    const listContainer = document.getElementById('agentList');
    
    listContainer.innerHTML = agents.map(agent => `
        <div class="breadcrumb-item ${selectedAgent && selectedAgent.id === agent.id ? 'selected' : ''}" 
             data-id="${agent.id}" 
             onclick="selectAgentForDetails(${JSON.stringify(agent).replace(/"/g, '&quot;')})" 
             ondblclick="editAgentById('${agent.id}')">
            <div class="breadcrumb-item-title">🤖 Agent ${agent.id.substring(30)}</div>
            <div class="breadcrumb-item-meta">
                ${agent.roles.join(', ')} • Created: ${new Date(agent.created_at).toLocaleDateString()}
            </div>
        </div>
    `).join('');
    
    document.getElementById('agentCount').textContent = agents.length;
}

function updateStats() {
    const stats = document.getElementById('stats');
    const displayCount = filteredBreadcrumbs.length > 0 ? filteredBreadcrumbs.length : breadcrumbs.length;
    const totalCount = breadcrumbs.length;
    
    if (filteredBreadcrumbs.length > 0) {
        stats.textContent = `${displayCount} of ${totalCount} breadcrumbs`;
        
        // Show delete all button when there are filtered results
        const deleteAllBtn = document.getElementById('deleteAllBtn');
        const deleteAllCount = document.getElementById('deleteAllCount');
        deleteAllBtn.style.display = 'block';
        deleteAllCount.textContent = displayCount;
    } else {
        stats.textContent = `${totalCount} breadcrumbs`;
        
        // Hide delete all button when showing all
        document.getElementById('deleteAllBtn').style.display = 'none';
    }
}

// Right Panel Functions
function toggleRightPanel() {
    const panel = document.getElementById('rightPanel');
    const toggle = panel.querySelector('.panel-toggle');
    
    panel.classList.toggle('collapsed');
    toggle.textContent = panel.classList.contains('collapsed') ? '◀' : '▶';
}

function connectEventStream() {
    if (eventSource) {
        eventSource.close();
    }
    
    try {
        console.log('Connecting to event stream at /api/events/stream');
        eventSource = new EventSource('/api/events/stream');
        
        eventSource.onopen = function() {
            console.log('EventSource connection opened');
            updateStreamStatus(true, 'Connected');
            addEventToLog({
                type: 'system',
                message: 'Connected to event stream',
                timestamp: new Date().toISOString()
            });
        };
        
        eventSource.onmessage = function(event) {
            console.log('EventSource message received:', event.data);
            
            if (streamPaused) {
                console.log('Stream paused, ignoring event');
                return;
            }
            
            try {
                const data = JSON.parse(event.data);
                console.log('Parsed event data:', data);
                
                // Filter out ping events if hiding is enabled
                if (hidePings && data.type === 'ping') {
                    console.log('Ping event filtered out');
                    return;
                }
                
                addEventToLog(data);
            } catch (e) {
                console.error('Failed to parse event data:', e, 'Raw data:', event.data);
                // Add the raw data as a system event
                addEventToLog({
                    type: 'system',
                    message: 'Received unparseable event: ' + event.data,
                    timestamp: new Date().toISOString()
                });
            }
        };
        
        eventSource.onerror = function(event) {
            console.error('EventSource error:', event);
            updateStreamStatus(false, 'Connection error');
            
            addEventToLog({
                type: 'system',
                message: 'EventSource error occurred',
                timestamp: new Date().toISOString()
            });
            
            // Try to reconnect after 5 seconds
            setTimeout(() => {
                if (!streamPaused) {
                    console.log('Attempting to reconnect...');
                    connectEventStream();
                }
            }, 5000);
        };
        
    } catch (error) {
        console.error('Failed to connect to event stream:', error);
        updateStreamStatus(false, 'Failed to connect');
        addEventToLog({
            type: 'system',
            message: 'Failed to initialize event stream: ' + error.message,
            timestamp: new Date().toISOString()
        });
    }
}

function updateStreamStatus(connected, statusText) {
    const indicator = document.getElementById('streamStatus');
    const text = document.getElementById('streamStatusText');
    
    indicator.classList.toggle('connected', connected);
    text.textContent = statusText;
}

function addEventToLog(eventData) {
    console.log('Adding event to log:', eventData);
    const timestamp = new Date(eventData.timestamp || eventData.ts || Date.now()).toLocaleTimeString();
    const eventType = eventData.type || 'unknown';
    
    // Limit log size
    if (eventLog.length >= maxEventLogSize) {
        eventLog.shift();
    }
    
    const logEntry = {
        ...eventData,
        displayTime: timestamp,
        rawEventData: JSON.stringify(eventData) // For debugging
    };
    
    eventLog.push(logEntry);
    console.log('Event log now has', eventLog.length, 'events');
    
    renderEventLog();
}

function renderEventLog() {
    console.log('Rendering event log with', eventLog.length, 'events, hidePings:', hidePings);
    const eventList = document.getElementById('eventList');
    
    // Filter events based on ping filter setting
    const filteredEvents = eventLog.filter(event => {
        if (hidePings && event.type === 'ping') {
            return false;
        }
        return true;
    });
    
    console.log('Filtered events count:', filteredEvents.length);
    
    if (filteredEvents.length === 0) {
        const message = hidePings ? 'No non-ping events yet...' : 'No events yet...';
        eventList.innerHTML = `<div class="event-item ping"><div class="event-details">${message}</div></div>`;
        return;
    }
    
    eventList.innerHTML = filteredEvents.map(event => {
        const eventType = event.type || 'unknown';
        const eventClass = eventType.replace(/\./g, '-');
        
        let details = '';
        let action = '';
        
        if (eventType === 'ping') {
            details = `Heartbeat ${event.counter || ''}`;
            if (event.source) details += ` (${event.source})`;
        } else if (eventType.includes('breadcrumb')) {
            action = eventType.split('.')[1] || 'unknown';
            details = `${action.toUpperCase()}`;
            if (event.breadcrumb_id) {
                details += `: ${event.breadcrumb_id.toString().substring(0, 8)}...`;
            }
            if (event.title) {
                details += `<br>Title: ${escapeHtml(event.title.toString())}`;
            }
            if (event.tags && Array.isArray(event.tags)) {
                details += `<br>Tags: ${event.tags.join(', ')}`;
            }
        } else if (eventType === 'system') {
            details = event.message || 'System event';
        }
        
        return `
            <div class="event-item ${eventClass}">
                <div class="event-header">
                    <span class="event-type ${action || eventType}">${eventType}</span>
                    <span class="event-time">${event.displayTime}</span>
                </div>
                <div class="event-details">${details}</div>
                ${event.breadcrumb_id ? `<div class="event-id">ID: ${event.breadcrumb_id}</div>` : ''}
            </div>
        `;
    }).reverse().join(''); // Show newest first
    
    // Auto-scroll to bottom if enabled
    if (autoScroll) {
        setTimeout(() => {
            eventList.scrollTop = eventList.scrollHeight;
        }, 10);
    }
}

function clearEventLog() {
    eventLog = [];
    renderEventLog();
}

function toggleAutoScroll() {
    autoScroll = !autoScroll;
    document.getElementById('autoScrollBtn').textContent = `Auto-scroll: ${autoScroll ? 'ON' : 'OFF'}`;
}

function pauseStream() {
    streamPaused = !streamPaused;
    const btn = document.getElementById('pauseBtn');
    
    if (streamPaused) {
        btn.textContent = 'Resume';
        btn.style.background = 'rgba(255, 107, 107, 0.1)';
        btn.style.borderColor = 'rgba(255, 107, 107, 0.3)';
        btn.style.color = '#ff6b6b';
        updateStreamStatus(false, 'Paused');
    } else {
        btn.textContent = 'Pause';
        btn.style.background = 'rgba(0, 245, 255, 0.1)';
        btn.style.borderColor = 'rgba(0, 245, 255, 0.3)';
        btn.style.color = '#00f5ff';
        if (eventSource && eventSource.readyState === EventSource.OPEN) {
            updateStreamStatus(true, 'Connected');
        }
    }
}

function testEvent() {
    console.log('Manual test event triggered');
    addEventToLog({
        type: 'breadcrumb.test',
        breadcrumb_id: 'test-manual-' + Date.now(),
        title: 'Manual Test Event',
        tags: ['test', 'manual'],
        version: 1,
        ts: new Date().toISOString(),
        message: 'This is a manual test event'
    });
}

function reconnectStream() {
    console.log('Manual reconnect triggered');
    if (eventSource) {
        eventSource.close();
    }
    updateStreamStatus(false, 'Reconnecting...');
    setTimeout(() => {
        connectEventStream();
    }, 1000);
}

function togglePingFilter() {
    hidePings = !hidePings;
    const btn = document.getElementById('pingFilterBtn');
    
    if (hidePings) {
        btn.textContent = 'Show Pings';
        btn.style.background = 'rgba(255, 165, 0, 0.1)';
        btn.style.borderColor = 'rgba(255, 165, 0, 0.3)';
        btn.style.color = '#ffa500';
        console.log('Ping events are now hidden');
        
        // Re-render existing log to hide pings
        renderEventLog();
    } else {
        btn.textContent = 'Hide Pings';
        btn.style.background = 'rgba(0, 245, 255, 0.1)';
        btn.style.borderColor = 'rgba(0, 245, 255, 0.3)';
        btn.style.color = '#00f5ff';
        console.log('Ping events are now visible');
        
        // Re-render existing log to show pings
        renderEventLog();
    }
}

// Admin Panel Functions
function showAdminPanel() {
    document.getElementById('adminModal').style.display = 'block';
    
    // First, check current agent permissions
    checkCurrentAgentPermissions().then(() => {
        // Load initial data for current tab
        const activeTab = document.querySelector('.admin-tab.active').textContent.toLowerCase().includes('agents') ? 'agents' : 'tenants';
        loadAdminData(activeTab);
    });
}

async function checkCurrentAgentPermissions() {
    try {
        // Get current agent info by trying to access a simple endpoint
        const response = await fetch('/api/agents');
        if (response.ok) {
            const agents = await response.json();
            // Find current agent in the list to show their roles
            console.log('Current agent permissions check - agents loaded:', agents.length);
            
            // Add permission info to admin panel header
            const header = document.querySelector('.admin-content h2');
            header.innerHTML = `🛠️ Admin Management <small style="color: rgba(255,255,255,0.6); font-size: 0.7rem;">(Current agent roles: checking...)</small>`;
        } else {
            console.error('Failed to check current agent permissions:', response.status);
        }
    } catch (error) {
        console.error('Error checking permissions:', error);
    }
}

function hideAdminPanel() {
    document.getElementById('adminModal').style.display = 'none';
}

function showAdminTab(tabName) {
    // Update tab visuals
    document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(panel => panel.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabName + 'Panel').classList.add('active');
    
    // Load data for the selected tab
    loadAdminData(tabName);
}

async function loadAdminData(entityType) {
    console.log('Loading admin data for:', entityType);
    
    try {
        let endpoint = `/api/${entityType}`;
        
        // Special handling for webhooks - need to get for all agents
        if (entityType === 'webhooks') {
            // For now, show placeholder since webhooks are per-agent
            renderAdminEntity(entityType, [], 'Select "Agents" tab to view agent-specific webhooks');
            return;
        }
        
        const response = await fetch(endpoint, {
            headers: authHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            renderAdminEntity(entityType, data);
        } else {
            if (response.status === 403) {
                renderAdminEntity(entityType, [], `Access Denied: Requires curator role for ${entityType}`);
            } else {
                renderAdminEntity(entityType, [], `Error ${response.status}: ${response.statusText}`);
            }
        }
    } catch (error) {
        console.error(`Failed to load ${entityType}:`, error);
        renderAdminEntity(entityType, [], `Network Error: ${error.message}`);
    }
}

function renderAdminEntity(entityType, data, error = null) {
    const listContainer = document.getElementById(entityType + 'List');
    
    if (error) {
        listContainer.innerHTML = `<div style="padding: 2rem; text-align: center; color: #ff6b6b;">${error}</div>`;
        return;
    }
    
    if (!data || data.length === 0) {
        listContainer.innerHTML = `<div style="padding: 2rem; text-align: center; color: rgba(255,255,255,0.6);">No ${entityType} found.</div>`;
        return;
    }
    
    listContainer.innerHTML = data.map(item => {
        if (entityType === 'agents') {
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
                        <button class="btn-small" onclick="viewAgent('${item.id}')">Details</button>
                        <button class="btn-small" onclick="viewAgentWebhooks('${item.id}')">Webhooks</button>
                    </div>
                </div>
            `;
        } else if (entityType === 'subscriptions') {
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
                        <button class="btn-small" onclick="viewSubscription('${item.id}')">Details</button>
                        <button class="btn-small btn-danger" onclick="deleteSubscription('${item.id}')">Delete</button>
                    </div>
                </div>
            `;
        } else if (entityType === 'tenants') {
            return `
                <div class="entity-item">
                    <div class="entity-info">
                        <div class="entity-title">${escapeHtml(item.name)}</div>
                        <div class="entity-meta">ID: ${item.id} | Created: ${new Date(item.created_at).toLocaleDateString()}</div>
                    </div>
                    <div class="entity-actions">
                        <button class="btn-small" onclick="viewTenant('${item.id}')">View</button>
                    </div>
                </div>
            `;
        } else if (entityType === 'secrets') {
            return `
                <div class="entity-item">
                    <div class="entity-info">
                        <div class="entity-title">🔐 ${escapeHtml(item.name)}</div>
                        <div class="entity-meta">Scope: ${item.scope_type} | Created: ${new Date(item.created_at).toLocaleDateString()}</div>
                    </div>
                    <div class="entity-actions">
                        <button class="btn-small btn-danger" onclick="viewSecret('${item.id}')">Decrypt</button>
                    </div>
                </div>
            `;
        } else if (entityType === 'acl') {
            return `
                <div class="entity-item">
                    <div class="entity-info">
                        <div class="entity-title">ACL ${item.id.substring(0, 8)}...</div>
                        <div class="entity-meta">Breadcrumb: ${item.breadcrumb_id.substring(0, 8)}... | Actions: ${item.actions.join(', ')}</div>
                    </div>
                    <div class="entity-actions">
                        <button class="btn-small btn-danger" onclick="revokeAcl('${item.id}')">Revoke</button>
                    </div>
                </div>
            `;
        }
        return '';
    }).join('');
}

function authHeaders() {
    // Use the same JWT token as the main dashboard
    return {};  // Dashboard handles auth via state
}

// Individual refresh functions
function refreshAgents() { loadAdminData('agents'); }
function refreshSubscriptions() { loadAdminData('subscriptions'); }
function refreshTenants() { loadAdminData('tenants'); }
function refreshSecrets() { loadAdminData('secrets'); }
function refreshAcl() { loadAdminData('acl'); }
function refreshWebhooks() { loadAdminData('webhooks'); }

// Admin action functions
async function viewAgent(id) { 
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

async function viewAgentWebhooks(agentId) {
    try {
        const response = await fetch(`/api/agents/${agentId}/webhooks`);
        if (response.ok) {
            const webhooks = await response.json();
            const details = webhooks.length > 0 
                ? webhooks.map(w => `• ${w.url}`).join('\n')
                : 'No webhooks configured';
            alert(`Webhooks for Agent ${agentId.substring(0, 8)}...\n\n${details}`);
        } else {
            alert(`Error ${response.status}: Cannot load webhooks for this agent`);
        }
    } catch (error) {
        alert(`Error loading webhooks: ${error.message}`);
    }
}

function viewTenant(id) { 
    alert(`Tenant Management:\n\nID: ${id}\n\n⚠️ Curator role required for tenant operations.\n\nAvailable operations:\n• View tenant details\n• Update tenant name\n• Delete tenant (dangerous!)`);
}

function viewSecret(id) { 
    if (confirm('⚠️ This will decrypt and display the secret value!\n\nThis action is audited and requires curator privileges.\n\nProceed?')) {
        alert(`Secret Decryption:\n\nID: ${id}\n\n🔐 Secret decryption would require:\n1. Curator role verification\n2. Audit log entry\n3. Reason for access\n\n(Full decrypt implementation coming soon)`); 
    }
}

function revokeAcl(id) { 
    if (confirm('⚠️ Revoke this ACL entry?\n\nThis will remove access permissions and cannot be undone easily.')) {
        alert(`ACL Management:\n\nID: ${id}\n\n🛡️ ACL operations require curator role.\n\nThis would revoke specific permissions for accessing breadcrumbs.\n\n(Full implementation coming soon)`); 
    }
}

async function viewSubscription(id) {
    try {
        const response = await fetch(`/api/subscriptions`);
        const subscriptions = await response.json();
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

function deleteSubscription(id) {
    if (confirm('Delete this subscription?\n\nThe agent will stop receiving events for matching breadcrumbs.')) {
        alert(`Subscription Deletion:\n\nID: ${id}\n\n📡 Would unsubscribe agent from matching breadcrumb events.\n\n(Full implementation coming soon)`);
    }
}

function showCreateSubscription() {
    alert(`Create Subscription:\n\n📡 Subscriptions use "selectors" to match breadcrumbs:\n\n• ANY_TAGS: ["workspace:demo", "urgent"] - matches breadcrumbs with either tag\n• ALL_TAGS: ["ui:instance"] - matches breadcrumbs with all specified tags\n• SCHEMA_NAME: "user.profile.v1" - matches specific schema\n• CONTEXT_MATCH: $.priority == "high" - matches JSON path conditions\n\nWhen breadcrumbs match, agents get real-time events!\n\n(Full creation UI coming soon)`);
}

async function subscribeToThisBreadcrumb() {
    if (!selectedBreadcrumbDetails) {
        alert('No breadcrumb selected');
        return;
    }
    
    const confirmed = confirm(`📡 Subscribe to Breadcrumb Updates?\n\nID: ${selectedBreadcrumbDetails.id}\nTitle: "${selectedBreadcrumbDetails.title}"\n\nYour agent will receive events when THIS specific breadcrumb is updated.\n\nProceed?`);
    
    if (confirmed) {
        try {
            // For now, show what would happen since direct ID subscriptions may need implementation
            alert(`📡 Breadcrumb Subscription:\n\nWould subscribe to: ${selectedBreadcrumbDetails.id}\n\nReal-time updates for:\n• Title changes\n• Context modifications  \n• Tag updates\n• Version increments\n\nEvents delivered via:\n• SSE stream (right panel)\n• Webhooks (if configured)\n• NATS JetStream\n\n(Direct ID subscription implementation coming soon)\n\nFor now, use Selector Subscriptions in Admin panel!`);
        } catch (error) {
            alert(`Subscription error: ${error.message}`);
        }
    }
}

// Close modal on escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        hideAdminPanel();
    }
});

// Close modal on background click
document.getElementById('adminModal').addEventListener('click', function(event) {
    if (event.target === this) {
        hideAdminPanel();
    }
});

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Initialize canvas element
    canvas = document.getElementById('canvas');
    canvasContainer = canvas.parentElement;
    
    // Load initial data
    loadBreadcrumbs();
    
    // Connect to event stream
    connectEventStream();
    
    // Auto-refresh every 30 seconds
    setInterval(loadBreadcrumbs, 30000);
});
