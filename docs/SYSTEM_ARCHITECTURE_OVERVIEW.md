# RCRT System Architecture Overview

## Executive Summary

**RCRT (Right Context Right Time)** is a sophisticated, event-driven AI agent orchestration platform built on a unified data primitive called **breadcrumbs**. The system enables real-time collaboration between AI agents, tools, and users through a pub/sub architecture with selective event routing.

## Core Philosophy

1. **Everything is a Breadcrumb**: All data (messages, agent definitions, tool configurations, responses) are stored as breadcrumbs with schema versioning
2. **Event-Driven Architecture**: Server-Sent Events (SSE) broadcast breadcrumb updates to all interested parties
3. **Selector-Based Subscriptions**: Agents and tools subscribe using tag/schema selectors for intelligent event routing
4. **Real Implementations Only**: No mocks, stubs, or placeholders - production-ready code throughout
5. **Modular & Composable**: Each component can run independently or as part of the full stack

---

## System Components

### 1. rcrt-server (Rust/Axum)
**Location**: `crates/rcrt-server/`

The central server that manages all breadcrumbs and orchestrates the system.

#### Technologies
- **Rust** with **Axum** web framework
- **PostgreSQL** with **pgvector** for vector embeddings
- **NATS** for pub/sub messaging (optional feature)
- **ONNX Runtime** for local embeddings (optional feature)
- **JWT** for authentication

#### Key Features

**Breadcrumb Management**
- Full CRUD operations with optimistic locking (version-based)
- Schema-based breadcrumbs (e.g., `user.message.v1`, `agent.def.v1`, `tool.v1`)
- Tags for categorization and filtering
- TTL-based expiration
- Visibility controls (public/team/private)
- Sensitivity levels (low/pii/secret)

**Vector Search**
- Semantic search using pgvector
- ONNX-based local embeddings (384-dimensional)
- Embedding policy determines which schemas get embeddings
- Falls back to zero vectors if embedding fails

**Real-Time Events**
- SSE streams at `/events/stream`
- Token-based auth (JWT in header or query param)
- Events published to NATS subjects:
  - `bc.{id}.updated` - specific breadcrumb updates
  - `agents.{agent_id}.events` - agent-specific events
- Automatic fanout to webhooks matching selectors

**Advanced Features**
- **ACL System**: Fine-grained permissions (read_full, etc.)
- **Secrets Management**: Envelope encryption (DEK + KEK)
- **Webhook System**: HTTP callbacks with HMAC signatures, DLQ for failures
- **Hygiene Runner**: Automatic cleanup of expired breadcrumbs, idle agents
- **Transform Engine**: LLM hints for context optimization (JSONPath, templates)
- **Metrics**: Prometheus-compatible metrics

#### API Endpoints
```
GET  /health                    # Health check
GET  /metrics                   # Prometheus metrics
GET  /docs                      # API documentation (Redoc)
POST /auth/token                # JWT token generation
POST /breadcrumbs               # Create breadcrumb
GET  /breadcrumbs               # List breadcrumbs
GET  /breadcrumbs/:id           # Get breadcrumb
PATCH /breadcrumbs/:id          # Update breadcrumb
DELETE /breadcrumbs/:id         # Delete breadcrumb
GET  /breadcrumbs/search        # Vector search
GET  /events/stream             # SSE event stream
POST /subscriptions/selectors   # Create selector subscription
GET  /agents                    # List agents
POST /agents/:id                # Register agent
POST /agents/:id/webhooks       # Register webhook
POST /secrets                   # Create secret
POST /hygiene/run               # Trigger manual cleanup
```

---

### 2. frontend (Dashboard v2) (React/TypeScript)
**Location**: `rcrt-dashboard-v2/frontend/`

Real-time 3D/2D visualization dashboard for the RCRT ecosystem.

#### Technologies
- **React 18** with TypeScript
- **Zustand** for state management (with Immer)
- **React Query** for data fetching
- **Three.js** + **React Three Fiber** for 3D rendering
- **Framer Motion** for animations
- **TailwindCSS** for styling

#### Key Features

**Visualization**
- Switchable 2D/3D views
- Nodes represent breadcrumbs, agents, tools, secrets
- Connections show relationships (creation, subscription, tool execution)
- Real-time updates via SSE
- Force-directed and spherical layouts

**State Management**
```typescript
// Zustand store with Immer
nodes: Map<string, RenderNode>
connections: Map<string, RenderConnection>
selectedNodeIds: string[]
activeFilters: FilterState
eventStream: { connected, lastEventTime, eventCount }
```

