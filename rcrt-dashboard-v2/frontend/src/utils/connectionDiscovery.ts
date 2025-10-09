/**
 * THE RCRT WAY - Clean Connection Discovery
 * Discovers and creates connections based on breadcrumb relationships
 * NO LEGACY CODE - Clean implementation following RCRT principles
 */

import { Breadcrumb, Agent, Tool } from '../types/rcrt';
import { RenderConnection } from '../types/rcrt';
import { CONNECTION_STYLES, ConnectionType } from './connectionTypes';
import { matchesSelector } from './selectorMatching';

export interface ConnectionDiscoveryInput {
  breadcrumbs: Breadcrumb[];
  agents: Agent[];
  tools?: Tool[];
}

/**
 * THE RCRT WAY - Discover all connections
 * Returns ONLY the 4 canonical connection types
 */
export function discoverConnections(data: ConnectionDiscoveryInput): RenderConnection[] {
  const connections: RenderConnection[] = [];
  
  console.log('🔗 [RCRT Way] Connection discovery starting...');
  console.log(`📊 Data: ${data.breadcrumbs.length} breadcrumbs, ${data.agents.length} agents, ${data.tools?.length || 0} tools`);
  
  // 1. Creates connections (green, solid)
  const createsConns = findCreatesConnections(data.breadcrumbs, data.agents);
  connections.push(...createsConns);
  console.log(`✅ Creates: ${createsConns.length}`);
  
  // 2. Config connections (purple, dashed)
  const configConns = findConfigConnections(data.breadcrumbs, data.tools || []);
  connections.push(...configConns);
  console.log(`✅ Config: ${configConns.length}`);
  
  // 3. Subscribed connections (blue, dotted)
  const subscribedConns = findSubscribedConnections(data.breadcrumbs);
  connections.push(...subscribedConns);
  console.log(`✅ Subscribed: ${subscribedConns.length}`);
  
  // 4. Triggered connections (blue, solid)
  const triggeredConns = findTriggeredConnections(data.breadcrumbs);
  connections.push(...triggeredConns);
  console.log(`✅ Triggered: ${triggeredConns.length}`);
  
  console.log(`🎯 Total connections: ${connections.length}`);
  return connections;
}

/**
 * Find "creates" connections: Agent/Tool → Breadcrumb
 * Green, solid line
 */
function findCreatesConnections(breadcrumbs: Breadcrumb[], agents: Agent[]): RenderConnection[] {
  const connections: RenderConnection[] = [];
  const style = CONNECTION_STYLES.creates;
  
  breadcrumbs.forEach(breadcrumb => {
    if (!breadcrumb.created_by) return;
    
    // Check if created by an agent
    const agent = agents.find(a => a.id === breadcrumb.created_by);
    if (agent) {
      connections.push(createConnection(
        'creates',
        agent.id,
        breadcrumb.id,
        style
      ));
    }
  });
  
  return connections;
}

/**
 * Find "config" connections: Tool → Config Breadcrumb
 * Purple, dashed line
 */
function findConfigConnections(breadcrumbs: Breadcrumb[], tools: Tool[]): RenderConnection[] {
  const connections: RenderConnection[] = [];
  const style = CONNECTION_STYLES.config;
  
  // Find config breadcrumbs
  const configBreadcrumbs = breadcrumbs.filter(b => 
    b.schema_name === 'tool.config.v1' || 
    b.schema_name === 'context.config.v1'
  );
  
  configBreadcrumbs.forEach(config => {
    // Extract tool name from context or tags
    let toolName: string | undefined;
    
    if (config.schema_name === 'context.config.v1') {
      toolName = 'context-builder';
    } else {
      toolName = config.context?.toolName || 
        config.tags?.find(tag => tag.startsWith('tool:config:'))?.replace('tool:config:', '');
    }
    
    if (toolName) {
      const tool = tools.find(t => t.name === toolName);
      if (tool) {
        // Tool → Config (tool uses/reads config)
        connections.push(createConnection(
          'config',
          tool.name,
          config.id,
          style
        ));
      }
    }
  });
  
  return connections;
}

/**
 * Find "subscribed" connections: Breadcrumb → Agent
 * Blue, dotted line
 * For selectors with role != "trigger"
 */
function findSubscribedConnections(breadcrumbs: Breadcrumb[]): RenderConnection[] {
  const connections: RenderConnection[] = [];
  const style = CONNECTION_STYLES.subscribed;
  
  // Find agent definition breadcrumbs
  const agentDefs = breadcrumbs.filter(b => b.schema_name === 'agent.def.v1');
  
  agentDefs.forEach(agentDef => {
    const agentId = agentDef.context?.agent_id;
    if (!agentId) return;
    
    // Get selectors with role != "trigger" (or no role)
    const selectors = agentDef.context?.subscriptions?.selectors || [];
    const subscribedSelectors = selectors.filter((sel: any) => 
      sel.role !== 'trigger'
    );
    
    subscribedSelectors.forEach((selector: any) => {
      // Find matching breadcrumbs
      const matches = breadcrumbs.filter(b => {
        // Don't connect to self
        if (b.id === agentDef.id || b.created_by === agentId) return false;
        return matchesSelector(b, selector);
      });
      
      matches.forEach(breadcrumb => {
        connections.push(createConnection(
          'subscribed',
          breadcrumb.id,
          agentDef.id,
          style
        ));
      });
    });
  });
  
  return connections;
}

/**
 * Find "triggered" connections: Breadcrumb → Agent
 * Blue, solid line (thicker than subscribed)
 * For selectors with role === "trigger"
 */
function findTriggeredConnections(breadcrumbs: Breadcrumb[]): RenderConnection[] {
  const connections: RenderConnection[] = [];
  const style = CONNECTION_STYLES.triggered;
  
  // Find agent definition breadcrumbs
  const agentDefs = breadcrumbs.filter(b => b.schema_name === 'agent.def.v1');
  
  agentDefs.forEach(agentDef => {
    const agentId = agentDef.context?.agent_id;
    if (!agentId) return;
    
    // Get selectors with role === "trigger"
    const selectors = agentDef.context?.subscriptions?.selectors || [];
    const triggerSelectors = selectors.filter((sel: any) => 
      sel.role === 'trigger'
    );
    
    triggerSelectors.forEach((selector: any) => {
      // Find matching breadcrumbs
      const matches = breadcrumbs.filter(b => {
        // Don't connect to self
        if (b.id === agentDef.id || b.created_by === agentId) return false;
        return matchesSelector(b, selector);
      });
      
      matches.forEach(breadcrumb => {
        connections.push(createConnection(
          'triggered',
          breadcrumb.id,
          agentDef.id,
          style
        ));
      });
    });
  });
  
  return connections;
}

/**
 * Helper: Create a connection object
 */
function createConnection(
  type: ConnectionType,
  fromId: string,
  toId: string,
  style: typeof CONNECTION_STYLES[ConnectionType]
): RenderConnection {
  return {
    id: `${type}-${fromId}-${toId}`,
    type,
    fromNodeId: fromId,
    toNodeId: toId,
    metadata: {
      label: style.label,
      color: style.color,
      style: style.style,
      weight: style.weight,
      animated: type === 'triggered', // Animate trigger connections
    },
    state: {
      visible: true,
      highlighted: false,
    },
  };
}

