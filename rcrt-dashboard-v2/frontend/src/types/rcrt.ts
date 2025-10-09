/**
 * RCRT Dashboard v2 - Type Definitions
 * 
 * Comprehensive TypeScript types for the RCRT ecosystem
 */

// ============ CORE RCRT TYPES ============

export interface Breadcrumb {
  id: string;
  title: string;
  context: Record<string, any>;
  tags: string[];
  schema_name?: string;
  visibility: 'public' | 'team' | 'private';
  sensitivity: 'low' | 'pii' | 'secret';
  version: number;
  checksum: string;
  ttl?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  size_bytes: number;
}

export interface Agent {
  id: string;
  roles: string[];
  created_at: string;
}

export interface SelectorSubscription {
  id: string;
  owner_id: string;
  agent_id: string;
  selector: {
    any_tags?: string[];
    all_tags?: string[];
    schema_name?: string;
    context_match?: Array<{
      path: string;
      op: 'eq' | 'contains_any' | 'gt' | 'lt';
      value: any;
    }>;
  };
}

export interface AgentDefinition extends Breadcrumb {
  schema_name: 'agent.def.v1';
  context: {
    agent_id: string;
    agent_name?: string;
    description?: string;
    model: string;
    system_prompt: string;
    temperature?: number;
    max_tokens?: number;
    capabilities: {
      can_create_breadcrumbs: boolean;
      can_update_own: boolean;
      can_delete_own: boolean;
      can_spawn_agents: boolean;
      can_modify_agents?: boolean;
      can_create_flows?: boolean;
    };
    subscriptions: {
      selectors: Array<{
        any_tags?: string[];
        all_tags?: string[];
        schema_name?: string;
        context_match?: Array<{
          path: string;
          op: 'eq' | 'contains_any' | 'gt' | 'lt';
          value: any;
        }>;
      }>;
    };
    emits?: {
      tags?: string[];
      schemas?: string[];
    };
    memory?: {
      type: 'breadcrumb' | 'local' | 'none';
      tags?: string[];
      ttl_hours?: number;
    };
  };
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  required_secrets?: string[];
}

export interface Secret {
  id: string;
  name: string;
  scope_type: 'global' | 'workspace' | 'agent';
  scope_id?: string;
  created_at: string;
}

// ============ DASHBOARD CONFIGURATION TYPES ============

export interface DashboardConfig extends Breadcrumb {
  schema_name: 'dashboard.config.v1';
  context: {
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
  };
}

export interface DashboardLayout extends Breadcrumb {
  schema_name: 'dashboard.layout.v1';
  context: {
    workspace: string;
    view_type: '2d' | '3d';
    node_positions: Record<string, Position3D>;
    camera_state: {
      position: Position3D;
      target: Position3D;
      zoom: number;
    };
    active_filters: string[];
    connection_visibility: Record<string, boolean>;
    last_auto_save: string;
  };
}

export interface WorkspaceConfig extends Breadcrumb {
  schema_name: 'dashboard.workspace.v1';
  context: {
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
    visualization_rules: {
      chat_flow?: {
        enabled: boolean;
        direction: 'left_to_right' | 'top_to_bottom';
        bubble_style: string;
        thinking_visualization: string;
      };
      node_clustering?: {
        group_by: string;
        max_cluster_size: number;
      };
    };
    real_time_features: {
      live_chat_bubbles: boolean;
      thinking_animations: boolean;
      response_trails: boolean;
      typing_indicators: boolean;
    };
  };
}

// ============ REAL-TIME CHAT TYPES ============

export interface ChatMessage extends Breadcrumb {
  schema_name: 'chat.message.v1';
  context: {
    conversation_id: string;
    message_id: string;
    sender: 'user' | 'agent';
    sender_id: string;
    content: string;
    timestamp: string;
    message_type: 'question' | 'response' | 'command';
    intent?: string;
    entities_mentioned?: string[];
    urgency: 'low' | 'normal' | 'high';
  };
}

export interface AgentThinking extends Breadcrumb {
  schema_name: 'agent.thinking.v1';
  context: {
    agent_id: string;
    conversation_id: string;
    parent_message_id: string;
    thinking_step: number;
    thought_process: string;
    confidence: number;
    reasoning: {
      user_intent: string;
      required_info: string[];
      approach: string;
    };
    next_actions: string[];
    estimated_response_time: number;
  };
}

