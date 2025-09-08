/**
 * Agent Node Component
 * Visual representation of agent nodes
 */

import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, Badge, Modal, Input, Textarea, Select, Chip } from '@heroui/react';
import { BaseNode } from './BaseNode';

export interface AgentNodeData {
  agent_id?: string;
  model?: string;
  system_prompt?: string;
  subscriptions?: any[];
  capabilities?: {
    can_create_breadcrumbs?: boolean;
    can_update_own?: boolean;
    can_delete_own?: boolean;
    can_spawn_agents?: boolean;
  };
  workspace?: string;
}

export const AgentNodeComponent = memo<NodeProps<AgentNodeData>>(({ 
  id, 
  data, 
  selected,
  isConnectable 
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [nodeData, setNodeData] = useState<AgentNodeData>(data);
  
  const handleSave = () => {
    data = nodeData;
    setShowConfig(false);
  };

  return (
    <>
      <BaseNode
        id={id}
        selected={selected}
        icon="🤖"
        title="Agent"
        color="#7828c8"
        onDoubleClick={() => setShowConfig(true)}
      >
        {/* Input handle - trigger */}
        <Handle
          type="target"
          position={Position.Left}
          id="trigger"
          style={{ 
            background: '#f5a524',
            width: 12,
            height: 12,
            left: -6
          }}
          isConnectable={isConnectable}
        />

        {/* Output handles */}
        <Handle
          type="source"
          position={Position.Right}
          id="emitter"
          style={{ 
            background: '#17c964',
            width: 12,
            height: 12,
            right: -6,
            top: '40%'
          }}
          isConnectable={isConnectable}
        />
        
        <Handle
          type="source"
          position={Position.Right}
          id="curator"
          style={{ 
            background: '#f31260',
            width: 12,
            height: 12,
            right: -6,
            top: '60%'
          }}
          isConnectable={isConnectable && nodeData.capabilities?.can_delete_own}
        />

        {/* Node content */}
        <div style={{ padding: '8px 12px' }}>
          <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>
            {nodeData.agent_id || 'agent-unnamed'}
          </div>
          
          {nodeData.model && (
            <div style={{ fontSize: '0.75rem', color: '#888' }}>
              {nodeData.model.split('/').pop()}
            </div>
          )}
          
          {nodeData.subscriptions && nodeData.subscriptions.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              <Badge size="sm" variant="flat" color="secondary">
                {nodeData.subscriptions.length} subscriptions
              </Badge>
            </div>
          )}
          
          {/* Capabilities badges */}
          <div style={{ display: 'flex', gap: '2px', marginTop: '4px', flexWrap: 'wrap' }}>
            {nodeData.capabilities?.can_spawn_agents && (
              <Chip size="sm" color="success" variant="dot">Spawner</Chip>
            )}
            {nodeData.capabilities?.can_delete_own && (
              <Chip size="sm" color="danger" variant="dot">Curator</Chip>
            )}
          </div>
        </div>
      </BaseNode>

      {/* Configuration Modal */}
      <Modal
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        size="2xl"
      >
        <Modal.Header>
          <h3>🤖 Configure Agent Node</h3>
        </Modal.Header>
        <Modal.Body>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Input
              label="Agent ID"
              placeholder="agent.researcher"
              value={nodeData.agent_id}
              onChange={(e) => setNodeData({ ...nodeData, agent_id: e.target.value })}
            />
            
            <Select
              label="Model"
              placeholder="Select model"
              value={nodeData.model}
              onChange={(e) => setNodeData({ ...nodeData, model: e.target.value })}
            >
              <Select.Option value="openrouter/anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</Select.Option>
              <Select.Option value="openrouter/openai/gpt-4o">GPT-4o</Select.Option>
              <Select.Option value="openrouter/openai/gpt-4o-mini">GPT-4o Mini</Select.Option>
            </Select>
            
            <Textarea
              label="System Prompt"
              placeholder="You are a helpful assistant..."
              value={nodeData.system_prompt}
              onChange={(e) => setNodeData({ ...nodeData, system_prompt: e.target.value })}
              minRows={3}
            />
            
            <div>
              <label>Capabilities</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={nodeData.capabilities?.can_create_breadcrumbs}
                    onChange={(e) => setNodeData({
                      ...nodeData,
                      capabilities: {
                        ...nodeData.capabilities,
                        can_create_breadcrumbs: e.target.checked
                      }
                    })}
                  />
                  Can create breadcrumbs
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={nodeData.capabilities?.can_spawn_agents}
                    onChange={(e) => setNodeData({
                      ...nodeData,
                      capabilities: {
                        ...nodeData.capabilities,
                        can_spawn_agents: e.target.checked
                      }
                    })}
                  />
                  Can spawn other agents
                </label>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button onClick={() => setShowConfig(false)}>Cancel</button>
          <button onClick={handleSave}>Save</button>
        </Modal.Footer>
      </Modal>
    </>
  );
});
