import { RenderNode, RenderConnection, NodeType, ConnectionType, Position3D, Breadcrumb, Agent, Secret, Tool, SelectorSubscription, AgentDefinition } from '../types/rcrt';
import { matchesSelector, findMatchingBreadcrumbs, matchesEmissionRules } from './selectorMatching';
import { discoverConnections as discoverConnectionsClean } from './connectionDiscovery';

/**
 * Data transformation utilities for converting RCRT API data to render format
 */

// ============ NODE CONVERSION ============

export function convertToRenderNode(
  type: NodeType, 
  data: Breadcrumb | Agent | Secret | Tool
): RenderNode {
  const basePosition = generateRandomPosition();
  
  switch (type) {
    case 'breadcrumb':
      return convertBreadcrumbToNode(data as Breadcrumb, basePosition);
    case 'agent':
      return convertAgentToNode(data as Agent, basePosition);
    case 'secret':
      return convertSecretToNode(data as Secret, basePosition);
    case 'tool':
      return convertToolToNode(data as Tool, basePosition);
    default:
      throw new Error(`Unknown node type: ${type}`);
  }
}

function convertBreadcrumbToNode(breadcrumb: Breadcrumb, position: Position3D): RenderNode {
  // Determine node subtype based on schema
  const schema = breadcrumb.schema_name;
  let nodeType: NodeType = 'breadcrumb';
  let metadata = getDefaultBreadcrumbMetadata(breadcrumb);
  
  // Debug logging for agent definitions
  if (breadcrumb.tags?.includes('agent:definition') || schema === 'agent.definition.v1') {
    console.log(`🤖 Converting agent definition:`, {
      title: breadcrumb.title,
      schema: schema,
      tags: breadcrumb.tags,
      hasContext: !!breadcrumb.context,
      contextKeys: Object.keys(breadcrumb.context || {})
    });
  }
  
  // Schema-specific customization
  if (schema) {
    const schemaConfig = getSchemaConfig(schema);
    if (schemaConfig) {
      metadata = {
        ...metadata,
        icon: schemaConfig.icon,
        color: schemaConfig.color,
        size: getSizeFromString(schemaConfig.size),
      };
      
      // Override node type for special schemas
      if (schema.startsWith('chat.')) nodeType = 'chat';
      if (schema.startsWith('agent.definition.') || schema === 'agent.def.v1') {
        nodeType = 'agent-definition';
        metadata = {
          ...metadata,
          icon: '🧠',
          color: '#9333ea', // Distinct purple for agent definitions
          size: { width: 160, height: 110 },
        };
        console.log(`🧠 Converting to agent-definition node type for: ${breadcrumb.title}`);
      }
      if (schema.startsWith('tool.code.') || schema === 'tool.code.v1') {
        nodeType = 'tool';
        // Ensure green color for self-contained tools
        metadata = {
          ...metadata,
          icon: '🛠️',
          color: '#10b981', // Green for self-contained tools
          size: { width: 140, height: 100 },
        };
        console.log(`🛠️ Converting to tool node type for: ${breadcrumb.title}`);
      }
      if (schema.startsWith('dashboard.')) nodeType = 'system';
    }
  }
  
  // Fallback: Check tags if schema detection failed (check both agent:definition AND agent:def)
  if (nodeType === 'breadcrumb' && (breadcrumb.tags?.includes('agent:definition') || breadcrumb.tags?.includes('agent:def'))) {
    nodeType = 'agent-definition';
    metadata = {
      ...metadata,
      icon: '🧠',
      color: '#9333ea', // Distinct purple for agent definitions
      size: { width: 160, height: 110 },
    };
    console.log(`🧠 Fallback: Converting to agent-definition node type via tags for: ${breadcrumb.title}`);
  }
  
  return {
    id: breadcrumb.id,
    type: nodeType,
    data: breadcrumb,
    position,
    metadata,
    effects: {
      pulse: schema === 'agent.thinking.v1',
      glow: schema?.startsWith('chat.'),
      animate: true,
      temporary: schema === 'agent.thinking.v1',
    },
    state: {
      selected: false,
      highlighted: false,
      filtered: false,
      visible: true,
    },
  };
}

function convertAgentToNode(agent: Agent, position: Position3D): RenderNode {
  return {
    id: agent.id,
    type: 'agent',
    data: agent,
    position,
    metadata: {
      title: agent.id.substring(30), // Show short ID
      subtitle: agent.roles.join(', '),
      icon: '🤖',
      color: '#00f5ff',
      size: { width: 160, height: 120 }, // Tall rectangle for agents
      tags: agent.roles,
    },
    effects: {
      glow: true,
    },
    state: {
      selected: false,
      highlighted: false,
      filtered: false,
      visible: true,
    },
  };
}

