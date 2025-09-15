/**
 * RCRT Dashboard 3D Visualization Engine
 * Handles Three.js 3D semantic visualization with semantic clustering
 */

import { dashboardState } from './state.js';
import { apiClient } from './api-client.js';

export class ThreeDEngine {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        this.nodeObjects3D = new Map();
        this.agentObjects3D = new Map();
        this.toolObjects3D = new Map();
        this.secretObjects3D = new Map();
        
        this.init();
    }
    
    init() {
        // Set up 3D environment on state
        dashboardState.scene = this.scene;
        dashboardState.camera = this.camera;
        dashboardState.renderer = this.renderer;
        dashboardState.controls = this.controls;
        dashboardState.nodeObjects3D = this.nodeObjects3D;
        dashboardState.agentObjects3D = this.agentObjects3D;
        dashboardState.toolObjects3D = this.toolObjects3D;
        dashboardState.secretObjects3D = this.secretObjects3D;
        
        // Set up global functions for HTML compatibility
        window.toggle3DView = () => this.toggle3DView();
        
        // Set up state listeners for real-time updates
        this.setupStateListeners();
        
        console.log('🎲 3D Engine initialized');
    }
    
    setupStateListeners() {
        // Listen for data changes to update 3D view in real-time
        dashboardState.subscribe('breadcrumbs', () => {
            if (dashboardState.is3DMode && this.scene) {
                console.log('🎲 3D: Updating view due to breadcrumbs change');
                this.render3DViewAsync();
            }
        });
        
        dashboardState.subscribe('agents', () => {
            if (dashboardState.is3DMode && this.scene) {
                console.log('🎲 3D: Updating view due to agents change');
                this.render3DViewAsync();
            }
        });
        
        dashboardState.subscribe('availableTools', () => {
            if (dashboardState.is3DMode && this.scene) {
                console.log('🎲 3D: Updating view due to tools change');
                this.render3DViewAsync();
            }
        });
        
        dashboardState.subscribe('secrets', () => {
            if (dashboardState.is3DMode && this.scene) {
                console.log('🎲 3D: Updating view due to secrets change');
                this.render3DViewAsync();
            }
        });
        
        console.log('🎲 3D Engine state listeners set up');
    }
    
    // Async wrapper for state listeners
    render3DViewAsync() {
        this.render3DView().catch(error => {
            console.error('Error updating 3D view:', error);
        });
    }
    
    // ============ 3D VIEW MANAGEMENT ============
    
    async toggle3DView() {
        const btn = document.getElementById('toggle3DBtn');
        const canvas2D = document.getElementById('canvas');
        const canvas3D = document.getElementById('canvas3D');
        
        dashboardState.is3DMode = !dashboardState.is3DMode;
        
        if (dashboardState.is3DMode) {
            btn.textContent = '📋 2D View';
            btn.style.background = 'rgba(255, 165, 0, 0.2)';
            canvas2D.style.display = 'none';
            canvas3D.style.display = 'block';
            
            // Initialize 3D scene
            this.init3DScene();
            await this.render3DView();
            
            // Add 3D interaction after scene is ready
            setTimeout(() => this.add3DInteraction(), 100);
        } else {
            btn.textContent = '🎲 3D View';
            btn.style.background = 'rgba(0, 245, 255, 0.1)';
            canvas2D.style.display = 'block';
            canvas3D.style.display = 'none';
            
            // Cleanup 3D scene
            this.cleanup3DScene();
        }
    }
    
    // ============ 3D SCENE INITIALIZATION ============
    
    init3DScene() {
        const container = document.getElementById('canvas3D');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a); // Dark background
        
        // Camera setup with extended zoom range and render distance
        this.camera = new THREE.PerspectiveCamera(75, width / height, 1, 15000);
        this.camera.position.set(300, 200, 400); // Positioned to see all clusters
        
        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setClearColor(0x0a0a0a, 0.8);
        container.appendChild(this.renderer.domElement);
        
        // Controls setup
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05; // Smoother movement
            this.controls.enableZoom = true;
            this.controls.autoRotate = false;
            this.controls.autoRotateSpeed = 0.5;
            this.controls.minDistance = 50; // Allow closer zoom
            this.controls.maxDistance = 8000; // Allow much further zoom out
            
            // Set target to center of semantic space
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }
        
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        // Add directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 50);
        this.scene.add(directionalLight);
        
        // Start render loop
        this.animate3D();
        
        // Update state references
        dashboardState.scene = this.scene;
        dashboardState.camera = this.camera;
        dashboardState.renderer = this.renderer;
        dashboardState.controls = this.controls;
        
        console.log('🎲 3D scene initialized');
    }
    
    // ============ SEMANTIC CLUSTERING ============
    
    calculateSemanticPositions(items, type) {
        const clusters = {
            llm: { center: [200, 0, 100], items: [] },
            system: { center: [-200, 0, 100], items: [] },
            ui: { center: [0, 200, 50], items: [] },
            tools: { center: [0, -200, 50], items: [] },
            agents: { center: [0, 0, 200], items: [] },
            misc: { center: [0, 0, -100], items: [] }
        };
        
        // Classify items into semantic clusters
        items.forEach(item => {
            const tags = item.tags || [];
            let assigned = false;
            
            // LLM-related content
            if (tags.some(tag => tag.includes('tool:') && ['request', 'response'].some(t => tag.includes(t))) ||
                item.title?.toLowerCase().includes('llm') ||
                item.title?.toLowerCase().includes('openrouter')) {
                clusters.llm.items.push(item);
                assigned = true;
            }
            // System/monitoring content
            else if (tags.some(tag => tag.includes('system:') || tag.includes('health:') || tag.includes('hygiene'))) {
                clusters.system.items.push(item);
                assigned = true;
            }
            // UI-related content
            else if (tags.some(tag => tag.includes('ui:'))) {
                clusters.ui.items.push(item);
                assigned = true;
            }
            // Tool-specific items
            else if (type === 'tool' || tags.some(tag => tag.includes('tool:catalog'))) {
                clusters.tools.items.push(item);
                assigned = true;
            }
            // Agent-specific items
            else if (type === 'agent' || tags.some(tag => tag.includes('agent:'))) {
                clusters.agents.items.push(item);
                assigned = true;
            }
            
            if (!assigned) {
                clusters.misc.items.push(item);
            }
        });
        
        // Calculate positions within each cluster
        const positions = [];
        
        Object.keys(clusters).forEach(clusterName => {
            const cluster = clusters[clusterName];
            const clusterItems = cluster.items;
            
            clusterItems.forEach((item, index) => {
                // Arrange items in a sphere around cluster center
                const radius = Math.max(50, clusterItems.length * 8);
                const phi = Math.acos(-1 + (2 * index) / clusterItems.length);
                const theta = Math.sqrt(clusterItems.length * Math.PI) * phi;
                
                const x = cluster.center[0] + radius * Math.cos(theta) * Math.sin(phi);
                const y = cluster.center[1] + radius * Math.sin(theta) * Math.sin(phi);
                const z = cluster.center[2] + radius * Math.cos(phi);
                
                positions.push({
                    item: item,
                    position: [x, y, z],
                    cluster: clusterName
                });
            });
        });
        
        console.log(`🎯 Calculated semantic positions for ${positions.length} ${type} items:`, 
            Object.keys(clusters).map(c => `${c}: ${clusters[c].items.length}`));
        
        return positions;
    }
    
    // ============ 3D SCENE RENDERING ============
    
    async render3DView() {
        if (!this.scene) return;
        
        // Clear previous objects
        this.nodeObjects3D.clear();
        this.agentObjects3D.clear();
        this.toolObjects3D.clear();
        this.secretObjects3D.clear();
        
        // Clear scene
        while(this.scene.children.length > 0) {
            this.scene.remove(this.scene.children[0]);
        }
        
        // Enhanced lighting for beautiful visualization
        this.setupLighting();
        
        const toRender = dashboardState.filteredBreadcrumbs.length > 0 ? 
            dashboardState.filteredBreadcrumbs : dashboardState.breadcrumbs;
        
        // Render breadcrumbs in 3D semantic space
        const breadcrumbPositions = this.calculateSemanticPositions(toRender, 'breadcrumb');
        breadcrumbPositions.forEach(({ item, position, cluster }) => {
            const mesh = this.create3DBreadcrumbNode(item, position, cluster);
            this.scene.add(mesh);
            this.nodeObjects3D.set(item.id, mesh);
        });
        
        // Render agents in 3D space
        const agentPositions = this.calculateSemanticPositions(dashboardState.agents, 'agent');
        agentPositions.forEach(({ item, position, cluster }) => {
            const mesh = this.create3DAgentNode(item, position, cluster);
            this.scene.add(mesh);
            this.agentObjects3D.set(item.id, mesh);
        });
        
        // Render tools in 3D space
        const toolPositions3D = this.calculateSemanticPositions(dashboardState.availableTools, 'tool');
        toolPositions3D.forEach(({ item, position, cluster }) => {
            const mesh = this.create3DToolNode(item, position, cluster);
            this.scene.add(mesh);
            this.toolObjects3D.set(item.id, mesh);
        });
        
        // Render secrets in 3D space
        const secretPositions3D = this.calculateSemanticPositions(dashboardState.secrets, 'secret');
        secretPositions3D.forEach(({ item, position, cluster }) => {
            const mesh = this.create3DSecretNode(item, position, cluster);
            this.scene.add(mesh);
            this.secretObjects3D.set(item.id, mesh);
        });
        
        // Add cluster labels and effects
        this.addClusterLabels();
        this.addParticleEffects();
        
        // Add 3D connection lines
        await this.render3DConnections();
        
        console.log('🎲 3D semantic view rendered with semantic clustering');
    }
    
    setupLighting() {
        // Enhanced lighting for beautiful translucent objects
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        // Primary directional light
        const directionalLight1 = new THREE.DirectionalLight(0x00f5ff, 0.6);
        directionalLight1.position.set(200, 200, 100);
        this.scene.add(directionalLight1);
        
        // Secondary light for fill
        const directionalLight2 = new THREE.DirectionalLight(0xffa500, 0.3);
        directionalLight2.position.set(-100, -100, 50);
        this.scene.add(directionalLight2);
        
        // Rim lighting from above
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
        rimLight.position.set(0, 300, 0);
        this.scene.add(rimLight);
        
        // Add subtle point lights for sparkle
        const pointLight1 = new THREE.PointLight(0x00ff88, 0.3, 200);
        pointLight1.position.set(100, 50, 100);
        this.scene.add(pointLight1);
        
        const pointLight2 = new THREE.PointLight(0xff6b6b, 0.3, 200);
        pointLight2.position.set(-100, -50, 100);
        this.scene.add(pointLight2);
    }
    
    // ============ 3D NODE CREATION ============
    
    create3DBreadcrumbNode(breadcrumb, position, cluster) {
        const nodeGroup = new THREE.Group();
        
        // Create styled breadcrumb card (rectangular)
        const infoCard = this.create3DBreadcrumbCard(breadcrumb, cluster);
        nodeGroup.add(infoCard);
        
        nodeGroup.position.set(position[0], position[1], position[2]);
        nodeGroup.userData = { 
            type: 'breadcrumb', 
            data: breadcrumb, 
            cluster: cluster,
            originalColor: this.getClusterColor(cluster),
            infoCard: infoCard
        };
        
        return nodeGroup;
    }
    
    create3DAgentNode(agent, position, cluster) {
        const nodeGroup = new THREE.Group();
        
        // Create styled agent card (circular)
        const infoCard = this.create3DAgentCard(agent, cluster);
        nodeGroup.add(infoCard);
        
        nodeGroup.position.set(position[0], position[1], position[2]);
        nodeGroup.userData = { 
            type: 'agent', 
            data: agent, 
            cluster: cluster,
            originalColor: 0xffa500,
            infoCard: infoCard
        };
        
        return nodeGroup;
    }
    
    create3DToolNode(tool, position, cluster) {
        const nodeGroup = new THREE.Group();
        
        // Create styled tool card (rectangular with tool-specific design)
        const infoCard = this.create3DToolCard(tool, cluster);
        nodeGroup.add(infoCard);
        
        nodeGroup.position.set(position[0], position[1], position[2]);
        nodeGroup.userData = { 
            type: 'tool', 
            data: tool, 
            cluster: cluster,
            originalColor: 0x00ff88,
            infoCard: infoCard
        };
        
        return nodeGroup;
    }
    
    create3DSecretNode(secret, position, cluster) {
        const nodeGroup = new THREE.Group();
        
        // Create styled secret card (rectangular with secret-specific design)
        const infoCard = this.create3DSecretCard(secret, cluster);
        nodeGroup.add(infoCard);
        
        nodeGroup.position.set(position[0], position[1], position[2]);
        nodeGroup.userData = { 
            type: 'secret', 
            data: secret, 
            cluster: cluster,
            originalColor: 0xff6b6b,
            infoCard: infoCard
        };
        
        return nodeGroup;
    }
    
    getClusterColor(cluster) {
        const clusterColors = {
            llm: 0x00f5ff,      // Cyan for LLM content
            system: 0xff6b6b,   // Red for system content  
            ui: 0xffa500,       // Orange for UI content
            tools: 0x00ff88,    // Green for tool content
            agents: 0xffaa00,   // Yellow for agent content
            misc: 0x888888      // Gray for misc content
        };
        return clusterColors[cluster] || 0x888888;
    }
    
    // ============ 3D CARD CREATION ============
    
    create3DBreadcrumbCard(breadcrumb, cluster) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 320;
        canvas.height = 200;
        
        // Rounded rectangle helper function
        function roundRect(x, y, width, height, radius) {
            context.beginPath();
            context.moveTo(x + radius, y);
            context.lineTo(x + width - radius, y);
            context.quadraticCurveTo(x + width, y, x + width, y + radius);
            context.lineTo(x + width, y + height - radius);
            context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            context.lineTo(x + radius, y + height);
            context.quadraticCurveTo(x, y + height, x, y + height - radius);
            context.lineTo(x, y + radius);
            context.quadraticCurveTo(x, y, x + radius, y);
            context.closePath();
        }
        
        // Exact 2D card background gradient
        const gradient = context.createLinearGradient(0, 0, 320, 200);
        gradient.addColorStop(0, 'rgba(0, 245, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(0, 128, 255, 0.1)');
        
        roundRect(0, 0, 320, 200, 12);
        context.fillStyle = gradient;
        context.fill();
        
        // Exact 2D border
        context.strokeStyle = 'rgba(0, 245, 255, 0.3)';
        context.lineWidth = 1;
        context.stroke();
        
        // Title section
        context.fillStyle = '#ffffff';
        context.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        context.textAlign = 'left';
        const title = (breadcrumb.title || 'Untitled').substring(0, 25);
        context.fillText(title, 16, 30);
        
        // Version badge (top right)
        const versionText = `v${breadcrumb.version || '1'}`;
        const versionWidth = context.measureText(versionText).width + 16;
        roundRect(320 - versionWidth - 16, 8, versionWidth, 20, 4);
        context.fillStyle = 'rgba(0, 245, 255, 0.2)';
        context.fill();
        context.strokeStyle = 'rgba(0, 245, 255, 0.4)';
        context.lineWidth = 1;
        context.stroke();
        
        context.fillStyle = '#00f5ff';
        context.font = '11px -apple-system';
        context.textAlign = 'center';
        context.fillText(versionText, 320 - versionWidth/2 - 16, 21);
        
        // Tags (as badges)
        const tags = (breadcrumb.tags || []).filter(tag => 
            !tag.startsWith('workspace:') && !tag.startsWith('breadcrumb:')
        ).slice(0, 3);
        
        let tagX = 16;
        let tagY = 55;
        context.font = '12px -apple-system';
        context.textAlign = 'left';
        
        tags.forEach((tag, index) => {
            const tagWidth = context.measureText(tag).width + 16;
            
            if (tagX + tagWidth > 300) {
                tagX = 16;
                tagY += 30;
            }
            
            roundRect(tagX, tagY, tagWidth, 22, 6);
            context.fillStyle = 'rgba(0, 245, 255, 0.15)';
            context.fill();
            context.strokeStyle = 'rgba(0, 245, 255, 0.3)';
            context.lineWidth = 1;
            context.stroke();
            
            context.fillStyle = '#ffffff';
            context.fillText(tag, tagX + 8, tagY + 15);
            
            tagX += tagWidth + 8;
        });
        
        // Meta information at bottom
        context.fillStyle = 'rgba(255, 255, 255, 0.6)';
        context.font = '11px -apple-system';
        context.textAlign = 'left';
        
        const updateTime = breadcrumb.updated_at ? 
            new Date(breadcrumb.updated_at).toLocaleTimeString() : 'Unknown time';
        context.fillText(`Updated: ${updateTime}`, 16, 180);
        
        const idText = `ID: ${breadcrumb.id?.substring(0, 8) || 'Unknown'}`;
        context.fillText(idText, 200, 180);
        
        // Create sprite
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(48, 30, 1);
        sprite.renderOrder = 999;
        
        return sprite;
    }
    
    create3DAgentCard(agent, cluster) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 120;
        canvas.height = 120;
        
        const centerX = 60;
        const centerY = 60;
        const radius = 55;
        
        // Exact 2D agent background gradient
        const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, 'rgba(255, 165, 0, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 140, 0, 0.1)');
        
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        context.fillStyle = gradient;
        context.fill();
        
        // Exact 2D border
        context.strokeStyle = 'rgba(255, 165, 0, 0.4)';
        context.lineWidth = 2;
        context.stroke();
        
        // Agent icon (centered)
        context.font = '20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        
        if (agent.roles?.includes('curator')) {
            context.fillText('👑', centerX, centerY - 5);
        } else {
            context.fillText('🤖', centerX, centerY - 5);
        }
        
        // Agent name/ID (simplified)
        context.font = 'bold 10px -apple-system';
        context.fillStyle = '#ffffff';
        const agentName = agent.id ? `Agent ${agent.id.substring(30, 33)}` : 'Agent';
        context.fillText(agentName, centerX, centerY + 20);
        
        // Role indicators (small text at bottom)
        context.font = '8px -apple-system';
        context.fillStyle = 'rgba(255, 165, 0, 0.8)';
        const roles = (agent.roles || []).join(', ').substring(0, 15);
        context.fillText(roles, centerX, centerY + 35);
        
        // Create sprite
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(18, 18, 1);
        sprite.renderOrder = 999;
        
        return sprite;
    }
    
    create3DToolCard(tool, cluster) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 120;
        canvas.height = 120;
        
        // Rounded rectangle helper function
        function roundRect(x, y, width, height, radius) {
            context.beginPath();
            context.moveTo(x + radius, y);
            context.lineTo(x + width - radius, y);
            context.quadraticCurveTo(x + width, y, x + width, y + radius);
            context.lineTo(x + width, y + height - radius);
            context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            context.lineTo(x + radius, y + height);
            context.quadraticCurveTo(x, y + height, x, y + height - radius);
            context.lineTo(x, y + radius);
            context.quadraticCurveTo(x, y, x + radius, y);
            context.closePath();
        }
        
        // Exact 2D tool background gradient
        const gradient = context.createLinearGradient(0, 0, 120, 120);
        gradient.addColorStop(0, 'rgba(0, 255, 136, 0.1)');
        gradient.addColorStop(1, 'rgba(0, 245, 255, 0.1)');
        
        roundRect(0, 0, 120, 120, 12);
        context.fillStyle = gradient;
        context.fill();
        
        // Exact 2D border
        context.strokeStyle = 'rgba(0, 255, 136, 0.4)';
        context.lineWidth = 2;
        context.stroke();
        
        // Tool icon (centered)
        const getToolIcon = (name) => {
            if (name === 'openrouter') return '🧠';
            if (name === 'ollama_local') return '🏠';
            if (name === 'echo') return '📢';
            if (name === 'timer') return '⏱️';
            if (name === 'random') return '🎲';
            if (name === 'calculator') return '🔢';
            if (name === 'web_browser') return '🌐';
            return '🛠️';
        };
        
        context.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.fillText(getToolIcon(tool.name), 60, 45);
        
        // Tool name
        context.font = 'bold 10px -apple-system';
        context.fillStyle = '#ffffff';
        const toolName = (tool.name || 'Tool').substring(0, 12);
        context.fillText(toolName, 60, 65);
        
        // Status indicator
        context.font = '8px -apple-system';
        context.fillStyle = tool.status === 'active' ? 'rgba(0, 255, 136, 0.8)' : 'rgba(255, 165, 0, 0.8)';
        context.fillText(tool.status?.toUpperCase() || 'UNKNOWN', 60, 80);
        
        // Category (if space allows)
        if (tool.category) {
            context.font = '7px -apple-system';
            context.fillStyle = 'rgba(255, 255, 255, 0.6)';
            context.fillText(tool.category.substring(0, 10), 60, 95);
        }
        
        // Create sprite
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(18, 18, 1);
        sprite.renderOrder = 999;
        
        return sprite;
    }
    
    create3DSecretCard(secret, cluster) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 140;
        canvas.height = 100;
        
        // Rounded rectangle helper function
        function roundRect(x, y, width, height, radius) {
            context.beginPath();
            context.moveTo(x + radius, y);
            context.lineTo(x + width - radius, y);
            context.quadraticCurveTo(x + width, y, x + width, y + radius);
            context.lineTo(x + width, y + height - radius);
            context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            context.lineTo(x + radius, y + height);
            context.quadraticCurveTo(x, y + height, x, y + height - radius);
            context.lineTo(x, y + radius);
            context.quadraticCurveTo(x, y, x + radius, y);
            context.closePath();
        }
        
        // Secret background gradient (red/orange like 2D version)
        const gradient = context.createLinearGradient(0, 0, 140, 100);
        gradient.addColorStop(0, 'rgba(255, 107, 107, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 165, 0, 0.1)');
        
        roundRect(0, 0, 140, 100, 12);
        context.fillStyle = gradient;
        context.fill();
        
        // Secret border
        context.strokeStyle = 'rgba(255, 107, 107, 0.4)';
        context.lineWidth = 2;
        context.stroke();
        
        // Secret icon (centered)
        const getSecretIcon = (name, scopeType) => {
            if (name.toLowerCase().includes('api_key') || name.toLowerCase().includes('apikey')) return '🔑';
            if (name.toLowerCase().includes('token')) return '🎫';
            if (name.toLowerCase().includes('password') || name.toLowerCase().includes('pwd')) return '🔒';
            if (name.toLowerCase().includes('openrouter')) return '🧠';
            if (name.toLowerCase().includes('db') || name.toLowerCase().includes('database')) return '🗄️';
            if (name.toLowerCase().includes('webhook')) return '🔗';
            
            // Icons based on scope type
            if (scopeType === 'global') return '🌐';
            if (scopeType === 'agent') return '🤖';
            if (scopeType === 'workspace') return '🏢';
            
            return '🔐'; // Default secret icon
        };
        
        context.font = '20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.fillText(getSecretIcon(secret.name, secret.scope_type), 70, 35);
        
        // Secret name
        context.font = 'bold 9px -apple-system';
        context.fillStyle = '#ffffff';
        const secretName = (secret.name || 'Secret').substring(0, 15);
        context.fillText(secretName, 70, 55);
        
        // Scope type
        context.font = '8px -apple-system';
        context.fillStyle = 'rgba(255, 255, 255, 0.6)';
        context.fillText(secret.scope_type?.toUpperCase() || 'UNKNOWN', 70, 70);
        
        // Security indicator
        context.font = '7px -apple-system';
        context.fillStyle = 'rgba(255, 107, 107, 0.8)';
        context.fillText('🔐 ENCRYPTED', 70, 85);
        
        // Create sprite
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(20, 14, 1); // Slightly wider than tools
        sprite.renderOrder = 999;
        
        return sprite;
    }
    
    // ============ 3D CONNECTIONS ============
    
    async render3DConnections() {
        console.log('🔗 Rendering 3D connections...');
        
        // Clear existing connection lines
        const existingConnections = this.scene.children.filter(child => child.userData.isConnectionLine);
        existingConnections.forEach(line => this.scene.remove(line));
        
        // Create connection lines between agents and subscribed breadcrumbs
        dashboardState.subscriptions.forEach((subscription) => {
            // Find agent position in 3D space
            const agentObj = this.agentObjects3D.get(subscription.agent_id);
            if (!agentObj) return;
            
            // Find matching breadcrumbs (using external function)
            const matchingBreadcrumbs = this.findMatchingBreadcrumbs(subscription.selector);
            
            matchingBreadcrumbs.forEach(breadcrumb => {
                const breadcrumbObj = this.nodeObjects3D.get(breadcrumb.id);
                
                if (breadcrumbObj) {
                    // Create 3D line between agent and breadcrumb
                    const line = this.create3DConnectionLine(
                        agentObj.position, 
                        breadcrumbObj.position, 
                        'agent', 
                        subscription
                    );
                    this.scene.add(line);
                }
            });
        });
        
        // Create connection lines between tools and breadcrumbs they created
        dashboardState.availableTools.forEach((tool) => {
            // Find tool position in 3D space
            const toolObj = this.toolObjects3D.get(tool.id);
            if (!toolObj) return;
            
            // Find breadcrumbs created by this tool
            const createdBreadcrumbs = this.findToolCreatedBreadcrumbs(tool.name);
            
            createdBreadcrumbs.forEach(breadcrumb => {
                const breadcrumbObj = this.nodeObjects3D.get(breadcrumb.id);
                
                if (breadcrumbObj) {
                    // Create 3D line between tool and breadcrumb
                    const line = this.create3DConnectionLine(
                        toolObj.position, 
                        breadcrumbObj.position, 
                        'tool', 
                        tool
                    );
                    this.scene.add(line);
                }
            });
        });
        
        // Create connection lines between secrets and tools that use them
        this.render3DSecretConnections();
        
        console.log('✅ 3D connections rendered');
    }
    
    async render3DSecretConnections() {
        // Look for tool configurations that reference secrets
        const toolConfigBreadcrumbs = dashboardState.breadcrumbs.filter(b => 
            b.tags?.includes('tool:config')
        );
        
        // Get full context for each tool config to check for secret_id
        for (const breadcrumb of toolConfigBreadcrumbs) {
            try {
                const fullBreadcrumb = await apiClient.loadBreadcrumbDetails(breadcrumb.id);
                if (fullBreadcrumb.context?.secret_id) {
                    const secretId = fullBreadcrumb.context.secret_id;
                    const toolName = fullBreadcrumb.context.tool_name;
                    
                    // Find secret and tool objects in 3D space
                    const secretObj = this.secretObjects3D.get(secretId);
                    const tool = dashboardState.availableTools.find(t => t.name === toolName);
                    const toolObj = tool ? this.toolObjects3D.get(tool.id) : null;
                    
                    if (secretObj && toolObj) {
                        console.log(`🔗 Creating 3D secret connection: ${fullBreadcrumb.context.secret_name} → ${toolName}`);
                        
                        // Create 3D line between secret and tool
                        const line = this.create3DConnectionLine(
                            secretObj.position, 
                            toolObj.position, 
                            'secret', 
                            { secret_name: fullBreadcrumb.context.secret_name, tool_name: toolName }
                        );
                        this.scene.add(line);
                    }
                }
            } catch (error) {
                console.warn(`Failed to load context for ${breadcrumb.title}:`, error);
            }
        }
    }
    
    create3DConnectionLine(startPos, endPos, type, data) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array([
            startPos.x, startPos.y, startPos.z,
            endPos.x, endPos.y, endPos.z
        ]);
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // Different colors and styles for different connection types - more transparent
        let material;
        if (type === 'agent') {
            // Orange lines for agent subscriptions - very subtle
            material = new THREE.LineBasicMaterial({
                color: 0xffa500,
                transparent: true,
                opacity: 0.15,
                linewidth: 1
            });
        } else if (type === 'tool') {
            // Green lines for tool creations - still subtle but slightly more visible
            material = new THREE.LineBasicMaterial({
                color: 0x00ff88,
                transparent: true,
                opacity: 0.2,
                linewidth: 1
            });
        } else if (type === 'secret') {
            // Red/orange lines for secret connections - subtle like other connections
            material = new THREE.LineBasicMaterial({
                color: 0xff6b6b,
                transparent: true,
                opacity: 0.25,
                linewidth: 1
            });
        }
        
        const line = new THREE.Line(geometry, material);
        line.userData = {
            isConnectionLine: true,
            type: type,
            data: data
        };
        
        // Set render order to be behind cards
        line.renderOrder = -1;
        
        return line;
    }
    
    // Helper functions that need to be implemented by the using code
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
    
    // ============ 3D EFFECTS ============
    
    addClusterLabels() {
        const clusterCenters = {
            'LLM': [200, 0, 100],
            'System': [-200, 0, 100], 
            'UI': [0, 200, 50],
            'Tools': [0, -200, 50],
            'Agents': [0, 0, 200],
            'Misc': [0, 0, -100]
        };
        
        Object.entries(clusterCenters).forEach(([label, center]) => {
            // Create beautiful cluster labels with glowing background
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 300;
            canvas.height = 80;
            
            // Glowing background
            context.shadowBlur = 20;
            context.shadowColor = 'rgba(0, 245, 255, 0.8)';
            context.fillStyle = 'rgba(0, 0, 0, 0.7)';
            context.fillRect(50, 20, 200, 40);
            
            // Border
            context.strokeStyle = 'rgba(0, 245, 255, 0.8)';
            context.lineWidth = 2;
            context.strokeRect(50, 20, 200, 40);
            
            // Text
            context.shadowBlur = 0;
            context.font = 'Bold 28px Arial';
            context.fillStyle = '#ffffff';
            context.textAlign = 'center';
            context.fillText(label, 150, 50);
            
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
            const sprite = new THREE.Sprite(material);
            
            sprite.position.set(center[0], center[1] + 80, center[2]);
            sprite.scale.set(60, 16, 1);
            
            this.scene.add(sprite);
        });
    }
    
    addParticleEffects() {
        const clusterCenters = {
            'LLM': [200, 0, 100],
            'System': [-200, 0, 100], 
            'UI': [0, 200, 50],
            'Tools': [0, -200, 50],
            'Agents': [0, 0, 200]
        };
        
        Object.entries(clusterCenters).forEach(([clusterName, center]) => {
            // Create subtle particle system for each cluster
            const particleCount = 50;
            const particles = new THREE.BufferGeometry();
            const positions = new Float32Array(particleCount * 3);
            const colors = new Float32Array(particleCount * 3);
            
            const clusterColor = new THREE.Color(
                clusterName === 'LLM' ? 0x00f5ff :
                clusterName === 'System' ? 0xff6b6b :
                clusterName === 'UI' ? 0xffa500 :
                clusterName === 'Tools' ? 0x00ff88 :
                0xffaa00 // Agents
            );
            
            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                
                // Random positions around cluster center
                positions[i3] = center[0] + (Math.random() - 0.5) * 150;
                positions[i3 + 1] = center[1] + (Math.random() - 0.5) * 150;
                positions[i3 + 2] = center[2] + (Math.random() - 0.5) * 150;
                
                colors[i3] = clusterColor.r;
                colors[i3 + 1] = clusterColor.g;
                colors[i3 + 2] = clusterColor.b;
            }
            
            particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            
            const particleMaterial = new THREE.PointsMaterial({
                size: 1.5,
                vertexColors: true,
                transparent: true,
                opacity: 0.3,
                blending: THREE.AdditiveBlending
            });
            
            const particleSystem = new THREE.Points(particles, particleMaterial);
            this.scene.add(particleSystem);
        });
    }
    
    // ============ 3D INTERACTION ============
    
    add3DInteraction() {
        if (!this.renderer) return;
        
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        
        this.renderer.domElement.addEventListener('click', (event) => {
            const rect = this.renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            raycaster.setFromCamera(mouse, this.camera);
            
            // Check for intersections with all objects (recursive to catch child meshes)
            const allGroups = [...this.nodeObjects3D.values(), ...this.agentObjects3D.values(), ...this.toolObjects3D.values(), ...this.secretObjects3D.values()];
            const intersects = raycaster.intersectObjects(allGroups, true); // true = recursive
            
            if (intersects.length > 0) {
                // Find the parent group (not individual mesh)
                let targetGroup = intersects[0].object;
                while (targetGroup.parent && targetGroup.parent !== this.scene) {
                    targetGroup = targetGroup.parent;
                }
                
                const userData = targetGroup.userData;
                
                // Trigger selection events (these would be handled by main controller)
                if (userData.type === 'breadcrumb') {
                    window.dashboard?.selectBreadcrumbForDetails(userData.data.id);
                } else if (userData.type === 'agent') {
                    window.dashboard?.selectAgentForDetails(userData.data);
                } else if (userData.type === 'tool') {
                    console.log('Tool clicked:', userData.data);
                }
                
                // Highlight clicked object
                this.highlight3DObject(targetGroup);
            }
        });
    }
    
    highlight3DObject(object) {
        // Reset all cards to normal state
        [...this.nodeObjects3D.values(), ...this.agentObjects3D.values(), ...this.toolObjects3D.values(), ...this.secretObjects3D.values()].forEach(nodeGroup => {
            const userData = nodeGroup.userData;
            if (userData.infoCard) {
                userData.infoCard.scale.set(
                    userData.infoCard.scale.x / 1.1,
                    userData.infoCard.scale.y / 1.1, 
                    1
                );
            }
        });
        
        // Highlight selected card by scaling it up
        const userData = object.userData;
        if (userData.infoCard) {
            userData.infoCard.scale.set(
                userData.infoCard.scale.x * 1.1,
                userData.infoCard.scale.y * 1.1,
                1
            );
        }
    }
    
    // ============ ANIMATION & LIFECYCLE ============
    
    animate3D() {
        if (!dashboardState.is3DMode || !this.renderer) return;
        
        requestAnimationFrame(() => this.animate3D());
        
        if (this.controls) {
            this.controls.update();
        }
        
        // No animations - keep cards stable for reading
        
        this.renderer.render(this.scene, this.camera);
    }
    
    cleanup3DScene() {
        if (this.renderer) {
            const container = document.getElementById('canvas3D');
            if (container && this.renderer.domElement) {
                container.removeChild(this.renderer.domElement);
            }
            this.renderer.dispose();
            this.renderer = null;
        }
        
        this.scene = null;
        this.camera = null;
        this.controls = null;
        this.nodeObjects3D.clear();
        this.agentObjects3D.clear();
        this.toolObjects3D.clear();
        this.secretObjects3D.clear();
        
        // Update state
        dashboardState.is3DMode = false;
        dashboardState.scene = null;
        dashboardState.camera = null;
        dashboardState.renderer = null;
        dashboardState.controls = null;
        
        console.log('🎲 3D scene cleaned up');
    }
    
    // Handle window resize for 3D canvas
    handle3DResize() {
        if (!dashboardState.is3DMode || !this.renderer || !this.camera) return;
        
        const container = document.getElementById('canvas3D');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
}