**Filter System**
- Filter by text, tags, schemas, node types
- Date range filtering
- Custom filter functions
- Real-time filter application

**Real-Time Features**
- SSE connection to rcrt-server
- Live chat bubble animations
- Thinking indicators
- Response trails

#### Component Architecture
```
App.tsx (QueryClientProvider + DashboardProvider)
└── Dashboard.tsx
    ├── Header.tsx
    ├── LeftPanel (filters, create, details)
    ├── Canvas2D or Canvas3D
    │   ├── Node2D/Node3D components
    │   └── Connection2D/Connection3D components
    └── RightPanel (events, chat)
```

---

### 3. agent-runner (Node.js/TypeScript)
**Location**: `rcrt-visual-builder/apps/agent-runner/`

Executes AI agents defined as breadcrumbs with schema `agent.def.v1`.

#### Technologies
- **Node.js** with TypeScript
- **@rcrt-builder/sdk** for RCRT API calls
- **@rcrt-builder/runtime** for AgentExecutor
- **jsonrepair** for fixing LLM JSON output

#### Architecture

**ModernAgentRegistry**
- Loads agent definitions from breadcrumbs
- Maintains catalog (schema: `agent.catalog.v1`)
- Single centralized SSE connection
- Routes events to appropriate agents

**AgentExecutor Pattern**
```typescript
class AgentExecutor {
  agentDef: AgentDefinitionV1
  rcrtClient: RcrtClientEnhanced
  eventBridge: EventBridge
  
  processSSEEvent(event) {
    // Match against agent subscriptions
    // Execute LLM call if needed
    // Create response breadcrumbs
  }
}
```

**Event Routing**
1. SSE dispatcher receives breadcrumb.updated event
2. Check event against each agent's subscriptions
3. Match on tags, schema, or context
4. Route to AgentExecutor.processSSEEvent()
5. Agent creates response breadcrumbs

**Agent Definition Schema** (`agent.def.v1`)
```json
{
  "schema_name": "agent.def.v1",
  "context": {
    "agent_id": "uuid",
    "model": "openrouter/model-name",
    "system_prompt": "You are...",
    "capabilities": {
      "can_create_breadcrumbs": true,
      "can_spawn_agents": false
    },
    "subscriptions": {
      "selectors": [
        { "any_tags": ["user:message"] },
        { "schema_name": "tool.response.v1" }
      ]
    }
  }
}
```

---

### 4. tools-runner (Node.js/TypeScript)
**Location**: `rcrt-visual-builder/apps/tools-runner/`

Executes tools in response to `tool.request.v1` breadcrumbs.

#### Technologies
- **Node.js** with TypeScript
- **@rcrt-builder/tools** for tool loading
- **EventBridge** for event coordination

#### Architecture

**Centralized SSE Dispatcher**
- Single SSE connection for all tools
- Routes `tool.request.v1` events to appropriate tools
- Deduplication to prevent duplicate processing

**Tool Loading** (RCRT-Native)
```typescript
class ToolLoader {
  async loadToolByName(name: string) {
    // Load tool definition from breadcrumb (schema: tool.v1)
    const toolBreadcrumb = await client.searchBreadcrumbs({
      schema_name: 'tool.v1',
      context: { name: name }
    })
    
    // Return executable tool
    return new Tool(toolBreadcrumb.context)
  }
}
```

**Tool Execution Flow**
1. Agent creates `tool.request.v1` breadcrumb
2. SSE dispatcher routes to tools-runner
3. Load tool definition from breadcrumbs
4. Execute tool with context (includes EventBridge)
5. Create `tool.response.v1` breadcrumb
6. EventBridge notifies waiting agents

**Tool Subscriptions** (Auto-Triggering)
Tools can subscribe to events just like agents:
```json
{
  "schema_name": "tool.v1",
  "context": {
    "name": "file-monitor",
    "subscriptions": {
      "selectors": [
        { "schema_name": "user.file.uploaded.v1" }
      ]
    }
  }
}
```

**EventBridge**
Allows tools to wait for events without polling:
```typescript
// Tool waits for LLM response
const response = await waitForEvent({
  schema_name: 'tool.response.v1',
  request_id: requestId
}, 60000)
```

---

### 5. extension (Chrome Extension)
**Location**: `extension/`

Browser integration providing chat interface and page context extraction.

#### Technologies
- **React** with TypeScript
- **Vite** for building
- **TailwindCSS** for styling
- **Chrome Extension Manifest V3**

#### Components

**Background Service Worker** (`background/index.js`)
- Manages RCRT connection
- JWT token retrieval and storage
- API call proxy (avoids CORS)
- Page context tracking
- Keepalive alarms