function convertSecretToNode(secret: Secret, position: Position3D): RenderNode {
  return {
    id: secret.id,
    type: 'secret',
    data: secret,
    position,
    metadata: {
      title: secret.name,
      subtitle: `${secret.scope_type} scope`,
      icon: '🔐',
      color: '#ff6b6b',
      size: { width: 120, height: 80 }, // Compact rectangle for secrets
      tags: [secret.scope_type],
    },
    effects: {},
    state: {
      selected: false,
      highlighted: false,
      filtered: false,
      visible: true,
    },
  };
}

function convertToolToNode(tool: Tool | Breadcrumb, position: Position3D): RenderNode {
  // Handle both Tool objects and tool breadcrumbs
  const isToolBreadcrumb = 'title' in tool && 'tags' in tool;
  
  if (isToolBreadcrumb) {
    const breadcrumb = tool as Breadcrumb;
    return {
      id: breadcrumb.id,
      type: 'tool',
      data: breadcrumb,
      position,
      metadata: {
        title: breadcrumb.title,
        subtitle: breadcrumb.context?.description?.substring(0, 30) + '...' || 'Tool',
        icon: getToolIcon(breadcrumb.tags || []),
        color: '#ffa500',
        size: { width: 140, height: 100 }, // Square-ish for tools
        tags: breadcrumb.tags || [],
      },
      effects: {},
      state: {
        selected: false,
        highlighted: false,
        filtered: false,
        visible: true,
      },
    };
  } else {
    // Handle proper Tool objects
    const toolObj = tool as Tool;
    return {
      id: toolObj.name || 'unknown-tool',
      type: 'tool',
      data: toolObj,
      position,
      metadata: {
        title: toolObj.name || 'Unknown Tool',
        subtitle: toolObj.description?.substring(0, 30) + '...' || 'Tool',
        icon: '🛠️',
        color: '#ffa500',
        size: { width: 140, height: 100 }, // Square-ish for tools
        tags: ['tool'],
      },
      effects: {},
      state: {
        selected: false,
        highlighted: false,
        filtered: false,
        visible: true,
      },
    };
  }
}

// ============ METADATA HELPERS ============

function getToolIcon(tags: string[]): string {
  // Determine icon based on tool tags
  if (tags.some(tag => tag.includes('health:check'))) return '❤️';
  if (tags.some(tag => tag.includes('openrouter') || tag.includes('llm'))) return '🤖';
  if (tags.some(tag => tag.includes('web') || tag.includes('browser'))) return '🌐';
  if (tags.some(tag => tag.includes('calculator'))) return '🧮';
  if (tags.some(tag => tag.includes('timer'))) return '⏱️';
  if (tags.some(tag => tag.includes('random'))) return '🎲';
  if (tags.some(tag => tag.includes('echo'))) return '📢';
  if (tags.some(tag => tag.includes('agent'))) return '🤖';
  if (tags.some(tag => tag.includes('catalog'))) return '📚';
  if (tags.some(tag => tag.includes('config'))) return '⚙️';
  return '🛠️'; // Default tool icon
}

function getDefaultBreadcrumbMetadata(breadcrumb: Breadcrumb) {
  return {
    title: breadcrumb.title,
    subtitle: breadcrumb.tags?.slice(0, 2).join(', ') || '',
    icon: getIconFromTags(breadcrumb.tags),
    color: getColorFromTags(breadcrumb.tags),
    size: { width: 220, height: 90 }, // Wider rectangular for content
    schema: breadcrumb.schema_name,
    tags: breadcrumb.tags || [],
  };
}

function getIconFromTags(tags: string[]): string {
  if (tags.includes('chat:message')) return '💬';
  if (tags.includes('agent:response')) return '🤖';
  if (tags.includes('agent:thinking')) return '🧠';
  if (tags.includes('tool:response')) return '🛠️';
  if (tags.includes('user:input')) return '👤';
  if (tags.includes('system:config')) return '⚙️';
  if (tags.includes('workspace:agents')) return '🤖';
  if (tags.includes('workspace:tools')) return '🛠️';
  if (tags.includes('workspace:ui')) return '🎨';
  return '📋'; // default
}

function getColorFromTags(tags: string[]): string {
  if (tags.includes('chat:message')) return '#00f5ff';
  if (tags.includes('agent:response')) return '#8a2be2';
  if (tags.includes('agent:thinking')) return '#ff6b6b';
  if (tags.includes('tool:response')) return '#ffa500';
  if (tags.includes('user:input')) return '#00ff88';
  if (tags.includes('system:config')) return '#64748b';
  if (tags.includes('error:')) return '#ff6b6b';
  if (tags.includes('success:')) return '#00ff88';
  return '#64748b'; // default gray
}

