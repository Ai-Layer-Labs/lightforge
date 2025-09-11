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

// Tools visualization
let availableTools = [];
let toolPositions = [];
let customToolPositions = new Map(); // Store custom tool positions by ID
let dataLoaded = false; // Track if we've loaded initial data
let isDraggingNode = false;
let draggedNode = null;
let draggedNodeType = null; // 'breadcrumb', 'agent', or 'tool'
let draggedNodeIndex = -1;
let lastUserInteraction = Date.now(); // Track user activity

// Chat interface variables
let chatTags = [];
let availableWorkspaces = new Set();
let eventFilters = new Set(['all']); // Default to showing all events
let breadcrumbTemplates = new Map();

// Direct RCRT connection variables
let rcrtJwtToken = null;
let rcrtBaseUrl = 'http://localhost:8081'; // Direct RCRT connection

// Persistent UI state variables
let leftPanelWidth = 350; // Default width
let rightPanelWidth = 350; // Default width
let collapsedSections = new Set(); // Track collapsed sections

// Pan functionality - only when not dragging a node
canvasContainer.addEventListener('mousedown', (e) => {
    // Track user interaction
    lastUserInteraction = Date.now();
    
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
            
        } else if (draggedNodeType === 'tool' && toolPositions[draggedNodeIndex]) {
            const toolId = toolPositions[draggedNodeIndex].id;
            toolPositions[draggedNodeIndex].x = canvasX;
            toolPositions[draggedNodeIndex].y = canvasY;
            
            // Save custom position for persistence (center coordinates)
            customToolPositions.set(toolId, { x: canvasX, y: canvasY });
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
    const allPositions = [...nodePositions, ...agentPositions, ...toolPositions];
    if (allPositions.length === 0) return;
    
    // Calculate bounding box of all nodes (breadcrumbs + agents + tools)
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
        
        // Preserve current filter state during auto-refresh
        // If filters are active, reapply them to the fresh data
        const hadActiveFilters = filteredBreadcrumbs.length > 0;
        
        // Only load agents and subscriptions on first load, not on every refresh
        if (!dataLoaded) {
            await loadAgentsAndSubscriptions();
            dataLoaded = true;
        }
        
        // Reapply filters if they were active to preserve user state
        if (hadActiveFilters) {
            applyFilters();
        } else {
            renderBreadcrumbs();
        }
        updateStats();
        
        // Update workspace options with fresh data
        updateWorkspaceOptions();
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
        
        // 🔧 NEW: Load available tools from tool catalog
        await loadAvailableTools();
        
    } catch (error) {
        console.error('Failed to load agents/subscriptions:', error);
        // Continue without agent visualization if this fails
        agents = [];
        subscriptions = [];
        availableTools = [];
    }
}

// Load available tools from the tool catalog breadcrumb
async function loadAvailableTools() {
    try {
        // Find the tool catalog breadcrumb
        const toolCatalog = breadcrumbs.find(b => 
            b.tags?.includes('tool:catalog') && 
            b.title?.includes('Tool Catalog')
        );
        
        if (toolCatalog) {
            console.log('🛠️ Found tool catalog breadcrumb:', toolCatalog.id);
            
            // Get full context to see the tools list
            const response = await fetch(`/api/breadcrumbs/${toolCatalog.id}`);
            if (response.ok) {
                const catalogData = await response.json();
                
                if (catalogData.context && catalogData.context.tools) {
                    availableTools = catalogData.context.tools.map((tool, index) => ({
                        name: tool.name,
                        description: tool.description,
                        category: tool.category,
                        status: tool.status,
                        id: `tool-${tool.name}`,
                        index: index
                    }));
                    
                    console.log('🛠️ Loaded tools:', availableTools.length, availableTools.map(t => t.name));
                } else {
                    console.warn('🛠️ Tool catalog found but no tools in context');
                    availableTools = [];
                }
            } else {
                console.error('🛠️ Failed to fetch tool catalog details');
                availableTools = [];
            }
        } else {
            console.warn('🛠️ No tool catalog breadcrumb found');
            availableTools = [];
        }
    } catch (error) {
        console.error('🛠️ Failed to load tools:', error);
        availableTools = [];
    }
}

