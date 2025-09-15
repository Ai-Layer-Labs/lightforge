/**
 * RCRT Dashboard Main Controller
 * Orchestrates all dashboard modules and manages application flow
 */

import { dashboardState } from './state.js';
import { apiClient } from './api-client.js';
import { CanvasEngine } from './canvas-engine.js';
import { NodeRenderer } from './node-renderer.js';

export class DashboardController {
    constructor() {
        this.canvas = null;
        this.canvasContainer = null;
        this.canvasEngine = null;
        this.nodeRenderer = new NodeRenderer();
        
        this.init();
    }
    
    async init() {
        // Initialize DOM elements
        this.canvas = document.getElementById('canvas');
        this.canvasContainer = this.canvas.parentElement;
        
        // Initialize canvas engine
        this.canvasEngine = new CanvasEngine(this.canvas, this.canvasContainer);
        
        // Load persistent UI state
        dashboardState.loadUIState();
        this.applyUIState();
        
        // Set up state listeners
        this.setupStateListeners();
        
        // Load initial data
        await this.loadInitialData();
        
        // Set up auto-refresh with smart user activity detection
        this.setupAutoRefresh();
        
        console.log('🎯 Dashboard Controller initialized');
    }
    
    setupStateListeners() {
        // Listen for data changes to trigger re-renders
        dashboardState.subscribe('breadcrumbs', () => this.renderContentAsync());
        dashboardState.subscribe('agents', () => this.renderContentAsync());
        dashboardState.subscribe('availableTools', () => this.renderContentAsync());
        dashboardState.subscribe('secrets', () => this.renderContentAsync());
        dashboardState.subscribe('filteredBreadcrumbs', () => this.renderContentAsync());
        
        // Listen for selections to update UI
        dashboardState.subscribe('selectedBreadcrumb', (breadcrumb) => {
            this.updateBreadcrumbSelection(breadcrumb);
        });
        dashboardState.subscribe('selectedAgent', (agent) => {
            this.updateAgentSelection(agent);
        });
        
        // Listen for position resets
        dashboardState.subscribe('positionsReset', () => {
            this.renderContentAsync();
        });
    }
    
    // Async wrapper for state listeners
    renderContentAsync() {
        this.renderContent().catch(error => {
            console.error('Error in renderContent:', error);
        });
    }
    
    async loadInitialData() {
        try {
            this.showLoading('Loading breadcrumbs...');
            
            // Load breadcrumbs first (most important for UI)
            const breadcrumbs = await apiClient.loadBreadcrumbs();
            dashboardState.setState('breadcrumbs', breadcrumbs);
            
            // Render breadcrumbs immediately for faster perceived performance
            this.renderBreadcrumbsOnly();
            this.updateStats();
            
            // Load other data in background on first load
            if (!dashboardState.dataLoaded) {
                this.showLoading('Loading agents and tools...');
                
                // Load agents, subscriptions, tools, and secrets in parallel for better performance
                const [agents, subscriptions, tools, secrets] = await Promise.all([
                    apiClient.loadAgents().catch(e => { console.warn('Failed to load agents:', e); return []; }),
                    apiClient.loadSubscriptions().catch(e => { console.warn('Failed to load subscriptions:', e); return []; }),
                    apiClient.loadAvailableTools(breadcrumbs).catch(e => { console.warn('Failed to load tools:', e); return []; }),
                    apiClient.loadSecrets().catch(e => { console.warn('Failed to load secrets:', e); return []; })
                ]);
                
                // Update state with loaded data
                dashboardState.setState('agents', agents);
                dashboardState.setState('subscriptions', subscriptions);
                dashboardState.setState('availableTools', tools);
                dashboardState.setState('secrets', secrets);
                
                console.log('Loaded additional data:', { agents: agents.length, subscriptions: subscriptions.length, tools: tools.length, secrets: secrets.length });
                
                // Update secrets manager
                if (window.secretsManager) {
                    window.secretsManager.updateSecretsCount();
                    window.secretsManager.renderSecretsList();
                }
                
                dashboardState.setState('dataLoaded', true);
            }
            
            // Final render with all data
            await this.renderContent();
            this.updateStats();
            
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.canvasEngine.showError(`Failed to load data: ${error.message}`);
        }
    }
    
