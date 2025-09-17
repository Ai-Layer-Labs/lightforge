import { RenderNode, Position3D } from '../types/rcrt';

/**
 * 2D Layout Algorithms for organizing nodes in the canvas
 */

export interface LayoutConfig {
  nodeSpacing: number;
  categorySpacing: number;
  canvasWidth: number;
  canvasHeight: number;
  padding: number;
}

export const defaultLayoutConfig: LayoutConfig = {
  nodeSpacing: 30, // Increased spacing between nodes
  categorySpacing: 80, // Increased spacing between categories
  canvasWidth: 1400, // Larger canvas area
  canvasHeight: 1000,
  padding: 60,
};

/**
 * Grid layout - organizes nodes by category in a clean grid
 */
export function applyGridLayout(nodes: RenderNode[], config: LayoutConfig = defaultLayoutConfig): RenderNode[] {
  // Group nodes by type
  const nodesByType = {
    breadcrumb: nodes.filter(n => n.type === 'breadcrumb'),
    agent: nodes.filter(n => n.type === 'agent'),
    'agent-definition': nodes.filter(n => n.type === 'agent-definition'),
    tool: nodes.filter(n => n.type === 'tool'),
    secret: nodes.filter(n => n.type === 'secret'),
    chat: nodes.filter(n => n.type === 'chat'),
  };

  const layoutNodes: RenderNode[] = [];
  let currentY = config.padding;

  // Layout each category
  Object.entries(nodesByType).forEach(([type, categoryNodes]) => {
    if (categoryNodes.length === 0) return;

    console.log(`📐 Laying out ${categoryNodes.length} ${type} nodes`);

    // Calculate grid dimensions for this category
    // Use consistent sizes based on node type for better layout
    const typeSize = {
      breadcrumb: { width: 280, height: 120 },
      agent: { width: 120, height: 120 },
      'agent-definition': { width: 140, height: 100 },
      tool: { width: 110, height: 110 },
      secret: { width: 130, height: 90 },
      chat: { width: 200, height: 100 },
    };
    
    const defaultSize = typeSize[type as keyof typeof typeSize] || { width: 200, height: 100 };
    const nodeWidth = defaultSize.width;
    const nodeHeight = defaultSize.height;
    
    const cols = Math.max(1, Math.floor((config.canvasWidth - config.padding * 2) / (nodeWidth + config.nodeSpacing)));
    const rows = Math.ceil(categoryNodes.length / cols);
    
    console.log(`  ${type}: ${categoryNodes.length} nodes, ${cols} cols, ${rows} rows, size ${nodeWidth}x${nodeHeight}`);

    // Position nodes in grid
    categoryNodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      const x = config.padding + col * (nodeWidth + config.nodeSpacing);
      const y = currentY + row * (nodeHeight + config.nodeSpacing);

      layoutNodes.push({
        ...node,
        position: {
          x,
          y,
          z: node.position.z, // Keep original z
        }
      });
    });

    // Move to next category section
    currentY += rows * (nodeHeight + config.nodeSpacing) + config.categorySpacing;
  });

  console.log(`✅ Grid layout applied to ${layoutNodes.length} nodes`);
  return layoutNodes;
}

/**
 * Circular layout - arranges nodes in circles by category
 */
export function applyCircularLayout(nodes: RenderNode[], config: LayoutConfig = defaultLayoutConfig): RenderNode[] {
  // Group nodes by type
  const nodesByType = {
    breadcrumb: nodes.filter(n => n.type === 'breadcrumb'),
    agent: nodes.filter(n => n.type === 'agent'),
    'agent-definition': nodes.filter(n => n.type === 'agent-definition'),
    tool: nodes.filter(n => n.type === 'tool'),
    secret: nodes.filter(n => n.type === 'secret'),
    chat: nodes.filter(n => n.type === 'chat'),
  };

  const layoutNodes: RenderNode[] = [];
  const centerX = config.canvasWidth / 2;
  const centerY = config.canvasHeight / 2;

  // Define circle centers for each category
  const categoryCircles = {
    breadcrumb: { x: centerX, y: centerY, radius: 200 },
    agent: { x: centerX - 300, y: centerY - 200, radius: 120 },
    'agent-definition': { x: centerX - 100, y: centerY - 200, radius: 130 },
    tool: { x: centerX + 300, y: centerY - 200, radius: 150 },
    secret: { x: centerX - 200, y: centerY + 250, radius: 100 },
    chat: { x: centerX + 200, y: centerY + 250, radius: 100 },
  };

  // Layout each category in its circle
  Object.entries(nodesByType).forEach(([type, categoryNodes]) => {
    if (categoryNodes.length === 0) return;

    const circle = categoryCircles[type as keyof typeof categoryCircles];
    if (!circle) return;

    console.log(`🔄 Laying out ${categoryNodes.length} ${type} nodes in circle`);

    categoryNodes.forEach((node, index) => {
      const angleStep = (2 * Math.PI) / categoryNodes.length;
      const angle = index * angleStep;

      const x = circle.x + Math.cos(angle) * circle.radius;
      const y = circle.y + Math.sin(angle) * circle.radius;

      layoutNodes.push({
        ...node,
        position: {
          x,
          y,
          z: node.position.z,
        }
      });
    });
  });

  console.log(`✅ Circular layout applied to ${layoutNodes.length} nodes`);
  return layoutNodes;
}

