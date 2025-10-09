/**
 * THE RCRT WAY - 2D Connection Rendering
 * Clean implementation using canonical connection types
 */

import React from 'react';
import { motion } from 'framer-motion';
import { RenderConnection, RenderNode } from '../../types/rcrt';
import { getStrokeDashArray } from '../../utils/connectionTypes';

interface Connection2DProps {
  connection: RenderConnection;
  nodes: RenderNode[];
}

export function Connection2D({ connection, nodes }: Connection2DProps) {
  // Don't render if not visible
  if (!connection.state.visible) return null;
  
  // Find the connected nodes
  const fromNode = nodes.find(n => n.id === connection.fromNodeId);
  const toNode = nodes.find(n => n.id === connection.toNodeId);
  
  if (!fromNode || !toNode) return null;
  
  // Don't render if either node is filtered
  if (fromNode.state.filtered || toNode.state.filtered) return null;
  
  // Calculate connection path
  const fromCenter = {
    x: fromNode.position.x + fromNode.metadata.size.width / 2,
    y: fromNode.position.y + fromNode.metadata.size.height / 2,
  };
  
  const toCenter = {
    x: toNode.position.x + toNode.metadata.size.width / 2,
    y: toNode.position.y + toNode.metadata.size.height / 2,
  };
  
  // Calculate curve for smooth connections
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Control points for curved line
  const curvature = Math.min(distance * 0.3, 100);
  const midX = (fromCenter.x + toCenter.x) / 2;
  const midY = (fromCenter.y + toCenter.y) / 2;
  
  // Perpendicular offset for curve
  const perpX = -dy / distance * curvature;
  const perpY = dx / distance * curvature;
  
  const controlX = midX + perpX;
  const controlY = midY + perpY;
  
  // SVG path for curved line
  const path = `M ${fromCenter.x} ${fromCenter.y} Q ${controlX} ${controlY} ${toCenter.x} ${toCenter.y}`;
  
  // Get stroke style from connection metadata
  const strokeDashArray = getStrokeDashArray(connection.metadata.style);
  
  return (
    <g className="connection-2d">
      {/* Main connection line */}
      <motion.path
        d={path}
        fill="none"
        stroke={connection.metadata.color}
        strokeWidth={connection.metadata.weight}
        strokeDasharray={strokeDashArray}
        opacity={connection.state.highlighted ? 0.9 : 0.6}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ 
          pathLength: 1, 
          opacity: connection.state.highlighted ? 0.9 : 0.6 
        }}
        transition={{ 
          pathLength: { duration: 0.8, ease: "easeInOut" },
          opacity: { duration: 0.3 }
        }}
        className="transition-opacity duration-200"
      />
      
      {/* Animated flow effect for triggered connections */}
      {connection.metadata.animated && (
        <motion.circle
          r="3"
          fill={connection.metadata.color}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ 
            duration: 2, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <animateMotion
            dur="2s"
            repeatCount="indefinite"
            path={path}
          />
        </motion.circle>
      )}
      
      {/* Arrow head */}
      <motion.polygon
        points={getArrowPoints(fromCenter, toCenter, toNode.metadata.size)}
        fill={connection.metadata.color}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 0.8, scale: 1 }}
        transition={{ delay: 0.6, duration: 0.3 }}
      />
    </g>
  );
}

// Helper function to calculate arrow head points
function getArrowPoints(
  from: { x: number; y: number }, 
  to: { x: number; y: number },
  nodeSize: { width: number; height: number }
): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);
  
  // Calculate arrow position at edge of target node
  const nodeRadius = Math.sqrt(nodeSize.width * nodeSize.width + nodeSize.height * nodeSize.height) / 4;
  const arrowX = to.x - Math.cos(angle) * nodeRadius;
  const arrowY = to.y - Math.sin(angle) * nodeRadius;
  
  // Arrow head geometry
  const arrowSize = 8;
  const arrowAngle = Math.PI / 6; // 30 degrees
  
  const x1 = arrowX - arrowSize * Math.cos(angle - arrowAngle);
  const y1 = arrowY - arrowSize * Math.sin(angle - arrowAngle);
  
  const x2 = arrowX - arrowSize * Math.cos(angle + arrowAngle);
  const y2 = arrowY - arrowSize * Math.sin(angle + arrowAngle);
  
  return `${arrowX},${arrowY} ${x1},${y1} ${x2},${y2}`;
}