**Side Panel** (`sidepanel/Panel.tsx`)
- Chat interface
- SSE connection for real-time responses
- Message history
- Filter configuration
- Connection status

**RCRT Client** (`lib/rcrt-client.ts`)
```typescript
class RCRTExtensionClient {
  async authenticate() // Get JWT token
  async createBreadcrumb() // Create breadcrumb
  async connectToSSE(filters, onEvent) // SSE listener
  async listenForAgentResponses(conversationId, onResponse)
}
```

**Communication Flow**
1. User types message in side panel
2. Extension creates `user.message.v1` breadcrumb
3. Agent-runner picks up event (via subscription)
4. Agent processes and creates `agent.response.v1`
5. Extension SSE listener receives event
6. Response displayed in chat

---

## Data Model: Breadcrumbs

Every piece of data in RCRT is a **breadcrumb**.

### Core Schema
```typescript
interface Breadcrumb {
  id: string (UUID)
  title: string
  context: Record<string, any>
  tags: string[]
  schema_name?: string
  version: number
  checksum: string
  ttl?: DateTime
  visibility: 'public' | 'team' | 'private'
  sensitivity: 'low' | 'pii' | 'secret'
  created_at: DateTime
  updated_at: DateTime
  created_by?: string (agent_id)
  updated_by?: string (agent_id)
  owner_id: string (UUID)
  embedding?: vector(384)
}
```

### Common Schemas

**User Messages**
```json
{
  "schema_name": "user.message.v1",
  "tags": ["user:message", "extension:chat"],
  "context": {
    "content": "User's message",
    "conversation_id": "conv-123",
    "timestamp": "2024-..."
  }
}
```

**Agent Responses**
```json
{
  "schema_name": "agent.response.v1",
  "tags": ["agent:response"],
  "context": {
    "content": "Agent's response",
    "conversation_id": "conv-123",
    "confidence": 0.95,
    "sources_used": ["breadcrumb-id-1"]
  }
}
```

**Tool Requests**
```json
{
  "schema_name": "tool.request.v1",
  "tags": ["tool:request", "workspace:tools"],
  "context": {
    "tool": "openrouter",
    "input": { "messages": [...] },
    "requestId": "req-123",
    "requestedBy": "agent-uuid"
  }
}
```

**Tool Responses**
```json
{
  "schema_name": "tool.response.v1",
  "tags": ["tool:response", "request:req-123"],
  "context": {
    "request_id": "req-123",
    "tool": "openrouter",
    "status": "success",
    "output": { "content": "..." },
    "execution_time_ms": 1234
  }
}
```

**Agent Definitions**
```json
{
  "schema_name": "agent.def.v1",
  "tags": ["workspace:agents"],
  "context": {
    "agent_id": "agent-uuid",
    "model": "openrouter/anthropic/claude-3.5-sonnet",
    "system_prompt": "You are a helpful assistant",
    "capabilities": { "can_create_breadcrumbs": true },
    "subscriptions": {
      "selectors": [{ "any_tags": ["user:message"] }]
    }
  }
}
```

**Tool Definitions**
```json
{
  "schema_name": "tool.v1",
  "tags": ["workspace:tools"],
  "context": {
    "name": "openrouter",
    "description": "Call LLM via OpenRouter",
    "parameters": { ... },
    "subscriptions": {
      "selectors": [{ "schema_name": "llm.request.v1" }]
    }
  }
}
```

---

## Event Flow Examples

### Example 1: User Chat Message

```mermaid
sequenceDiagram
    User->>Extension: Types message
    Extension->>rcrt-server: POST /breadcrumbs (user.message.v1)
    rcrt-server->>NATS: Publish bc.{id}.updated
    NATS->>agent-runner: SSE event
    agent-runner->>AgentExecutor: Route to agent
    AgentExecutor->>OpenRouter: LLM call
    OpenRouter-->>AgentExecutor: Response
    AgentExecutor->>rcrt-server: POST /breadcrumbs (agent.response.v1)
    rcrt-server->>NATS: Publish bc.{id}.updated
    NATS->>Extension: SSE event
    Extension->>User: Display response
```

### Example 2: Tool Execution