/**
 * Force-directed layout - uses simple physics simulation for organic layout
 */
export function applyForceLayout(nodes: RenderNode[], config: LayoutConfig = defaultLayoutConfig): RenderNode[] {
  const layoutNodes = nodes.map(node => ({ ...node }));
  const centerX = config.canvasWidth / 2;
  const centerY = config.canvasHeight / 2;

  // Simple force-directed algorithm
  for (let iteration = 0; iteration < 100; iteration++) {
    layoutNodes.forEach((node, i) => {
      let forceX = 0;
      let forceY = 0;

      // Repulsion from other nodes
      layoutNodes.forEach((otherNode, j) => {
        if (i === j) return;

        const dx = node.position.x - otherNode.position.x;
        const dy = node.position.y - otherNode.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 200) {
          const force = 1000 / (distance * distance);
          forceX += (dx / distance) * force;
          forceY += (dy / distance) * force;
        }
      });

      // Attraction to center
      const centerDx = centerX - node.position.x;
      const centerDy = centerY - node.position.y;
      const centerDistance = Math.sqrt(centerDx * centerDx + centerDy * centerDy);
      
      if (centerDistance > 0) {
        forceX += (centerDx / centerDistance) * 0.1;
        forceY += (centerDy / centerDistance) * 0.1;
      }

      // Apply forces
      node.position.x += forceX * 0.01;
      node.position.y += forceY * 0.01;

      // Keep within bounds
      node.position.x = Math.max(config.padding, Math.min(config.canvasWidth - config.padding, node.position.x));
      node.position.y = Math.max(config.padding, Math.min(config.canvasHeight - config.padding, node.position.y));
    });
  }

  console.log(`✅ Force layout applied to ${layoutNodes.length} nodes`);
  return layoutNodes;
}

/**
 * Hierarchical layout - organizes nodes based on connections and importance
 */
export function applyHierarchicalLayout(nodes: RenderNode[], config: LayoutConfig = defaultLayoutConfig): RenderNode[] {
  const layoutNodes = nodes.map(node => ({ ...node }));
  
  // Separate by importance/type
  const agents = layoutNodes.filter(n => n.type === 'agent');
  const agentDefinitions = layoutNodes.filter(n => n.type === 'agent-definition');
  const tools = layoutNodes.filter(n => n.type === 'tool');
  const breadcrumbs = layoutNodes.filter(n => n.type === 'breadcrumb');
  const secrets = layoutNodes.filter(n => n.type === 'secret');
  const chat = layoutNodes.filter(n => n.type === 'chat');

  let yOffset = config.padding;

  // Top tier: Agents (most important)
  if (agents.length > 0) {
    const agentSpacing = Math.min(200, (config.canvasWidth - config.padding * 2) / agents.length);
    agents.forEach((node, index) => {
      node.position.x = config.padding + index * agentSpacing + agentSpacing / 2;
      node.position.y = yOffset;
    });
    yOffset += 150;
  }

  // Second tier: Agent Definitions
  if (agentDefinitions.length > 0) {
    const agentDefSpacing = Math.min(160, (config.canvasWidth - config.padding * 2) / agentDefinitions.length);
    agentDefinitions.forEach((node, index) => {
      node.position.x = config.padding + index * agentDefSpacing + agentDefSpacing / 2;
      node.position.y = yOffset;
    });
    yOffset += 120;
  }

  // Third tier: Tools
  if (tools.length > 0) {
    const toolSpacing = Math.min(150, (config.canvasWidth - config.padding * 2) / tools.length);
    tools.forEach((node, index) => {
      node.position.x = config.padding + index * toolSpacing + toolSpacing / 2;
      node.position.y = yOffset;
    });
    yOffset += 130;
  }

  // Third tier: Breadcrumbs (in rows)
  if (breadcrumbs.length > 0) {
    const cols = Math.floor((config.canvasWidth - config.padding * 2) / 320);
    breadcrumbs.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      node.position.x = config.padding + col * 320 + 160;
      node.position.y = yOffset + row * 140;
    });
    yOffset += Math.ceil(breadcrumbs.length / cols) * 140 + 50;
  }

  // Bottom tier: Secrets and Chat
  const bottomNodes = [...secrets, ...chat];
  if (bottomNodes.length > 0) {
    const bottomSpacing = Math.min(150, (config.canvasWidth - config.padding * 2) / bottomNodes.length);
    bottomNodes.forEach((node, index) => {
      node.position.x = config.padding + index * bottomSpacing + bottomSpacing / 2;
      node.position.y = yOffset;
    });
  }

  console.log(`✅ Hierarchical layout applied to ${layoutNodes.length} nodes`);
  return layoutNodes;
}
