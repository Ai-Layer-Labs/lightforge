# RCRT Dashboard v2 - Comprehensive Feature Specification

**A complete specification of all features, concepts, and implementation details discussed for the revolutionary RCRT Dashboard v2.**

---

## 🎯 Core Philosophy & Vision

### **Everything is a Breadcrumb**
The dashboard fully embraces the RCRT philosophy where all data, configuration, and state is stored as breadcrumbs:
- Dashboard configuration → `dashboard.config.v1` breadcrumbs
- View layouts → `dashboard.layout.v1` breadcrumbs
- User preferences → `user.preferences.v1` breadcrumbs
- Workspace settings → `dashboard.workspace.v1` breadcrumbs
- Chat messages → `chat.message.v1` breadcrumbs
- Agent thoughts → `agent.thinking.v1` breadcrumbs

### **Self-Bootstrapping System**
The dashboard reads its own configuration from RCRT breadcrumbs, making it completely self-describing and dynamic.

### **Real-Time Visualization**
Live visualization of agent conversations, thinking processes, and system interactions as they happen.

---

## 🏗️ Architecture Overview

### **Frontend-Only Approach**
- **Keep**: Existing RCRT server (perfect APIs, SSE streaming, performance)
- **Replace**: Only the dashboard frontend with modern React stack
- **Integration**: Direct API calls to existing RCRT endpoints

### **Technology Stack**
```
Frontend (New):
├── React 18 + TypeScript       # Modern React with concurrent features
├── Zustand + Immer            # Predictable state management  
├── React Three Fiber          # Declarative 3D visualization
├── Framer Motion              # Physics-based smooth interactions
├── TanStack Query             # Intelligent data fetching + SSE
├── Tailwind CSS               # RCRT-themed rapid styling
└── Vite                       # Fast build tool with HMR

Backend (Existing):
└── RCRT Server                # Keep as-is - provides perfect APIs
```

---

## 📋 Breadcrumb Schema Definitions

### **1. Dashboard Configuration Schema**
```json
{
  "schema_name": "dashboard.config.v1",
  "title": "RCRT Dashboard Configuration",
  "tags": ["dashboard:config", "workspace:system"],
  "context": {
    "version": "2.0.0",
    "default_view": "2d",
    "real_time_updates": true,
    "animation_speed": "smooth",
    "auto_layout": {
      "enabled": true,
      "algorithm": "force_directed",
      "spacing": 200
    },
    "connection_styles": {
      "creation": {"color": "#00ff88", "style": "solid", "width": 2},
      "subscription": {"color": "#0099ff", "style": "dashed", "width": 1.5},
      "agent_thinking": {"color": "#ff6b6b", "style": "dotted", "animated": true},
      "tool_response": {"color": "#ffa500", "style": "solid", "width": 2}
    },
    "node_styles": {
      "chat.message.v1": {"icon": "💬", "color": "#00f5ff", "size": "small"},
      "agent.response.v1": {"icon": "🤖", "color": "#8a2be2", "size": "medium"},
      "agent.thinking.v1": {"icon": "🧠", "color": "#ff6b6b", "size": "small", "pulse": true},
      "tool.response.v1": {"icon": "🛠️", "color": "#ffa500", "size": "medium"}
    },
    "chat_visualization": {
      "show_bubbles": true,
      "bubble_duration": 3000,
      "thinking_animation": true,
      "connection_flow": true
    }
  }
}
```

### **2. Layout Persistence Schema**
```json
{
  "schema_name": "dashboard.layout.v1",
  "title": "Dashboard Layout - Agents Workspace",
  "tags": ["dashboard:layout", "workspace:agents"],
  "context": {
    "workspace": "agents",
    "view_type": "3d",
    "node_positions": {
      "breadcrumb-123": {"x": 100, "y": 200, "z": 50},
      "agent-456": {"x": 300, "y": 100, "z": 0}
    },
    "camera_state": {
      "position": {"x": 0, "y": 0, "z": 500},
      "target": {"x": 200, "y": 200, "z": 0},
      "zoom": 1.2
    },
    "active_filters": ["workspace:agents", "recent:24h"],
    "connection_visibility": {
      "creation": true,
      "subscription": true,
      "thinking": false
    }
  }
}
```

