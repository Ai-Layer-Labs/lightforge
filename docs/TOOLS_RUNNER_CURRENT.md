# Tools Runner - Current Implementation

## Overview
Standalone service that registers and runs tools for the RCRT ecosystem. Supports Docker, local Node.js, and Electron deployments.

## Features
- **Universal Tool Interface**: Wraps any tool to work with RCRT breadcrumbs
- **LangChain Integration**: Automatic bridge for 100+ LangChain tools
- **Tool Discovery**: Single catalog breadcrumb per workspace
- **UI Generation**: Auto-creates Visual Builder interfaces
- **Multi-Deployment**: Docker, local, or Electron packaging

## Tool Catalog Management
Tools are managed via a **single catalog breadcrumb** that updates when tools are added/removed:

```json
{
  "schema_name": "tool.catalog.v1",
  "title": "workspace:tools Tool Catalog",
  "context": {
    "workspace": "workspace:tools", 
    "tools": [
      {"name": "serpapi", "status": "active", "category": "search"},
      {"name": "calculator", "status": "active", "category": "math"}
    ],
    "totalTools": 2,
    "activeTools": 2,
    "lastUpdated": "2025-01-10T..."
  }
}
```

## Tool Execution Flow
1. Agent creates `tool.request.v1` breadcrumb
2. Tools runner processes request
3. Executes appropriate tool (built-in or LangChain)
4. Creates `tool.response.v1` breadcrumb with results
5. Agent receives response via SSE

## Available Tools

### Built-in Tools
- **echo**: Returns input unchanged (testing)
- **timer**: Wait for specified seconds
- **random**: Generate random numbers

### LangChain Tools (when enabled)
- **serpapi**: Web search via SerpAPI
- **calculator**: Mathematical calculations  
- **web_browser**: Web page content extraction

## Configuration
- `RCRT_BASE_URL`: Direct RCRT server URL
- `WORKSPACE`: Tool workspace tag (default: workspace:tools)
- `ENABLE_LANGCHAIN_TOOLS`: Enable LangChain integration
- `ENABLE_BUILTIN_TOOLS`: Enable built-in tools
- `ENABLE_TOOL_UI`: Generate Visual Builder interfaces

## Secrets Management
At startup, the runner resolves tool API keys from RCRT Secrets. If missing, it will auto-create from same-named env vars (one-time bootstrap) or emit a `tool.config.request.v1` breadcrumb.

## Deployment Modes

### Docker (Production)
- Connects directly to RCRT server
- No auth proxy needed
- Suitable for server deployments

### Local (Development)  
- Uses Visual Builder proxy (`/api/rcrt`)
- JWT auth via `/api/auth/token`
- Good for development and testing

### Electron (Desktop App)
- Bundles tools as desktop application
- Uses local RCRT proxy
- Good for end-user distribution

## Tool Discovery
```bash
# View available tools
curl http://localhost:8081/breadcrumbs?tag=workspace:tools&schema_name=tool.catalog.v1
```

Agents can discover and use tools dynamically based on the centralized catalog.