function getSchemaConfig(schema: string) {
  // This would eventually be loaded from dashboard.config.v1 breadcrumbs
  const defaultSchemaConfigs: Record<string, any> = {
    'chat.message.v1': { icon: '💬', color: '#00f5ff', size: 'small' },
    'agent.response.v1': { icon: '🤖', color: '#8a2be2', size: 'medium' },
    'agent.thinking.v1': { icon: '🧠', color: '#ff6b6b', size: 'small' },
    'agent.definition.v1': { icon: '🧠', color: '#8a2be2', size: 'medium' },
    'tool.code.v1': { icon: '🛠️', color: '#10b981', size: 'medium' }, // Green for self-contained tools
    'tool.response.v1': { icon: '🛠️', color: '#ffa500', size: 'medium' },
    'tool.request.v1': { icon: '⚡', color: '#ffa500', size: 'small' },
    'dashboard.config.v1': { icon: '⚙️', color: '#64748b', size: 'small' },
    'dashboard.layout.v1': { icon: '📐', color: '#64748b', size: 'small' },
  };
  
  return defaultSchemaConfigs[schema];
}

function getSizeFromString(size: string) {
  switch (size) {
    case 'small': return { width: 120, height: 40 };
    case 'medium': return { width: 180, height: 60 };
    case 'large': return { width: 240, height: 80 };
    default: return { width: 180, height: 60 };
  }
}

// ============ POSITION GENERATION ============

export function generateRandomPosition(): Position3D {
  return {
    x: Math.random() * 800 + 100,
    y: Math.random() * 600 + 100,
    z: Math.random() * 200 - 100,
  };
}

export function generateGridPosition(index: number, columns = 5): Position3D {
  const spacing = 220;
  const row = Math.floor(index / columns);
  const col = index % columns;
  
  return {
    x: col * spacing + 150,
    y: row * spacing + 150,
    z: 0,
  };
}

// ============ CONNECTION DISCOVERY ============

export function discoverConnections(data: {
  breadcrumbs: Breadcrumb[];
  agents: Agent[];
  secrets: Secret[];
  tools?: Tool[];
  subscriptions?: SelectorSubscription[];
}): RenderConnection[] {
  const connections: RenderConnection[] = [];
  
  console.log('🔗 Dynamic connection discovery starting...');
  console.log('📊 Input data:', {
    breadcrumbs: data.breadcrumbs.length,
    agents: data.agents.length,
    secrets: data.secrets.length,
    tools: data.tools?.length || 0,
    subscriptions: data.subscriptions?.length || 0,
  });
  
  // DEBUG: Show sample data to understand what we're working with
  console.log('🔍 Sample breadcrumbs:', data.breadcrumbs.slice(0, 3).map(b => ({
    id: b.id,
    title: b.title,
    schema: b.schema_name,
    tags: b.tags,
    created_by: b.created_by
  })));
  
  console.log('🔍 Agents:', data.agents.map(a => ({ id: a.id, roles: a.roles })));
  
  if (data.subscriptions && data.subscriptions.length > 0) {
    console.log('🔍 Sample subscriptions:', data.subscriptions.slice(0, 2).map(s => ({
      agent_id: s.agent_id,
      selector: s.selector
    })));
  }
  
  // ============ THE RCRT WAY ============
  // Use clean connection discovery - ONLY 4 connection types:
  // 1. Creates (green, solid)
  // 2. Config (purple, dashed)
  // 3. Subscribed (blue, dotted)
  // 4. Triggered (blue, solid)
  
  // Import at runtime to avoid circular dependencies
  // Note: Import statement moved to top of file
  const cleanConnections = discoverConnectionsClean({
    breadcrumbs: data.breadcrumbs,
    agents: data.agents,
    tools: data.tools || []
  });
  
  console.log(`✅ [RCRT Way] Discovered ${cleanConnections.length} connections`);
  return cleanConnections;
}

function findCreationConnections(breadcrumbs: Breadcrumb[], agents: Agent[]): RenderConnection[] {
  const connections: RenderConnection[] = [];
  
  console.log('🔍 Finding creation connections...');
  console.log(`  Breadcrumbs with created_by: ${breadcrumbs.filter(b => b.created_by).length}/${breadcrumbs.length}`);
  
  breadcrumbs.forEach(breadcrumb => {
    if (breadcrumb.created_by) {
      const agent = agents.find(a => a.id === breadcrumb.created_by);
      if (agent) {
        connections.push({
          id: `creation-${agent.id}-${breadcrumb.id}`,
          type: 'creation',
          fromNodeId: agent.id,
          toNodeId: breadcrumb.id,
          metadata: {
            label: 'created',
            color: '#00ff88',
            style: 'solid',
            weight: 2,
          },
          state: {
            visible: true,
            highlighted: false,
          },
        });
        console.log(`  ✅ Created connection: ${agent.id} → ${breadcrumb.title}`);
      } else {
        console.log(`  ⚠️ No agent found for created_by: ${breadcrumb.created_by} (breadcrumb: ${breadcrumb.title})`);
      }
    }
  });
  
  console.log(`🔗 Creation connections: ${connections.length}`);
  return connections;
}