### **3. Workspace Configuration Schema**
```json
{
  "schema_name": "dashboard.workspace.v1",
  "title": "Workspace: Real-Time Chat Monitoring",
  "tags": ["dashboard:workspace", "workspace:chat"],
  "context": {
    "workspace_id": "chat",
    "display_name": "💬 Live Chat Monitoring",
    "description": "Real-time visualization of agent conversations",
    "theme": {
      "primary_color": "#00f5ff",
      "accent_color": "#ff6b6b",
      "background": "linear-gradient(135deg, #0f0f0f, #1a1a2e)"
    },
    "default_view": "2d",
    "auto_filters": ["chat:message", "agent:response", "agent:thinking"],
    "visualization_rules": {
      "chat_flow": {
        "enabled": true,
        "direction": "left_to_right",
        "bubble_style": "modern",
        "thinking_visualization": "pulsing_connections"
      },
      "node_clustering": {
        "group_by": "conversation_id",
        "max_cluster_size": 10
      }
    },
    "real_time_features": {
      "live_chat_bubbles": true,
      "thinking_animations": true,
      "response_trails": true,
      "typing_indicators": true
    }
  }
}
```

### **4. Real-Time Chat Schemas**

#### **Chat Message Schema**
```json
{
  "schema_name": "chat.message.v1",
  "title": "User: How do I create a custom agent?",
  "tags": ["chat:message", "workspace:chat", "user:input", "conversation:conv-123"],
  "context": {
    "conversation_id": "conv-123",
    "message_id": "msg-789",
    "sender": "user",
    "sender_id": "user-456",
    "content": "How do I create a custom agent that can analyze code?",
    "timestamp": "2024-01-15T10:30:15Z",
    "message_type": "question",
    "intent": "agent_creation",
    "entities_mentioned": ["agent", "code_analysis"],
    "urgency": "normal"
  }
}
```

#### **Agent Thinking Schema**
```json
{
  "schema_name": "agent.thinking.v1",
  "title": "Agent Thinking: Analyzing code analysis requirements",
  "tags": ["agent:thinking", "workspace:internal", "agent:helpful-assistant"],
  "context": {
    "agent_id": "agent-helpful-assistant",
    "conversation_id": "conv-123",
    "parent_message_id": "msg-789",
    "thinking_step": 1,
    "thought_process": "User wants to create a code analysis agent...",
    "confidence": 0.85,
    "reasoning": {
      "user_intent": "Create custom agent for code analysis",
      "required_info": ["agent.definition.v1 schema", "code analysis tools"],
      "approach": "Step-by-step guide with examples"
    },
    "next_actions": ["search_documentation", "find_examples", "generate_response"],
    "estimated_response_time": 3000
  }
}
```

#### **Agent Response Schema**
```json
{
  "schema_name": "agent.response.v1",
  "title": "Agent Response: Code Analysis Agent Guide",
  "tags": ["agent:response", "workspace:chat", "agent:helpful-assistant"],
  "context": {
    "agent_id": "agent-helpful-assistant",
    "conversation_id": "conv-123",
    "responding_to": "msg-789",
    "response_id": "resp-890",
    "content": "To create a code analysis agent, you'll need to...",
    "response_type": "instructional",
    "confidence": 0.92,
    "sources_used": ["docs/agent-creation-guide.md"],
    "actions_performed": [
      {"type": "document_search", "query": "agent definition schema", "results": 5}
    ],
    "follow_up_suggestions": [
      "Would you like me to create a template for you?"
    ]
  }
}
```

---

## 🎨 Visual System & Node Types

### **Node Type Definitions**
```typescript
type NodeType = 
  | 'breadcrumb'        // Generic breadcrumbs
  | 'agent'             // Agent entities
  | 'agent-definition'  // Agent definition breadcrumbs
  | 'tool'              // Available tools
  | 'secret'            // Encrypted secrets
  | 'chat'              // Chat messages
  | 'system';           // System/config breadcrumbs
```

### **Node Visual Properties**
```typescript
interface NodeMetadata {
  title: string;
  subtitle: string;
  icon: string;          // Emoji or icon identifier
  color: string;         // Hex color code
  size: {
    width: number;
    height: number;
  };
  schema?: string;       // Schema name for dynamic rendering
  tags: string[];        // Associated tags
}

interface NodeEffects {
  pulse?: boolean;       // Pulsing animation
  glow?: boolean;        // Glow effect
  animate?: boolean;     // Entry animation
  temporary?: boolean;   // Auto-remove after timeout
}
```

### **Connection Type Definitions**
```typescript
type ConnectionType = 
  | 'creation'           // Agent created breadcrumb
  | 'subscription'       // Agent subscribed to breadcrumb  
  | 'tool-response'      // Tool produced breadcrumb
  | 'agent-definition'   // Agent def → agent entity
  | 'secret-usage'       // Secret used by tool/agent
  | 'acl-grant'          // Permission granted
  | 'webhook'            // Webhook delivery
  | 'agent-thinking';    // Agent thinking connection
```

