/**
 * Port Extractor - Extract I/O ports from breadcrumbs
 * Makes the universal executor architecture visible
 */

import { RenderNode, Breadcrumb } from '../types/rcrt';

export interface NodePort {
  id: string;
  type: 'input' | 'output';
  schema_name: string;
  role?: 'trigger' | 'context';
  key?: string;
  tags?: string[];
  position: 'top' | 'bottom' | 'left' | 'right';
  color: string;
  label: string;
}

export interface NodePorts {
  inputs: NodePort[];
  outputs: NodePort[];
}

const PORT_COLORS = {
  trigger_input: '#ff6b6b',    // Red - active trigger
  context_input: '#4ECDC4',    // Teal - passive context
  response: '#FFD93D',         // Yellow - outputs
  emit: '#95E1D3'              // Green - emissions
};

/**
 * Extract I/O ports from any node
 */
export function extractPorts(node: RenderNode): NodePorts {
  const inputs: NodePort[] = [];
  const outputs: NodePort[] = [];
  
  // Agent Definition Nodes
  if (node.type === 'agent-definition' && node.data.schema_name === 'agent.def.v1') {
    const context = (node.data as Breadcrumb).context;
    
    // INPUT PORTS: From subscriptions
    const subscriptions = context.subscriptions?.selectors || [];
    subscriptions.forEach((sub: any, index: number) => {
      const role = sub.role || inferRole(sub.schema_name);
      
      inputs.push({
        id: `input-${index}`,
        type: 'input',
        schema_name: sub.schema_name,
        role: role,
        key: sub.key,
        tags: sub.any_tags || sub.all_tags,
        position: role === 'trigger' ? 'top' : 'left',
        color: role === 'trigger' ? PORT_COLORS.trigger_input : PORT_COLORS.context_input,
        label: `${sub.schema_name} (${role})`
      });
    });
    
    // OUTPUT PORTS: From capabilities
    outputs.push({
      id: 'output-0',
      type: 'output',
      schema_name: 'agent.response.v1',
      position: 'bottom',
      color: PORT_COLORS.response,
      label: 'agent.response.v1'
    });
    
    if (context.capabilities?.can_create_breadcrumbs) {
      outputs.push({
        id: 'output-1',
        type: 'output',
        schema_name: 'tool.request.v1',
        position: 'right',
        color: PORT_COLORS.emit,
        label: 'tool.request.v1'
      });
    }
  }
  
  // Tool Nodes
  if (node.type === 'tool' && node.data.schema_name === 'tool.v1') {
    const context = (node.data as Breadcrumb).context;
    
    // INPUT PORTS
    inputs.push({
      id: 'input-0',
      type: 'input',
      schema_name: 'tool.request.v1',
      role: 'trigger',
      position: 'top',
      color: PORT_COLORS.trigger_input,
      label: 'tool.request.v1'
    });
    
    // Additional subscriptions (context inputs)
    const subscriptions = context.subscriptions?.selectors || [];
    subscriptions.forEach((sub: any, index: number) => {
      inputs.push({
        id: `input-${index + 1}`,
        type: 'input',
        schema_name: sub.schema_name,
        role: sub.role || 'context',
        position: 'left',
        color: PORT_COLORS.context_input,
        label: sub.schema_name
      });
    });
    
    // OUTPUT PORTS
    outputs.push({
      id: 'output-0',
      type: 'output',
      schema_name: 'tool.response.v1',
      position: 'bottom',
      color: PORT_COLORS.response,
      label: 'tool.response.v1'
    });
  }
  
  // Context Config Nodes
  if (node.data.schema_name === 'context.config.v1') {
    const context = (node.data as Breadcrumb).context;
    
    // INPUT PORTS: From sources
    const sources = context.sources || [];
    sources.forEach((source: any, index: number) => {
      inputs.push({
        id: `input-${index}`,
        type: 'input',
        schema_name: source.schema_name,
        role: 'context',
        position: 'left',
        color: PORT_COLORS.context_input,
        label: `${source.schema_name} (${source.method})`
      });
    });
    
    // OUTPUT PORTS: From output config
    if (context.output) {
      outputs.push({
        id: 'output-0',
        type: 'output',
        schema_name: context.output.schema_name,
        position: 'bottom',
        color: PORT_COLORS.emit,
        label: context.output.schema_name
      });
    }
  }
  
  return { inputs, outputs };
}

function inferRole(schema: string): 'trigger' | 'context' {
  const triggers = [
    'user.message.v1',
    'agent.context.v1',
    'tool.request.v1',
    'system.message.v1'
  ];
  return triggers.includes(schema) ? 'trigger' : 'context';
}

/**
 * Generate port-based connections
 */
export function generatePortConnections(nodes: RenderNode[]): Array<{
  from: string;
  to: string;
  fromPort: string;
  toPort: string;
  schema: string;
  role: 'trigger' | 'context';
}> {
  const connections = [];
  
  // Extract ports for all nodes
  const nodesWithPorts = nodes.map(n => ({
    node: n,
    ports: extractPorts(n)
  }));
  
  // For each node with inputs
  for (const { node: toNode, ports: toPorts } of nodesWithPorts) {
    for (const inputPort of toPorts.inputs) {
      // Find nodes with matching output
      for (const { node: fromNode, ports: fromPorts } of nodesWithPorts) {
        const outputPort = fromPorts.outputs.find(p => 
          p.schema_name === inputPort.schema_name
        );
        
        if (outputPort) {
          connections.push({
            from: fromNode.id,
            to: toNode.id,
            fromPort: outputPort.id,
            toPort: inputPort.id,
            schema: inputPort.schema_name,
            role: inputPort.role || 'context'
          });
        }
      }
    }
  }
  
  return connections;
}
