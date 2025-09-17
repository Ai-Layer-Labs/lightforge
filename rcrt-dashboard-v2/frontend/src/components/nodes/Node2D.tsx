import React, { memo, useState, useRef, useCallback } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { RenderNode } from '../../types/rcrt';
import clsx from 'clsx';

interface Node2DProps {
  node: RenderNode;
  scale: number;
  onClick: (e: React.MouseEvent) => void;
  onDragStart?: () => void;
  onDragEnd: (info: PanInfo) => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

const Node2DComponent = ({ 
  node, 
  scale, 
  onClick, 
  onDragStart,
  onDragEnd, 
  onHoverStart, 
  onHoverEnd 
}: Node2DProps) => {
  
  // Don't render if filtered out
  if (node.state.filtered) return null;
  
  // High-performance native drag state
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const nodeRef = useRef<HTMLDivElement>(null);

  // Native HTML5 drag handlers for maximum performance
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only handle left click
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    setHasDragged(false);
    setDragOffset({ x: 0, y: 0 });
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    onDragStart?.();
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartPos.current.x;
      const deltaY = e.clientY - dragStartPos.current.y;
      
      // Mark as dragged if moved more than 3px
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        setHasDragged(true);
      }
      
      setDragOffset({ x: deltaX, y: deltaY });
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartPos.current.x;
      const deltaY = e.clientY - dragStartPos.current.y;
      
      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
      
