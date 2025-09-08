import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';

export const UtilityNodeComponent = memo<NodeProps>(({ id, data, selected, isConnectable }) => (
  <BaseNode id={id} selected={selected} icon="🔧" title="Utility" color="#52525b">
    <Handle type="target" position={Position.Left} id="input" style={{ background: '#52525b', width: 12, height: 12, left: -6 }} isConnectable={isConnectable} />
    <Handle type="source" position={Position.Right} id="output" style={{ background: '#52525b', width: 12, height: 12, right: -6 }} isConnectable={isConnectable} />
    <div style={{ padding: '8px 12px' }}><div style={{ fontSize: '0.8rem', color: '#666' }}>{data.type || 'Transformer'}</div></div>
  </BaseNode>
));
