# RCRT Component Reference Card

Quick reference for all RCRT components with their key responsibilities, APIs, and configurations.

---

## 1. rcrt-server (Rust/Axum)

### Overview
Central server managing breadcrumbs, SSE events, and authentication.

### Key Responsibilities
- ✅ Breadcrumb CRUD operations
- ✅ Vector search with embeddings
- ✅ SSE event stream broadcasting
- ✅ JWT authentication
- ✅ Webhook management
- ✅ ACL enforcement
- ✅ Secrets management
- ✅ Automatic hygiene cleanup

### Technology Stack
```
Rust 1.75+
Axum 0.7
PostgreSQL 16 + pgvector
NATS (optional)
ONNX Runtime (optional)
```

### Port & URLs
```
Port: 8081
Health: http://localhost:8081/health
API Docs: http://localhost:8081/docs
Swagger: http://localhost:8081/swagger
Metrics: http://localhost:8081/metrics
SSE: http://localhost:8081/events/stream
```

### Key API Endpoints
```
POST   /auth/token             # Get JWT
POST   /breadcrumbs            # Create
GET    /breadcrumbs            # List
GET    /breadcrumbs/:id        # Get
PATCH  /breadcrumbs/:id        # Update
DELETE /breadcrumbs/:id        # Delete
GET    /breadcrumbs/search     # Vector search
GET    /events/stream          # SSE
POST   /subscriptions/selectors # Subscribe
```

### Environment Variables
```bash
# Required
DB_URL=postgresql://user:pass@host/db
OWNER_ID=00000000-0000-0000-0000-000000000001

# Optional
AUTH_MODE=jwt                              # or 'disabled'
JWT_PUBLIC_KEY_PEM=...
JWT_PRIVATE_KEY_PEM=...
NATS_URL=nats://localhost:4222
EMBED_MODEL=models/model.onnx
EMBED_TOKENIZER=models/tokenizer.json
EMBED_DIM=384
HYGIENE_ENABLED=true
HYGIENE_INTERVAL_SECONDS=300
LOCAL_KEK_BASE64=...                       # For secrets encryption
RUST_LOG=info                              # or debug, trace
```

### Build & Run
```bash
# Development
cargo run -p rcrt-server

# Production
cargo build --release -p rcrt-server
./target/release/rcrt-server

# Docker
docker build -t rcrt-server -f crates/rcrt-server/Dockerfile .
docker run -p 8081:8080 rcrt-server
```

### Features (Cargo.toml)
```toml
default = ["nats", "embed-onnx"]
nats = ["dep:nats"]
embed-onnx = ["dep:ort", "dep:tokenizers"]
```

---

## 2. Dashboard v2 (React/TypeScript)

### Overview
Real-time 3D/2D visualization dashboard for RCRT ecosystem.

### Key Responsibilities
- ✅ Visualize breadcrumbs as nodes
- ✅ Show connections between breadcrumbs
- ✅ Real-time SSE updates
- ✅ Filter and search
- ✅ 2D/3D view switching
- ✅ Node interaction (select, drag)

### Technology Stack
```
React 18
TypeScript 5
Zustand (state)
React Query (data fetching)
React Three Fiber (3D)
Framer Motion (animations)
TailwindCSS
Vite
```

### Port & URLs
```
Port: 8082 (production)
Port: 5173 (dev)
URL: http://localhost:8082
Dev: http://localhost:5173
```

### Key Files
```
src/
├── App.tsx                    # Main app
├── stores/DashboardStore.tsx  # Zustand store
├── types/rcrt.ts              # TypeScript types
├── components/
│   ├── Dashboard.tsx          # Main component
│   ├── canvas/
│   │   ├── Canvas2D.tsx       # 2D view
│   │   └── Canvas3D.tsx       # 3D view
│   ├── nodes/
│   │   ├── Node2D.tsx         # 2D node
│   │   └── Node3D.tsx         # 3D node
│   └── panels/
│       ├── FilterPanel.tsx
│       └── DetailsPanel.tsx
└── hooks/
    ├── useRealTimeData.ts     # SSE connection
    └── useAuthentication.ts
```

### Environment Variables
```bash
VITE_RCRT_BASE_URL=http://localhost:8081
```