function findAgentDefinitionConnections(breadcrumbs: Breadcrumb[], agents: Agent[]): RenderConnection[] {
  const connections: RenderConnection[] = [];
  
  const agentDefinitions = breadcrumbs.filter(b => 
    b.schema_name === 'agent.definition.v1' && 
    b.tags?.includes('agent:definition')
  );
  
  agentDefinitions.forEach(agentDef => {
    const agentEntityId = agentDef.context?.agent_entity_id;
    if (agentEntityId) {
      const agent = agents.find(a => a.id === agentEntityId);
      if (agent) {
        connections.push({
          id: `agent-def-${agentDef.id}-${agent.id}`,
          type: 'agent-definition',
          fromNodeId: agentDef.id,
          toNodeId: agent.id,
          metadata: {
            label: 'defines',
            color: '#8a2be2',
            style: 'solid',
            weight: 3,
          },
          state: {
            visible: true,
            highlighted: false,
          },
        });
      }
    }
  });
  
  return connections;
}

function findChatConversationConnections(breadcrumbs: Breadcrumb[]): RenderConnection[] {
  const connections: RenderConnection[] = [];
  
  // Group by conversation_id
  const chatMessages = breadcrumbs.filter(b => 
    b.schema_name?.startsWith('chat.') || 
    b.schema_name?.startsWith('agent.response.') ||
    b.schema_name?.startsWith('agent.thinking.')
  );
  
  // Group by conversation
  const conversations = new Map<string, Breadcrumb[]>();
  chatMessages.forEach(msg => {
    const convId = msg.context?.conversation_id;
    if (convId) {
      if (!conversations.has(convId)) {
        conversations.set(convId, []);
      }
      conversations.get(convId)!.push(msg);
    }
  });
  
  // Create connections within each conversation
  conversations.forEach((messages, convId) => {
    // Sort by timestamp
    messages.sort((a, b) => 
      new Date(a.context?.timestamp || a.created_at).getTime() - 
      new Date(b.context?.timestamp || b.created_at).getTime()
    );
    
    // Connect sequential messages
    for (let i = 0; i < messages.length - 1; i++) {
      const fromMsg = messages[i];
      const toMsg = messages[i + 1];
      
      connections.push({
        id: `chat-flow-${fromMsg.id}-${toMsg.id}`,
        type: 'agent-thinking',
        fromNodeId: fromMsg.id,
        toNodeId: toMsg.id,
        metadata: {
          label: 'conversation',
          color: '#00f5ff',
          style: 'dashed',
          weight: 1.5,
          animated: true,
        },
        state: {
          visible: true,
          highlighted: false,
        },
      });
    }
  });
  
  return connections;
}

// ============ CONFIGURATION HELPERS ============

export function getDefaultDashboardConfig() {
  return {
    version: '2.0.0',
    default_view: '2d' as const,
    real_time_updates: true,
    animation_speed: 'normal' as const,
    auto_layout: {
      enabled: true,
      algorithm: 'force_directed' as const,
      spacing: 200,
    },
    connection_styles: {
      creation: { color: '#00ff88', style: 'solid' as const, width: 2 },
      subscription: { color: '#0099ff', style: 'dashed' as const, width: 2 },
      emission: { color: '#00ff88', style: 'solid' as const, width: 2 },
      'agent-thinking': { color: '#ff6b6b', style: 'dotted' as const, width: 1, animated: true },
      'tool-response': { color: '#ffa500', style: 'solid' as const, width: 2 },
      'tool-execution': { color: '#ffa500', style: 'solid' as const, width: 3, animated: true },
    },
    node_styles: {
      'chat.message.v1': { icon: '💬', color: '#00f5ff', size: 'small' as const },
      'agent.response.v1': { icon: '🤖', color: '#8a2be2', size: 'medium' as const },
      'agent.thinking.v1': { icon: '🧠', color: '#ff6b6b', size: 'small' as const, pulse: true },
      'agent.definition.v1': { icon: '🧠', color: '#8a2be2', size: 'medium' as const },
      'tool.response.v1': { icon: '🛠️', color: '#ffa500', size: 'medium' as const },
    },
    chat_visualization: {
      show_bubbles: true,
      bubble_duration: 3000,
      thinking_animation: true,
      connection_flow: true,
    },
  };
}

// ============ LAYOUT ALGORITHMS ============

