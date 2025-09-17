import { createNoise3D } from 'simplex-noise';
import { RenderNode, Position3D } from '../types/rcrt';
import { Scene3DConfig } from '../components/panels/Scene3DControls';

/**
 * Smart spherical layering system for 3D breadcrumb positioning
 * Creates new layers only when previous layers are full
 */
export class SphericalLayoutManager {
  private noise3D = createNoise3D();
  private noiseScale = 0.01;
  
  /**
   * Calculate how many nodes can fit in a spherical layer
   * Based on circumference and minimum spacing between nodes
   */
  calculateLayerCapacity(radius: number, minSpacing: number = 100): number {
    const circumference = 2 * Math.PI * radius;
    const nodesOnCircumference = Math.floor(circumference / minSpacing);
    
    // For a sphere, we can have multiple "rings" at different heights
    // Approximate by dividing sphere into horizontal rings
    const sphereHeight = radius * 2;
    const numberOfRings = Math.max(1, Math.floor(sphereHeight / minSpacing));
    
    // Total capacity is sum of all rings (larger rings in middle, smaller at poles)
    let totalCapacity = 0;
    for (let ring = 0; ring < numberOfRings; ring++) {
      const ringHeight = (ring / numberOfRings) * sphereHeight - radius;
      const ringRadius = Math.sqrt(radius * radius - ringHeight * ringHeight);
      const ringCircumference = 2 * Math.PI * ringRadius;
      const nodesInRing = Math.max(1, Math.floor(ringCircumference / minSpacing));
      totalCapacity += nodesInRing;
    }
    
    return totalCapacity;
  }
  
  /**
   * Distribute nodes on sphere surfaces with automatic layering
   * Nodes are positioned on the SURFACE of spheres, creating new layers when full
   */
  distributeNodesOnSphereSurfaces(
    nodes: RenderNode[], 
    sphereConfig: { x: number; y: number; z: number; baseRadius: number; },
    layerDistance: number,
    minSpacing: number
  ): { nodes: RenderNode[]; layers: Array<{ radius: number; capacity: number; nodeCount: number; }> } {
    if (nodes.length === 0) return { nodes: [], layers: [] };
    
    const layers: Array<{ radius: number; capacity: number; nodeCount: number; }> = [];
    const positionedNodes: RenderNode[] = [];
    let remainingNodes = [...nodes];
    let currentRadius = sphereConfig.baseRadius;
    let layerIndex = 0;
    
    while (remainingNodes.length > 0) {
      // Calculate how many nodes can fit on this sphere surface
      const surfaceArea = 4 * Math.PI * currentRadius * currentRadius;
      const nodeArea = minSpacing * minSpacing; // Approximate area per node
      const capacity = Math.floor(surfaceArea / nodeArea);
      
      // Take nodes for this layer
      const layerNodes = remainingNodes.splice(0, Math.min(capacity, remainingNodes.length));
      
      // Position nodes on sphere surface
      layerNodes.forEach((node, index) => {
        const position = this.positionNodeOnSphereSurface(
          node,
          index,
          layerNodes.length,
          currentRadius,
          sphereConfig
        );
        
        positionedNodes.push({
          ...node,
          position,
        });
      });
      
      layers.push({
        radius: currentRadius,
        capacity,
        nodeCount: layerNodes.length,
      });
      
      console.log(`🌐 Layer ${layerIndex + 1}: radius=${currentRadius.toFixed(1)}, capacity=${capacity}, nodes=${layerNodes.length}`);
      
      // Prepare next layer
      layerIndex++;
      currentRadius += layerDistance;
    }
    
    return { nodes: positionedNodes, layers };
  }
  
  /**
   * Position a node on the surface of a sphere with even distribution
   */
  private positionNodeOnSphereSurface(
    node: RenderNode,
    index: number,
    totalNodes: number,
    radius: number,
    sphereCenter: { x: number; y: number; z: number; }
  ): Position3D {
    // Use Fibonacci sphere distribution for even spacing
    // This ensures nodes are evenly distributed around the entire sphere surface
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const angleIncrement = 2 * Math.PI / goldenRatio;
    
    // Calculate spherical coordinates for even distribution
    // Handle single node case to avoid division by zero
    const y = totalNodes === 1 ? 0 : 1 - (index / (totalNodes - 1)) * 2; // y goes from 1 to -1
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = angleIncrement * index;
    
    // Add some Perlin noise variation for natural look
    const seedX = node.id.charCodeAt(0) * this.noiseScale;
    const seedY = node.id.charCodeAt(1) * this.noiseScale;
    const seedZ = node.id.charCodeAt(2) * this.noiseScale;
    
    const noiseVariation = 0.1; // Small variation to break perfect uniformity
    const noiseX = this.noise3D(seedX, seedY, seedZ) * noiseVariation;
    const noiseY = this.noise3D(seedY, seedZ, seedX) * noiseVariation;
    const noiseTheta = this.noise3D(seedZ, seedX, seedY) * noiseVariation;
    
    // Apply noise variation
    const finalY = Math.max(-1, Math.min(1, y + noiseY));
    const finalRadiusAtY = Math.sqrt(1 - finalY * finalY);
    const finalTheta = theta + noiseTheta;
    
    // Convert to Cartesian coordinates on sphere surface
    const x = radius * finalRadiusAtY * Math.cos(finalTheta) + noiseX * radius * 0.05;
    const finalYPos = radius * finalY;
    const z = radius * finalRadiusAtY * Math.sin(finalTheta);
    
    // Debug logging
    if (index < 3) {
      console.log(`🌐 ${node.type} ${index} EVENLY DISTRIBUTED: y=${finalY.toFixed(2)}, theta=${finalTheta.toFixed(2)}, pos(${x.toFixed(1)}, ${finalYPos.toFixed(1)}, ${z.toFixed(1)})`);
    }
    
    return {
      x: sphereCenter.x + x,
      y: sphereCenter.y + finalYPos,
      z: sphereCenter.z + z,
    };
  }
  
