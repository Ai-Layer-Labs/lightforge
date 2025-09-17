import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Text } from '@react-three/drei';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { RenderNode } from '../../types/rcrt';
import { useDashboard } from '../../stores/DashboardStore';
import { Scene3DConfig } from '../panels/Scene3DControls';

interface Node3DProps {
  node: RenderNode;
  config: Scene3DConfig;
}

export function Node3D({ node, config }: Node3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { selectNode, setHoveredNode } = useDashboard();
  
  // Don't render if filtered
  if (node.state.filtered) return null;
  
  // Animation effects
  useFrame((state, delta) => {
    if (meshRef.current) {
      // Pulse effect
      if (node.effects.pulse) {
        const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
        meshRef.current.scale.setScalar(scale);
      }
      
      // Rotation for thinking nodes
      if (node.type === 'chat' || node.effects.animate) {
        meshRef.current.rotation.y += delta * 0.5;
      }
      
      // Glow effect (handled by material)
      if (node.effects.glow && meshRef.current.material) {
        const material = meshRef.current.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = 0.2 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
      }
    }
  });
  
  // Node geometry based on type
  const getNodeGeometry = () => {
    switch (node.type) {
      case 'agent':
        return <sphereGeometry args={[15, 16, 16]} />;
      case 'agent-definition':
        return <boxGeometry args={[25, 25, 15]} />;
      case 'tool':
        return <cylinderGeometry args={[12, 12, 20, 8]} />;
      case 'secret':
        return <octahedronGeometry args={[15]} />;
      case 'chat':
        return <sphereGeometry args={[10, 12, 12]} />;
      default:
        return <boxGeometry args={[20, 15, 10]} />;
    }
  };
  
  // Material based on node properties
  const getMaterial = () => {
    const baseColor = new THREE.Color(node.metadata.color);
    
    return (
      <meshStandardMaterial
        color={baseColor}
        emissive={node.effects.glow ? baseColor.clone().multiplyScalar(0.1) : new THREE.Color(0x000000)}
        emissiveIntensity={node.effects.glow ? 0.2 : 0}
        roughness={0.3}
        metalness={0.1}
        transparent={true}
        opacity={node.state.selected ? 0.9 : 0.8}
      />
    );
  };
  
  const handleClick = (e: any) => {
    console.log('🎯 3D Node clicked:', node.metadata.title, node.type);
    e.stopPropagation?.();
    selectNode(node.id, e.ctrlKey || e.metaKey || false);
  };
  
  const handlePointerOver = () => {
    setHoveredNode(node.id);
    document.body.style.cursor = 'pointer';
  };
  
  const handlePointerOut = () => {
    setHoveredNode(null);
    document.body.style.cursor = 'default';
  };
  
  // Card styling functions (dynamic based on node type) - MUCH BIGGER
  const getCardWidth = () => {
    switch (node.type) {
      case 'breadcrumb': return '400px';
      case 'agent': return '200px';
      case 'tool': return '180px';
      case 'secret': return '200px';
      default: return '220px';
    }
  };
  
  const getCardHeight = () => {
    switch (node.type) {
      case 'breadcrumb': return '180px';
      case 'agent': return '200px';
      case 'tool': return '180px';
      case 'secret': return '140px';
      default: return '160px';
    }
  };
  
  const getCardBackground = () => {
    switch (node.type) {
      case 'breadcrumb': return 'linear-gradient(135deg, rgba(0, 245, 255, 0.1) 0%, rgba(0, 128, 255, 0.1) 100%)';
      case 'agent': return 'linear-gradient(135deg, rgba(255, 165, 0, 0.1) 0%, rgba(255, 140, 0, 0.1) 100%)';
      case 'tool': return 'linear-gradient(135deg, rgba(0, 255, 136, 0.1) 0%, rgba(0, 245, 255, 0.1) 100%)';
      case 'secret': return 'linear-gradient(135deg, rgba(255, 99, 132, 0.1) 0%, rgba(255, 64, 129, 0.1) 100%)';
      default: return 'rgba(100, 100, 100, 0.1)';
    }
  };
  
  const getCardBorderRadius = () => {
    switch (node.type) {
      case 'breadcrumb': return '12px';
      case 'agent': return '50%'; // Circular
      case 'tool': return '12px';
      case 'secret': return '8px';
      default: return '8px';
    }
  };
  
  // Render card content (same as 2D but optimized for 3D)
  const renderCardContent = () => {
    switch (node.type) {
       case 'breadcrumb':
         return (
           <div className="w-full h-full flex flex-col text-white">
             <div className="font-bold text-lg mb-3 line-clamp-2 leading-tight">
               {node.metadata.title}
             </div>
             <div className="flex flex-wrap gap-2 mb-3 flex-1 overflow-hidden">
               {node.metadata.tags.map(tag => (
                 <span key={tag} className="text-sm px-2 py-1 bg-blue-500/30 text-blue-200 rounded">
                   {tag}
                 </span>
               ))}
             </div>
             <div className="text-sm text-gray-300 mt-auto">
               v{node.data?.version || '1'}
             </div>
           </div>
         );
        
      case 'agent':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center text-center text-white">
            <div className="text-4xl mb-4">{node.metadata.icon}</div>
            <div className="text-orange-400 font-bold text-lg mb-2">
              {node.metadata.title.substring(0, 10)}
            </div>
            <div className="text-white/70 text-sm">
              {node.metadata.tags.slice(0, 2).join(', ')}
            </div>
          </div>
        );
        
      case 'agent-definition':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center text-center text-white">
            <div className="text-3xl mb-3">{node.metadata.icon}</div>
            <div className="text-purple-400 font-bold text-base mb-2 line-clamp-2">
              {node.metadata.title}
            </div>
            <div className="text-white/60 text-sm">
              {node.data?.context?.category || 'agent def'}
            </div>
          </div>
        );
        
       case 'tool':
         return (
           <div className="w-full h-full flex flex-col items-center justify-center text-center text-white">
             <div className="text-3xl mb-3">{node.metadata.icon}</div>
             <div className="text-green-400 font-bold text-base mb-2 line-clamp-2">
               {node.metadata.title}
             </div>
             <div className="text-white/60 text-sm">
               {node.data?.category || 'tool'}
             </div>
           </div>
         );
        
       case 'secret':
         return (
           <div className="w-full h-full flex flex-col items-center justify-center text-center text-white">
             <div className="text-3xl mb-3">{node.metadata.icon}</div>
             <div className="text-red-400 font-bold text-base mb-2">
               {node.metadata.title}
             </div>
             <div className="text-white/60 text-sm">
               {node.metadata.subtitle}
             </div>
           </div>
         );
        
      default:
        return (
          <div className="text-white text-sm">{node.metadata.title}</div>
        );
    }
  };
  
  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      {/* Camera-facing card (like v1) */}
       <Html
         center
         distanceFactor={config.cardDistance}
         occlude={false}
         transform={false}
         sprite={true}
         onClick={handleClick}
         onPointerOver={handlePointerOver}
         onPointerOut={handlePointerOut}
       >
         <motion.div
           className="node-3d-card pointer-events-auto cursor-pointer"
           onClick={handleClick}
           onPointerOver={handlePointerOver}
           onPointerOut={handlePointerOut}
           style={{
             width: getCardWidth(),
             height: getCardHeight(),
             background: getCardBackground(),
             border: `3px solid ${node.metadata.color}60`,
             borderRadius: getCardBorderRadius(),
             padding: '20px',
             backdropFilter: 'blur(10px)',
             boxShadow: node.state.selected 
               ? `0 0 30px ${node.metadata.color}80` 
               : `0 8px 25px rgba(0, 0, 0, 0.4)`,
             transform: node.state.highlighted ? `scale(${config.cardScale * 1.1})` : `scale(${config.cardScale})`,
             transition: 'all 0.3s ease',
           }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: Math.random() * 0.2 }}
        >
          {renderCardContent()}
        </motion.div>
      </Html>
      
    </group>
  );
}