export function applyForceDirectedLayout(nodes: RenderNode[]): void {
  // Simple force-directed layout algorithm
  const iterations = 50;
  const k = Math.sqrt((800 * 600) / nodes.length);
  
  for (let iter = 0; iter < iterations; iter++) {
    // Calculate repulsive forces
    nodes.forEach(node1 => {
      let fx = 0, fy = 0;
      
      nodes.forEach(node2 => {
        if (node1.id !== node2.id) {
          const dx = node1.position.x - node2.position.x;
          const dy = node1.position.y - node2.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = (k * k) / distance;
          fx += (dx / distance) * force;
          fy += (dy / distance) * force;
        }
      });
      
      // Apply forces with damping
      const damping = 0.1;
      node1.position.x += fx * damping;
      node1.position.y += fy * damping;
      
      // Keep within bounds
      node1.position.x = Math.max(50, Math.min(750, node1.position.x));
      node1.position.y = Math.max(50, Math.min(550, node1.position.y));
    });
  }
}

export function applyCircularLayout(nodes: RenderNode[]): void {
  const centerX = 400;
  const centerY = 300;
  const radius = Math.min(300, nodes.length * 20);
  
  nodes.forEach((node, index) => {
    const angle = (index / nodes.length) * 2 * Math.PI;
    node.position.x = centerX + Math.cos(angle) * radius;
    node.position.y = centerY + Math.sin(angle) * radius;
    node.position.z = 0;
  });
}

// ============ DYNAMIC CONNECTION DISCOVERY FUNCTIONS ============

/**
 * Find subscription connections by reading agent definitions directly
 * This is the correct approach since we have all the data in breadcrumbs
 */
function findSubscriptionConnectionsFromAgentDefs(breadcrumbs: Breadcrumb[]): RenderConnection[] {
  const connections: RenderConnection[] = [];
  
  // Find agent definitions by schema OR tags (since list API doesn't include schema_name)
  const agentDefinitions = breadcrumbs.filter(b => 
    b.schema_name === 'agent.def.v1' || 
    b.tags?.includes('agent:definition')
  ) as AgentDefinition[];
  
  console.log(`🔍 Found ${agentDefinitions.length} agent definitions to analyze`);
  
  agentDefinitions.forEach(agentDef => {
    // Skip if no context
    if (!agentDef.context) {
      console.warn(`⚠️ Agent definition "${agentDef.title}" has no context, skipping`);
      return;
    }
    
    const agentId = agentDef.context.agent_id;
    const selectors = agentDef.context.subscriptions?.selectors || [];
    
    console.log(`📡 Agent "${agentDef.title}" (${agentId}) has ${selectors.length} selectors`);
    
    selectors.forEach((selector, selectorIndex) => {
      console.log(`  Selector ${selectorIndex}:`, selector);
      
      // Find breadcrumbs that match this selector
      const matchingBreadcrumbs = findMatchingBreadcrumbs(breadcrumbs, selector);
      console.log(`    → Found ${matchingBreadcrumbs.length} matching breadcrumbs`);
      
      matchingBreadcrumbs.forEach(breadcrumb => {
        // Don't create self-connections
        if (breadcrumb.created_by === agentId || breadcrumb.id === agentDef.id) return;
        
        connections.push({
          id: `subscription-${breadcrumb.id}-${agentDef.id}`,
          type: 'subscription',
          fromNodeId: breadcrumb.id,
          toNodeId: agentDef.id,
          metadata: {
            label: getSubscriptionLabelFromSelector(selector),
            color: '#0099ff',
            style: 'dashed',
            weight: 2,
          },
          state: {
            visible: true,
            highlighted: false,
          },
        });
        
        console.log(`    ✅ Created subscription: ${breadcrumb.title} → ${agentDef.title}`);
      });
    });
  });
  
  return connections;
}

/**
 * Find emission connections using agent definition emission rules
 */
function findEmissionConnectionsFromAgentDefs(breadcrumbs: Breadcrumb[]): RenderConnection[] {
  const connections: RenderConnection[] = [];
  
  // Find agent definitions by schema OR tags (since list API doesn't include schema_name)
  const agentDefinitions = breadcrumbs.filter(b => 
    b.schema_name === 'agent.def.v1' || 
    b.tags?.includes('agent:definition')
  ) as AgentDefinition[];
  
  console.log(`🔍 Found ${agentDefinitions.length} agent definitions for emission analysis`);
  
  agentDefinitions.forEach(agentDef => {
    // Skip if no context
    if (!agentDef.context) {
      console.warn(`⚠️ Agent definition "${agentDef.title}" has no context, skipping emissions`);
      return;
    }
    
    const emits = agentDef.context.emits;
    const agentId = agentDef.context.agent_id;
    
    console.log(`📤 Agent "${agentDef.title}" (${agentId}) emits:`, emits);
    
    if (!emits) {
      console.log(`  No emission rules defined for ${agentDef.title}`);
      return;
    }
    
    // Find breadcrumbs that match the emission rules
    const emittedBreadcrumbs = breadcrumbs.filter(breadcrumb =>
      matchesEmissionRules(breadcrumb, emits, agentId)
    );
    
    console.log(`  Found ${emittedBreadcrumbs.length} breadcrumbs matching emission rules`);
    
    // Create emission connections from agent definition to emitted breadcrumbs
    emittedBreadcrumbs.forEach(breadcrumb => {
      connections.push({
        id: `emission-${agentDef.id}-${breadcrumb.id}`,
        type: 'emission',
        fromNodeId: agentDef.id,
        toNodeId: breadcrumb.id,
        metadata: {
          label: getEmissionLabel(emits),
          color: '#00ff88',
          style: 'solid',
          weight: 2,
        },
        state: {
          visible: true,
          highlighted: false,
        },
      });
      
      console.log(`    ✅ Created emission: ${agentDef.title} → ${breadcrumb.title}`);
    });
  });
  
  return connections;
}