```mermaid
sequenceDiagram
    Agent->>rcrt-server: POST /breadcrumbs (tool.request.v1)
    rcrt-server->>NATS: Publish event
    NATS->>tools-runner: SSE event
    tools-runner->>ToolLoader: Load tool definition
    ToolLoader->>rcrt-server: GET /breadcrumbs/search (tool.v1)
    rcrt-server-->>ToolLoader: Tool breadcrumb
    ToolLoader-->>tools-runner: Tool instance
    tools-runner->>Tool: Execute
    Tool->>External API: API call
    External API-->>Tool: Response
    Tool-->>tools-runner: Result
    tools-runner->>rcrt-server: POST /breadcrumbs (tool.response.v1)
    rcrt-server->>NATS: Publish event
    NATS->>Agent: SSE event (EventBridge)
    Agent->>EventBridge: waitForEvent resolves
```

---

## Authentication & Security

### JWT Token Flow
```typescript
// 1. Request token
POST /auth/token
{
  "owner_id": "uuid",
  "agent_id": "uuid",
  "roles": ["curator", "emitter", "subscriber"],
  "ttl_sec": 3600
}

// 2. Response
{
  "token": "eyJ...",
  "owner_id": "uuid",
  "agent_id": "uuid",
  "roles": ["curator", "emitter", "subscriber"],
  "exp": 1234567890
}

// 3. Use in requests
Authorization: Bearer eyJ...
```

### Roles
- **curator**: Full breadcrumb management, agent management
- **emitter**: Create breadcrumbs
- **subscriber**: Read breadcrumbs, create selectors

### Security Features
- RSA256 JWT signatures
- Envelope encryption for secrets (AES-256-GCM + XChaCha20-Poly1305)
- HMAC webhook signatures (SHA256)
- Audit trail for secret access
- ACL for fine-grained permissions

---

## Configuration & Deployment

### Environment Variables

**rcrt-server**
```bash
DB_URL=postgresql://user:pass@localhost/rcrt
OWNER_ID=00000000-0000-0000-0000-000000000001
JWT_PUBLIC_KEY_PEM=...
JWT_PRIVATE_KEY_PEM=...
NATS_URL=nats://localhost:4222
EMBED_MODEL=models/model.onnx
EMBED_TOKENIZER=models/tokenizer.json
EMBED_DIM=384
LOCAL_KEK_BASE64=... # For secrets encryption
```

**agent-runner**
```bash
RCRT_BASE_URL=http://localhost:8081
WORKSPACE=workspace:agents
OWNER_ID=00000000-0000-0000-0000-000000000001
AGENT_ID=00000000-0000-0000-0000-000000000AAA
OPENROUTER_API_KEY=...
```

**tools-runner**
```bash
RCRT_BASE_URL=http://localhost:8081
WORKSPACE=workspace:tools
DEPLOYMENT_MODE=local # docker, local, electron
RCRT_AUTH_MODE=jwt # disabled, jwt
```

**frontend**
```bash
VITE_RCRT_BASE_URL=http://localhost:8081
```

### Docker Compose
```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    ports: ["5432:5432"]
  
  nats:
    image: nats:latest
    ports: ["4222:4222"]
  
  rcrt-server:
    build: ./crates/rcrt-server
    ports: ["8081:8080"]
    depends_on: [postgres, nats]
  
  agent-runner:
    build: ./rcrt-visual-builder/apps/agent-runner
    depends_on: [rcrt-server]
  
  tools-runner:
    build: ./rcrt-visual-builder/apps/tools-runner
    depends_on: [rcrt-server]
  
  frontend:
    build: ./rcrt-dashboard-v2/frontend
    ports: ["8082:80"]
```

---

## Key Design Patterns

### 1. Selector-Based Routing
Instead of hardcoded routing, use selectors:
```typescript
{
  "selectors": [
    { "any_tags": ["user:message"] },
    { "all_tags": ["urgent", "customer"] },
    { "schema_name": "tool.response.v1" },
    {
      "context_match": [{
        "path": "$.status",
        "op": "eq",
        "value": "error"
      }]
    }
  ]
}
```

### 2. Event-Driven Coordination
No polling! Use EventBridge:
```typescript
// Create request
await client.createBreadcrumb({
  schema_name: 'tool.request.v1',
  context: { requestId: 'req-123' }
})

// Wait for response (via SSE)
const response = await eventBridge.waitForEvent({
  schema_name: 'tool.response.v1',
  request_id: 'req-123'
}, 60000)
```

### 3. Schema Versioning
All breadcrumbs have versioned schemas:
- `user.message.v1` → future: `user.message.v2`
- Allows gradual migration
- Old clients still work

### 4. Hygiene System
Automatic cleanup of ephemeral data:
```rust
// Auto-TTL based on schema
if schema_name == "tool.request.v1" && tags.contains("health:check") {
  ttl = now + 5 minutes
}

// Manual TTL
breadcrumb.ttl = Some(now + 1 hour)

// Automatic cleanup runner
HygieneRunner::new(config).start()
```