### **Connection Visual Properties**
```typescript
interface ConnectionMetadata {
  label?: string;        // Optional connection label
  color: string;         // Line color
  style: 'solid' | 'dashed' | 'dotted';
  weight: number;        // Line thickness
  animated?: boolean;    // Animated flow effect
}
```

---

## 🔄 Real-Time Features

### **Live Chat Visualization**
- **Chat Bubbles**: Animated speech bubbles for `chat.message.v1` breadcrumbs
- **Thinking Indicators**: Pulsing nodes for `agent.thinking.v1` breadcrumbs  
- **Response Trails**: Connection lines animate from question to response
- **Typing Indicators**: Show when agents are processing

### **Agent Thinking Process**
- **Thought Visualization**: Show agent reasoning as connected nodes
- **Confidence Indicators**: Visual representation of agent confidence levels
- **Step-by-Step Process**: Animate through thinking steps
- **Temporary Nodes**: Thinking nodes fade after response completion

### **Tool Response Flows**
- **Request/Response Pairs**: Visual connection between tool requests and responses
- **Status Indicators**: Success/error states with appropriate colors
- **Data Flow Animation**: Animate data flowing through tool pipelines

### **SSE Integration**
```typescript
// Real-time event processing
const eventSource = new EventSource('/api/events/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.schema_name) {
    case 'chat.message.v1':
      showChatBubble(data);
      break;
    case 'agent.thinking.v1':
      showThinkingIndicator(data);
      break;
    case 'agent.response.v1':
      showResponseFlow(data);
      break;
  }
};
```

---

## 🎮 Interaction System

### **Physics-Based Drag & Drop**
- **Spring Animations**: Realistic physics using Framer Motion
- **Momentum**: Nodes continue moving after release with decay
- **Elastic Snapping**: Snap to grid with elastic overshoot
- **Visual Feedback**: Scale and glow effects during interaction

### **Smooth View Transitions**
- **2D ↔ 3D Switching**: Seamless transitions preserving node positions
- **Camera Animations**: Smooth camera movements between viewports
- **Layout Morphing**: Animate between different layout algorithms

### **Selection & Highlighting**
- **Multi-Select**: Ctrl/Cmd+click for multiple selection
- **Hover Effects**: Subtle glow and scale on hover
- **Connection Highlighting**: Highlight related connections on node selection
- **Keyboard Navigation**: Arrow keys for node navigation

### **Gesture Support**
```typescript
// Framer Motion gesture handling
<motion.div
  drag
  dragConstraints={{ left: 0, right: 300 }}
  dragElastic={0.1}
  whileDrag={{ scale: 1.1, zIndex: 1000 }}
  whileHover={{ scale: 1.05 }}
  onDragEnd={(event, info) => {
    updateNodePosition(node.id, {
      x: node.position.x + info.offset.x,
      y: node.position.y + info.offset.y
    });
  }}
>
  <NodeComponent node={node} />
</motion.div>
```

---

## 🔍 Dynamic System Features

### **Schema Discovery**
- **Automatic Detection**: Scan existing breadcrumbs for new schemas
- **Dynamic Rendering**: Create appropriate visualizations for unknown schemas
- **Custom Renderers**: Store rendering rules as breadcrumbs
- **Plugin Architecture**: Extensible system for new node types

### **Workspace System**
- **Multiple Workspaces**: Different visualization themes and rules
- **Context Switching**: Smooth transitions between workspace contexts
- **Workspace-Specific Filters**: Auto-apply relevant filters per workspace
- **Custom Themes**: Per-workspace color schemes and layouts

### **Connection Discovery Engine**
```typescript
class ConnectionDiscovery {
  // Discover all connection types dynamically
  discoverConnections(systemState) {
    return [
      ...this.findCreationConnections(systemState),
      ...this.findSubscriptionConnections(systemState),
      ...this.findToolConnections(systemState),
      ...this.findAgentDefinitionConnections(systemState),
      ...this.findSecretUsageConnections(systemState),
      ...this.findACLConnections(systemState),
      ...this.findWebhookConnections(systemState),
      ...this.findChatFlowConnections(systemState)
    ];
  }
}
```

---

## 🎛️ User Interface Components

### **Left Panel System**
- **Filters Section**: Always visible search and filtering
- **Dynamic Content**: Context-sensitive panels based on selection
- **Collapsible Sections**: Expandable/collapsible content areas
- **Quick Actions**: Common operations easily accessible

