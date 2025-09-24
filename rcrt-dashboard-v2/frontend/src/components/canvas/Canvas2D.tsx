import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, useDragControls, PanInfo } from 'framer-motion';
import { useNodes, useConnections, useCanvas2D, useDashboardStore } from '../../stores/DashboardStore';
import { Node2D } from '../nodes/Node2D';
import { Connection2D } from '../nodes/Connection2D';
import { RenderNode, Position3D } from '../../types/rcrt';
import { applyGridLayout, applyCircularLayout, applyForceLayout, applyHierarchicalLayout, defaultLayoutConfig } from '../../utils/layoutAlgorithms';

export function Canvas2D() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  
  const nodes = useNodes();
  const connections = useConnections();
  const canvas2D = useCanvas2D();
  const updateNode = useDashboardStore((state) => state.updateNode);
  const selectNode = useDashboardStore((state) => state.selectNode);
  const deselectAll = useDashboardStore((state) => state.deselectAll);
  const setHoveredNode = useDashboardStore((state) => state.setHoveredNode);
  const setNodes = useDashboardStore((state) => state.setNodes);
  const updateCanvas2D = useDashboardStore((state) => state.updateCanvas2D);
  
  // Track if we've applied initial layout using a ref to avoid re-renders
  const hasAppliedInitialLayout = useRef(false);
  
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
      
      updateCanvas2D({
        pan: {
          x: canvas2D.pan.x + deltaX,
          y: canvas2D.pan.y + deltaY,
        }
      });
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
      x: node.position.x + info.offset.x / canvas2D.zoom,
      y: node.position.y + info.offset.y / canvas2D.zoom,
      z: node.position.z,
    };
    
    updateNode(node.id, { position: newPosition });
    
    console.log('📍 Node moved:', node.metadata.title, newPosition);
  };
  
  const handleNodeHover = (node: RenderNode | null) => {
    setHoveredNode(node?.id || null);
  };
  
  // ============ LAYOUT FUNCTIONS ============
  
  const applyLayout = useCallback((layoutType: 'grid' | 'circular' | 'force' | 'hierarchical', nodesToLayout?: RenderNode[]) => {
    if (!nodesToLayout || nodesToLayout.length === 0) {
      console.log('📐 No nodes to layout');
      return;
    }
    
    console.log(`📐 Applying ${layoutType} layout to ${nodesToLayout.length} nodes`);
    
    let layoutedNodes: RenderNode[];
    
    switch (layoutType) {
      case 'grid':
        layoutedNodes = applyGridLayout(nodesToLayout, defaultLayoutConfig);
        break;
      case 'circular':
        layoutedNodes = applyCircularLayout(nodesToLayout, defaultLayoutConfig);
        break;
      case 'force':
        layoutedNodes = applyForceLayout(nodesToLayout, defaultLayoutConfig);
        break;
      case 'hierarchical':
        layoutedNodes = applyHierarchicalLayout(nodesToLayout, defaultLayoutConfig);
        break;
      default:
        return;
    }
    
    // Update all nodes with new positions (don't preserve old positions)
    setNodes(layoutedNodes, false);
    
    // Center view on the laid out nodes
    setTimeout(() => {
      centerViewOnNodes(layoutedNodes);
    }, 100);
  }, [setNodes]);
  
  // Apply grid layout when nodes are first loaded
  const previousNodesLength = useRef(0);
  const previousNodeIds = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    const currentNodeIds = new Set(nodes.map(n => n.id));
    
    // Check if we have new nodes
    const newNodeIds = [...currentNodeIds].filter(id => !previousNodeIds.current.has(id));
    
    if (newNodeIds.length > 0) {
      console.log(`📐 ${newNodeIds.length} new nodes detected`);
      
      // If this is the first load or we need to re-layout
      if (!hasAppliedInitialLayout.current || newNodeIds.length > 5) {
        console.log('📐 Applying grid layout to all nodes');
        hasAppliedInitialLayout.current = true;
        // Use setTimeout to avoid the update depth issue
        setTimeout(() => {
          applyLayout('grid', nodes);
        }, 100);
      } else {
        // For small numbers of new nodes, just add them to the grid
        console.log('📐 Adding new nodes to existing grid');
        setTimeout(() => {
          const existingNodes = nodes.filter(n => !newNodeIds.includes(n.id));
          const newNodes = nodes.filter(n => newNodeIds.includes(n.id));
          
          // Find the next available grid position
          const maxRow = Math.max(...existingNodes.map(n => Math.floor(n.position.y / 220)), 0);
          const maxCol = Math.max(...existingNodes.map(n => Math.floor(n.position.x / 220)), 0);
          const startIndex = (maxRow + 1) * 5; // Assuming 5 columns
          
          // Position new nodes in grid
          const updatedNewNodes = newNodes.map((node, index) => ({
            ...node,
            position: {
              x: ((startIndex + index) % 5) * 220 + 150,
              y: Math.floor((startIndex + index) / 5) * 220 + 150,
              z: 0
            }
          }));
          
          setNodes([...existingNodes, ...updatedNewNodes], false);
        }, 100);
      }
    }
    
    previousNodesLength.current = nodes.length;
    previousNodeIds.current = currentNodeIds;
  }, [nodes, applyLayout, setNodes]);
  
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
    
    updateCanvas2D({
      pan: { x: targetX, y: targetY },
      zoom: targetScale,
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
        const newScale = Math.max(0.1, Math.min(3, canvas2D.zoom * zoomFactor));
        
        // Zoom toward mouse position
        const scaleDiff = newScale - canvas2D.zoom;
        const newX = canvas2D.pan.x - (mouseX * scaleDiff);
        const newY = canvas2D.pan.y - (mouseY * scaleDiff);
        
        updateCanvas2D({
          pan: { x: newX, y: newY },
          zoom: newScale,
        });
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [deselectAll, canvas2D, updateCanvas2D]);
  
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
          transform: `translate(${canvas2D.pan.x}px, ${canvas2D.pan.y}px) scale(${canvas2D.zoom})`,
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
            scale={canvas2D.zoom}
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
            onClick={() => applyLayout('grid', nodes)}
          />
          <CanvasControl 
            icon="🔄" 
            label="Circular Layout"
            onClick={() => applyLayout('circular', nodes)}
          />
          <CanvasControl 
            icon="🌐" 
            label="Force Layout"
            onClick={() => applyLayout('force', nodes)}
          />
          <CanvasControl 
            icon="📋" 
            label="Hierarchical"
            onClick={() => applyLayout('hierarchical', nodes)}
          />
        </div>
        
        <CanvasControl 
          icon="🔄" 
          label="Reset Positions"
          onClick={() => updateCanvas2D({ pan: { x: 0, y: 0 }, zoom: 1 })}
        />
      </div>
      
      {/* Canvas Info */}
      <div className="absolute top-4 left-4 text-xs text-gray-400 font-mono">
        Zoom: {(canvas2D.zoom * 100).toFixed(0)}% | 
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