/**
 * Simplified tool execution flow (request -> response)
 */
function findToolExecutionFlow(breadcrumbs: Breadcrumb[]): RenderConnection[] {
  const connections: RenderConnection[] = [];
  
  const toolRequests = breadcrumbs.filter(b => b.schema_name === 'tool.request.v1');
  const toolResponses = breadcrumbs.filter(b => b.schema_name === 'tool.response.v1');
  
  toolResponses.forEach(response => {
    const requestId = response.context?.request_id || response.context?.requestId;
    if (requestId) {
      const request = toolRequests.find(r => r.id === requestId);
      if (request) {
        connections.push({
          id: `tool-flow-${request.id}-${response.id}`,
          type: 'tool-execution',
          fromNodeId: request.id,
          toNodeId: response.id,
          metadata: {
            label: response.context?.tool || 'tool',
            color: '#ffa500',
            style: 'solid',
            weight: 3,
            animated: true,
          },
          state: {
            visible: true,
            highlighted: false,
          },
        });
      }
    }
  });
  
  return connections;
}

/**
 * Simplified chat conversation flow
 */
function findChatConversationFlow(breadcrumbs: Breadcrumb[]): RenderConnection[] {
  const connections: RenderConnection[] = [];
  
  // Group by conversation_id
  const chatMessages = breadcrumbs.filter(b => 
    b.schema_name?.startsWith('chat.') || 
    b.schema_name?.startsWith('agent.response.') ||
    b.schema_name?.startsWith('agent.thinking.')
  );
  
  const conversations = new Map<string, Breadcrumb[]>();
  chatMessages.forEach(msg => {
    const convId = msg.context?.conversation_id;
    if (convId) {
      if (!conversations.has(convId)) {
        conversations.set(convId, []);
      }
      conversations.get(convId)!.push(msg);
    }
  });
  
  // Create sequential connections within conversations
  conversations.forEach(messages => {
    messages.sort((a, b) => 
      new Date(a.context?.timestamp || a.created_at).getTime() - 
      new Date(b.context?.timestamp || b.created_at).getTime()
    );
    
    for (let i = 0; i < messages.length - 1; i++) {
      const fromMsg = messages[i];
      const toMsg = messages[i + 1];
      
      connections.push({
        id: `chat-flow-${fromMsg.id}-${toMsg.id}`,
        type: 'agent-thinking',
        fromNodeId: fromMsg.id,
        toNodeId: toMsg.id,
        metadata: {
          label: '',
          color: '#00f5ff',
          style: 'dashed',
          weight: 1.5,
          animated: true,
        },
        state: {
          visible: true,
          highlighted: false,
        },
      });
    }
  });
  
  return connections;
}

/**
 * Helper to create readable subscription labels from agent definition selectors
 */
function getSubscriptionLabelFromSelector(selector: AgentDefinition['context']['subscriptions']['selectors'][0]): string {
  const parts: string[] = [];
  
  if (selector.schema_name) {
    parts.push(selector.schema_name);
  }
  
  if (selector.any_tags && selector.any_tags.length > 0) {
    parts.push(`[${selector.any_tags.slice(0, 2).join(',')}]`);
  }
  
  if (selector.all_tags && selector.all_tags.length > 0) {
    parts.push(`[${selector.all_tags.slice(0, 2).join(',')}]`);
  }
  
  return parts.length > 0 ? parts.join(' ') : 'subscribes';
}

/**
 * Helper to create readable subscription labels (legacy function)
 */
function getSubscriptionLabel(selector: SelectorSubscription['selector']): string {
  return getSubscriptionLabelFromSelector(selector);
}

/**
 * Helper to create readable emission labels
 */
function getEmissionLabel(emits: { tags?: string[]; schemas?: string[] }): string {
  const parts: string[] = [];
  
  if (emits.schemas && emits.schemas.length > 0) {
    parts.push(`${emits.schemas[0]}${emits.schemas.length > 1 ? '...' : ''}`);
  }
  
  if (emits.tags && emits.tags.length > 0) {
    parts.push(`[${emits.tags.slice(0, 2).join(',')}${emits.tags.length > 2 ? '...' : ''}]`);
  }
  
  return parts.length > 0 ? parts.join(' ') : 'emits';
}