### **Canvas System**
- **Infinite Canvas**: Unlimited panning in all directions
- **Smart Zoom**: Cursor-focused zooming with momentum
- **Grid Snapping**: Optional grid alignment for neat layouts
- **Auto-Layout**: Force-directed and other automatic layout algorithms

### **3D Visualization**
- **React Three Fiber**: Declarative 3D scene definition
- **Orbit Controls**: Mouse/touch navigation in 3D space
- **Level of Detail**: Reduce complexity at distance
- **HTML Overlays**: 2D UI elements in 3D space

### **Panel Components**
```typescript
// Dynamic panel content
function DynamicPanel({ selectedNode }: { selectedNode: RenderNode }) {
  switch (selectedNode.type) {
    case 'chat':
      return <ChatMessagePanel message={selectedNode.data} />;
    case 'agent-definition':
      return <AgentDefinitionEditor definition={selectedNode.data} />;
    case 'breadcrumb':
      return <BreadcrumbDetailsPanel breadcrumb={selectedNode.data} />;
    default:
      return <GenericNodePanel node={selectedNode} />;
  }
}
```

---

## 🔧 State Management Architecture

### **Zustand Store Structure**
```typescript
interface DashboardState {
  // Core data
  nodes: Map<string, RenderNode>;
  connections: Map<string, RenderConnection>;
  
  // Configuration
  config: DashboardConfig;
  workspaces: Map<string, WorkspaceConfig>;
  userPreferences: UserPreferences;
  
  // UI state
  currentView: '2d' | '3d';
  selectedNodeIds: string[];
  hoveredNodeId?: string;
  
  // Filters
  activeFilters: FilterState;
  
  // Real-time
  eventStream: EventStreamState;
  
  // Actions
  addNode: (node: RenderNode) => void;
  updateNode: (id: string, updates: Partial<RenderNode>) => void;
  deleteNode: (id: string) => void;
  selectNode: (id: string) => void;
  applyFilter: (filter: FilterFunction) => void;
  switchView: (view: '2d' | '3d') => void;
}
```

### **Immer Integration**
```typescript
const useDashboardStore = create<DashboardState>()(
  immer((set, get) => ({
    nodes: new Map(),
    connections: new Map(),
    
    addNode: (node) => set((state) => {
      state.nodes.set(node.id, node);
    }),
    
    updateNode: (id, updates) => set((state) => {
      const node = state.nodes.get(id);
      if (node) {
        Object.assign(node, updates);
      }
    }),
    
    // ... other actions
  }))
);
```

---

## 📊 Performance Optimizations

### **Rendering Optimizations**
- **Virtualization**: Only render visible nodes in large datasets
- **Level of Detail**: Reduce detail for distant 3D objects
- **Frustum Culling**: Automatic in React Three Fiber
- **Connection Culling**: Hide connections between invisible nodes

### **Data Optimizations**
- **Smart Caching**: TanStack Query handles intelligent caching
- **Optimistic Updates**: Instant UI feedback before server confirmation
- **Background Sync**: Automatic background data refresh
- **Delta Updates**: Only update changed data via SSE

### **Animation Optimizations**
- **Hardware Acceleration**: CSS transforms for 2D, WebGL for 3D
- **RequestAnimationFrame**: Smooth 60fps animations
- **Spring Physics**: Natural-feeling motion with Framer Motion
- **Batch Updates**: Group multiple changes for efficiency

---

## 🔒 Security & Authentication

### **RCRT Integration**
- **JWT Tokens**: Use existing RCRT authentication
- **Role-Based Access**: Respect RCRT agent roles (curator, emitter, subscriber)
- **ACL Enforcement**: Honor breadcrumb-level permissions
- **Tenant Isolation**: Multi-tenant data separation

### **Frontend Security**
- **XSS Prevention**: Sanitize all user input
- **CSRF Protection**: Use RCRT's built-in CSRF tokens
- **Content Security Policy**: Restrict resource loading
- **Secure Storage**: Store sensitive data in httpOnly cookies

---

## 🧪 Testing Strategy

### **Component Testing**
- **React Testing Library**: Component behavior testing
- **Storybook**: Component development and documentation
- **Visual Regression**: Automated visual testing
- **Accessibility Testing**: Screen reader and keyboard navigation

### **Integration Testing**
- **MSW (Mock Service Worker)**: Mock RCRT API responses
- **E2E Testing**: Full user workflow testing with Playwright
- **Real-time Testing**: Mock SSE streams for event testing
- **Performance Testing**: Lighthouse and Core Web Vitals