    renderBreadcrumbsOnly() {
        // Quick render of just breadcrumbs for faster initial display
        this.canvasEngine.clear();
        
        const toRender = dashboardState.filteredBreadcrumbs.length > 0 ? 
            dashboardState.filteredBreadcrumbs : dashboardState.breadcrumbs;
        
        toRender.forEach((breadcrumb, index) => {
            const node = this.nodeRenderer.createBreadcrumbNode(
                breadcrumb, 
                index, 
                (id) => this.selectBreadcrumbForDetails(id)
            );
            this.canvas.appendChild(node);
        });
        
        this.canvasEngine.updateCanvasSize();
        this.updateBreadcrumbList();
    }
    
    async loadAgentsAndSubscriptions() {
        try {
            // Load agents
            const agents = await apiClient.loadAgents();
            dashboardState.setState('agents', agents);
            console.log('Loaded agents:', agents.length);
            
            // Load subscriptions  
            const subscriptions = await apiClient.loadSubscriptions();
            dashboardState.setState('subscriptions', subscriptions);
            console.log('Loaded subscriptions:', subscriptions.length);
            
            // Load available tools from tool catalog
            const tools = await apiClient.loadAvailableTools(dashboardState.breadcrumbs);
            dashboardState.setState('availableTools', tools);
            console.log('Loaded tools:', tools.length);
            
            
        } catch (error) {
            console.error('Failed to load agents/subscriptions:', error);
            // Continue without agent visualization if this fails
            dashboardState.setState('agents', []);
            dashboardState.setState('subscriptions', []);
            dashboardState.setState('availableTools', []);
        }
    }
    
    async loadSecrets() {
        try {
            // Load secrets
            const secrets = await apiClient.loadSecrets();
            dashboardState.setState('secrets', secrets);
            console.log('Loaded secrets:', secrets.length);
            
            // Update secrets manager
            if (window.secretsManager) {
                window.secretsManager.updateSecretsCount();
                window.secretsManager.renderSecretsList();
            }
            
        } catch (error) {
            console.error('Failed to load secrets:', error);
            // Continue without secrets if this fails
            dashboardState.setState('secrets', []);
        }
    }
    
    async renderContent() {
        this.canvasEngine.clear();
        
        const toRender = dashboardState.filteredBreadcrumbs.length > 0 ? 
            dashboardState.filteredBreadcrumbs : dashboardState.breadcrumbs;
        
        // Render breadcrumb nodes
        toRender.forEach((breadcrumb, index) => {
            const node = this.nodeRenderer.createBreadcrumbNode(
                breadcrumb, 
                index, 
                (id) => this.selectBreadcrumbForDetails(id)
            );
            this.canvas.appendChild(node);
        });
        
        // Render agent nodes
        dashboardState.agents.forEach((agent, index) => {
            const node = this.nodeRenderer.createAgentNode(
                agent, 
                index, 
                (agent) => this.selectAgentForDetails(agent)
            );
            this.canvas.appendChild(node);
        });
        
        // Render tool nodes
        dashboardState.availableTools.forEach((tool, index) => {
            const node = this.nodeRenderer.createToolNode(
                tool, 
                index, 
                (tool) => this.viewToolDetails(tool)
            );
            this.canvas.appendChild(node);
        });
        
        // Render secret nodes
        dashboardState.secrets.forEach((secret, index) => {
            const node = this.nodeRenderer.createSecretNode(
                secret, 
                index, 
                (secret) => this.selectSecretForDetails(secret)
            );
            this.canvas.appendChild(node);
        });
        
        // Render connection lines
        await this.renderConnections();
        
        // Update canvas size to fit all nodes
        this.canvasEngine.updateCanvasSize();
        
        // Center view on first load
        if (dashboardState.canvasOffset.x === 0 && dashboardState.canvasOffset.y === 0 && 
            dashboardState.nodePositions.length > 0) {
            this.canvasEngine.centerViewOnContent();
        }
        
        // Update UI lists
        this.updateBreadcrumbList();
        this.updateAgentList();
        this.updateAvailableTags();
    }
    
