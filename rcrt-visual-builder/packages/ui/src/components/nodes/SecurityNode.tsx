import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';

export const SecurityNodeComponent = memo<NodeProps>(({ id, data, selected, isConnectable }) => (
  <BaseNode id={id} selected={selected} icon="🔐" title="Security" color="#dc2626">
    <Handle type="target" position={Position.Left} id="request" style={{ background: '#dc2626', width: 12, height: 12, left: -6 }} isConnectable={isConnectable} />
    <Handle type="source" position={Position.Right} id="credentials" style={{ background: '#17c964', width: 12, height: 12, right: -6, top: '40%' }} isConnectable={isConnectable} />
    <Handle type="source" position={Position.Right} id="passthrough" style={{ background: '#52525b', width: 12, height: 12, right: -6, top: '60%' }} isConnectable={isConnectable} />
    <div style={{ padding: '8px 12px' }}><div style={{ fontSize: '0.8rem', color: '#666' }}>Secrets Provider</div></div>
  </BaseNode>
));
