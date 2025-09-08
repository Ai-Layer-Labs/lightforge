/**
 * UI Package Types
 * Type definitions for the visual builder UI
 */

import { Node, Edge, Connection } from '@xyflow/react';

export interface FlowNode extends Node {
  data: {
    workspace?: string;
    [key: string]: any;
  };
}

export interface FlowEdge extends Edge {
  data?: {
    [key: string]: any;
  };
}

export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface NodeTemplate {
  type: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  category: string;
  config?: any;
}

export interface WorkspaceConfig {
  id: string;
  name: string;
  description?: string;
  settings?: Record<string, any>;
  quotas?: {
    max_breadcrumbs?: number;
    max_agents?: number;
    max_flows?: number;
  };
}

export interface ConnectionValidation {
  isValid: boolean;
  reason?: string;
}

export interface CanvasState {
  selectedNodes: string[];
  selectedEdges: string[];
  isConnecting: boolean;
  isDragging: boolean;
  zoom: number;
  position: { x: number; y: number };
}