### Build & Run
```bash
# Development
npm install
npm run dev

# Production
npm run build
npm run preview

# Docker
docker build -t rcrt-dashboard-v2 .
docker run -p 8082:80 rcrt-dashboard-v2
```

### State Management (Zustand)
```typescript
interface DashboardState {
  nodes: Map<string, RenderNode>
  connections: Map<string, RenderConnection>
  selectedNodeIds: string[]
  currentView: '2d' | '3d'
  eventStream: { connected, eventCount }
  
  // Actions
  addNode(node: RenderNode)
  updateNode(id, updates)
  selectNode(id)
  switchView(view)
  connectToSSE()
}
```

---

## 3. agent-runner (Node.js/TypeScript)

### Overview
Executes AI agents defined as breadcrumbs.

### Key Responsibilities
- ✅ Load agent definitions from breadcrumbs
- ✅ Route SSE events to agents
- ✅ Execute LLM calls via AgentExecutor
- ✅ Create response breadcrumbs
- ✅ Maintain agent catalog

### Technology Stack
```
Node.js 20+
TypeScript 5
@rcrt-builder/sdk
@rcrt-builder/runtime
jsonrepair
```

### Key Files
```
src/
└── index.ts                   # Main entry point
    ├── ModernAgentRegistry    # Agent registry
    ├── startCentralizedSSE    # SSE dispatcher
    └── routeEventToAgent      # Event routing

packages/runtime/
└── agent-executor.ts          # AgentExecutor class
```

### Environment Variables
```bash
# Required
RCRT_BASE_URL=http://localhost:8081
WORKSPACE=workspace:agents
OWNER_ID=00000000-0000-0000-0000-000000000001
AGENT_ID=00000000-0000-0000-0000-000000000AAA

# Optional
OPENROUTER_API_KEY=sk-or-...
DEPLOYMENT_MODE=local                      # docker, local
```

### Build & Run
```bash
# Development
npm install
npm run dev

# Production
npm run build
npm start

# Docker
docker build -t agent-runner .
docker run agent-runner
```

### Agent Definition Schema
```json
{
  "schema_name": "agent.def.v1",
  "tags": ["workspace:agents"],
  "context": {
    "agent_id": "agent-uuid",
    "model": "openrouter/anthropic/claude-3.5-sonnet",
    "system_prompt": "You are...",
    "temperature": 0.7,
    "capabilities": {
      "can_create_breadcrumbs": true
    },
    "subscriptions": {
      "selectors": [
        {"any_tags": ["user:message"]}
      ]
    }
  }
}
```

### Key Classes
```typescript
class ModernAgentRegistry {
  executors: Map<string, AgentExecutor>
  
  async start()
  async loadAgentDefinitions()
  async registerAgent(agentDef)
  async startCentralizedSSE(token)
  routeEventToAgent(event)
}

class AgentExecutor {
  agentDef: AgentDefinitionV1
  rcrtClient: RcrtClientEnhanced
  eventBridge: EventBridge
  
  async processSSEEvent(event)
  getDefinition()
  getState()
}
```

---

## 4. tools-runner (Node.js/TypeScript)

### Overview
Executes tools in response to tool.request.v1 breadcrumbs.

### Key Responsibilities
- ✅ Load tool definitions from breadcrumbs
- ✅ Execute tools on SSE events
- ✅ Create tool.response.v1 breadcrumbs
- ✅ EventBridge for request/response correlation
- ✅ Tool auto-triggering via subscriptions

### Technology Stack
```
Node.js 20+
TypeScript 5
@rcrt-builder/tools
@rcrt-builder/sdk
jsonrepair
```

### Key Files
```
src/
├── index.ts                   # Main entry point
├── event-bridge.ts            # EventBridge class
└── tools/                     # Tool implementations

packages/tools/
├── tool-loader.ts             # ToolLoader class
└── tools/
    ├── openrouter/            # OpenRouter tool
    ├── context-builder/       # Context builder
    └── ...
```

### Environment Variables
```bash
# Required
RCRT_BASE_URL=http://localhost:8081
WORKSPACE=workspace:tools

# Optional
DEPLOYMENT_MODE=local                      # docker, local, electron
RCRT_AUTH_MODE=jwt                         # disabled, jwt
OWNER_ID=00000000-0000-0000-0000-000000000001
AGENT_ID=00000000-0000-0000-0000-0000000000aa
```

