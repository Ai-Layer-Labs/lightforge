# RCRT System - Current Implementation Overview

## System Architecture (As Implemented)

The RCRT system consists of these core components:

### 1. RCRT Core Server (Rust)
- **Location**: `crates/rcrt-server/`
- **Database**: PostgreSQL with pgvector extension
- **Event Bus**: NATS JetStream
- **API**: HTTP REST API on port 8081
- **Authentication**: JWT-based with role-based permissions
- **Secrets**: Envelope encryption with KEK support

### 2. Agent Runner (TypeScript)
- **Location**: `rcrt-visual-builder/apps/agent-runner/`
- **Architecture**: ModernAgentRegistry with AgentExecutor pattern
- **Event Processing**: Centralized SSE dispatcher
- **Agent Discovery**: Loads `agent.def.v1` breadcrumbs from workspace
- **LLM Integration**: OpenRouter API for agent decisions

### 3. Tools Runner (TypeScript)
- **Location**: `rcrt-visual-builder/apps/tools-runner/`
- **Features**: Tool catalog management, LangChain integration
- **Tool Discovery**: Single catalog breadcrumb per workspace
- **Execution**: Processes `tool.request.v1` → `tool.response.v1`

### 4. Visual Builder (Next.js)
- **Location**: `rcrt-visual-builder/apps/builder/`
- **UI Framework**: React + HeroUI components
- **API Proxy**: Routes to RCRT server via `/api/rcrt`
- **Features**: Agent definition builder, workflow designer

### 5. Dashboard (Rust)
- **Location**: `crates/rcrt-dashboard/`
- **Port**: 8082
- **Purpose**: System monitoring and breadcrumb management

## Current Schemas

### Agent Definition (`agent.def.v1`)
```json
{
  "schema_name": "agent.def.v1",
  "title": "Agent Name",
  "context": {
    "agent_id": "unique-id",
    "agent_name": "display-name",
    "description": "what the agent does",
    "model": "openrouter/openai/gpt-4",
    "system_prompt": "system instructions",
    "subscriptions": {
      "selectors": [
        {"any_tags": ["user:message"]},
        {"schema_name": "specific.event.v1"}
      ]
    },
    "capabilities": {
      "can_create_breadcrumbs": true,
      "can_update_own": true,
      "can_spawn_agents": false
    }
  }
}
```

### Tool Catalog (`tool.catalog.v1`)
```json
{
  "schema_name": "tool.catalog.v1",
  "title": "Tool Catalog",
  "context": {
    "workspace": "workspace:tools",
    "tools": [
      {"name": "serpapi", "status": "active", "category": "search"}
    ],
    "totalTools": 1,
    "activeTools": 1,
    "lastUpdated": "2025-01-10T..."
  }
}
```

## Deployment

### Docker Compose Services
- `db`: PostgreSQL with pgvector
- `nats`: NATS JetStream messaging
- `rcrt`: Core RCRT server (port 8081)
- `agent-runner`: Agent execution service
- `tools-runner`: Tool execution service
- `builder`: Visual builder UI (port 3000)
- `dashboard`: System dashboard (port 8082)

### Environment Configuration
- JWT keys embedded in docker-compose.yml
- OpenRouter API key via `.env` file
- Workspace isolation via tags (e.g., `workspace:agents`)

## Key Workflows

### Agent Execution Flow
1. Agent runner loads `agent.def.v1` breadcrumbs
2. Creates AgentExecutor for each definition
3. SSE dispatcher routes events to matching agents
4. Agents process events based on subscriptions
5. LLM integration via OpenRouter for decisions
6. Agents create/update breadcrumbs as responses

### Tool Execution Flow
1. Agent creates `tool.request.v1` breadcrumb
2. Tools runner processes request
3. Executes appropriate tool (built-in or LangChain)
4. Creates `tool.response.v1` breadcrumb with results
5. Agent receives response via SSE

## Current Limitations
- Single-tenant by default (can be multi-tenant with configuration)
- OpenRouter dependency for LLM capabilities
- No built-in UI for agent creation (requires Visual Builder)
- Limited tool ecosystem (mostly LangChain integration)

## Setup Commands
```bash
# Quick start
./setup.sh

# Clean restart
./clean-start.sh

# If agent-runner shows 0 agents
./reload-agents.js
```
