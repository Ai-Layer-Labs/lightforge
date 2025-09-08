import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';

export const DatabaseNodeComponent = memo<NodeProps>(({ id, data, selected, isConnectable }) => (
  <BaseNode id={id} selected={selected} icon="🐘" title="Database" color="#336791">
    <Handle type="target" position={Position.Left} id="query" style={{ background: '#336791', width: 12, height: 12, left: -6, top: '30%' }} isConnectable={isConnectable} />
    <Handle type="target" position={Position.Left} id="params" style={{ background: '#52525b', width: 12, height: 12, left: -6, top: '50%' }} isConnectable={isConnectable} />
    <Handle type="target" position={Position.Left} id="credentials" style={{ background: '#dc2626', width: 12, height: 12, left: -6, top: '70%' }} isConnectable={isConnectable} />
    <Handle type="source" position={Position.Right} id="results" style={{ background: '#17c964', width: 12, height: 12, right: -6, top: '40%' }} isConnectable={isConnectable} />
    <Handle type="source" position={Position.Right} id="row_count" style={{ background: '#52525b', width: 12, height: 12, right: -6, top: '60%' }} isConnectable={isConnectable} />
    <div style={{ padding: '8px 12px' }}><div style={{ fontSize: '0.8rem', color: '#666' }}>PostgreSQL</div></div>
  </BaseNode>
));
