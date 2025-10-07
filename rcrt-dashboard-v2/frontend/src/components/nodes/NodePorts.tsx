/**
 * Node Ports Component
 * Renders I/O ports on nodes to visualize data flow
 */

import React from 'react';
import { RenderNode } from '../../types/rcrt';
import { extractPorts } from '../../utils/portExtractor';

interface NodePortsProps {
  node: RenderNode;
  view: '2d' | '3d';
}

export function NodePorts({ node, view }: NodePortsProps) {
  const ports = extractPorts(node);
  
  if (!ports.inputs.length && !ports.outputs.length) return null;
  
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Input Ports (Top and Left) */}
      <div className="absolute top-0 left-0 right-0 flex justify-center gap-1 -translate-y-full pb-1">
        {ports.inputs
          .filter(p => p.position === 'top')
          .map(port => (
            <div
              key={port.id}
              className="port-indicator pointer-events-auto group relative"
              title={port.label}
            >
              <div
                className="w-3 h-3 flex items-center justify-center text-[8px] font-bold transition-all cursor-help hover:scale-125"
                style={{
                  backgroundColor: port.color,
                  borderRadius: port.role === 'trigger' ? '50%' : '4px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  boxShadow: port.role === 'trigger' 
                    ? `0 0 8px ${port.color}` 
                    : 'none'
                }}
              >
                {port.role === 'trigger' ? '▶' : '◀'}
              </div>
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {port.schema_name}
                <div className="text-gray-400 text-[10px]">
                  {port.role === 'trigger' ? '🔴 Trigger' : '📥 Context'}
                </div>
              </div>
            </div>
          ))}
      </div>
      
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-1 flex flex-col gap-1">
        {ports.inputs
          .filter(p => p.position === 'left')
          .map(port => (
            <div
              key={port.id}
              className="port-indicator pointer-events-auto group relative"
              title={port.label}
            >
              <div
                className="w-3 h-3 flex items-center justify-center text-[8px] font-bold transition-all cursor-help hover:scale-125"
                style={{
                  backgroundColor: port.color,
                  borderRadius: '4px',
                  border: '2px solid rgba(255,255,255,0.3)'
                }}
              >
                ◀
              </div>
              
              {/* Tooltip */}
              <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {port.schema_name}
                <div className="text-gray-400 text-[10px]">📥 Context</div>
              </div>
            </div>
          ))}
      </div>
      
      {/* Output Ports (Bottom and Right) */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1 translate-y-full pt-1">
        {ports.outputs
          .filter(p => p.position === 'bottom')
          .map(port => (
            <div
              key={port.id}
              className="port-indicator pointer-events-auto group relative"
              title={port.label}
            >
              <div
                className="w-3 h-3 flex items-center justify-center text-[8px] font-bold transition-all cursor-help hover:scale-125"
                style={{
                  backgroundColor: port.color,
                  borderRadius: '4px',
                  border: '2px solid rgba(255,255,255,0.3)'
                }}
              >
                ▼
              </div>
              
              {/* Tooltip */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {port.schema_name}
                <div className="text-gray-400 text-[10px]">📤 Output</div>
              </div>
            </div>
          ))}
      </div>
      
      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full pl-1 flex flex-col gap-1">
        {ports.outputs
          .filter(p => p.position === 'right')
          .map(port => (
            <div
              key={port.id}
              className="port-indicator pointer-events-auto group relative"
              title={port.label}
            >
              <div
                className="w-3 h-3 flex items-center justify-center text-[8px] font-bold transition-all cursor-help hover:scale-125"
                style={{
                  backgroundColor: port.color,
                  borderRadius: '4px',
                  border: '2px solid rgba(255,255,255,0.3)'
                }}
              >
                ▶
              </div>
              
              {/* Tooltip */}
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {port.schema_name}
                <div className="text-gray-400 text-[10px]">📤 Output</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
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