    async renderConnections() {
        const startTime = Date.now();
        console.log('🔗 Rendering connections...');
        
        // Remove old connection lines
        dashboardState.connections.forEach(conn => {
            if (conn.line && conn.line.parentNode) {
                conn.line.parentNode.removeChild(conn.line);
            }
        });
        dashboardState.setState('connections', []);
        
        // Create agent subscription connections
        this.renderAgentConnections();
        
        // Create tool creation connections
        this.renderToolConnections();
        
        // Create secret usage connections
        await this.renderSecretConnections();
        
        const endTime = Date.now();
        console.log(`✅ Created ${dashboardState.connections.length} total connection lines in ${endTime - startTime}ms`);
        
        // Flash the connection lines briefly to show they've been updated
        if (dashboardState.connections.length > 0) {
            dashboardState.connections.forEach(conn => {
                if (conn.line) {
                    const originalOpacity = conn.line.style.opacity || '1';
                    conn.line.style.opacity = '1';
                    conn.line.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.5)';
                    
                    setTimeout(() => {
                        conn.line.style.opacity = originalOpacity;
                        conn.line.style.boxShadow = 'none';
                    }, 500);
                }
            });
        }
    }
    
    renderAgentConnections() {
        dashboardState.subscriptions.forEach((subscription, subIndex) => {
            console.log(`📡 Processing subscription ${subIndex + 1}:`, {
                agent: subscription.agent_id.substring(30),
                selector: subscription.selector
            });
            
            // Find agent position
            const agentPos = dashboardState.agentPositions.find(pos => pos.id === subscription.agent_id);
            if (!agentPos) {
                console.log(`❌ Agent not found in positions:`, subscription.agent_id.substring(30));
                return;
            }
            
            // Find matching breadcrumbs for this subscription
            const matchingBreadcrumbs = this.findMatchingBreadcrumbs(subscription.selector);
            
            matchingBreadcrumbs.forEach((breadcrumb) => {
                // Find breadcrumb position in current render
                const breadcrumbPos = dashboardState.nodePositions.find(pos => pos.id === breadcrumb.id);
                
                if (breadcrumbPos) {
                    console.log(`🔗 Creating connection: ${subscription.agent_id.substring(30)} → ${breadcrumb.title}`);
                    
                    // Create connection line
                    const line = this.canvasEngine.createConnectionLine(agentPos, breadcrumbPos, subscription);
                    this.canvas.appendChild(line);
                    
                    dashboardState.connections.push({
                        agent: subscription.agent_id,
                        breadcrumb: breadcrumb.id,
                        line: line
                    });
                }
            });
        });
    }
    
    renderToolConnections() {
        dashboardState.availableTools.forEach((tool, toolIndex) => {
            console.log(`🛠️ Processing tool ${toolIndex + 1}:`, tool.name);
            
            // Find tool position
            const toolPos = dashboardState.toolPositions.find(pos => pos.id === tool.id);
            if (!toolPos) {
                console.log(`❌ Tool position not found:`, tool.name);
                return;
            }
            
            // Find breadcrumbs created by this tool
            const toolBreadcrumbs = this.findToolCreatedBreadcrumbs(tool.name);
            console.log(`🎯 Found ${toolBreadcrumbs.length} breadcrumbs created by ${tool.name}`);
            
            toolBreadcrumbs.forEach((breadcrumb) => {
                // Find breadcrumb position in current render
                const breadcrumbPos = dashboardState.nodePositions.find(pos => pos.id === breadcrumb.id);
                
                if (breadcrumbPos) {
                    console.log(`🔗 Creating tool connection: ${tool.name} → ${breadcrumb.title}`);
                    
                    // Create connection line
                    const line = this.canvasEngine.createToolConnectionLine(toolPos, breadcrumbPos, tool);
                    this.canvas.appendChild(line);
                    
                    dashboardState.connections.push({
                        tool: tool.id,
                        breadcrumb: breadcrumb.id,
                        line: line,
                        type: 'tool-creation'
                    });
                }
            });
        });
    }
    
    async renderSecretConnections() {
        // Look for tool configurations that reference secrets
        const toolConfigBreadcrumbs = dashboardState.breadcrumbs.filter(b => 
            b.tags?.includes('tool:config')
        );
        
        console.log(`🔐 Found ${toolConfigBreadcrumbs.length} tool config breadcrumbs`);
        
        // Get full context for each tool config to check for secret_id
        const toolConfigs = [];
        for (const breadcrumb of toolConfigBreadcrumbs) {
            try {
                const fullBreadcrumb = await apiClient.loadBreadcrumbDetails(breadcrumb.id);
                if (fullBreadcrumb.context?.secret_id) {
                    toolConfigs.push(fullBreadcrumb);
                    console.log(`🔐 Tool config with secret: ${fullBreadcrumb.context.tool_name} → ${fullBreadcrumb.context.secret_name}`);
                }
            } catch (error) {
                console.warn(`Failed to load context for ${breadcrumb.title}:`, error);
            }
        }
        
        toolConfigs.forEach((configBreadcrumb) => {
            console.log(`🔐 Processing tool config:`, configBreadcrumb.context.tool_name);
            
            // Find the secret being referenced
            const secretId = configBreadcrumb.context.secret_id;
            const secret = dashboardState.secrets.find(s => s.id === secretId);
            const secretPos = dashboardState.secretPositions.find(pos => pos.id === secretId);
            
            if (!secret || !secretPos) {
                console.log(`❌ Secret not found:`, secretId);
                return;
            }
            
            // Find the tool that uses this secret
            const toolName = configBreadcrumb.context.tool_name;
            const tool = dashboardState.availableTools.find(t => t.name === toolName);
            const toolPos = dashboardState.toolPositions.find(pos => pos.name === toolName);
            
            if (!tool || !toolPos) {
                console.log(`❌ Tool not found:`, toolName);
                return;
            }
            
            console.log(`🔗 Creating secret connection: ${secret.name} → ${tool.name}`);
            
            // Create connection line from secret to tool
            const line = this.canvasEngine.createSecretConnectionLine(secretPos, toolPos, secret, tool);
            this.canvas.appendChild(line);
            
            dashboardState.connections.push({
                secret: secret.id,
                tool: tool.id,
                line: line,
                type: 'secret-usage'
            });
        });
        
        // Also show connections from secrets to agents that have access to them
        dashboardState.secrets.forEach((secret) => {
            if (secret.scope_type === 'agent' && secret.scope_id) {
                const agentPos = dashboardState.agentPositions.find(pos => pos.id === secret.scope_id);
                const secretPos = dashboardState.secretPositions.find(pos => pos.id === secret.id);
                
                if (agentPos && secretPos) {
                    console.log(`🔗 Creating agent secret connection: ${secret.name} → Agent`);
                    
                    const line = this.canvasEngine.createSecretConnectionLine(secretPos, agentPos, secret, null);
                    this.canvas.appendChild(line);
                    
                    dashboardState.connections.push({
                        secret: secret.id,
                        agent: secret.scope_id,
                        line: line,
                        type: 'secret-access'
                    });
                }
            }
        });
    }
    
    findMatchingBreadcrumbs(selector) {
        const toCheck = dashboardState.filteredBreadcrumbs.length > 0 ? 
            dashboardState.filteredBreadcrumbs : dashboardState.breadcrumbs;
        
        return toCheck.filter(breadcrumb => {
            // Check any_tags: breadcrumb must have at least one of these tags
            const anyTagsMatch = !selector.any_tags || 
                selector.any_tags.some(tag => breadcrumb.tags.includes(tag));
            
            // Check all_tags: breadcrumb must have all of these tags
            const allTagsMatch = !selector.all_tags || 
                selector.all_tags.every(tag => breadcrumb.tags.includes(tag));
            
            // Check schema_name
            const schemaMatch = !selector.schema_name || 
                (breadcrumb.schema_name === selector.schema_name);
            
            return anyTagsMatch && allTagsMatch && schemaMatch;
        });
    }
    
    findToolCreatedBreadcrumbs(toolName) {
        const toCheck = dashboardState.filteredBreadcrumbs.length > 0 ? 
            dashboardState.filteredBreadcrumbs : dashboardState.breadcrumbs;
        
        return toCheck.filter(breadcrumb => {
            return breadcrumb.tags?.includes('tool:response') &&
                   (breadcrumb.title?.includes(`Response: ${toolName}`) ||
                    breadcrumb.title?.includes(`${toolName} Result`) ||
                    breadcrumb.title?.includes(`${toolName} Error`));
        });
    }
    
    async selectBreadcrumbForDetails(id) {
        dashboardState.trackUserInteraction();
        
        try {
            const details = await apiClient.loadBreadcrumbDetails(id);
            const breadcrumb = dashboardState.breadcrumbs.find(b => b.id === id);
            
            dashboardState.setState('selectedBreadcrumb', breadcrumb);
            dashboardState.setState('selectedBreadcrumbDetails', details);
            
            this.displayBreadcrumbDetails(details);
            this.nodeRenderer.highlightBreadcrumbNode(id);
            
        } catch (error) {
            console.error('Failed to load breadcrumb details:', error);
            alert('Failed to load breadcrumb details');
        }
    }
    
    selectAgentForDetails(agent) {
        dashboardState.setState('selectedAgent', agent);
        dashboardState.setState('selectedAgentDetails', agent);
        
        this.displayAgentDetails(agent);
        this.nodeRenderer.highlightAgentNode(agent.id);
    }
    
    viewToolDetails(tool) {
        // Use the secrets manager to handle tool selection
        if (window.secretsManager) {
            window.secretsManager.selectTool(tool);
        } else {
            // Fallback to simple alert
            const toolBreadcrumbs = this.findToolCreatedBreadcrumbs(tool.name);
            
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
    }
    
    selectSecretForDetails(secret) {
        // Use the secrets manager to handle secret selection
        if (window.secretsManager) {
            window.secretsManager.selectSecret(secret);
        } else {
            // Fallback to simple alert
            alert(`Secret: ${secret.name}\nScope: ${secret.scope_type}\nCreated: ${new Date(secret.created_at).toLocaleString()}`);
        }
    }
    
    displayBreadcrumbDetails(details) {
        const detailsContainer = document.getElementById('breadcrumbDetails');
        const updatedAt = new Date(details.updated_at).toLocaleString();
        
        detailsContainer.innerHTML = `
            <div class="detail-field">
                <div class="detail-label">ID</div>
                <div class="detail-value">${details.id}</div>
            </div>
            <div class="detail-field">
                <div class="detail-label">Title</div>
                <div class="detail-value">${this.escapeHtml(details.title)}</div>
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
    
    displayAgentDetails(agent) {
        const agentSubs = dashboardState.subscriptions.filter(s => s.agent_id === agent.id);
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
                return total + this.findMatchingBreadcrumbs(sub.selector).length;
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
    
    updateBreadcrumbList() {
        const listContainer = document.getElementById('breadcrumbList');
        const toShow = dashboardState.filteredBreadcrumbs.length > 0 ? 
            dashboardState.filteredBreadcrumbs : dashboardState.breadcrumbs;
        
        listContainer.innerHTML = toShow.map(breadcrumb => `
            <div class="breadcrumb-item ${dashboardState.selectedBreadcrumb && dashboardState.selectedBreadcrumb.id === breadcrumb.id ? 'selected' : ''}" 
                 data-id="${breadcrumb.id}" 
                 onclick="dashboard.selectBreadcrumbForDetails('${breadcrumb.id}')" 
                 ondblclick="dashboard.editBreadcrumbById('${breadcrumb.id}')">
                <div class="breadcrumb-item-title">${this.escapeHtml(breadcrumb.title)}</div>
                <div class="breadcrumb-item-meta">
                    v${breadcrumb.version} • ${breadcrumb.tags.join(', ')} • ${new Date(breadcrumb.updated_at).toLocaleDateString()}
                </div>
            </div>
        `).join('');
        
        document.getElementById('breadcrumbCount').textContent = toShow.length;
    }
    
    updateAgentList() {
        const listContainer = document.getElementById('agentList');
        
        listContainer.innerHTML = dashboardState.agents.map(agent => `
            <div class="breadcrumb-item ${dashboardState.selectedAgent && dashboardState.selectedAgent.id === agent.id ? 'selected' : ''}" 
                 data-id="${agent.id}" 
                 onclick="dashboard.selectAgentForDetails(${JSON.stringify(agent).replace(/"/g, '&quot;')})" 
                 ondblclick="dashboard.editAgentById('${agent.id}')">
                <div class="breadcrumb-item-title">🤖 Agent ${agent.id.substring(30)}</div>
                <div class="breadcrumb-item-meta">
                    ${agent.roles.join(', ')} • Created: ${new Date(agent.created_at).toLocaleDateString()}
                </div>
            </div>
        `).join('');
        
        document.getElementById('agentCount').textContent = dashboardState.agents.length;
    }
    
    updateAvailableTags() {
        // Collect all unique tags from breadcrumbs
        const tagSet = new Set();
        dashboardState.breadcrumbs.forEach(breadcrumb => {
            breadcrumb.tags.forEach(tag => tagSet.add(tag));
        });
        
        dashboardState.setState('allAvailableTags', Array.from(tagSet).sort());
        
        const container = document.getElementById('availableTags');
        container.innerHTML = dashboardState.allAvailableTags.map(tag => `
            <span class="tag-filter-chip ${dashboardState.selectedTagFilters.includes(tag) ? 'active' : ''}" 
                  onclick="dashboard.toggleTagFilter('${tag}')">
                ${this.escapeHtml(tag)}
            </span>
        `).join('');
    }
    
    updateStats() {
        const stats = document.getElementById('stats');
        const displayCount = dashboardState.filteredBreadcrumbs.length > 0 ? 
            dashboardState.filteredBreadcrumbs.length : dashboardState.breadcrumbs.length;
        const totalCount = dashboardState.breadcrumbs.length;
        
        if (dashboardState.filteredBreadcrumbs.length > 0) {
            stats.textContent = `${displayCount} of ${totalCount} breadcrumbs`;
        } else {
            stats.textContent = `${totalCount} breadcrumbs`;
        }
    }
    
    setupAutoRefresh() {
        setInterval(() => {
            const timeSinceLastInteraction = Date.now() - dashboardState.lastUserInteraction;
            const inactiveThreshold = 60000; // 1 minute of inactivity
            
            // Only auto-refresh if user is inactive
            if (timeSinceLastInteraction > inactiveThreshold) {
                console.log('Auto-refreshing after user inactivity');
                this.loadInitialData();
            } else {
                console.log('Skipping auto-refresh - user is active');
            }
        }, 120000); // Check every 2 minutes
    }
    
    applyUIState() {
        const leftPanel = document.getElementById('leftPanel');
        const rightPanel = document.getElementById('rightPanel');
        
        if (leftPanel) {
            leftPanel.style.width = `${dashboardState.leftPanelWidth}px`;
        }
        if (rightPanel) {
            rightPanel.style.width = `${dashboardState.rightPanelWidth}px`;
        }
    }
    
    showLoading(message = 'Loading...') {
        this.canvasEngine.showLoading(message);
    }
    
    async refreshData() {
        this.showLoading('Refreshing...');
        dashboardState.setState('dataLoaded', false);
        await this.loadInitialData();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    updateBreadcrumbSelection(breadcrumb) {
        // Update visual selection in list
        document.querySelectorAll('.breadcrumb-item').forEach(item => {
            item.classList.remove('selected');
        });
        if (breadcrumb) {
            document.querySelector(`[data-id="${breadcrumb.id}"]`)?.classList.add('selected');
        }
    }
    
    updateAgentSelection(agent) {
        // Update visual selection in list
        document.querySelectorAll('#agentList .breadcrumb-item').forEach(item => {
            item.classList.remove('selected');
        });
        if (agent) {
            document.querySelector(`#agentList [data-id="${agent.id}"]`)?.classList.add('selected');
        }
    }
}

// Export singleton instance
export const dashboardController = new DashboardController();