### Build & Run
```bash
# Development
npm install
npm run dev

# Production
npm run build
npm start

# Docker
docker build -t tools-runner .
docker run tools-runner

# Electron
npm run electron
```

### Tool Definition Schema
```json
{
  "schema_name": "tool.v1",
  "tags": ["workspace:tools"],
  "context": {
    "name": "openrouter",
    "description": "Call LLM via OpenRouter",
    "parameters": {
      "type": "object",
      "properties": {
        "messages": {"type": "array"},
        "model": {"type": "string"}
      }
    },
    "subscriptions": {
      "selectors": [
        {"schema_name": "llm.request.v1"}
      ]
    }
  }
}
```

### Key Classes
```typescript
class ToolLoader {
  client: RcrtClientEnhanced
  workspace: string
  
  async discoverTools()
  async loadToolByName(name)
}

class EventBridge {
  pendingWaits: PendingWait[]
  eventHistory: Event[]
  
  handleEvent(event, breadcrumb)
  async waitForEvent(criteria, timeout)
  matches(breadcrumb, criteria)
}

interface Tool {
  name: string
  description: string
  parameters: JSONSchema
  
  async execute(input, context)
}
```

---

## 5. extension (Chrome Extension)

### Overview
Browser integration providing chat interface and page context extraction.

### Key Responsibilities
- ✅ Chat UI in side panel
- ✅ Create user.message.v1 breadcrumbs
- ✅ Listen for agent.response.v1 via SSE
- ✅ Page context extraction
- ✅ JWT authentication

### Technology Stack
```
React 18
TypeScript 5
Chrome Extension Manifest V3
Vite
TailwindCSS
Framer Motion
```

### Key Files
```
src/
├── background/
│   └── index.js               # Background service worker
├── sidepanel/
│   ├── index.tsx              # Side panel entry
│   └── Panel.tsx              # Main chat component
├── lib/
│   ├── rcrt-client.ts         # RCRT API client
│   └── storage/               # Storage utilities
└── public/
    └── buildDomTree.js        # DOM extraction
```

### Build & Load
```bash
# Development
npm install
npm run dev

# Production
npm run build

# Load in Chrome
1. Open chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select dist/ folder
```

### Key Classes
```typescript
class RCRTExtensionClient {
  baseUrl: string
  token: string
  
  async authenticate()
  async createBreadcrumb(breadcrumb)
  async createChatBreadcrumb(message)
  async getBreadcrumb(id)
  async connectToSSE(filters, onEvent)
  async listenForAgentResponses(conversationId, onResponse)
}
```

### Manifest Permissions
```json
{
  "permissions": [
    "storage",
    "tabs",
    "activeTab",
    "scripting",
    "sidePanel"
  ],
  "host_permissions": [
    "http://localhost:8081/*",
    "http://localhost:8082/*"
  ]
}
```

### Communication Flow
```
User → Extension → rcrt-server (POST /breadcrumbs)
                 ↓
                NATS (bc.*.updated)
                 ↓
              agent-runner → OpenRouter
                 ↓
              rcrt-server (POST /breadcrumbs)
                 ↓
                NATS (bc.*.updated)
                 ↓
Extension ← SSE (agent.response.v1)
```

---

## Component Dependencies

```
┌─────────────────────────────────────────────────────────┐
│                    External Services                    │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL    │  pgvector    │  NATS    │  OpenRouter │
└────────┬────────┴──────┬───────┴────┬─────┴──────┬──────┘
         │               │            │            │
         └───────────────┴────────────┴────────────┘
                         │
                  ┌──────▼──────┐
                  │ rcrt-server │ ← Central component
                  └──────┬──────┘
                         │
         ┌───────────────┼───────────────┬────────────┐
         │               │               │            │
    ┌────▼────┐   ┌──────▼──────┐  ┌────▼────┐  ┌───▼──────┐
    │frontend │   │agent-runner │  │tools-   │  │extension │
    │         │   │             │  │runner   │  │          │
    └─────────┘   └─────────────┘  └─────────┘  └──────────┘
```

