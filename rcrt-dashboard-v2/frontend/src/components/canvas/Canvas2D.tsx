import React, { useRef, useEffect, useState } from 'react';
import { motion, useDragControls, PanInfo } from 'framer-motion';
import { useNodes, useConnections, useDashboard } from '../../stores/DashboardStore';
import { Node2D } from '../nodes/Node2D';
import { Connection2D } from '../nodes/Connection2D';
import { RenderNode, Position3D } from '../../types/rcrt';
import { applyGridLayout, applyCircularLayout, applyForceLayout, applyHierarchicalLayout, defaultLayoutConfig } from '../../utils/layoutAlgorithms';

export function Canvas2D() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasTransform, setCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  
  const nodes = useNodes();
  const connections = useConnections();
  const { updateNode, selectNode, deselectAll, setHoveredNode, setNodes } = useDashboard();
  
  // ============ CANVAS PANNING ============
  
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Check if we clicked on a node or its children
    const target = e.target as HTMLElement;
    const isNode = target.closest('.node-2d') !== null;
    
    // Only start panning if we didn't click on a node
    if (!isNode && !isDraggingNode) {
      setIsPanning(true);
      deselectAll();
    }
  };
  
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning && !isDraggingNode) {
      const deltaX = e.movementX;
      const deltaY = e.movementY;
      
      setCanvasTransform(prev => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
    }
  };
  
  const handleCanvasMouseUp = () => {
    setIsPanning(false);
  };
  
  
  // ============ NODE INTERACTION HANDLERS ============
  
  const handleNodeClick = (node: RenderNode, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const multiSelect = e.ctrlKey || e.metaKey;
    selectNode(node.id, multiSelect);
    
    console.log('🎯 Node selected:', node.metadata.title);
  };
  
  const handleNodeDragStart = () => {
    setIsDraggingNode(true);
    setIsPanning(false); // Stop panning when dragging a node
  };
  
  const handleNodeDragEnd = (node: RenderNode, info: PanInfo) => {
    setIsDraggingNode(false);
    
    // Calculate new position accounting for canvas transform
    const newPosition: Position3D = {
      x: node.position.x + info.offset.x / canvasTransform.scale,
      y: node.position.y + info.offset.y / canvasTransform.scale,
      z: node.position.z,
    };
    
    updateNode(node.id, { position: newPosition });
    
    console.log('📍 Node moved:', node.metadata.title, newPosition);
  };
  
  const handleNodeHover = (node: RenderNode | null) => {
    setHoveredNode(node?.id || null);
  };
  
  // ============ LAYOUT FUNCTIONS ============
  
  const applyLayout = (layoutType: 'grid' | 'circular' | 'force' | 'hierarchical') => {
    console.log(`📐 Applying ${layoutType} layout to ${nodes.length} nodes`);
    
    let layoutedNodes: RenderNode[];
    
    switch (layoutType) {
      case 'grid':
        layoutedNodes = applyGridLayout(nodes, defaultLayoutConfig);
        break;
      case 'circular':
        layoutedNodes = applyCircularLayout(nodes, defaultLayoutConfig);
        break;
      case 'force':
        layoutedNodes = applyForceLayout(nodes, defaultLayoutConfig);
        break;
      case 'hierarchical':
        layoutedNodes = applyHierarchicalLayout(nodes, defaultLayoutConfig);
        break;
      default:
        return;
    }
    
    // Update all nodes with new positions
    setNodes(layoutedNodes);
    
    // Center view on the laid out nodes
    setTimeout(() => {
      centerViewOnNodes(layoutedNodes);
    }, 100);
  };
  
  const centerViewOnNodes = (nodesToCenter: RenderNode[] = nodes) => {
    if (nodesToCenter.length === 0) return;
    
    // Calculate bounding box of all nodes
    const positions = nodesToCenter.map(n => n.position);
    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x + (n => n.metadata.size.width)(nodesToCenter.find(n => n.position.x === p.x)!)));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y + (n => n.metadata.size.height)(nodesToCenter.find(n => n.position.y === p.y)!)));
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const contentCenterX = minX + contentWidth / 2;
    const contentCenterY = minY + contentHeight / 2;
    
    // Calculate canvas center
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    
    const canvasCenterX = canvasRect.width / 2;
    const canvasCenterY = canvasRect.height / 2;
    
    // Calculate transform to center content
    const targetX = canvasCenterX - contentCenterX;
    const targetY = canvasCenterY - contentCenterY;
    
    // Calculate scale to fit content
    const scaleX = (canvasRect.width * 0.8) / contentWidth;
    const scaleY = (canvasRect.height * 0.8) / contentHeight;
    const targetScale = Math.min(1.5, Math.max(0.3, Math.min(scaleX, scaleY)));
    
    setCanvasTransform({
      x: targetX,
      y: targetY,
      scale: targetScale,
    });
    
    console.log(`🎯 Centered view on ${nodesToCenter.length} nodes`);
  };
  
  // ============ KEYBOARD SHORTCUTS & WHEEL EVENTS ============
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          deselectAll();
          break;
        case 'Delete':
        case 'Backspace':
          // TODO: Delete selected nodes
          break;
        case 'f':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            // TODO: Focus search
          }
          break;
      }
    };
    
    const handleWheel = (e: WheelEvent) => {
      if (canvasRef.current?.contains(e.target as Node)) {
        e.preventDefault();
        
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.1, Math.min(3, canvasTransform.scale * zoomFactor));
        
        // Zoom toward mouse position
        const scaleDiff = newScale - canvasTransform.scale;
        const newX = canvasTransform.x - (mouseX * scaleDiff);
        const newY = canvasTransform.y - (mouseY * scaleDiff);
        
        setCanvasTransform({
          x: newX,
          y: newY,
          scale: newScale,
        });
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [deselectAll, canvasTransform]);
  
  return (
    <div 
      ref={canvasRef}
      className="canvas-2d w-full h-full relative overflow-hidden bg-gray-900"
      style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
    >
      {/* Canvas Background */}
      <div
        className="canvas-background absolute inset-0"
        style={{
          transform: `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Grid Background */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 245, 255, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 245, 255, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
        
        {/* Connection Lines */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ overflow: 'visible' }}
        >
          {connections.map(connection => (
            <Connection2D
              key={connection.id}
              connection={connection}
              nodes={nodes}
            />
          ))}
        </svg>
        
        {/* Nodes */}
        {nodes.map(node => (
          <Node2D
            key={node.id}
            node={node}
            scale={canvasTransform.scale}
            onClick={(e) => handleNodeClick(node, e)}
            onDragStart={handleNodeDragStart}
            onDragEnd={(info) => handleNodeDragEnd(node, info)}
            onHoverStart={() => handleNodeHover(node)}
            onHoverEnd={() => handleNodeHover(null)}
          />
        ))}
      </div>
      
      {/* Canvas Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <CanvasControl 
          icon="🎯" 
          label="Center View"
          onClick={() => centerViewOnNodes()}
        />
        <CanvasControl 
          icon="🔍" 
          label="Zoom to Fit"
          onClick={() => centerViewOnNodes()}
        />
        
        {/* Layout Controls */}
        <div className="flex flex-col gap-1">
          <CanvasControl 
            icon="📊" 
            label="Grid Layout"
            onClick={() => applyLayout('grid')}
          />
          <CanvasControl 
            icon="🔄" 
            label="Circular Layout"
            onClick={() => applyLayout('circular')}
          />
          <CanvasControl 
            icon="🌐" 
            label="Force Layout"
            onClick={() => applyLayout('force')}
          />
          <CanvasControl 
            icon="📋" 
            label="Hierarchical"
            onClick={() => applyLayout('hierarchical')}
          />
        </div>
        
        <CanvasControl 
          icon="🔄" 
          label="Reset Positions"
          onClick={() => setCanvasTransform({ x: 0, y: 0, scale: 1 })}
        />
      </div>
      
      {/* Canvas Info */}
      <div className="absolute top-4 left-4 text-xs text-gray-400 font-mono">
        Zoom: {(canvasTransform.scale * 100).toFixed(0)}% | 
        Nodes: {nodes.filter(n => !n.state.filtered).length} | 
        Connections: {connections.filter(c => c.state.visible).length}
      </div>
    </div>
  );
}

function CanvasControl({ icon, label, onClick }: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      className="flex items-center gap-2 px-3 py-2 bg-black/30 backdrop-blur-md rounded-lg border border-white/10 text-white/80 hover:text-white text-sm"
      onClick={onClick}
      whileHover={{ scale: 1.05, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      whileTap={{ scale: 0.95 }}
      title={label}
    >
      <span>{icon}</span>
      <span className="hidden lg:inline">{label}</span>
    </motion.button>
  );
}