// ============ TOOL CONFIG CONNECTIONS ============

function findToolConfigConnections(breadcrumbs: Breadcrumb[], tools: Tool[]): RenderConnection[] {
  const connections: RenderConnection[] = [];
  
  // Find all config breadcrumbs (tool.config.v1 and context.config.v1)
  const configBreadcrumbs = breadcrumbs.filter(b => 
    (b.schema_name === 'tool.config.v1' || b.schema_name === 'context.config.v1') &&
    (b.tags?.includes('tool:config') || b.tags?.includes('context:config'))
  );
  
  console.log(`🔍 Found ${configBreadcrumbs.length} config breadcrumbs`);
  
  configBreadcrumbs.forEach(configBreadcrumb => {
    let toolName: string | undefined;
    
    // Extract tool name from tags or context
    if (configBreadcrumb.schema_name === 'context.config.v1') {
      // For context configs, link to context-builder tool
      toolName = 'context-builder';
    } else {
      // For tool configs, extract from tags like tool:config:openrouter
      toolName = configBreadcrumb.context?.toolName || 
        configBreadcrumb.tags?.find(tag => tag.startsWith('tool:config:'))?.replace('tool:config:', '');
    }
    
    if (toolName) {
      const tool = tools.find(t => t.name === toolName);
      if (tool) {
        connections.push({
          id: `config-${configBreadcrumb.id}-${tool.name}`,
          type: 'tool-execution', // Using existing type
          fromNodeId: tool.name, // Tool ID is the name
          toNodeId: configBreadcrumb.id,
          metadata: {
            label: 'config',
            color: '#9333ea', // Purple for config
            style: 'dashed',
            weight: 2,
          },
          state: {
            visible: true,
            highlighted: false,
          },
        });
        console.log(`  ✅ Tool config: ${tool.name} → ${configBreadcrumb.title}`);
      } else {
        console.log(`  ⚠️ Tool not found for config: ${toolName}`);
      }
    }
  });
  
  return connections;
}

function findToolResponseConnections(breadcrumbs: Breadcrumb[], tools: Tool[]): RenderConnection[] {
  const connections: RenderConnection[] = [];
  
  // Find tool.request.v1 and tool.response.v1 breadcrumbs
  const toolRequests = breadcrumbs.filter(b => b.schema_name === 'tool.request.v1');
  const toolResponses = breadcrumbs.filter(b => 
    b.schema_name === 'tool.response.v1' || 
    b.tags?.includes('tool:response')
  );
  
  console.log(`🔍 Found ${toolRequests.length} tool requests and ${toolResponses.length} tool responses`);
  
  // 1. Connect tool requests to their responses
  toolResponses.forEach(response => {
    const requestId = response.context?.request_id;
    if (requestId) {
      const request = toolRequests.find(r => r.id === requestId);
      if (request) {
        connections.push({
          id: `request-response-${request.id}-${response.id}`,
          type: 'tool-execution',
          fromNodeId: request.id,
          toNodeId: response.id,
          metadata: {
            label: response.context?.tool || 'response',
            color: '#ffa500',
            style: 'solid',
            weight: 2,
            animated: true,
          },
          state: {
            visible: true,
            highlighted: false,
          },
        });
      }
    }
  });
  
  // 2. Connect tools to their response breadcrumbs
  toolResponses.forEach(response => {
    const toolName = response.context?.tool || response.context?.toolName;
    
    if (toolName) {
      const tool = tools.find(t => t.name === toolName);
      if (tool) {
        connections.push({
          id: `tool-creates-${tool.name}-${response.id}`,
          type: 'tool-execution',
          fromNodeId: tool.name, // Tool ID is the name
          toNodeId: response.id,
          metadata: {
            label: 'creates',
            color: '#00ff88', // Green for creation
            style: 'solid',
            weight: 2,
          },
          state: {
            visible: true,
            highlighted: false,
          },
        });
        console.log(`  ✅ Tool creates: ${tool.name} → ${response.title}`);
      }
    }
  });
  
  return connections;
}

// ============ LEGACY CONNECTION DISCOVERY FUNCTIONS ============

function findSecretUsageConnections(breadcrumbs: Breadcrumb[], secrets: Secret[]): RenderConnection[] {
  const connections: RenderConnection[] = [];
  
  // Look for breadcrumbs that reference secrets in their context
  breadcrumbs.forEach(breadcrumb => {
    if (breadcrumb.context) {
      // Check for secret IDs in the context
      const contextStr = JSON.stringify(breadcrumb.context);
      secrets.forEach(secret => {
        if (contextStr.includes(secret.id)) {
          connections.push({
            id: `secret-usage-${secret.id}-${breadcrumb.id}`,
            type: 'secret-usage',
            fromNodeId: secret.id,
            toNodeId: breadcrumb.id,
            metadata: {
              label: '',
              color: '#ff6b6b',
              style: 'dotted',
              weight: 1,
            },
            state: {
              visible: true,
              highlighted: false,
            },
          });
        }
      });
    }
  });
  
  return connections;
}

