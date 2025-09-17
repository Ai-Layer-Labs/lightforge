import React, { createContext, useContext, ReactNode } from 'react';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { enableMapSet } from 'immer';
import { RenderNode, RenderConnection, NodeType, ConnectionType, Position3D, FilterState } from '../types/rcrt';

// Enable Immer MapSet plugin
enableMapSet();

// ============ DASHBOARD STATE INTERFACE ============

interface DashboardState {
  // Core data
  nodes: Map<string, RenderNode>;
  connections: Map<string, RenderConnection>;
  
  // Configuration (loaded from breadcrumbs)
  config: DashboardConfig | null;
  workspaces: Map<string, WorkspaceConfig>;
  userPreferences: UserPreferences | null;
  
  // UI state
  currentView: '2d' | '3d';
  selectedNodeIds: string[];
  hoveredNodeId: string | null;
  
  // Camera and viewport
  camera: {
    position: Position3D;
    target: Position3D;
    zoom: number;
  };
  
  // Filters
  activeFilters: FilterState;
  
  // Real-time state
  eventStream: {
    connected: boolean;
    lastEventTime: string | null;
    eventCount: number;
  };
  
  // Loading states
  loading: {
    initialLoad: boolean;
    saving: boolean;
    operations: Map<string, boolean>;
  };
  
  // ============ ACTIONS ============
  
  // Node management
  addNode: (node: RenderNode) => void;
  updateNode: (id: string, updates: Partial<RenderNode>) => void;
  deleteNode: (id: string) => void;
  setNodes: (nodes: RenderNode[]) => void;
  
  // Connection management
  addConnection: (connection: RenderConnection) => void;
  updateConnection: (id: string, updates: Partial<RenderConnection>) => void;
  deleteConnection: (id: string) => void;
  setConnections: (connections: RenderConnection[]) => void;
  refreshConnections: () => Promise<void>;
  
  // Selection
  selectNode: (id: string, multiSelect?: boolean) => void;
  deselectNode: (id: string) => void;
  deselectAll: () => void;
  setHoveredNode: (id: string | null) => void;
  
  // View management
  switchView: (view: '2d' | '3d') => void;
  updateCamera: (camera: Partial<DashboardState['camera']>) => void;
  
  // Configuration
  loadConfiguration: () => Promise<void>;
  updateConfiguration: (config: Partial<DashboardConfig>) => Promise<void>;
  saveLayout: () => Promise<void>;
  
  // Filtering
  applyFilter: (filterId: string, filterFn: (node: RenderNode) => boolean) => void;
  removeFilter: (filterId: string) => void;
  clearFilters: () => void;
  
  // Real-time
  setEventStreamConnected: (connected: boolean) => void;
  incrementEventCount: () => void;
  
  // Loading states
  setLoading: (operation: string, loading: boolean) => void;
}

// ============ CONFIGURATION TYPES ============

interface DashboardConfig {
  version: string;
  default_view: '2d' | '3d';
  real_time_updates: boolean;
  animation_speed: 'slow' | 'normal' | 'fast';
  auto_layout: {
    enabled: boolean;
    algorithm: 'force_directed' | 'hierarchical' | 'circular';
    spacing: number;
  };
  connection_styles: Record<string, {
    color: string;
    style: 'solid' | 'dashed' | 'dotted';
    width: number;
    animated?: boolean;
  }>;
  node_styles: Record<string, {
    icon: string;
    color: string;
    size: 'small' | 'medium' | 'large';
    pulse?: boolean;
    glow?: boolean;
  }>;
  chat_visualization: {
    show_bubbles: boolean;
    bubble_duration: number;
    thinking_animation: boolean;
    connection_flow: boolean;
  };
}

interface WorkspaceConfig {
  workspace_id: string;
  display_name: string;
  description: string;
  theme: {
    primary_color: string;
    accent_color: string;
    background: string;
  };
  default_view: '2d' | '3d';
  auto_filters: string[];
  visualization_rules: any;
  real_time_features: any;
}

interface UserPreferences {
  user_id: string;
  theme: 'dark' | 'light';
  preferred_view: '2d' | '3d';
  auto_save_layout: boolean;
  notification_settings: {
    show_chat_bubbles: boolean;
    animate_connections: boolean;
    sound_enabled: boolean;
  };
  workspace_favorites: string[];
}