export interface AgentResponse extends Breadcrumb {
  schema_name: 'agent.response.v1';
  context: {
    agent_id: string;
    conversation_id: string;
    responding_to: string;
    response_id: string;
    content: string;
    response_type: 'answer' | 'question' | 'instructional';
    confidence: number;
    sources_used: string[];
    actions_performed: Array<{
      type: string;
      query?: string;
      results?: number;
      category?: string;
      found?: number;
    }>;
    follow_up_suggestions: string[];
  };
}

// ============ RENDER SYSTEM TYPES ============

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface Position2D {
  x: number;
  y: number;
}

export type NodeType = 
  | 'breadcrumb' 
  | 'agent' 
  | 'agent-definition' 
  | 'tool' 
  | 'secret' 
  | 'chat'
  | 'system';

  
/**
 * THE RCRT WAY - Only 4 connection types
 * Green = creates, Purple = config, Blue dotted = subscribed, Blue solid = triggered
 */
export type ConnectionType = 
  | 'creates'      // Green, solid - Agent/tool creates breadcrumb
  | 'config'       // Purple, dashed - Tool uses config
  | 'subscribed'   // Blue, dotted - Agent subscribed to events
  | 'triggered';   // Blue, solid - Event triggers agent

export interface RenderNode {
  id: string;
  type: NodeType;
  data: Breadcrumb | Agent | Tool | Secret;
  position: Position3D;
  metadata: {
    title: string;
    subtitle: string;
    icon: string;
    color: string;
    size: {
      width: number;
      height: number;
    };
    schema?: string;
    tags: string[];
  };
  effects: {
    pulse?: boolean;
    glow?: boolean;
    animate?: boolean;
    temporary?: boolean;
  };
  state: {
    selected: boolean;
    highlighted: boolean;
    filtered: boolean;
    visible: boolean;
    dragging?: boolean;
  };
}

export interface RenderConnection {
  id: string;
  type: ConnectionType;
  fromNodeId: string;
  toNodeId: string;
  metadata: {
    label?: string;
    color: string;
    style: 'solid' | 'dashed' | 'dotted';
    weight: number;
    animated?: boolean;
  };
  state: {
    visible: boolean;
    highlighted: boolean;
  };
}

// ============ FILTER SYSTEM TYPES ============

export interface FilterState {
  text?: string;
  tags: string[];
  nodeTypes: NodeType[];
  schemas: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  workspaces: string[];
}

export type FilterFunction = (node: RenderNode) => boolean;

// ============ EVENT SYSTEM TYPES ============

export interface SSEEvent {
  type: 'breadcrumb.created' | 'breadcrumb.updated' | 'breadcrumb.deleted' | 'ping';
  data: any;
  timestamp: string;
}

export interface DashboardEvent {
  type: 'NODE_CREATED' | 'NODE_UPDATED' | 'NODE_DELETED' | 'CONNECTIONS_REFRESHED' | 'FILTERS_CHANGED' | 'VIEW_SWITCHED';
  payload: any;
}

// ============ UI STATE TYPES ============

export interface ViewState {
  currentView: '2d' | '3d';
  camera: {
    position: Position3D;
    target: Position3D;
    zoom: number;
  };
  selection: {
    selectedNodeIds: string[];
    hoveredNodeId?: string;
  };
  interaction: {
    isDragging: boolean;
    draggedNodeId?: string;
    isZooming: boolean;
    isPanning: boolean;
  };
}

export interface PanelState {
  leftPanel: {
    visible: boolean;
    width: number;
    activeTab: 'filters' | 'create' | 'details';
  };
  rightPanel: {
    visible: boolean;
    width: number;
    activeTab: 'events' | 'chat';
  };
}

// ============ API RESPONSE TYPES ============

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ============ COMPONENT PROP TYPES ============

export interface NodeComponentProps {
  node: RenderNode;
  onSelect?: (node: RenderNode) => void;
  onDragStart?: (node: RenderNode) => void;
  onDragEnd?: (node: RenderNode, newPosition: Position3D) => void;
  onDoubleClick?: (node: RenderNode) => void;
}

export interface ConnectionComponentProps {
  connection: RenderConnection;
  fromNode: RenderNode;
  toNode: RenderNode;
  onSelect?: (connection: RenderConnection) => void;
}