      // Call onDragEnd with PanInfo-like structure
      onDragEnd({
        offset: { x: deltaX, y: deltaY },
        delta: { x: deltaX, y: deltaY },
        velocity: { x: 0, y: 0 },
        point: { x: e.clientX, y: e.clientY }
      } as PanInfo);
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onDragStart, onDragEnd]);

  // Get node styling based on type (copying v1 designs)
  const getNodeStyles = () => {
    const baseStyles = {
      position: 'absolute' as const,
      left: node.position.x + (isDragging ? dragOffset.x : 0),
      top: node.position.y + (isDragging ? dragOffset.y : 0),
      cursor: isDragging ? 'grabbing' : 'grab',
      userSelect: 'none' as const,
      transition: isDragging ? 'none' : 'all 0.3s ease',
      zIndex: isDragging ? 1000 : 10,
    };

    switch (node.type) {
      case 'breadcrumb':
        return {
          ...baseStyles,
          background: 'linear-gradient(135deg, rgba(0, 245, 255, 0.1) 0%, rgba(0, 128, 255, 0.1) 100%)',
          border: '1px solid rgba(0, 245, 255, 0.3)',
          borderRadius: '12px',
          padding: '12px',
          width: '280px', // Fixed width for consistent layout
          height: '120px', // Taller to fit content
          backdropFilter: 'blur(10px)',
          borderColor: node.state.selected ? '#00f5ff' : 'rgba(0, 245, 255, 0.3)',
          boxShadow: node.state.highlighted ? '0 8px 25px rgba(0, 245, 255, 0.15)' : 'none',
          transform: node.state.highlighted ? 'translateY(-2px)' : 'none',
          overflow: 'hidden',
        };
        
      case 'agent':
        return {
          ...baseStyles,
          background: 'linear-gradient(135deg, rgba(255, 165, 0, 0.1) 0%, rgba(255, 140, 0, 0.1) 100%)',
          border: '2px solid rgba(255, 165, 0, 0.4)',
          borderRadius: '50%',
          width: '120px', // Slightly larger
          height: '120px',
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(10px)',
          fontSize: '0.8rem',
          borderColor: node.state.selected ? '#ffa500' : 'rgba(255, 165, 0, 0.4)',
          boxShadow: node.state.highlighted ? '0 8px 25px rgba(255, 165, 0, 0.25)' : 'none',
          transform: node.state.highlighted ? 'scale(1.1)' : 'none',
          overflow: 'hidden',
        };
        
      case 'agent-definition':
        return {
          ...baseStyles,
          background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)',
          border: '2px solid rgba(138, 43, 226, 0.4)',
          borderRadius: '12px',
          width: '140px',
          height: '100px',
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(10px)',
          fontSize: '0.75rem',
          borderColor: node.state.selected ? '#8a2be2' : 'rgba(138, 43, 226, 0.4)',
          boxShadow: node.state.highlighted ? '0 6px 20px rgba(138, 43, 226, 0.25)' : 'none',
          transform: node.state.highlighted ? 'scale(1.05)' : 'none',
          overflow: 'hidden',
          padding: '8px',
        };
        
      case 'tool':
        return {
          ...baseStyles,
          background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.1) 0%, rgba(0, 245, 255, 0.1) 100%)',
          border: '2px solid rgba(0, 255, 136, 0.4)',
          borderRadius: '12px',
          width: '110px', // Slightly larger
          height: '110px',
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(10px)',
          fontSize: '0.7rem',
          borderColor: node.state.selected ? '#00ff88' : 'rgba(0, 255, 136, 0.4)',
          boxShadow: node.state.highlighted ? '0 6px 20px rgba(0, 255, 136, 0.25)' : 'none',
          transform: node.state.highlighted ? 'scale(1.05)' : 'none',
          overflow: 'hidden',
          padding: '8px',
        };
        
      case 'secret':
        return {
          ...baseStyles,
          background: 'linear-gradient(135deg, rgba(255, 99, 132, 0.1) 0%, rgba(255, 64, 129, 0.1) 100%)',
          border: '2px solid rgba(255, 99, 132, 0.4)',
          borderRadius: '8px',
          width: '130px', // Wider for text
          height: '90px', // Taller for text
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(10px)',
          fontSize: '0.75rem',
          borderColor: node.state.selected ? '#ff6384' : 'rgba(255, 99, 132, 0.4)',
          boxShadow: node.state.highlighted ? '0 6px 20px rgba(255, 99, 132, 0.25)' : 'none',
          transform: node.state.highlighted ? 'scale(1.05)' : 'none',
          overflow: 'hidden',
          padding: '8px',
        };
        
      default:
        return baseStyles;
    }
  };

  // Render based on node type (copying v1 structure)
  const renderNodeContent = () => {
    switch (node.type) {
      case 'breadcrumb':
        return (
          <div className="w-full h-full flex flex-col">
            <div className="node-title text-white font-semibold text-sm mb-2 line-clamp-1 leading-tight">
              {node.metadata.title}
            </div>
            <div className="node-tags flex flex-wrap gap-1 mb-2 flex-1 overflow-hidden">
              {node.metadata.tags.map(tag => (
                <span key={tag} className="tag bg-blue-500/20 text-blue-300 text-xs px-1.5 py-0.5 rounded whitespace-nowrap">
                  {tag}
                </span>
              ))}
            </div>
            <div className="node-meta text-xs text-gray-400 mt-auto flex items-center justify-between">
              <span className="truncate">Updated: {new Date(node.data?.updated_at || Date.now()).toLocaleDateString()}</span>
              {node.data?.version && (
                <span className="version-badge bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
                  v{node.data.version}
                </span>
              )}
            </div>
          </div>
        );
        
      case 'agent':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center text-center px-2">
            <div className="agent-icon text-2xl mb-2">
              {node.metadata.icon}
            </div>
            <div className="agent-name text-orange-400 font-bold text-xs mb-1 line-clamp-1 max-w-full">
              {node.metadata.title.length > 8 ? node.metadata.title.substring(0, 8) + '...' : node.metadata.title}
            </div>
            <div className="agent-roles text-white/70 text-xs line-clamp-2 leading-tight max-w-full">
              {node.metadata.tags.slice(0, 2).join(', ')}
            </div>
          </div>
        );
        
      case 'agent-definition':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center text-center px-2">
            <div className="agent-def-icon text-xl mb-1">
              {node.metadata.icon}
            </div>
            <div className="agent-def-name text-purple-400 font-bold text-xs mb-1 line-clamp-2 max-w-full">
              {node.metadata.title}
            </div>
            <div className="agent-def-category text-white/60 text-xs line-clamp-1">
              {node.data?.context?.category || 'agent def'}
            </div>
          </div>
        );
        
      case 'tool':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center text-center px-1">
            <div className="tool-icon text-lg mb-1">
              {node.metadata.icon}
            </div>
            <div className="tool-name text-green-400 font-bold text-xs line-clamp-2 max-w-full leading-tight mb-1">
              {node.metadata.title.length > 15 ? node.metadata.title.substring(0, 15) + '...' : node.metadata.title}
            </div>
            {/* Show key tags */}
            <div className="tool-tags text-xs text-white/60 line-clamp-1">
              {node.metadata.tags.filter(tag => !tag.includes('workspace:')).slice(0, 2).join(', ')}
            </div>
          </div>
        );
        
      case 'secret':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center text-center px-1">
            <div className="secret-icon text-lg mb-1">
              {node.metadata.icon}
            </div>
            <div className="secret-name text-red-400 font-bold text-xs line-clamp-1 max-w-full">
              {node.metadata.title.length > 10 ? node.metadata.title.substring(0, 10) + '...' : node.metadata.title}
            </div>
            <div className="secret-scope text-white/70 text-xs line-clamp-1 max-w-full">
              {node.metadata.subtitle?.length > 12 ? node.metadata.subtitle.substring(0, 12) + '...' : node.metadata.subtitle}
            </div>
          </div>
        );
        
      default:
        return (
          <div className="w-full h-full p-2">
            <div className="text-white text-sm">{node.metadata.title}</div>
          </div>
        );
    }
  };

  return (
    <motion.div
      ref={nodeRef}
      className="node-2d"
      style={getNodeStyles()}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1,
        transition: {
          type: "spring",
          stiffness: 300,
          damping: 25,
          delay: Math.random() * 0.2,
        }
      }}
      whileHover={{
        y: node.type === 'breadcrumb' ? -2 : 0,
        scale: node.type === 'agent' ? 1.1 : (node.type === 'tool' || node.type === 'secret' ? 1.05 : 1),
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        // Only trigger click if we haven't dragged
        if (!hasDragged) {
          onClick(e);
        }
      }}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
    >
      {renderNodeContent()}
      
      {/* Real-time Indicators */}
      {node.type === 'chat' && (
        <motion.div
          className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full"
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.2, 1] }}
          transition={{ duration: 0.5 }}
        />
      )}
      
      {node.effects.temporary && (
        <motion.div
          className="absolute top-1 right-1 text-xs text-gray-400"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          ⏱️
        </motion.div>
      )}
    </motion.div>
  );
};

// Memoize component to prevent unnecessary re-renders
export const Node2D = memo(Node2DComponent);