---

## 🚀 Deployment Strategy

### **Development**
```bash
# Start RCRT stack
docker-compose up rcrt db nats -d

# Start frontend with hot reload
cd rcrt-dashboard-v2/frontend
npm run dev
# Vite dev server with API proxy to RCRT
```

### **Production**
```bash
# Build optimized frontend
npm run build

# Serve static files (multiple options)
# Option 1: Serve from RCRT server static directory
# Option 2: CDN deployment (Vercel, Netlify)
# Option 3: Nginx reverse proxy
```

### **Docker Integration**
```dockerfile
# Multi-stage build for production
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
```

---

## 🔮 Future Enhancements

### **Advanced Visualizations**
- **VR/AR Support**: WebXR for immersive visualization
- **Timeline View**: Historical breadcrumb evolution
- **Heatmaps**: Activity and connection frequency visualization
- **Graph Algorithms**: Shortest path, centrality analysis

### **AI Integration**
- **Smart Layout**: ML-powered optimal node positioning
- **Predictive UI**: Anticipate user actions and pre-load data
- **Natural Language**: Voice commands for navigation
- **Anomaly Detection**: Highlight unusual patterns in data

### **Collaboration Features**
- **Multi-User**: Real-time collaborative editing
- **Comments**: Annotation system for breadcrumbs
- **Sharing**: Export and share specific views
- **Version Control**: Track dashboard configuration changes

---

## ✅ Success Metrics

### **Performance Targets**
- **Load Time**: < 2 seconds initial load
- **Interaction Response**: < 16ms (60fps)
- **Memory Usage**: < 100MB for 1000+ nodes
- **Bundle Size**: < 500KB gzipped

### **User Experience Goals**
- **Intuitive Navigation**: Zero learning curve for basic operations
- **Smooth Interactions**: No janky animations or lag
- **Information Density**: Maximum insight with minimal clutter
- **Accessibility**: WCAG 2.1 AA compliance

### **Feature Completeness**
- **Real-time Updates**: < 100ms event-to-UI latency
- **Data Accuracy**: 100% consistency with RCRT server
- **Cross-Platform**: Works on desktop, tablet, mobile
- **Browser Support**: Modern browsers (Chrome, Firefox, Safari, Edge)

---

## 🎯 Implementation Roadmap

### **Phase 1: Foundation (Weeks 1-2)**
- [ ] Project setup and build system
- [ ] TypeScript definitions for all RCRT types
- [ ] Basic breadcrumb visualization (2D)
- [ ] RCRT API integration with TanStack Query
- [ ] Real-time SSE connection

### **Phase 2: Self-Configuration (Weeks 3-4)**
- [ ] Configuration breadcrumb schemas
- [ ] Dynamic node factory system
- [ ] Workspace management
- [ ] Layout persistence
- [ ] User preferences system

### **Phase 3: Real-Time Features (Weeks 5-6)**
- [ ] Chat message visualization
- [ ] Agent thinking animations
- [ ] Tool response flows
- [ ] Connection discovery engine
- [ ] Live event processing

### **Phase 4: 3D & Advanced UX (Weeks 7-8)**
- [ ] React Three Fiber 3D scene
- [ ] Smooth 2D/3D transitions
- [ ] Physics-based interactions
- [ ] Advanced filtering system
- [ ] Performance optimizations

### **Phase 5: Polish & Production (Weeks 9-10)**
- [ ] Comprehensive testing suite
- [ ] Accessibility improvements
- [ ] Performance optimization
- [ ] Documentation and deployment
- [ ] User feedback integration

---

## 📚 Technical References

### **Key Libraries & Documentation**
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) - 3D visualization
- [Framer Motion](https://www.framer.com/motion/) - Animation system
- [Zustand](https://github.com/pmndrs/zustand) - State management
- [TanStack Query](https://tanstack.com/query) - Data fetching
- [Tailwind CSS](https://tailwindcss.com/) - Styling system

### **RCRT API References**
- OpenAPI Specification: `docs/openapi.json`
- SSE Events: `GET /events/stream`
- Breadcrumb Operations: `GET/POST/PATCH/DELETE /breadcrumbs`
- Vector Search: `GET /breadcrumbs/search`

---

**This comprehensive specification captures all the innovative features and technical details discussed for RCRT Dashboard v2. It serves as the complete blueprint for building a revolutionary, self-configuring, real-time dashboard that fully embraces the RCRT philosophy.** 🚀
