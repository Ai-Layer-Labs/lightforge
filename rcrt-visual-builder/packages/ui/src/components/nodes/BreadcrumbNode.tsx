/**
 * Unified Breadcrumb Node Component
 * Single node for ALL RCRT operations - no fallbacks, no separate role nodes!
 */

import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { Badge, Modal, Select, Input, Textarea } from '@heroui/react';

export interface BreadcrumbNodeData {
  operation?: 'create' | 'read' | 'update' | 'delete' | 'search' | 'vector_search' | 'subscribe';
  workspace?: string;
  agent_roles?: string[];
  default_schema?: string;
  search_limit?: number;
}

const OPERATION_CONFIG = {
  create: { icon: '➕', color: '#17c964', role: 'emitter' },
  read: { icon: '👁️', color: '#0072f5', role: null },
  update: { icon: '✏️', color: '#f5a524', role: 'curator' },
  delete: { icon: '🗑️', color: '#f31260', role: 'curator' },
  search: { icon: '🔎', color: '#0072f5', role: null },
  vector_search: { icon: '🧲', color: '#9353d3', role: null },
  subscribe: { icon: '📥', color: '#7828c8', role: 'subscriber' },
};

export const BreadcrumbNodeComponent = memo<NodeProps<BreadcrumbNodeData>>(({ 
  id, 
  data, 
  selected,
  isConnectable 
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [nodeData, setNodeData] = useState<BreadcrumbNodeData>(data);
  
  const operation = nodeData.operation || 'read';
  const config = OPERATION_CONFIG[operation];
  
  const handleSave = () => {
    data = nodeData;
    setShowConfig(false);
  };

  return (
    <>
      <BaseNode
        id={id}
        selected={selected}
        icon="📝"
        title="Breadcrumb"
        color="#0072f5"
        onDoubleClick={() => setShowConfig(true)}
      >
        {/* Universal input handles */}
        <Handle
          type="target"
          position={Position.Left}
          id="trigger"
          style={{ background: '#f5a524', width: 12, height: 12, left: -6, top: '25%' }}
          isConnectable={isConnectable}
        />
        <Handle
          type="target"
          position={Position.Left}
          id="data"
          style={{ background: '#0072f5', width: 12, height: 12, left: -6, top: '50%' }}
          isConnectable={isConnectable}
        />
        <Handle
          type="target"
          position={Position.Left}
          id="query"
          style={{ background: '#9353d3', width: 12, height: 12, left: -6, top: '75%' }}
          isConnectable={isConnectable}
        />

        {/* Universal output handles */}
        <Handle
          type="source"
          position={Position.Right}
          id="result"
          style={{ background: '#17c964', width: 12, height: 12, right: -6, top: '30%' }}
          isConnectable={isConnectable}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="context"
          style={{ background: '#0072f5', width: 12, height: 12, right: -6, top: '50%' }}
          isConnectable={isConnectable}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="events"
          style={{ background: '#f5a524', width: 12, height: 12, right: -6, top: '70%' }}
          isConnectable={isConnectable}
        />

        {/* Node content */}
        <div style={{ padding: '8px 12px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            marginBottom: '4px'
          }}>
            <span style={{ fontSize: '1rem' }}>{config.icon}</span>
            <Badge 
              size="sm" 
              variant="flat" 
              style={{ backgroundColor: `${config.color}20`, color: config.color }}
            >
              {operation.toUpperCase()}
            </Badge>
          </div>
          
          {config.role && (
            <div style={{ fontSize: '0.7rem', color: '#888' }}>
              Requires: {config.role}
            </div>
          )}
        </div>
      </BaseNode>

      {/* Configuration Modal */}
      <Modal
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        size="xl"
      >
        <Modal.Header>
          <h3>📝 Configure Breadcrumb Node</h3>
        </Modal.Header>
        <Modal.Body>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Select
              label="Operation"
              placeholder="Select operation"
              value={nodeData.operation}
              onChange={(e) => setNodeData({ ...nodeData, operation: e.target.value as any })}
              description="All RCRT operations in one node - no fallbacks!"
            >
              <Select.Option value="create">➕ Create - Emit new breadcrumb</Select.Option>
              <Select.Option value="read">👁️ Read - Get breadcrumb by ID</Select.Option>
              <Select.Option value="update">✏️ Update - Modify existing</Select.Option>
              <Select.Option value="delete">🗑️ Delete - Remove breadcrumb</Select.Option>
              <Select.Option value="search">🔎 Search - Query breadcrumbs</Select.Option>
              <Select.Option value="vector_search">🧲 Vector Search - Semantic search</Select.Option>
              <Select.Option value="subscribe">📥 Subscribe - SSE events</Select.Option>
            </Select>
            
            {(operation === 'create' || operation === 'update') && (
              <Input
                label="Default Schema"
                placeholder="generic.v1"
                value={nodeData.default_schema}
                onChange={(e) => setNodeData({ ...nodeData, default_schema: e.target.value })}
              />
            )}
            
            {(operation === 'search' || operation === 'vector_search') && (
              <Input
                type="number"
                label="Search Limit"
                placeholder="10"
                value={String(nodeData.search_limit || 10)}
                onChange={(e) => setNodeData({ ...nodeData, search_limit: parseInt(e.target.value) })}
              />
            )}
            
            {OPERATION_CONFIG[operation].role && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  Required Role: <Badge color="warning">{OPERATION_CONFIG[operation].role}</Badge>
                </label>
                <p style={{ fontSize: '0.8rem', color: '#888' }}>
                  Make sure the connected agent has this role
                </p>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button onClick={() => setShowConfig(false)}>Cancel</button>
          <button onClick={handleSave} style={{ color: '#0072f5' }}>
            Save Configuration
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
});