// ============ ZUSTAND STORE ============

export const useDashboardStore = create<DashboardState>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      nodes: new Map(),
      connections: new Map(),
      config: null,
      workspaces: new Map(),
      userPreferences: null,
      currentView: '2d',
      selectedNodeIds: [],
      hoveredNodeId: null,
      camera: {
        position: { x: 0, y: 0, z: 500 },
        target: { x: 0, y: 0, z: 0 },
        zoom: 1,
      },
      activeFilters: {
        text: '',
        tags: [],
        nodeTypes: [],
        schemas: [],
        workspaces: [],
      },
      eventStream: {
        connected: false,
        lastEventTime: null,
        eventCount: 0,
      },
      loading: {
        initialLoad: true,
        saving: false,
        operations: new Map(),
      },
      
      // ============ NODE ACTIONS ============
      
      addNode: (node) => set((state) => {
        state.nodes.set(node.id, node);
      }),
      
      updateNode: (id, updates) => set((state) => {
        const node = state.nodes.get(id);
        if (node) {
          Object.assign(node, updates);
        }
      }),
      
      deleteNode: (id) => set((state) => {
        state.nodes.delete(id);
        // Remove from selection if selected
        const index = state.selectedNodeIds.indexOf(id);
        if (index > -1) {
          state.selectedNodeIds.splice(index, 1);
        }
        // Remove related connections
        state.connections.forEach((connection, connectionId) => {
          if (connection.fromNodeId === id || connection.toNodeId === id) {
            state.connections.delete(connectionId);
          }
        });
      }),
      
      setNodes: (nodes) => set((state) => {
        state.nodes.clear();
        nodes.forEach(node => {
          state.nodes.set(node.id, node);
        });
      }),
      
      // ============ CONNECTION ACTIONS ============
      
      addConnection: (connection) => set((state) => {
        state.connections.set(connection.id, connection);
      }),
      
      updateConnection: (id, updates) => set((state) => {
        const connection = state.connections.get(id);
        if (connection) {
          Object.assign(connection, updates);
        }
      }),
      
      deleteConnection: (id) => set((state) => {
        state.connections.delete(id);
      }),
      
      setConnections: (connections) => set((state) => {
        state.connections.clear();
        connections.forEach(connection => {
          state.connections.set(connection.id, connection);
        });
      }),
      
      refreshConnections: async () => {
        // This will be implemented to discover connections dynamically
        console.log('🔄 Refreshing connections...');
        // TODO: Implement connection discovery
      },
      
      // ============ SELECTION ACTIONS ============
      
      selectNode: (id, multiSelect = false) => set((state) => {
        if (multiSelect) {
          if (!state.selectedNodeIds.includes(id)) {
            state.selectedNodeIds.push(id);
          }
        } else {
          state.selectedNodeIds = [id];
        }
        
        // Update node state
        state.nodes.forEach((node) => {
          node.state.selected = state.selectedNodeIds.includes(node.id);
        });
      }),
      
      deselectNode: (id) => set((state) => {
        const index = state.selectedNodeIds.indexOf(id);
        if (index > -1) {
          state.selectedNodeIds.splice(index, 1);
        }
        
        const node = state.nodes.get(id);
        if (node) {
          node.state.selected = false;
        }
      }),
      
      deselectAll: () => set((state) => {
        state.selectedNodeIds = [];
        state.nodes.forEach((node) => {
          node.state.selected = false;
        });
      }),
      
      setHoveredNode: (id) => set((state) => {
        // Clear previous hover state
        if (state.hoveredNodeId) {
          const prevNode = state.nodes.get(state.hoveredNodeId);
          if (prevNode) {
            prevNode.state.highlighted = false;
          }
        }
        
        // Set new hover state
        state.hoveredNodeId = id;
        if (id) {
          const node = state.nodes.get(id);
          if (node) {
            node.state.highlighted = true;
          }
        }
      }),
      
      // ============ VIEW ACTIONS ============
      
      switchView: (view) => set((state) => {
        state.currentView = view;
      }),
      
      updateCamera: (camera) => set((state) => {
        Object.assign(state.camera, camera);
      }),
      
      // ============ CONFIGURATION ACTIONS ============
      
      loadConfiguration: async () => {
        console.log('📋 Loading dashboard configuration from breadcrumbs...');
        set((state) => {
          state.loading.initialLoad = true;
        });
        
        try {
          // This will be implemented to load config from RCRT breadcrumbs
          // TODO: Implement configuration loading
          
          set((state) => {
            state.loading.initialLoad = false;
          });
        } catch (error) {
          console.error('Failed to load configuration:', error);
          set((state) => {
            state.loading.initialLoad = false;
          });
        }
      },
      
      updateConfiguration: async (config) => {
        console.log('💾 Updating dashboard configuration...');
        // TODO: Save config as breadcrumb
      },
      
      saveLayout: async () => {
        console.log('💾 Saving layout to breadcrumbs...');
        // TODO: Save layout as breadcrumb
      },
      
      // ============ FILTER ACTIONS ============
      
      applyFilter: (filterId, filterFn) => set((state) => {
        // Apply filter to all nodes
        state.nodes.forEach((node) => {
          node.state.filtered = !filterFn(node);
        });
        
        // Update connection visibility based on node visibility
        state.connections.forEach((connection) => {
          const fromNode = state.nodes.get(connection.fromNodeId);
          const toNode = state.nodes.get(connection.toNodeId);
          
          connection.state.visible = 
            fromNode && !fromNode.state.filtered &&
            toNode && !toNode.state.filtered;
        });
      }),
      
      removeFilter: (filterId) => set((state) => {
        // TODO: Implement filter removal
      }),
      
      clearFilters: () => set((state) => {
        state.activeFilters = {
          text: '',
          tags: [],
          nodeTypes: [],
          schemas: [],
          workspaces: [],
        };
        
        // Make all nodes visible
        state.nodes.forEach((node) => {
          node.state.filtered = false;
        });
        
        // Make all connections visible
        state.connections.forEach((connection) => {
          connection.state.visible = true;
        });
      }),
      
      // ============ REAL-TIME ACTIONS ============
      
      setEventStreamConnected: (connected) => set((state) => {
        state.eventStream.connected = connected;
        if (connected) {
          state.eventStream.lastEventTime = new Date().toISOString();
        }
      }),
      
      incrementEventCount: () => set((state) => {
        state.eventStream.eventCount += 1;
        state.eventStream.lastEventTime = new Date().toISOString();
      }),
      
      // ============ LOADING ACTIONS ============
      
      setLoading: (operation, loading) => set((state) => {
        state.loading.operations.set(operation, loading);
      }),
    }))
  )
);

