import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { RenderConnection, RenderNode } from '../../types/rcrt';

interface Connection3DProps {
  connection: RenderConnection;
  nodes: RenderNode[];
}

export function Connection3D({ connection, nodes }: Connection3DProps) {
  // Don't render if not visible
  if (!connection.state.visible) return null;
  
  // Find connected nodes
  const fromNode = nodes.find(n => n.id === connection.fromNodeId);
  const toNode = nodes.find(n => n.id === connection.toNodeId);
  
  if (!fromNode || !toNode) return null;
  if (fromNode.state.filtered || toNode.state.filtered) return null;
  
  // Calculate 3D positions (use actual positions, no scaling)
  const fromPos = new THREE.Vector3(
    fromNode.position.x,
    fromNode.position.y,
    fromNode.position.z
  );
  
  const toPos = new THREE.Vector3(
    toNode.position.x,
    toNode.position.y,
    toNode.position.z
  );
  
  // Create curved path for connection
  const curve = useMemo(() => {
    const midPoint = fromPos.clone().add(toPos).multiplyScalar(0.5);
    
    // Add some curve based on distance for better visibility
    const distance = fromPos.distanceTo(toPos);
    const curveHeight = Math.min(distance * 0.1, 50);
    midPoint.y += curveHeight;
    
    return new THREE.QuadraticBezierCurve3(fromPos, midPoint, toPos);
  }, [fromPos.x, fromPos.y, fromPos.z, toPos.x, toPos.y, toPos.z]);
  
  // Generate points along the curve
  const points = useMemo(() => curve.getPoints(50), [curve]);
  
  // Create geometry from points
  const geometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [points]);
  
  // Line material based on connection type
  const getMaterial = () => {
    const color = new THREE.Color(connection.metadata.color);
    
    return (
      <lineBasicMaterial
        color={color}
        transparent={true}
        opacity={connection.state.highlighted ? 0.9 : 0.6}
        linewidth={connection.metadata.weight} // Note: linewidth doesn't work in WebGL
      />
    );
  };
  
  // Animated flow particle for certain connection types
  const AnimatedParticle = () => {
    const particleRef = React.useRef<THREE.Mesh>(null);
    
    useFrame((state) => {
      if (particleRef.current && connection.metadata.animated) {
        // Move particle along curve
        const t = (state.clock.elapsedTime * 0.2) % 1;
        const position = curve.getPoint(t);
        particleRef.current.position.copy(position);
      }
    });
    
    if (!connection.metadata.animated) return null;
    
    return (
      <mesh ref={particleRef}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial 
          color={connection.metadata.color}
          transparent
          opacity={0.8}
        />
      </mesh>
    );
  };
  
  // Get node colors for gradient
  const getNodeColor = (node: RenderNode): string => {
    switch (node.type) {
      case 'breadcrumb': return '#00f5ff'; // Cyan
      case 'agent': return '#ffa500'; // Orange
      case 'agent-definition': return '#9333ea'; // Vibrant Purple
      case 'tool': return '#00ff88'; // Green
      case 'secret': return '#ff6b6b'; // Red
      case 'chat': return '#8a2be2'; // Purple
      default: return '#888888'; // Gray
    }
  };

  const fromColor = getNodeColor(fromNode);
  const toColor = getNodeColor(toNode);

  return (
    <group>
      {/* Use TubeGeometry with gradient material */}
      <mesh>
        <tubeGeometry 
          args={[curve, 32, Math.max(0.2, connection.metadata.weight * 0.1), 8, false]} 
        />
        <GradientTubeMaterial 
          fromColor={fromColor}
          toColor={toColor}
          opacity={connection.state.highlighted ? 0.4 : 0.25}
        />
      </mesh>
      
      {/* Animated particle */}
      <AnimatedParticle />
      
      {/* Arrow head at destination */}
      <group position={toPos}>
        <mesh>
          <coneGeometry args={[2, 6, 8]} />
          <meshBasicMaterial color={connection.metadata.color} />
        </mesh>
      </group>
    </group>
  );
}

// Gradient tube material component
function GradientTubeMaterial({ fromColor, toColor, opacity }: {
  fromColor: string;
  toColor: string;
  opacity: number;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  // Create gradient shader material
  const shaderMaterial = useMemo(() => {
    const fromColorObj = new THREE.Color(fromColor);
    const toColorObj = new THREE.Color(toColor);
    
    return new THREE.ShaderMaterial({
      uniforms: {
        fromColor: { value: fromColorObj },
        toColor: { value: toColorObj },
        opacity: { value: opacity },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 fromColor;
        uniform vec3 toColor;
        uniform float opacity;
        varying vec2 vUv;
        
        void main() {
          // Create gradient along the tube length (v coordinate)
          vec3 color = mix(fromColor, toColor, vUv.y);
          gl_FragColor = vec4(color, opacity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
  }, [fromColor, toColor, opacity]);
  
  // Update uniforms when colors change
  React.useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.fromColor.value = new THREE.Color(fromColor);
      materialRef.current.uniforms.toColor.value = new THREE.Color(toColor);
      materialRef.current.uniforms.opacity.value = opacity;
    }
  }, [fromColor, toColor, opacity]);
  
  return <primitive ref={materialRef} object={shaderMaterial} />;
}