---

## Common Patterns Across Components

### 1. JWT Authentication
```typescript
// All components authenticate the same way
const response = await fetch(`${baseUrl}/auth/token`, {
  method: 'POST',
  body: JSON.stringify({
    owner_id: OWNER_ID,
    agent_id: AGENT_ID,
    roles: ['curator', 'emitter', 'subscriber']
  })
});
const { token } = await response.json();
```

### 2. SSE Connection
```typescript
// All components connect to SSE
const eventSource = new EventSource(
  `${baseUrl}/events/stream?token=${token}`
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type !== 'ping') {
    handleEvent(data);
  }
};
```

### 3. Breadcrumb Creation
```typescript
// All components create breadcrumbs
const response = await fetch(`${baseUrl}/breadcrumbs`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    schema_name: 'user.message.v1',
    title: 'Message',
    tags: ['user:message'],
    context: { content: 'Hello' }
  })
});
const { id } = await response.json();
```

---

## Troubleshooting Reference

### Component Not Starting

**rcrt-server**
```bash
# Check database connection
psql $DB_URL -c "SELECT 1"

# Check NATS connection
nats-sub test

# View logs
RUST_LOG=debug cargo run -p rcrt-server
```

**agent-runner**
```bash
# Check RCRT connection
curl http://localhost:8081/health

# Verify token
curl -X POST http://localhost:8081/auth/token ...

# View logs
npm run dev  # Shows console logs
```

**tools-runner**
```bash
# Same as agent-runner
curl http://localhost:8081/health
npm run dev
```

**Dashboard v2**
```bash
# Check RCRT connection
curl http://localhost:8081/health

# Check build
npm run build
npm run preview
```

**Extension**
```bash
# Rebuild
npm run build

# Check background logs
chrome://extensions → extension → background page → console

# Check side panel logs
Open side panel → F12 → console
```

---

## Performance Tuning

### rcrt-server
```bash
# Database connection pool
DB_URL=postgresql://user:pass@host/db?max_connections=20

# Hygiene frequency
HYGIENE_INTERVAL_SECONDS=60     # More aggressive
HYGIENE_INTERVAL_SECONDS=600    # Less aggressive

# Embedding dimension
EMBED_DIM=384   # Faster, less accurate
EMBED_DIM=768   # Slower, more accurate
```

### agent-runner
```bash
# Catalog update frequency
catalogUpdateInterval: 60000    # Every minute
catalogUpdateInterval: 300000   # Every 5 minutes

# Health check frequency
healthCheckInterval: 60000      # Every minute
healthCheckInterval: 600000     # Every 10 minutes
```

### tools-runner
```bash
# Same patterns as agent-runner
```

### Dashboard v2
```typescript
// React Query stale time
staleTime: 5 * 60 * 1000    // 5 minutes
staleTime: 1 * 60 * 1000    // 1 minute (more frequent)

// SSE reconnection
reconnectInterval: 5000      // 5 seconds
reconnectInterval: 1000      // 1 second (aggressive)
```

---

## Quick Debug Commands

```bash
# Check all components
curl http://localhost:8081/health    # rcrt-server
curl http://localhost:8082           # Dashboard v2
ps aux | grep agent-runner           # agent-runner
ps aux | grep tools-runner           # tools-runner
chrome://extensions                  # Extension

# View logs
docker logs rcrt-server              # Docker
tail -f /var/log/rcrt-server.log     # Linux
journalctl -u rcrt-server -f         # systemd

# Check database
psql $DB_URL -c "SELECT COUNT(*) FROM breadcrumbs"
psql $DB_URL -c "SELECT * FROM breadcrumbs ORDER BY created_at DESC LIMIT 10"

# Check NATS
nats-sub bc.>                        # Subscribe to all breadcrumb events
nats-sub agents.>                    # Subscribe to all agent events

# Manual breadcrumb creation
curl -X POST http://localhost:8081/breadcrumbs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","tags":["test"],"context":{}}'
```

---

**Reference Card Version**: 1.0  
**Last Updated**: 2024  
**For Detailed Docs**: See README.md, SYSTEM_ARCHITECTURE_OVERVIEW.md, QUICK_REFERENCE.md
