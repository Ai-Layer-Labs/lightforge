import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';

export const ObservabilityNodeComponent = memo<NodeProps>(({ id, data, selected, isConnectable }) => (
  <BaseNode id={id} selected={selected} icon="📊" title="Observability" color="#8b5cf6">
    <Handle type="target" position={Position.Left} id="trace_data" style={{ background: '#8b5cf6', width: 12, height: 12, left: -6, top: '30%' }} isConnectable={isConnectable} />
    <Handle type="target" position={Position.Left} id="metadata" style={{ background: '#52525b', width: 12, height: 12, left: -6, top: '50%' }} isConnectable={isConnectable} />
    <Handle type="target" position={Position.Left} id="credentials" style={{ background: '#dc2626', width: 12, height: 12, left: -6, top: '70%' }} isConnectable={isConnectable} />
    <Handle type="source" position={Position.Right} id="trace_id" style={{ background: '#17c964', width: 12, height: 12, right: -6, top: '30%' }} isConnectable={isConnectable} />
    <Handle type="source" position={Position.Right} id="passthrough" style={{ background: '#52525b', width: 12, height: 12, right: -6, top: '50%' }} isConnectable={isConnectable} />
    <Handle type="source" position={Position.Right} id="trace_url" style={{ background: '#0072f5', width: 12, height: 12, right: -6, top: '70%' }} isConnectable={isConnectable} />
    <div style={{ padding: '8px 12px' }}><div style={{ fontSize: '0.8rem', color: '#666' }}>Langfuse</div></div>
  </BaseNode>
));