function findToolExecutionConnections(breadcrumbs: Breadcrumb[], tools: Tool[]): RenderConnection[] {
  const connections: RenderConnection[] = [];
  
  // Find tool request and response breadcrumbs
  const toolRequests = breadcrumbs.filter(b => b.schema_name === 'tool.request.v1');
  const toolResponses = breadcrumbs.filter(b => b.schema_name === 'tool.response.v1');
  
  console.log(`🔍 Tool execution analysis:`, {
    toolRequests: toolRequests.length,
    toolResponses: toolResponses.length,
    availableTools: tools.length
  });
  
  // Debug: Show tool requests and responses
  toolRequests.forEach((req, i) => {
    console.log(`  Request ${i + 1}: "${req.title}" - tool: ${req.context?.tool}, schema: ${req.schema_name}`);
  });
  toolResponses.forEach((res, i) => {
    console.log(`  Response ${i + 1}: "${res.title}" - request_id: ${res.context?.request_id}, tool: ${res.context?.tool}`);
  });
  
  // 1. Connect tool requests to their responses
  toolRequests.forEach(request => {
    const response = toolResponses.find(r => 
      r.context?.request_id === request.id
    );
    
    if (response) {
      connections.push({
        id: `tool-execution-${request.id}-${response.id}`,
        type: 'tool-execution',
        fromNodeId: request.id,
        toNodeId: response.id,
        metadata: {
          label: 'response',
          color: '#00ff88',
          style: 'solid',
          weight: 3,
        },
        state: {
          visible: true,
          highlighted: false,
        },
      });
      console.log(`🔗 Connected request "${request.title}" → response "${response.title}"`);
    }
  });
  
  // 2. Connect tools to their requests (tool receives request)
  toolRequests.forEach(request => {
    const toolName = request.context?.tool;
    if (toolName) {
      const tool = tools.find(t => t.name === toolName);
      if (tool) {
        connections.push({
          id: `tool-receives-${tool.id}-${request.id}`,
          type: 'tool-request',
          fromNodeId: tool.id,
          toNodeId: request.id,
          metadata: {
            label: 'receives',
            color: '#ffa500',
            style: 'solid',
            weight: 2,
          },
          state: {
            visible: true,
            highlighted: false,
          },
        });
        console.log(`🔗 Connected tool "${tool.name}" → request "${request.title}"`);
      }
    }
  });
  
  // 3. Connect tools to their responses (tool produces response)
  toolResponses.forEach(response => {
    const toolName = response.context?.tool;
    if (toolName) {
      const tool = tools.find(t => t.name === toolName);
      if (tool) {
        connections.push({
          id: `tool-produces-${tool.id}-${response.id}`,
          type: 'tool-response',
          fromNodeId: tool.id,
          toNodeId: response.id,
          metadata: {
            label: 'produces',
            color: '#00ff88',
            style: 'solid',
            weight: 2,
          },
          state: {
            visible: true,
            highlighted: false,
          },
        });
        console.log(`🔗 Connected tool "${tool.name}" → response "${response.title}"`);
      }
    }
  });
  
  // 4. Connect any breadcrumb that mentions a tool name in context
  tools.forEach(tool => {
    breadcrumbs.forEach(breadcrumb => {
      if (breadcrumb.context && breadcrumb.id !== tool.id) {
        const contextStr = JSON.stringify(breadcrumb.context).toLowerCase();
        // Check if this breadcrumb mentions the tool
        if (contextStr.includes(tool.name.toLowerCase()) || 
            contextStr.includes(`"tool":"${tool.name}"`) ||
            contextStr.includes(`"tool_name":"${tool.name}"`)) {
          
          // Skip if we already have a more specific connection
          const hasSpecificConnection = connections.some(c => 
            (c.fromNodeId === tool.id && c.toNodeId === breadcrumb.id) ||
            (c.fromNodeId === breadcrumb.id && c.toNodeId === tool.id)
          );
          
          if (!hasSpecificConnection) {
            connections.push({
              id: `tool-related-${tool.id}-${breadcrumb.id}`,
              type: 'tool-related',
              fromNodeId: tool.id,
              toNodeId: breadcrumb.id,
              metadata: {
                label: '', // No label for cleaner look
                color: '#888888',
                style: 'dotted',
                weight: 1,
              },
              state: {
                visible: true,
                highlighted: false,
              },
            });
            console.log(`🔗 Connected tool "${tool.name}" → related breadcrumb "${breadcrumb.title}"`);
          }
        }
      }
    });
  });
  
  return connections;
}


// ============ UTILITY FUNCTIONS ============