function renderBreadcrumbs() {
    canvas.innerHTML = '';
    nodePositions = []; // Reset positions
    agentPositions = []; // Reset agent positions
    toolPositions = []; // Reset tool positions
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
    
    // 🛠️ NEW: Render tool nodes
    availableTools.forEach((tool, index) => {
        const node = createToolNode(tool, index);
        canvas.appendChild(node);
    });
    
    // Render connection lines (agents → subscriptions, tools → created breadcrumbs)
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

// 🛠️ NEW: Create tool nodes on canvas
function createToolNode(tool, index) {
    const node = document.createElement('div');
    node.className = 'tool-node';
    
    // Check if we have a custom position for this tool
    let x, y;
    const nodeSize = 100;
    
    if (customToolPositions.has(tool.id)) {
        // Use saved custom position
        const saved = customToolPositions.get(tool.id);
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
    toolPositions.push({
        id: tool.id,
        name: tool.name,
        x: x + 50, // Center of square
        y: y + 50, // Center of square
        width: 100,
        height: 100
    });
    
    // Get tool-specific icon and color
    const getToolIcon = (toolName, category) => {
        if (toolName === 'openrouter') return '🧠';
        if (toolName === 'ollama_local') return '🏠';
        if (toolName === 'echo') return '📢';
        if (toolName === 'timer') return '⏱️';
        if (toolName === 'random') return '🎲';
        if (toolName === 'calculator') return '🔢';
        if (toolName === 'web_browser') return '🌐';
        return category === 'llm' ? '🤖' : '🛠️';
    };
    
    const icon = getToolIcon(tool.name, tool.category);
    const statusColor = tool.status === 'active' ? '#00ff88' : '#ffaa00';
    
    node.innerHTML = `
        <div class="tool-icon">${icon}</div>
        <div class="tool-name">${tool.name}</div>
        <div class="tool-status" style="color: ${statusColor};">${tool.status}</div>
        <div class="tool-category">${tool.category || 'tool'}</div>
    `;
    
    // Make tool node draggable
    let toolMouseDown = false;
    
    node.addEventListener('mousedown', (e) => {
        toolMouseDown = true;
        setTimeout(() => {
            if (toolMouseDown) {
                isDraggingNode = true;
                draggedNode = node;
                draggedNodeType = 'tool';
                draggedNodeIndex = index;
                e.stopPropagation();
            }
        }, 150); // 150ms delay to distinguish click from drag
    });
    
    node.addEventListener('mouseup', (e) => {
        if (!isDraggingNode && toolMouseDown) {
            // This was a click, not a drag
            viewToolDetails(tool);
        }
        toolMouseDown = false;
    });
    
    // Prevent text selection during drag
    node.addEventListener('dragstart', (e) => e.preventDefault());
    
    return node;
}

function renderConnections() {
    console.log('🔗 Rendering connections...');
    console.log('Subscriptions:', subscriptions.length);
    console.log('Agent positions:', agentPositions.length);
    console.log('Tool positions:', toolPositions.length);
    console.log('Node positions:', nodePositions.length);
    
    // Remove old connection lines
    connections.forEach(conn => {
        if (conn.line && conn.line.parentNode) {
            conn.line.parentNode.removeChild(conn.line);
        }
    });
    connections = [];
    
    // 1. Create connection lines between agents and subscribed breadcrumbs
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
    
    // 2. 🛠️ NEW: Create connection lines between tools and breadcrumbs they created
    availableTools.forEach((tool, toolIndex) => {
        console.log(`🛠️ Processing tool ${toolIndex + 1}:`, tool.name);
        
        // Find tool position
        const toolPos = toolPositions.find(pos => pos.id === tool.id);
        if (!toolPos) {
            console.log(`❌ Tool position not found:`, tool.name);
            return;
        }
        
        // Find breadcrumbs created by this tool
        const toolBreadcrumbs = findToolCreatedBreadcrumbs(tool.name);
        console.log(`🎯 Found ${toolBreadcrumbs.length} breadcrumbs created by ${tool.name}`);
        
        toolBreadcrumbs.forEach((breadcrumb) => {
            // Find breadcrumb position in current render
            const breadcrumbPos = nodePositions.find(pos => pos.id === breadcrumb.id);
            
            if (breadcrumbPos) {
                console.log(`🔗 Creating tool connection: ${tool.name} → ${breadcrumb.title}`);
                
                // Create connection line with different styling than agent connections
                const line = createToolConnectionLine(toolPos, breadcrumbPos, tool);
                canvas.appendChild(line);
                
                connections.push({
                    tool: tool.id,
                    breadcrumb: breadcrumb.id,
                    line: line,
                    type: 'tool-creation'
                });
            } else {
                console.log(`❌ Breadcrumb position not found for: ${breadcrumb.title}`);
            }
        });
    });
    
    console.log(`✅ Created ${connections.length} total connection lines (agent subscriptions + tool creations)`);
}

function redrawConnections() {
    // Quickly redraw all connection lines with current positions
    connections.forEach(conn => {
        if (conn.line && conn.line.parentNode) {
            if (conn.type === 'tool-creation') {
                // Tool → breadcrumb connection
                const toolPos = toolPositions.find(pos => pos.id === conn.tool);
                const breadcrumbIndex = breadcrumbs.findIndex(b => b.id === conn.breadcrumb);
                
                if (toolPos && breadcrumbIndex >= 0 && nodePositions[breadcrumbIndex]) {
                    const breadcrumbPos = nodePositions[breadcrumbIndex];
                    updateConnectionLine(conn.line, toolPos, breadcrumbPos);
                }
            } else {
                // Agent subscription connection
                const agentPos = agentPositions.find(pos => pos.id === conn.agent);
                const breadcrumbIndex = breadcrumbs.findIndex(b => b.id === conn.breadcrumb);
                
                if (agentPos && breadcrumbIndex >= 0 && nodePositions[breadcrumbIndex]) {
                    const breadcrumbPos = nodePositions[breadcrumbIndex];
                    updateConnectionLine(conn.line, agentPos, breadcrumbPos);
                }
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

// 🛠️ NEW: Create connection lines from tools to breadcrumbs they created
function createToolConnectionLine(toolPos, breadcrumbPos, tool) {
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

function viewAgentDetails(agent) {
    // Show agent details in left panel instead of alert
    selectAgentForDetails(agent);
}

// 🛠️ NEW: View tool details when clicked
function viewToolDetails(tool) {
    const toolBreadcrumbs = findToolCreatedBreadcrumbs(tool.name);
    
    const details = `
Tool Details:

🛠️ Name: ${tool.name}
📖 Description: ${tool.description}
📂 Category: ${tool.category || 'general'}
🔄 Status: ${tool.status}

📊 Activity:
• Created ${toolBreadcrumbs.length} breadcrumbs
• Recent activity: ${toolBreadcrumbs.length > 0 ? 'Active' : 'No recent activity'}

🔗 Tool Breadcrumbs:
${toolBreadcrumbs.slice(0, 5).map(b => `• ${b.title.substring(0, 50)}${b.title.length > 50 ? '...' : ''}`).join('\n')}
${toolBreadcrumbs.length > 5 ? `\n... and ${toolBreadcrumbs.length - 5} more` : ''}

🎯 This tool ${tool.status === 'active' ? 'is ready to process requests' : 'is not currently active'}.
    `.trim();
    
    alert(details);
}

// Find breadcrumbs created by a specific tool
function findToolCreatedBreadcrumbs(toolName) {
    const toCheck = filteredBreadcrumbs.length > 0 ? filteredBreadcrumbs : breadcrumbs;
    
    return toCheck.filter(breadcrumb => {
        // Check for tool.response.v1 breadcrumbs with this tool name
        return breadcrumb.tags?.includes('tool:response') &&
               breadcrumb.title?.includes(`Response: ${toolName}`) ||
               breadcrumb.title?.includes(`${toolName} Result`) ||
               breadcrumb.title?.includes(`${toolName} Error`);
    });
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
    // Track user interaction
    lastUserInteraction = Date.now();
    
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
    
    // Preserve current user state (filters, selections) during manual refresh
    // Only deselect if the selected item no longer exists after refresh
    
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
        customToolPositions.clear(); // 🛠️ Also clear tool positions
        renderBreadcrumbs();
    }
}

function centerViewOnContent() {
    const allPositions = [...nodePositions, ...agentPositions, ...toolPositions];
    if (allPositions.length === 0) return;
    
    const containerWidth = canvasContainer.clientWidth;
    const containerHeight = canvasContainer.clientHeight;
    
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
    // Track user interaction when filters are applied
    lastUserInteraction = Date.now();
    
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
    // Track user interaction
    lastUserInteraction = Date.now();
    
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

// Get JWT token from dashboard backend for direct RCRT connection
async function getRCRTToken() {
    try {
        console.log('🔑 Fetching JWT token from dashboard backend...');
        const response = await fetch('/api/auth/token');
        
        if (response.ok) {
            const data = await response.json();
            rcrtJwtToken = data.token;
            rcrtBaseUrl = data.rcrt_base_url || 'http://localhost:8081';
            console.log('✅ Got JWT token for direct RCRT connection');
            return data.token;
        } else {
            console.error('❌ Failed to get JWT token:', response.status);
            return null;
        }
    } catch (error) {
        console.error('❌ Error getting JWT token:', error);
        return null;
    }
}

async function connectEventStream() {
    if (eventSource) {
        eventSource.close();
    }
    
    try {
        console.log('🚀 Initializing direct RCRT SSE connection...');
        
        // 🎯 STEP 1: Get JWT token for direct connection
        const token = await getRCRTToken();
        
        // 🔧 SECURITY FIX: CORS prevents direct cross-origin EventSource
        // Use dashboard proxy for security compliance (but make it real-time!)
        const streamUrl = '/api/events/stream';
        console.log('🔐 Using secure dashboard proxy for RCRT SSE (required for CORS compliance)');
        
        eventSource = new EventSource(streamUrl);
        
        eventSource.onopen = function() {
            console.log('EventSource connection opened: 🔐 Secure Dashboard Proxy');
            updateStreamStatus(true, '🔐 Secure Proxy Connected');
            addEventToLog({
                type: 'system',
                message: '🔐 Connected via secure dashboard proxy (CORS compliant)',
                timestamp: new Date().toISOString(),
                connection_type: 'secure_proxy'
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
            setTimeout(async () => {
                if (!streamPaused) {
                    console.log('Attempting to reconnect...');
                    await connectEventStream().catch(console.error);
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

// Generate chat-like event display with conversation content as hero
function generateEnhancedEventDetails(event, action) {
    const schema = event.schema_name || '';
    
    // 🎯 CHAT-LIKE UX: Show conversation content prominently for LLM events
    if (schema === 'tool.request.v1' && event.context) {
        const tool = event.context.tool || 'unknown';
        
        // LLM tool requests - show as user messages
        if (tool === 'openrouter' || tool === 'ollama_local') {
            const input = event.context.input || {};
            if (input.messages && Array.isArray(input.messages)) {
                const userMsg = input.messages.find(m => m.role === 'user');
                if (userMsg) {
                    // HERO: Show the actual prompt prominently
                    return `
                        <div class="chat-message user-message">
                            <div class="message-header">👤 <strong>User</strong></div>
                            <div class="message-content">"${escapeHtml(userMsg.content)}"</div>
                        </div>
                        <div class="message-meta">
                            🧠 ${input.model || 'Unknown model'} • 📊 Max: ${input.max_tokens || 'N/A'} tokens
                        </div>
                    `;
                }
            }
            return `🛠️ ${tool} tool request (no message content)`;
        } else {
            // Other tool requests
            return `🛠️ <strong>${tool}</strong> tool request`;
        }
    }
    
    if (schema === 'tool.response.v1' && event.context) {
        const tool = event.context.tool || 'unknown';
        const status = event.context.status || 'unknown';
        const executionTime = event.context.execution_time_ms;
        
        // LLM tool responses - show as AI messages
        if ((tool === 'openrouter' || tool === 'ollama_local') && event.context.output) {
            const output = event.context.output;
            
            if (status === 'success' && output.content) {
                // HERO: Show the actual AI response prominently
                return `
                    <div class="chat-message ai-message">
                        <div class="message-header">🤖 <strong>AI</strong> <span style="color: rgba(255,255,255,0.6);">(${tool})</span></div>
                        <div class="message-content">"${escapeHtml(output.content)}"</div>
                    </div>
                    <div class="message-meta">
                        ⚡ ${executionTime || 'N/A'}ms • 🧠 ${output.model || 'Unknown'} • 
                        📈 ${output.usage?.total_tokens || 'N/A'} tokens • 
                        💰 ${typeof output.cost_estimate === 'number' ? '$' + output.cost_estimate.toFixed(6) : 'N/A'}
                    </div>
                `;
            } else {
                // Error case
                return `
                    <div class="chat-message error-message">
                        <div class="message-header">❌ <strong>Error</strong> <span style="color: rgba(255,255,255,0.6);">(${tool})</span></div>
                        <div class="message-content">${escapeHtml(event.context.error || 'Unknown error')}</div>
                    </div>
                    <div class="message-meta">
                        ⚡ ${executionTime || 'N/A'}ms • Status: ${status}
                    </div>
                `;
            }
        } else {
            // Other tool responses
            const outputData = event.context.output || event.context.result;
            const outputStr = typeof outputData === 'object' ? 
                JSON.stringify(outputData) : 
                String(outputData);
            return `🛠️ <strong>${tool}</strong> response: ${escapeHtml(outputStr.substring(0, 100))}${outputStr.length > 100 ? '...' : ''}`;
        }
    }
    
    // Non-tool events - standard display
    let details = `${action.toUpperCase()}`;
    if (event.breadcrumb_id) {
        details += `: ${event.breadcrumb_id.toString().substring(0, 8)}...`;
    }
    if (event.title) {
        details += `<br><strong>Title:</strong> ${escapeHtml(event.title.toString())}`;
    }
    if (event.tags && Array.isArray(event.tags)) {
        details += `<br><strong>Tags:</strong> ${event.tags.join(', ')}`;
    }
    
    return details;
}

function renderEventLog() {
    console.log('Rendering event log with', eventLog.length, 'events');
    const eventList = document.getElementById('eventList');
    
    // Filter events based on event type filters and ping settings
    const filteredEvents = eventLog.filter(event => {
        // Apply type-based filtering
        if (!shouldShowEvent(event)) {
            return false;
        }
        
        // Legacy ping filter for backward compatibility
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
        const schema = event.schema_name || '';
        
        // Enhanced event class naming for tool-specific styling
        let eventClass = eventType.replace(/\./g, '-');
        if (schema === 'tool.request.v1') {
            eventClass += ' tool-request';
        } else if (schema === 'tool.response.v1') {
            eventClass += ' tool-response';
        }
        
        let details = '';
        let action = '';
        
        if (eventType === 'ping') {
            details = `Heartbeat ${event.counter || ''}`;
            if (event.source) details += ` (${event.source})`;
        } else if (eventType.includes('breadcrumb')) {
            action = eventType.split('.')[1] || 'unknown';
            details = generateEnhancedEventDetails(event, action);
        } else if (eventType === 'system') {
            details = event.message || 'System event';
        }

        const hasExpandableData = event.context || (event.rawEventData && event.rawEventData.length > 200);
        // Remove redeclaration of 'schema' (already declared above)
        const isLLMEvent = (schema === 'tool.request.v1' || schema === 'tool.response.v1') && 
                          event.context?.tool && ['openrouter', 'ollama_local'].includes(event.context.tool);

        return `
            <div class="event-item ${eventClass}">
                ${!isLLMEvent ? `
                    <div class="event-header">
                        <span class="event-type ${action || eventType}">${eventType}</span>
                        <span class="event-time">${event.displayTime}</span>
                    </div>
                ` : `
                    <div class="event-header" style="justify-content: flex-end;">
                        <span class="event-time">${event.displayTime}</span>
                    </div>
                `}
                <div class="event-details">${details}</div>
                ${!isLLMEvent && event.breadcrumb_id ? `<div class="event-id">ID: ${event.breadcrumb_id}</div>` : ''}
                ${hasExpandableData ? `
                    <div class="event-expand">
                        <button class="btn-small" onclick="toggleEventDetails('${event.breadcrumb_id || Date.now()}', this)" style="font-size: 0.7rem; padding: 0.2rem 0.5rem; margin-top: 0.3rem;">
                            📋 Show Details
                        </button>
                        <div class="event-full-details" style="display: none; margin-top: 0.5rem; padding: 0.5rem; background: rgba(0,0,0,0.3); border-radius: 4px; font-family: monospace; font-size: 0.7rem; max-height: 300px; overflow-y: auto;">
                            <pre style="margin: 0; white-space: pre-wrap; color: rgba(255,255,255,0.9);">${escapeHtml(JSON.stringify(event.context || JSON.parse(event.rawEventData || '{}'), null, 2))}</pre>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).reverse().join(''); // Show newest first
    
    // Auto-scroll to TOP since newest events are at top
    if (autoScroll) {
        setTimeout(() => {
            eventList.scrollTop = 0; // Scroll to top for newest events
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

// Toggle event details expansion
function toggleEventDetails(eventId, button) {
    const detailsDiv = button.nextElementSibling;
    const isVisible = detailsDiv.style.display !== 'none';
    
    if (isVisible) {
        detailsDiv.style.display = 'none';
        button.textContent = '📋 Show Details';
        button.style.background = 'rgba(0, 245, 255, 0.1)';
    } else {
        detailsDiv.style.display = 'block';
        button.textContent = '📋 Hide Details';
        button.style.background = 'rgba(0, 245, 255, 0.2)';
    }
}

async function reconnectStream() {
    console.log('Manual reconnect triggered');
    if (eventSource) {
        eventSource.close();
    }
    updateStreamStatus(false, 'Reconnecting...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await connectEventStream().catch(console.error);
}

function togglePingFilter() {
    // This function is now integrated with the event filter system
    if (eventFilters.has('ping')) {
        toggleEventFilter('ping'); // Remove ping filter
    } else {
        toggleEventFilter('ping'); // Add ping filter
    }
}

    // ============ PERSISTENT UI STATE MANAGEMENT ============

// Save UI state to localStorage
function saveUIState() {
    const uiState = {
        leftPanelWidth,
        rightPanelWidth,
        collapsedSections: Array.from(collapsedSections)
    };
    localStorage.setItem('rcrt-dashboard-ui-state', JSON.stringify(uiState));
}

// Load UI state from localStorage
function loadUIState() {
    try {
        const saved = localStorage.getItem('rcrt-dashboard-ui-state');
        if (saved) {
            const uiState = JSON.parse(saved);
            leftPanelWidth = uiState.leftPanelWidth || 350;
            rightPanelWidth = uiState.rightPanelWidth || 350;
            collapsedSections = new Set(uiState.collapsedSections || []);
            
            // Apply loaded widths
            applyPanelWidths();
            applyCollapsedSections();
        }
    } catch (error) {
        console.error('Failed to load UI state:', error);
    }
}

// Apply panel widths to DOM
function applyPanelWidths() {
    const leftPanel = document.getElementById('leftPanel');
    const rightPanel = document.getElementById('rightPanel');
    
    if (leftPanel) {
        leftPanel.style.width = `${leftPanelWidth}px`;
    }
    if (rightPanel) {
        rightPanel.style.width = `${rightPanelWidth}px`;
    }
    
    console.log(`Applied panel widths: left=${leftPanelWidth}px, right=${rightPanelWidth}px`);
}

// Apply collapsed sections state
function applyCollapsedSections() {
    collapsedSections.forEach(sectionId => {
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

// Toggle section collapse
function toggleSectionCollapse(sectionId) {
    const section = document.querySelector(`[data-section="${sectionId}"]`);
    const button = event.target;
    
    if (!section) return;
    
    const isCollapsed = section.classList.contains('collapsed');
    
    if (isCollapsed) {
        section.classList.remove('collapsed');
        button.textContent = '▼';
        collapsedSections.delete(sectionId);
    } else {
        section.classList.add('collapsed');
        button.textContent = '▶';
        collapsedSections.add(sectionId);
    }
    
    saveUIState();
}

// Initialize panel resize functionality
function initializePanelResize() {
    // Add resize handles
    addResizeHandle('left');
    addResizeHandle('right');
}

function addResizeHandle(side) {
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
        startWidth = side === 'left' ? leftPanelWidth : rightPanelWidth;
        e.preventDefault();
        
        // Add visual feedback
        document.body.style.cursor = 'col-resize';
        handle.style.background = 'rgba(0, 245, 255, 0.3)';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const deltaX = side === 'left' ? (e.clientX - startX) : (startX - e.clientX);
        const newWidth = Math.max(200, Math.min(800, startWidth + deltaX));
        
        if (side === 'left') {
            leftPanelWidth = newWidth;
        } else {
            rightPanelWidth = newWidth;
        }
        
        applyPanelWidths();
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            handle.style.background = '';
            saveUIState();
        }
    });
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

// Hygiene management functions
async function triggerHygieneCleanup() {
    if (!confirm('🧹 Run hygiene cleanup?\n\nThis will remove expired breadcrumbs including:\n- Health checks older than 5 minutes\n- System pings older than 10 minutes\n- Agent thinking data older than 6 hours\n- Other expired temporary data\n\nProceed?')) {
        return;
    }
    
    try {
        console.log('Triggering hygiene cleanup...');
        
        const response = await fetch('/api/admin/purge', {
            method: 'POST',
            headers: authHeaders()
        });
        
        if (response.ok) {
            const result = await response.json();
            const totalCleaned = result.ttl_purged + result.health_checks_purged + result.expired_purged;
            
            alert(`✅ Hygiene cleanup completed!\n\nCleaned up:\n- TTL expired: ${result.ttl_purged}\n- Health checks: ${result.health_checks_purged}\n- Other expired: ${result.expired_purged}\n\nTotal: ${totalCleaned} breadcrumbs removed`);
            
            // Refresh the breadcrumbs view
            await loadBreadcrumbs();
            renderBreadcrumbs();
            updateStats();
            
        } else {
            const errorText = await response.text();
            alert(`❌ Hygiene cleanup failed: ${response.status} ${errorText}`);
        }
        
    } catch (error) {
        console.error('Hygiene cleanup error:', error);
        alert(`❌ Hygiene cleanup error: ${error.message}`);
    }
}

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

// ============ CHAT INTERFACE FUNCTIONS ============

// Initialize breadcrumb templates
function initializeBreadcrumbTemplates() {
    breadcrumbTemplates.set('tool.request.v1', {
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
    
    breadcrumbTemplates.set('agent.def.v1', {
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
    
    breadcrumbTemplates.set('prompt.system.v1', {
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
    
    breadcrumbTemplates.set('ui.plan.v1', {
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
}

// Update workspace options dynamically
function updateWorkspaceOptions() {
    // Collect unique workspaces from existing breadcrumbs
    const workspaces = new Set(['workspace:tools', 'workspace:agents', 'workspace:ui', 'workspace:test']);
    
    breadcrumbs.forEach(breadcrumb => {
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

// Quick test functions
async function sendEchoTest() {
    const testData = {
        schema_name: 'tool.request.v1',
        title: 'Echo Test from Dashboard',
        tags: [document.getElementById('workspaceSelect').value, 'tool:request', 'test:echo'],
        context: {
            tool: 'echo',
            input: {
                message: 'Dashboard echo test: ' + new Date().toLocaleTimeString()
            }
        }
    };
    
    await sendBreadcrumb(testData);
}

async function sendLLMTest() {
    const testData = {
        schema_name: 'tool.request.v1',
        title: 'LLM Test from Dashboard',
        tags: [document.getElementById('workspaceSelect').value, 'tool:request', 'test:llm'],
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
    
    await sendBreadcrumb(testData);
}

async function sendRandomTest() {
    const testData = {
        schema_name: 'tool.request.v1', 
        title: 'Random Number Test',
        tags: [document.getElementById('workspaceSelect').value, 'tool:request', 'test:random'],
        context: {
            tool: 'random',
            input: {
                min: 1,
                max: 100,
                count: 3
            }
        }
    };
    
    await sendBreadcrumb(testData);
}

// Update breadcrumb template based on type selection
function updateBreadcrumbTemplate() {
    const selectedType = document.getElementById('breadcrumbType').value;
    
    if (selectedType === 'custom') {
        // Clear for custom entry
        document.getElementById('chatTitle').value = '';
        document.getElementById('chatContext').value = '{}';
        chatTags = [];
        updateChatTagDisplay();
        return;
    }
    
    const template = breadcrumbTemplates.get(selectedType);
    if (template) {
        document.getElementById('chatTitle').value = template.title;
        document.getElementById('chatContext').value = JSON.stringify(template.context, null, 2);
        chatTags = [...template.tags];
        updateChatTagDisplay();
    }
}

// Chat tag input handling
function handleChatTagInput(event) {
    if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        const input = event.target;
        const tag = input.value.trim();
        if (tag && !chatTags.includes(tag)) {
            chatTags.push(tag);
            updateChatTagDisplay();
            input.value = '';
        }
    } else if (event.key === 'Backspace' && event.target.value === '') {
        if (chatTags.length > 0) {
            chatTags.pop();
            updateChatTagDisplay();
        }
    }
}

function focusChatTagInput() {
    document.getElementById('chatTagInput').focus();
}

function updateChatTagDisplay() {
    const container = document.getElementById('chatTags');
    container.innerHTML = chatTags.map(tag => 
        `<span class="tag-chip">
            ${escapeHtml(tag)}
            <span class="remove-tag" onclick="removeChatTag('${tag}')">×</span>
        </span>`
    ).join('');
}

function removeChatTag(tag) {
    chatTags = chatTags.filter(t => t !== tag);
    updateChatTagDisplay();
}

// Send custom breadcrumb from chat interface
async function sendChatBreadcrumb() {
    const type = document.getElementById('breadcrumbType').value;
    const workspace = document.getElementById('workspaceSelect').value;
    const title = document.getElementById('chatTitle').value.trim();
    const contextText = document.getElementById('chatContext').value.trim();
    
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
    const allTags = [workspace, ...chatTags];
    
    const breadcrumbData = {
        schema_name: type === 'custom' ? undefined : type,
        title: title,
        context: context,
        tags: allTags
    };
    
    await sendBreadcrumb(breadcrumbData);
}

// Generic breadcrumb sender
async function sendBreadcrumb(data) {
    try {
        const response = await fetch('/api/breadcrumbs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Breadcrumb sent:', result.id);
            
            // Add success event to log
            addEventToLog({
                type: 'breadcrumb.sent',
                breadcrumb_id: result.id,
                title: data.title,
                schema_name: data.schema_name,
                tags: data.tags,
                timestamp: new Date().toISOString(),
                source: 'dashboard_chat'
            });
            
            // Optionally refresh breadcrumbs list
            setTimeout(loadBreadcrumbs, 1000);
        } else {
            const errorText = await response.text();
            alert(`Failed to send breadcrumb: ${response.status} ${errorText}`);
        }
    } catch (error) {
        console.error('Error sending breadcrumb:', error);
        alert('Error sending breadcrumb');
    }
}

function clearChatForm() {
    document.getElementById('chatTitle').value = '';
    document.getElementById('chatContext').value = '{}';
    chatTags = [];
    updateChatTagDisplay();
    document.getElementById('breadcrumbType').selectedIndex = 0;
    updateBreadcrumbTemplate();
}

// Event filtering functions
function toggleEventFilter(filterType) {
    const button = document.getElementById('filter' + filterType.charAt(0).toUpperCase() + filterType.slice(1));
    
    if (filterType === 'all') {
        eventFilters.clear();
        eventFilters.add('all');
        
        // Update all button states
        document.querySelectorAll('[id^="filter"]').forEach(btn => {
            btn.classList.remove('btn-primary');
        });
        button.classList.add('btn-primary');
    } else {
        if (eventFilters.has('all')) {
            eventFilters.clear();
            document.getElementById('filterAll').classList.remove('btn-primary');
        }
        
        if (eventFilters.has(filterType)) {
            eventFilters.delete(filterType);
            button.classList.remove('btn-primary');
        } else {
            eventFilters.add(filterType);
            button.classList.add('btn-primary');
        }
        
        // If no specific filters, default back to all
        if (eventFilters.size === 0) {
            eventFilters.add('all');
            document.getElementById('filterAll').classList.add('btn-primary');
        }
    }
    
    // Re-render event log with new filters
    renderEventLog();
}

// Enhanced event filtering in renderEventLog
function shouldShowEvent(event) {
    if (eventFilters.has('all')) {
        return true;
    }
    
    // Filter by event type patterns
    const eventType = event.type || 'unknown';
    const schema = event.schema_name || '';
    const tags = event.tags || [];
    
    if (eventFilters.has('tool') && (
        eventType.includes('tool') || 
        schema.includes('tool.') ||
        tags.some(tag => tag.includes('tool'))
    )) {
        return true;
    }
    
    if (eventFilters.has('agent') && (
        eventType.includes('agent') || 
        schema.includes('agent.') ||
        tags.some(tag => tag.includes('agent'))
    )) {
        return true;
    }
    
    if (eventFilters.has('ui') && (
        eventType.includes('ui') || 
        schema.includes('ui.') ||
        tags.some(tag => tag.includes('ui'))
    )) {
        return true;
    }
    
    if (eventFilters.has('ping') && eventType === 'ping') {
        return true;
    }
    
    return false; // 🔧 Don't show unmatched events when specific filters are active
}

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
    
    // 🎯 Load persistent UI state first
    loadUIState();
    
    // Initialize resizable panels
    initializePanelResize();
    
    // Initialize chat interface
    initializeBreadcrumbTemplates();
    updateBreadcrumbTemplate(); // Load default template
    
    // Load initial data
    loadBreadcrumbs().then(() => {
        // Update workspace options after breadcrumbs are loaded
        updateWorkspaceOptions();
    });
    
    // Connect to event stream (async for direct RCRT connection)
    connectEventStream().catch(console.error);
    
    // Smart auto-refresh: only refresh if user hasn't been active recently
    setInterval(() => {
        const timeSinceLastInteraction = Date.now() - lastUserInteraction;
        const inactiveThreshold = 60000; // 1 minute of inactivity
        
        // Only auto-refresh if user is inactive (preserves UX during active use)
        if (timeSinceLastInteraction > inactiveThreshold) {
            console.log('Auto-refreshing after user inactivity');
            loadBreadcrumbs();
        } else {
            console.log('Skipping auto-refresh - user is active');
        }
    }, 120000); // Check every 2 minutes
});
