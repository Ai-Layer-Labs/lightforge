import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';

export const SearchNodeComponent = memo<NodeProps>(({ id, data, selected, isConnectable }) => (
  <BaseNode id={id} selected={selected} icon="🔍" title="Search" color="#fb542b">
    <Handle type="target" position={Position.Left} id="query" style={{ background: '#fb542b', width: 12, height: 12, left: -6, top: '30%' }} isConnectable={isConnectable} />
    <Handle type="target" position={Position.Left} id="credentials" style={{ background: '#dc2626', width: 12, height: 12, left: -6, top: '50%' }} isConnectable={isConnectable} />
    <Handle type="target" position={Position.Left} id="options" style={{ background: '#52525b', width: 12, height: 12, left: -6, top: '70%' }} isConnectable={isConnectable} />
    <Handle type="source" position={Position.Right} id="results" style={{ background: '#17c964', width: 12, height: 12, right: -6, top: '40%' }} isConnectable={isConnectable} />
    <Handle type="source" position={Position.Right} id="metadata" style={{ background: '#9353d3', width: 12, height: 12, right: -6, top: '60%' }} isConnectable={isConnectable} />
    <div style={{ padding: '8px 12px' }}><div style={{ fontSize: '0.8rem', color: '#666' }}>Brave Search</div></div>
  </BaseNode>
));
