# RCRT Tools Runner

Standalone service that registers and runs tools for the RCRT ecosystem. Supports Docker, local Node.js, and Electron deployments.

## Features

- **Universal Tool Interface**: Wraps any tool to work with RCRT breadcrumbs
- **LangChain Integration**: Automatic bridge for 100+ LangChain tools
- **Tool Discovery**: Publishes tool catalog for agent discovery
- **UI Generation**: Auto-creates Visual Builder interfaces
- **Multi-Deployment**: Docker, local, or Electron packaging

## Quick Start

### Local Development
```bash
# Install dependencies
pnpm install

# Copy environment config
cp env.example .env
# Edit .env with your API keys

# Start in development mode
pnpm dev
```

### Docker Deployment
```bash
# Build and run with tools
docker-compose -f docker-compose.tools.yml up --build

# Or add to existing RCRT deployment
docker-compose up rcrt rcrt-tools
```

### Electron App
```bash
# Build for desktop
pnpm build
npm install -g electron-builder

# Package for current platform
electron-builder --dir

# Or build distributable
electron-builder
```

## Configuration

Secrets-first flow: At startup the runner resolves tool API keys from RCRT Secrets. If missing, it will auto-create from same-named env vars (one-time bootstrap) or emit a `tool.config.request.v1` breadcrumb to prompt provisioning.

Environment variables (see `env.example`). Do not store API keys in .env; provision them as RCRT Secrets:

- `RCRT_BASE_URL`: Direct RCRT server URL (Docker mode)
- `RCRT_PROXY_URL`: Proxied RCRT URL (local/Electron mode)
- `WORKSPACE`: Tool workspace tag (default: `workspace:tools`)
- `ENABLE_LANGCHAIN_TOOLS`: Enable LangChain integration
No env fallback: If a required secret is missing, the tool will be skipped and a `tool.config.request.v1` breadcrumb will be emitted with instructions.

## Tool Usage

### From Agents
```typescript
// Request a tool execution
await client.createBreadcrumb({
  schema_name: 'tool.request.v1',
  title: 'Search Request',
  tags: ['workspace:tools', 'tool:request'],
  context: {
    tool: 'serpapi',
    input: { query: 'electric bikes' }
  }
});

// Listen for results
client.startEventStream((evt) => {
  if (evt.schema_name === 'tool.response.v1') {
    console.log('Tool result:', evt.context.result);
  }
});
```

### From Visual Builder
Tools automatically create UI components when `ENABLE_TOOL_UI=true`. Users can interact with forms that emit `tool.request.v1` breadcrumbs.

## Available Tools

### Built-in Tools
- **echo**: Returns input unchanged (testing)
- **timer**: Wait for specified seconds
- **random**: Generate random numbers

### LangChain Tools (when enabled)
- **serpapi**: Web search via SerpAPI
- **calculator**: Mathematical calculations  
- **web_browser**: Web page content extraction

### Adding Custom Tools
```typescript
import { RCRTTool, RCRTToolWrapper } from '@rcrt-builder/tools';

const myTool: RCRTTool = {
  name: 'my_custom_tool',
  description: 'Does something useful',
  inputSchema: { /* JSON Schema */ },
  outputSchema: { /* JSON Schema */ },
  async execute(input, context) {
    // Your tool logic here
    return { result: 'success' };
  }
};

const wrapper = new RCRTToolWrapper(myTool, client, 'workspace:tools');
await wrapper.start();
```

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

Tools are managed via a **single catalog breadcrumb** that updates when tools are added/removed:

```bash
# View available tools (single catalog per workspace)
curl http://localhost:8081/breadcrumbs?tag=workspace:tools&schema_name=tool.catalog.v1

# Example response (single breadcrumb):
{
  "schema_name": "tool.catalog.v1",
  "title": "workspace:tools Tool Catalog",
  "context": {
    "workspace": "workspace:tools", 
    "tools": [
      {"name": "serpapi", "status": "active", "category": "search"},
      {"name": "calculator", "status": "active", "category": "math"},
      {"name": "timer", "status": "active", "category": "utility"}
    ],
    "totalTools": 3,
    "activeTools": 3,
    "lastUpdated": "2025-01-10T..."
  }
}
```

**Benefits of Single Catalog:**
- ✅ **Efficient Discovery**: One query finds all tools
- ✅ **Real-time Updates**: Catalog updates when tools change  
- ✅ **Version History**: Track tool availability over time
- ✅ **No Duplication**: Clean, centralized tool management

Agents can discover and use tools dynamically based on the centralized catalog.
