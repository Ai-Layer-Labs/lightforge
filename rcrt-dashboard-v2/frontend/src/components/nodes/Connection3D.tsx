/**
 * THE RCRT WAY - 3D Connection Rendering
 * Clean implementation using canonical connection types
 */

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
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
  
  // Calculate 3D positions
  const fromPos = useMemo(() => new THREE.Vector3(
    fromNode.position.x,
    fromNode.position.y,
    fromNode.position.z
  ), [fromNode.position.x, fromNode.position.y, fromNode.position.z]);
  
  const toPos = useMemo(() => new THREE.Vector3(
    toNode.position.x,
    toNode.position.y,
    toNode.position.z
  ), [toNode.position.x, toNode.position.y, toNode.position.z]);
  
  // Create curved path for connection
  const curve = useMemo(() => {
    const midPoint = fromPos.clone().add(toPos).multiplyScalar(0.5);
    
    // Add curve height based on distance
    const distance = fromPos.distanceTo(toPos);
    const curveHeight = Math.min(distance * 0.1, 50);
    midPoint.y += curveHeight;
    
    return new THREE.QuadraticBezierCurve3(fromPos, midPoint, toPos);
  }, [fromPos, toPos]);
  
  // Tube radius based on connection weight and style
  const tubeRadius = useMemo(() => {
    const baseRadius = connection.metadata.weight * 0.1;
    // Make dotted lines thinner
    return connection.metadata.style === 'dotted' ? baseRadius * 0.7 : baseRadius;
  }, [connection.metadata.weight, connection.metadata.style]);
  
  // Material for the tube
  const tubeMaterial = useMemo(() => {
    const color = new THREE.Color(connection.metadata.color);
    const opacity = connection.state.highlighted ? 0.7 : 0.4;
    
    // For dotted/dashed, create segmented appearance
    if (connection.metadata.style === 'dotted' || connection.metadata.style === 'dashed') {
      return (
        <meshBasicMaterial 
          color={color}
          transparent
          opacity={opacity * 0.8}
        />
      );
    }
    
    // Solid line - normal appearance
    return (
      <meshBasicMaterial 
        color={color}
        transparent
        opacity={opacity}
      />
    );
  }, [connection.metadata.color, connection.metadata.style, connection.state.highlighted]);
  
  // Animated particle for triggered connections
  const AnimatedParticle = () => {
    const particleRef = useRef<THREE.Mesh>(null);
    
    useFrame((state) => {
      if (particleRef.current && connection.metadata.animated) {
        const t = (state.clock.elapsedTime * 0.3) % 1;
        const position = curve.getPoint(t);
        particleRef.current.position.copy(position);
      }
    });
    
    if (!connection.metadata.animated) return null;
    
    return (
      <mesh ref={particleRef}>
        <sphereGeometry args={[1.5, 8, 8]} />
        <meshBasicMaterial 
          color={connection.metadata.color}
          transparent
          opacity={0.9}
        />
      </mesh>
    );
  };
  
  // Calculate arrow direction
  const arrowRotation = useMemo(() => {
    const direction = toPos.clone().sub(fromPos).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(up, direction);
    return quaternion;
  }, [fromPos, toPos]);
  
  // Arrow position (at destination, offset by node radius)
  const arrowPosition = useMemo(() => {
    const direction = toPos.clone().sub(fromPos).normalize();
    return toPos.clone().sub(direction.multiplyScalar(8)); // Offset by ~8 units
  }, [fromPos, toPos]);
  
  return (
    <group>
      {/* Main tube connection */}
      <mesh>
        <tubeGeometry 
          args={[curve, 32, tubeRadius, 8, false]} 
        />
        {tubeMaterial}
      </mesh>
      
      {/* Animated particle for triggered connections */}
      <AnimatedParticle />
      
      {/* Arrow head at destination */}
      <group position={arrowPosition} quaternion={arrowRotation}>
        <mesh>
          <coneGeometry args={[2, 6, 8]} />
          <meshBasicMaterial 
            color={connection.metadata.color}
            transparent
            opacity={0.8}
          />
        </mesh>
      </group>
      
      {/* For dotted/dashed - add spheres along path for visual effect */}
      {(connection.metadata.style === 'dotted' || connection.metadata.style === 'dashed') && (
        <DottedLine curve={curve} color={connection.metadata.color} isDashed={connection.metadata.style === 'dashed'} />
      )}
    </group>
  );
}

/**
 * Render dotted/dashed line as series of spheres
 */
function DottedLine({ curve, color, isDashed }: { curve: THREE.QuadraticBezierCurve3; color: string; isDashed: boolean }) {
  const points = useMemo(() => {
    const count = isDashed ? 12 : 24;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= count; i++) {
      if (isDashed) {
        // Dashed: show every other segment
        if (i % 2 === 0) {
          points.push(curve.getPoint(i / count));
        }
      } else {
        // Dotted: show all points
        points.push(curve.getPoint(i / count));
      }
    }
    return points;
  }, [curve, isDashed]);
  
  const colorObj = useMemo(() => new THREE.Color(color), [color]);
  
  return (
    <>
      {points.map((point, i) => (
        <mesh key={i} position={point}>
          <sphereGeometry args={[isDashed ? 0.8 : 0.5, 8, 8]} />
          <meshBasicMaterial color={colorObj} transparent opacity={0.6} />
        </mesh>
      ))}
    </>
  );
}
