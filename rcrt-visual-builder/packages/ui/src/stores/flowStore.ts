/**
 * Flow Store
 * Zustand store for managing flow state
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { 
  Node, 
  Edge, 
  Connection,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges
} from '@xyflow/react';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { FlowDefinitionV1 } from '@rcrt-builder/core';

interface FlowState {
  // Flow data
  flowId: string | null;
  flowTitle: string;
  workspace: string;
  nodes: Node[];
  edges: Edge[];
  
  // UI state
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  lastSaved: Date | null;
  
  // Selection state
  selectedNodes: string[];
  selectedEdges: string[];
  
  // History for undo/redo
  history: {
    past: Array<{ nodes: Node[]; edges: Edge[] }>;
    future: Array<{ nodes: Node[]; edges: Edge[] }>;
  };
  
  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  
  // Node operations
  addNode: (node: Node) => void;
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  deleteNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  
  // Edge operations
  addEdge: (edge: Edge) => void;
  updateEdge: (edgeId: string, updates: Partial<Edge>) => void;
  deleteEdge: (edgeId: string) => void;
  
  // Flow operations
  loadFlow: (flowId: string) => Promise<void>;
  saveFlow: () => Promise<void>;
  createFlow: (title: string, workspace: string) => Promise<string>;
  deleteFlow: () => Promise<void>;
  exportFlow: () => any;
  importFlow: (flowData: any) => void;
  
  // History operations
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  
  // Selection operations
  selectNode: (nodeId: string, multiple?: boolean) => void;
  selectEdge: (edgeId: string, multiple?: boolean) => void;
  clearSelection: () => void;
  
  // Utility
  reset: () => void;
  setError: (error: string | null) => void;
}

// Initialize RCRT client
const rcrtClient = new RcrtClientEnhanced(process.env.NEXT_PUBLIC_RCRT_URL || 'http://localhost:8081');

export const useFlowStore = create<FlowState>()(
  immer((set, get) => ({
    // Initial state
    flowId: null,
    flowTitle: 'Untitled Flow',
    workspace: 'workspace:default',
    nodes: [],
    edges: [],
    isLoading: false,
    isSaving: false,
    error: null,
    lastSaved: null,
    selectedNodes: [],
    selectedEdges: [],
    history: {
      past: [],
      future: []
    },

    // Basic setters
    setNodes: (nodes) => set((state) => {
      state.nodes = nodes;
    }),

    setEdges: (edges) => set((state) => {
      state.edges = edges;
    }),

    // React Flow change handlers
    onNodesChange: (changes) => set((state) => {
      state.nodes = applyNodeChanges(changes, state.nodes);
    }),

    onEdgesChange: (changes) => set((state) => {
      state.edges = applyEdgeChanges(changes, state.edges);
    }),

    // Node operations
    addNode: (node) => set((state) => {
      // Save history
      state.history.past.push({ nodes: [...state.nodes], edges: [...state.edges] });
      if (state.history.past.length > 50) state.history.past.shift();
      state.history.future = [];
      
      state.nodes.push(node);
    }),

    updateNode: (nodeId, updates) => set((state) => {
      const index = state.nodes.findIndex(n => n.id === nodeId);
      if (index !== -1) {
        state.nodes[index] = { ...state.nodes[index], ...updates };
      }
    }),

    deleteNode: (nodeId) => set((state) => {
      state.history.past.push({ nodes: [...state.nodes], edges: [...state.edges] });
      state.nodes = state.nodes.filter(n => n.id !== nodeId);
      state.edges = state.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    }),

    duplicateNode: (nodeId) => set((state) => {
      const node = state.nodes.find(n => n.id === nodeId);
      if (node) {
        const newNode: Node = {
          ...node,
          id: `${node.type}_${Date.now()}`,
          position: {
            x: node.position.x + 50,
            y: node.position.y + 50
          },
          selected: false
        };
        state.nodes.push(newNode);
      }
    }),

    // Edge operations
    addEdge: (edge) => set((state) => {
      state.history.past.push({ nodes: [...state.nodes], edges: [...state.edges] });
      state.edges.push(edge);
    }),

    updateEdge: (edgeId, updates) => set((state) => {
      const index = state.edges.findIndex(e => e.id === edgeId);
      if (index !== -1) {
        state.edges[index] = { ...state.edges[index], ...updates };
      }
    }),

    deleteEdge: (edgeId) => set((state) => {
      state.edges = state.edges.filter(e => e.id !== edgeId);
    }),

    // Flow operations
    loadFlow: async (flowId) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const breadcrumb = await rcrtClient.getBreadcrumbFull(flowId);
        const flow = breadcrumb.context as FlowDefinitionV1['context'];
        
        const nodes: Node[] = flow.nodes.map((n: any) => ({
          id: n.id,
          type: n.type.toLowerCase().replace('node', ''),
          position: n.position || { x: 0, y: 0 },
          data: n.config || {}
        }));

        const edges: Edge[] = flow.connections.map((c: any, index: number) => ({
          id: c.id || `edge_${index}`,
          source: c.from.node,
          target: c.to.node,
          sourceHandle: c.from.port,
          targetHandle: c.to.port,
          type: 'default'
        }));

        set((state) => {
          state.flowId = flowId;
          state.flowTitle = breadcrumb.title;
          state.workspace = breadcrumb.tags.find((t: string) => t.startsWith('workspace:')) || 'workspace:default';
          state.nodes = nodes;
          state.edges = edges;
          state.isLoading = false;
          state.lastSaved = new Date(breadcrumb.created_at);
        });
      } catch (error: any) {
        set((state) => {
          state.isLoading = false;
          state.error = error.message;
        });
        throw error;
      }
    },

    saveFlow: async () => {
      const state = get();
      
      set((state) => {
        state.isSaving = true;
        state.error = null;
      });

      try {
        const flowDefinition: Partial<FlowDefinitionV1> = {
          schema_name: 'flow.definition.v1',
          title: state.flowTitle,
          tags: [state.workspace, 'flow:definition', 'editable'],
          context: {
            flow_id: state.flowId || `flow_${Date.now()}`,
            version: 1,
            nodes: state.nodes.map(n => ({
              id: n.id,
              type: n.type === 'llm' ? 'LLMNode' : 
                    n.type === 'agent' ? 'AgentNode' :
                    n.type === 'breadcrumb' ? 'BreadcrumbNode' :
                    `${n.type.charAt(0).toUpperCase()}${n.type.slice(1)}Node`,
              position: n.position,
              config: n.data
            })),
            connections: state.edges.map(e => ({
              id: e.id,
              from: { node: e.source, port: e.sourceHandle || 'output' },
              to: { node: e.target, port: e.targetHandle || 'input' }
            })),
            viewport: { x: 0, y: 0, zoom: 1.0 },
            metadata: {
              created_by: 'visual-builder',
              created_at: new Date().toISOString(),
              last_modified_by: 'visual-builder',
              last_modified_at: new Date().toISOString()
            }
          }
        };

        let result;
        if (state.flowId) {
          // Update existing flow
          const existing = await rcrtClient.getBreadcrumb(state.flowId);
          result = await rcrtClient.updateBreadcrumb(
            state.flowId,
            existing.version,
            flowDefinition
          );
        } else {
          // Create new flow
          result = await rcrtClient.createBreadcrumb(
            flowDefinition,
            `flow-${Date.now()}`
          );
          set((state) => {
            state.flowId = result.id;
          });
        }

        set((state) => {
          state.isSaving = false;
          state.lastSaved = new Date();
        });
      } catch (error: any) {
        set((state) => {
          state.isSaving = false;
          state.error = error.message;
        });
        throw error;
      }
    },

    createFlow: async (title, workspace) => {
      const flowId = `flow_${Date.now()}`;
      
      const flowDefinition: Partial<FlowDefinitionV1> = {
        schema_name: 'flow.definition.v1',
        title,
        tags: [workspace, 'flow:definition', 'editable'],
        context: {
          flow_id: flowId,
          version: 1,
          nodes: [],
          connections: [],
          viewport: { x: 0, y: 0, zoom: 1.0 },
          metadata: {
            created_by: 'visual-builder',
            created_at: new Date().toISOString()
          }
        }
      };

      const result = await rcrtClient.createBreadcrumb(flowDefinition, flowId);
      
      set((state) => {
        state.flowId = result.id;
        state.flowTitle = title;
        state.workspace = workspace;
        state.nodes = [];
        state.edges = [];
      });

      return result.id;
    },

    deleteFlow: async () => {
      const state = get();
      if (state.flowId) {
        const existing = await rcrtClient.getBreadcrumb(state.flowId);
        await rcrtClient.deleteBreadcrumb(state.flowId, existing.version);
        
        set((state) => {
          state.flowId = null;
          state.nodes = [];
          state.edges = [];
        });
      }
    },

    exportFlow: () => {
      const state = get();
      return {
        flowId: state.flowId,
        title: state.flowTitle,
        workspace: state.workspace,
        nodes: state.nodes,
        edges: state.edges,
        metadata: {
          exported_at: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    },

    importFlow: (flowData) => set((state) => {
      state.flowId = null; // New flow
      state.flowTitle = flowData.title || 'Imported Flow';
      state.workspace = flowData.workspace || 'workspace:default';
      state.nodes = flowData.nodes || [];
      state.edges = flowData.edges || [];
      state.history = { past: [], future: [] };
    }),

    // History operations
    undo: () => set((state) => {
      if (state.history.past.length > 0) {
        const previous = state.history.past.pop()!;
        state.history.future.push({ nodes: state.nodes, edges: state.edges });
        state.nodes = previous.nodes;
        state.edges = previous.edges;
      }
    }),

    redo: () => set((state) => {
      if (state.history.future.length > 0) {
        const next = state.history.future.pop()!;
        state.history.past.push({ nodes: state.nodes, edges: state.edges });
        state.nodes = next.nodes;
        state.edges = next.edges;
      }
    }),

    clearHistory: () => set((state) => {
      state.history = { past: [], future: [] };
    }),

    // Selection operations
    selectNode: (nodeId, multiple = false) => set((state) => {
      if (multiple) {
        if (!state.selectedNodes.includes(nodeId)) {
          state.selectedNodes.push(nodeId);
        }
      } else {
        state.selectedNodes = [nodeId];
        state.selectedEdges = [];
      }
    }),

    selectEdge: (edgeId, multiple = false) => set((state) => {
      if (multiple) {
        if (!state.selectedEdges.includes(edgeId)) {
          state.selectedEdges.push(edgeId);
        }
      } else {
        state.selectedEdges = [edgeId];
        state.selectedNodes = [];
      }
    }),

    clearSelection: () => set((state) => {
      state.selectedNodes = [];
      state.selectedEdges = [];
    }),

    // Utility
    reset: () => set((state) => {
      state.flowId = null;
      state.flowTitle = 'Untitled Flow';
      state.workspace = 'workspace:default';
      state.nodes = [];
      state.edges = [];
      state.isLoading = false;
      state.isSaving = false;
      state.error = null;
      state.lastSaved = null;
      state.selectedNodes = [];
      state.selectedEdges = [];
      state.history = { past: [], future: [] };
    }),

    setError: (error) => set((state) => {
      state.error = error;
    })
  }))
);