// ============ REACT CONTEXT PROVIDER ============

const DashboardContext = createContext<ReturnType<typeof useDashboardStore> | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const store = useDashboardStore();
  
  return (
    <DashboardContext.Provider value={store}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}

// ============ SELECTOR HOOKS ============

export const useNodes = () => useDashboardStore((state) => Array.from(state.nodes.values()));
export const useConnections = () => useDashboardStore((state) => Array.from(state.connections.values()));
export const useSelectedNodes = () => useDashboardStore((state) => 
  state.selectedNodeIds.map(id => state.nodes.get(id)).filter(Boolean) as RenderNode[]
);
export const useCurrentView = () => useDashboardStore((state) => state.currentView);
export const useCamera = () => useDashboardStore((state) => state.camera);
export const useEventStream = () => useDashboardStore((state) => state.eventStream);
export const useLoading = () => useDashboardStore((state) => state.loading);

// ============ COMPUTED SELECTORS ============

export const useVisibleNodes = () => useDashboardStore((state) => 
  Array.from(state.nodes.values()).filter(node => !node.state.filtered)
);

export const useVisibleConnections = () => useDashboardStore((state) => 
  Array.from(state.connections.values()).filter(connection => connection.state.visible)
);

export const useNodesByType = (type: NodeType) => useDashboardStore((state) => 
  Array.from(state.nodes.values()).filter(node => node.type === type)
);

export const useConnectionsByType = (type: ConnectionType) => useDashboardStore((state) => 
  Array.from(state.connections.values()).filter(connection => connection.type === type)
);