  /**
   * Position a single node within a spherical layer using Perlin noise
   */
  private positionNodeInSphere(
    node: RenderNode,
    index: number,
    totalInLayer: number,
    radius: number,
    yOffset: number,
    config: Scene3DConfig
  ): Position3D {
    // Base spherical coordinates
    const angleStep = (2 * Math.PI) / totalInLayer;
    const baseAngle = index * angleStep;
    
    // Add Perlin noise for natural variation
    const noiseOffset = this.noise3D(
      node.id.charCodeAt(0) * this.noiseScale,
      node.id.charCodeAt(1) * this.noiseScale,
      index * this.noiseScale
    );
    
    const angle = baseAngle + noiseOffset * 0.5; // Slight angular variation
    const radiusVariation = this.noise3D(
      index * this.noiseScale,
      node.id.charCodeAt(2) * this.noiseScale,
      radius * this.noiseScale
    );
    
    const finalRadius = radius + radiusVariation * 30; // ±30 unit radius variation
    
    // True 3D spherical positioning using spherical coordinates
    // Generate phi (polar angle) and theta (azimuthal angle) using noise
    const phiNoise = this.noise3D(
      node.id.charCodeAt(3) * this.noiseScale,
      index * this.noiseScale,
      radius * this.noiseScale
    );
    
    const phi = Math.abs(phiNoise) * Math.PI; // Polar angle (0 to π)
    const theta = angle; // Use the calculated angle for azimuthal
    
    // Convert spherical coordinates to Cartesian for true 3D sphere
    const x = finalRadius * Math.sin(phi) * Math.cos(theta);
    const y = yOffset + finalRadius * Math.cos(phi) + radiusVariation * config.layerVariation;
    const z = finalRadius * Math.sin(phi) * Math.sin(theta);
    
    // Debug logging for breadcrumb spherical positioning
    if (index < 3) {
      console.log(`🌐 Breadcrumb ${index}: phi=${phi.toFixed(2)}, theta=${theta.toFixed(2)}, radius=${finalRadius.toFixed(1)}, pos(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
    }
    
    return { x, y, z };
  }
  
  /**
   * Position core category nodes using Perlin noise 3D cluster balls
   * Creates organic, spherical clusters for each node type
   */
  positionCoreNodes(
    nodes: RenderNode[],
    basePosition: Position3D,
    config: Scene3DConfig
  ): RenderNode[] {
    if (nodes.length === 0) return [];
    
    // Calculate cluster ball radius based on number of nodes
    const clusterRadius = Math.max(50, Math.sqrt(nodes.length) * 25);
    
    return nodes.map((node, index) => {
      // Use node ID for consistent noise generation (deterministic)
      const seedX = node.id.charCodeAt(0) * this.noiseScale;
      const seedY = node.id.charCodeAt(1) * this.noiseScale;
      const seedZ = node.id.charCodeAt(2) * this.noiseScale;
      
      // Generate 3D Perlin noise for spherical distribution
      const noiseX = this.noise3D(seedX, seedY, seedZ);
      const noiseY = this.noise3D(seedY, seedZ, seedX);
      const noiseZ = this.noise3D(seedZ, seedX, seedY);
      
      // Create spherical cluster using noise with configurable spread
      const phi = Math.abs(noiseX) * Math.PI; // Polar angle (0 to π)
      const theta = noiseY * 2 * Math.PI; // Azimuthal angle (0 to 2π)
      const radiusNoise = Math.abs(noiseZ); // Distance from center (0 to 1)
      
      // Apply configurable spread to each axis
      const spreadRadius = Math.min(config.clusterSpreadX, config.clusterSpreadY, config.clusterSpreadZ);
      const r = radiusNoise * spreadRadius;
      
      // Convert to Cartesian with individual axis scaling
      let x = r * Math.sin(phi) * Math.cos(theta);
      let y = r * Math.sin(phi) * Math.sin(theta);
      let z = r * Math.cos(phi);
      
      // Apply individual axis spread multipliers
      x *= (config.clusterSpreadX / spreadRadius);
      y *= (config.clusterSpreadY / spreadRadius);
      z *= (config.clusterSpreadZ / spreadRadius);
      
      // Add vertical layering with configurable spacing
      const layerOffset = index * config.verticalSpacing - (nodes.length * config.verticalSpacing / 2);
      
      // Debug logging for first few nodes
      if (index < 2) {
        console.log(`🔮 Node ${index} in cluster: spread(${config.clusterSpreadX}, ${config.clusterSpreadY}, ${config.clusterSpreadZ}), final pos(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
      }
      
      return {
        ...node,
        position: {
          x: basePosition.x + x,
          y: basePosition.y + y + layerOffset,
          z: basePosition.z + z,
        }
      };
    });
  }
  
  /**
   * Create a 3D cluster ball visualization mesh for debugging/visualization
   */
  createClusterBallMesh(
    position: Position3D,
    radius: number,
    color: string,
    opacity: number = 0.1
  ) {
    return {
      position: [position.x, position.y, position.z] as [number, number, number],
      radius,
      color,
      opacity,
    };
  }
}

export const sphericalLayout = new SphericalLayoutManager();
