import React, { useMemo } from 'react';
import { Text, Html } from '@react-three/drei';
import { useNodes, useConnections } from '../../stores/DashboardStore';
import { Node3D } from '../nodes/Node3D';
import { Connection3D } from '../nodes/Connection3D';
import { RenderNode } from '../../types/rcrt';
import { Scene3DConfig } from '../panels/Scene3DControls';
import { sphericalLayout } from '../../utils/sphericalLayout';
import * as THREE from 'three';

interface Scene3DProps {
  config: Scene3DConfig;
}

// Memoize Scene3D to prevent re-renders when camera changes
export const Scene3D = React.memo(function Scene3D({ config }: Scene3DProps) {
  const nodes = useNodes();
  const connections = useConnections();
  
  // Group nodes by category for clustering (dynamic based on actual data)
  const nodesByCategory = useMemo(() => {
    return {
      breadcrumbs: nodes.filter(n => n.type === 'breadcrumb'),
      agents: nodes.filter(n => n.type === 'agent'),
      'agent-definitions': nodes.filter(n => n.type === 'agent-definition'),
      tools: nodes.filter(n => n.type === 'tool'),
      secrets: nodes.filter(n => n.type === 'secret'),
      chat: nodes.filter(n => n.type === 'chat'),
    };
  }, [nodes]);
  
   // Category label positions (based on sphere configs)
   const categoryLabelPositions = useMemo(() => {
     return {
       breadcrumbs: { 
         x: config.breadcrumbs.x, 
         y: config.breadcrumbs.y + config.breadcrumbs.baseRadius + 100, 
         z: config.breadcrumbs.z, 
         color: '#00f5ff', 
         label: 'Breadcrumbs' 
       },
       agents: { 
         x: config.agents.x, 
         y: config.agents.y + config.agents.baseRadius + 80, 
         z: config.agents.z, 
         color: '#ffa500', 
         label: 'Agents' 
       },
       'agent-definitions': { 
         x: config['agent-definitions'].x, 
         y: config['agent-definitions'].y + config['agent-definitions'].baseRadius + 80, 
         z: config['agent-definitions'].z, 
         color: '#8a2be2', 
         label: 'Agent Definitions' 
       },
       tools: { 
         x: config.tools.x, 
         y: config.tools.y + config.tools.baseRadius + 80, 
         z: config.tools.z, 
         color: '#00ff88', 
         label: 'Tools' 
       },
       secrets: { 
         x: config.secrets.x, 
         y: config.secrets.y + config.secrets.baseRadius + 80, 
         z: config.secrets.z, 
         color: '#ff6b6b', 
         label: 'Secrets' 
       },
       chat: { 
         x: config.chat.x, 
         y: config.chat.y + config.chat.baseRadius + 80, 
         z: config.chat.z, 
         color: '#8a2be2', 
         label: 'Chat' 
       },
     };
   }, [config]);
   
  
  // Position all nodes using surface-based sphere layering
  const positionedNodes = useMemo(() => {
    const positioned: RenderNode[] = [];
    
    // Position each category on sphere surfaces with automatic layering
    Object.entries(nodesByCategory).forEach(([category, categoryNodes]) => {
      if (categoryNodes.length === 0) return;
      
      const sphereConfig = config[category as keyof typeof config];
      if (sphereConfig && typeof sphereConfig === 'object' && 'baseRadius' in sphereConfig) {
        const result = sphericalLayout.distributeNodesOnSphereSurfaces(
          categoryNodes,
          sphereConfig,
          config.sphereLayerDistance,
          config.minNodeSpacing
        );
        
        positioned.push(...result.nodes);
      }
    });
    
    return positioned;
  }, [nodesByCategory, config]);
  
  return (
    <>
      {/* Fixed-size Category Labels */}
      {Object.entries(categoryLabelPositions).map(([category, pos]) => {
        const categoryNodes = nodesByCategory[category as keyof typeof nodesByCategory];
        if (categoryNodes.length === 0) return null;
        
        return (
          <group key={category} position={[pos.x, pos.y + 80, pos.z]}>
            {/* Fixed-size Category Heading */}
            <Html 
              center
              distanceFactor={1}
              transform={false}
              sprite={false}
            >
              <div className="category-heading pointer-events-none">
                <div 
                  className="px-6 py-3 rounded-lg border backdrop-blur-md font-bold text-xl"
                  style={{
                    background: `${pos.color}20`,
                    borderColor: `${pos.color}60`,
                    color: pos.color,
                    minWidth: '200px',
                    textAlign: 'center',
                  }}
                >
                  {pos.label} ({categoryNodes.length})
                </div>
              </div>
            </Html>
            
          </group>
        );
      })}
      
      
      {/* Sphere Layer Visualizations */}
      {config.showClusterBalls && Object.entries(nodesByCategory).map(([category, categoryNodes]) => {
        if (categoryNodes.length === 0) return null;
        
        const sphereConfig = config[category as keyof typeof config];
        if (!sphereConfig || typeof sphereConfig !== 'object' || !('baseRadius' in sphereConfig)) return null;
        
        const colors = {
          breadcrumbs: '#00f5ff',
          agents: '#ffa500',
          tools: '#00ff88',
          secrets: '#ff6b6b',
          chat: '#8a2be2',
        };
        
        // Calculate how many layers this category needs
        const surfaceArea = 4 * Math.PI * sphereConfig.baseRadius * sphereConfig.baseRadius;
        const nodeArea = config.minNodeSpacing * config.minNodeSpacing;
        const baseCapacity = Math.floor(surfaceArea / nodeArea);
        const layersNeeded = Math.ceil(categoryNodes.length / baseCapacity);
        
        // Render all sphere layers for this category
        return (
          <group key={`cluster-${category}`}>
            {Array.from({ length: layersNeeded }, (_, layerIndex) => (
              <mesh 
                key={`${category}-layer-${layerIndex}`}
                position={[sphereConfig.x, sphereConfig.y, sphereConfig.z]}
              >
                <sphereGeometry args={[sphereConfig.baseRadius + layerIndex * config.sphereLayerDistance, 32, 32]} />
                <meshBasicMaterial
                  color={colors[category as keyof typeof colors]}
                  transparent
                  opacity={config.clusterBallOpacity * (1 - layerIndex * 0.2)} // Fade outer layers
                  wireframe={config.clusterBallWireframe}
                />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Sphere-based Particle Effects */}
      {Object.entries(nodesByCategory).map(([category, categoryNodes]) => {
        if (categoryNodes.length === 0) return null;
        
        const sphereConfig = config[category as keyof typeof config];
        if (!sphereConfig || typeof sphereConfig !== 'object' || !('baseRadius' in sphereConfig)) return null;
        
        const colors = {
          breadcrumbs: '#00f5ff',
          agents: '#ffa500',
          tools: '#00ff88',
          secrets: '#ff6b6b',
          chat: '#8a2be2',
        };
        
        return (
          <SphereParticleSystem 
            key={`particles-${category}`}
            sphereConfig={sphereConfig}
            layerDistance={config.sphereLayerDistance}
            color={colors[category as keyof typeof colors]}
            count={config.particleCount}
            opacity={config.particleOpacity}
            size={config.particleSize}
            spread={config.particleSpread}
            nodeCount={categoryNodes.length}
          />
        );
      })}

      {/* Render Nodes */}
      {positionedNodes.map(node => (
        <Node3D key={node.id} node={node} config={config} />
      ))}
      
      {/* Render Connections */}
      {connections.map(connection => (
        <Connection3D 
          key={connection.id} 
          connection={connection} 
          nodes={positionedNodes} 
        />
      ))}
      
      {/* Ambient Particle Effects */}
      <AmbientParticles config={config} />
    </>
  );
});

// Sphere-based particle system that flows around sphere layers
function SphereParticleSystem({ 
  sphereConfig, 
  layerDistance, 
  color, 
  count = 50, 
  opacity = 0.2, 
  size = 0.8,
  nodeCount,
  spread = 120
}: {
  sphereConfig: { x: number; y: number; z: number; baseRadius: number; };
  layerDistance: number;
  color: string;
  count?: number;
  opacity?: number;
  size?: number;
  nodeCount: number;
  spread?: number;
}) {
  const particles = useMemo(() => {
    if (!sphereConfig || count === 0) return { positions: new Float32Array(0), colors: new Float32Array(0) };
    
    // Calculate how many sphere layers this category has
    const surfaceArea = 4 * Math.PI * sphereConfig.baseRadius * sphereConfig.baseRadius;
    const nodeArea = 70 * 70; // Based on minNodeSpacing
    const baseCapacity = Math.floor(surfaceArea / nodeArea);
    const layersNeeded = Math.max(1, Math.ceil(nodeCount / baseCapacity));
    
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const colorObj = new THREE.Color(color);
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      
      // Distribute particles across all sphere layers
      const layerIndex = Math.floor((i / count) * layersNeeded);
      const currentRadius = sphereConfig.baseRadius + layerIndex * layerDistance;
      
      // Generate deterministic spherical coordinates using index
      const phi = (i * 2.4) % Math.PI; // Polar angle
      const theta = (i * 3.7) % (2 * Math.PI); // Azimuthal angle
      
      // Position particles around sphere with configurable spread
      const spreadFactor = spread / 100; // Convert spread to factor (0-3)
      const radiusOffset = (Math.sin(i * 0.5) * Math.cos(i * 0.3)) * spreadFactor * 50;
      const finalRadius = currentRadius + radiusOffset;
      
      const x = finalRadius * Math.sin(phi) * Math.cos(theta);
      const y = finalRadius * Math.cos(phi);
      const z = finalRadius * Math.sin(phi) * Math.sin(theta);
      
      // Position relative to sphere center
      positions[i3] = sphereConfig.x + x;
      positions[i3 + 1] = sphereConfig.y + y;
      positions[i3 + 2] = sphereConfig.z + z;
      
      colors[i3] = colorObj.r;
      colors[i3 + 1] = colorObj.g;
      colors[i3 + 2] = colorObj.b;
    }
    
    return { positions, colors };
  }, [sphereConfig, layerDistance, color, count, nodeCount]);
  
  if (count === 0) return null;
  
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={particles.colors}
          itemSize={3}
        />
      </bufferGeometry>
       <pointsMaterial
         size={size}
         vertexColors
         transparent
         opacity={opacity}
         blending={THREE.AdditiveBlending}
       />
    </points>
  );
}

// Ambient floating particles for atmosphere
function AmbientParticles({ config }: { config: Scene3DConfig }) {
  const ambientParticles = useMemo(() => {
    const count = 200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      
      // Spread particles throughout the scene
      positions[i3] = (Math.random() - 0.5) * 1000;
      positions[i3 + 1] = (Math.random() - 0.5) * 1000;
      positions[i3 + 2] = (Math.random() - 0.5) * 1000;
      
      // Subtle blue-cyan colors
      colors[i3] = 0.0;
      colors[i3 + 1] = Math.random() * 0.8 + 0.2;
      colors[i3 + 2] = Math.random() * 0.8 + 0.2;
    }
    
    return { positions, colors };
  }, []);
  
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={200}
          array={ambientParticles.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={200}
          array={ambientParticles.colors}
          itemSize={3}
        />
      </bufferGeometry>
       <pointsMaterial
         size={0.5}
         vertexColors
         transparent
         opacity={0.1}
         blending={THREE.AdditiveBlending}
       />
    </points>
  );
}