---

## Performance Characteristics

### Scalability
- **PostgreSQL**: Handles millions of breadcrumbs with indexes
- **pgvector**: Fast vector search with HNSW indexes
- **NATS**: Distributed pub/sub scales horizontally
- **SSE**: Thousands of concurrent connections per server

### Latency
- Breadcrumb creation: ~10-50ms
- Vector search: ~50-200ms (depends on index size)
- SSE event delivery: ~1-5ms
- Agent response: ~1-3s (LLM latency dominant)

### Optimization Strategies
1. **Embedding Policy**: Skip embeddings for system breadcrumbs
2. **Hygiene**: Automatic cleanup reduces DB size
3. **Connection Pooling**: Shared DB pools
4. **Batch Operations**: Bulk breadcrumb creation
5. **Caching**: Redis for hot breadcrumbs (future)

---

## Troubleshooting

### Common Issues

**SSE Connection Fails**
- Check JWT token is valid
- Verify CORS headers
- Check NATS connection (if using NATS feature)

**Agent Not Responding**
- Verify agent definition breadcrumb exists
- Check subscriptions match event tags
- Review agent-runner logs

**Tool Execution Fails**
- Ensure tool definition breadcrumb exists
- Check tool.request.v1 has correct context
- Verify secrets are configured

**Vector Search Returns Nothing**
- Check if embeddings were created (embedding policy)
- Verify ONNX model is loaded
- Use manual embeddings if needed

### Debug Commands
```bash
# Check breadcrumbs
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8081/breadcrumbs?schema_name=agent.def.v1

# Test vector search
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8081/breadcrumbs/search?q=hello&nn=5"

# Check agents
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8081/agents

# Manual hygiene run
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8081/hygiene/run
```

---

## Future Enhancements

### Planned Features
1. **WebAssembly Tools**: Run tools in browser
2. **GraphQL API**: Alternative to REST
3. **Redis Caching**: Hot breadcrumb cache
4. **Elasticsearch**: Full-text search
5. **Kubernetes Operators**: Native k8s deployment
6. **Multi-Tenancy**: Workspace isolation
7. **Audit Trail**: Full history tracking
8. **Rate Limiting**: Per-agent quotas
9. **Cost Tracking**: LLM usage monitoring
10. **Agent Marketplace**: Share agent definitions

### Research Areas
- Federated learning for agents
- Agent-to-agent negotiation protocols
- Automatic agent optimization
- Context window management strategies

---

## Contributing

### Code Structure
```
breadcrums/
├── crates/
│   ├── rcrt-core/         # Core types, DB layer
│   ├── rcrt-server/       # Main server
│   └── rcrt-dashboard/    # [Legacy]
├── rcrt-dashboard-v2/
│   └── frontend/          # React dashboard
├── rcrt-visual-builder/
│   ├── apps/
│   │   ├── agent-runner/  # Agent execution
│   │   └── tools-runner/  # Tool execution
│   └── packages/
│       ├── sdk/           # RCRT client SDK
│       ├── runtime/       # AgentExecutor, EventBridge
│       ├── tools/         # Tool implementations
│       └── core/          # Shared types
└── extension/             # Chrome extension
```

### Development Workflow
1. Start PostgreSQL + NATS
2. Run migrations: `sqlx migrate run`
3. Start rcrt-server: `cargo run -p rcrt-server`
4. Start agent-runner: `cd rcrt-visual-builder/apps/agent-runner && npm run dev`
5. Start tools-runner: `cd rcrt-visual-builder/apps/tools-runner && npm run dev`
6. Start frontend: `cd rcrt-dashboard-v2/frontend && npm run dev`
7. Build extension: `cd extension && npm run build`

---

## Conclusion

RCRT is a production-ready, event-driven AI agent platform that treats all data as versioned breadcrumbs. Its modular architecture allows running components independently while maintaining real-time coordination through SSE and selector-based subscriptions.

The system is designed for:
- **Developers**: Building AI agents and tools
- **Researchers**: Experimenting with agent architectures
- **Enterprises**: Deploying production AI workflows

Key strengths:
✅ Real-time event-driven architecture  
✅ Flexible selector-based routing  
✅ Schema versioning for backwards compatibility  
✅ Production-ready security (JWT, encryption, ACL)  
✅ Horizontal scalability with NATS  
✅ Beautiful 3D visualization dashboard  
✅ Browser integration via extension  

---

**Version**: 2.0  
**Last Updated**: 2024  
**Maintainer**: RCRT Team  
**License**: [Your License]
