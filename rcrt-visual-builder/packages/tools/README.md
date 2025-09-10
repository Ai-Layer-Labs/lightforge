# @rcrt-builder/tools

Universal tool integration system for RCRT. Wraps any tool (LangChain, custom functions, external APIs) to work seamlessly with the RCRT breadcrumb ecosystem.

## Features

- **Universal Interface**: Any tool can integrate via standardized schemas
- **LangChain Bridge**: Automatic wrapper for 100+ LangChain tools
- **Auto-Discovery**: Tools publish themselves for agent discovery
- **UI Generation**: Auto-creates Visual Builder interfaces
- **Multi-Environment**: Works in Docker, Node.js, browser, and Electron

## Quick Start

### Install
```bash
pnpm add @rcrt-builder/tools @rcrt-builder/sdk
```

### Basic Usage
```typescript
import { createClient } from '@rcrt-builder/sdk';
import { createToolRegistry, builtinTools } from '@rcrt-builder/tools';

const client = await createClient({ baseUrl: '/api/rcrt' });
const registry = await createToolRegistry(client, 'workspace:tools', {
  enableBuiltins: true,
  enableLangChain: true,
  enableUI: true
});

// Tools are now listening for tool.request.v1 breadcrumbs
```

### Request Tool Execution
```typescript
// From an agent or UI
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
    console.log('Result:', evt.context.result);
  }
});
```

## Creating Custom Tools

### Simple Function Tool
```typescript
import { createTool } from '@rcrt-builder/tools';

const weatherTool = createTool(
  'weather',
  'Get current weather for a location',
  {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' }
    },
    required: ['location']
  },
  {
    type: 'object',
    properties: {
      temperature: { type: 'number' },
      condition: { type: 'string' }
    }
  },
  async (input) => {
    // Your weather API call here
    return {
      temperature: 72,
      condition: 'sunny'
    };
  }
);

await registry.register(weatherTool);
```

### Advanced Tool Class
```typescript
import { RCRTTool } from '@rcrt-builder/tools';

class DatabaseTool implements RCRTTool {
  name = 'database_query';
  description = 'Execute SQL queries';
  category = 'database';
  
  inputSchema = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'SQL query' },
      database: { type: 'string', description: 'Database name' }
    },
    required: ['query']
  };
  
  outputSchema = {
    type: 'object',
    properties: {
      rows: { type: 'array' },
      count: { type: 'number' }
    }
  };
  
  validateInput(input: any): boolean | string {
    if (!input.query || typeof input.query !== 'string') {
      return 'Query must be a string';
    }
    if (input.query.toLowerCase().includes('drop')) {
      return 'DROP statements not allowed';
    }
    return true;
  }
  
  async execute(input: any, context: ToolExecutionContext) {
    // Your database logic here
    const rows = await executeQuery(input.query);
    return { rows, count: rows.length };
  }
  
  async cleanup() {
    // Close database connections, etc.
  }
}

await registry.register(new DatabaseTool());
```

## LangChain Integration

### Auto-Register LangChain Tools (with RCRT Secrets)
```typescript
// Keys are resolved by the registry via ensureSecrets during registration:
// SERPAPI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, BRAVE_SEARCH_API_KEY, GOOGLE_SEARCH_API_KEY, GOOGLE_CSE_ID
await registry.registerLangChainTools({
  serpApiKey: /* resolved from RCRT Secrets by tools-runner */, 
  openaiApiKey: /* resolved from RCRT Secrets by tools-runner */
});
```

### Available LangChain Tools
- **serpapi**: Web search via SerpAPI
- **calculator**: Mathematical calculations
- **web_browser**: Web page content extraction

More tools are added automatically when LangChain is available.

## Built-in Tools

- **echo**: Returns input unchanged (testing)
- **timer**: Wait for specified seconds  
- **random**: Generate random numbers

## Tool Discovery

Tools are managed via a **single catalog breadcrumb** that updates when tools are added/removed:

```typescript
// Agents can discover available tools (single catalog per workspace)
const catalogs = await client.searchBreadcrumbs({
  tag: 'workspace:tools',
  schema_name: 'tool.catalog.v1'
});

const toolCatalog = catalogs[0]; // Single catalog breadcrumb
console.log('Available tools:', toolCatalog?.context.tools);
console.log('Active tools:', toolCatalog?.context.activeTools);
console.log('Last updated:', toolCatalog?.context.lastUpdated);

// Example catalog structure:
{
  "schema_name": "tool.catalog.v1",
  "title": "workspace:tools Tool Catalog",
  "context": {
    "workspace": "workspace:tools",
    "tools": [
      {
        "name": "serpapi", 
        "description": "Search the web using Google",
        "status": "active",
        "category": "search"
      }
    ],
    "totalTools": 5,
    "activeTools": 4
  }
}
```

**Key Benefits:**
- ✅ **Single Source of Truth**: One catalog breadcrumb per workspace
- ✅ **Real-time Updates**: Catalog updates when tools are added/removed
- ✅ **Efficient Discovery**: Query one breadcrumb instead of many
- ✅ **Version History**: See how tool availability changed over time

## UI Integration

When `enableUI: true`, tools automatically create Visual Builder components:

```typescript
// Auto-generated UI for each tool
{
  component_ref: 'ToolCard',
  props: {
    title: 'Calculator',
    description: 'Perform mathematical calculations',
    onSubmit: {
      action: 'emit_breadcrumb',
      payload: {
        schema_name: 'tool.request.v1',
        context: { tool: 'calculator', input: '${formData}' }
      }
    }
  }
}
```

## Deployment

### Docker (secrets via RCRT)
```yaml
# docker-compose.yml
services:
  rcrt-tools:
    build: ./apps/tools-runner
    environment:
      - RCRT_BASE_URL=http://rcrt:8081
      - WORKSPACE=workspace:tools
      # API keys must be stored in RCRT Secrets.
      # Create secrets: SERPAPI_API_KEY, OPENAI_API_KEY, etc.
```

### Local Development
```bash
cd apps/tools-runner
pnpm dev
```

### Electron App
```bash
cd apps/tools-runner
pnpm build
electron .
```

## Schemas

### tool.request.v1
```json
{
  "schema_name": "tool.request.v1",
  "context": {
    "tool": "calculator",
    "input": { "expression": "2 + 2" },
    "timeout": 30000
  }
}
```

### tool.response.v1
```json
{
  "schema_name": "tool.response.v1", 
  "context": {
    "tool": "calculator",
    "requestId": "req-123",
    "result": { "result": 4, "expression": "2 + 2" },
    "executionTime": 150
  }
}
```

### tool.error.v1
```json
{
  "schema_name": "tool.error.v1",
  "context": {
    "tool": "calculator", 
    "requestId": "req-123",
    "error": "Invalid expression",
    "code": "EXECUTION_ERROR"
  }
}
```

## Architecture

The tool system follows RCRT's core principle: everything is a breadcrumb client.

1. **Tools subscribe** to `tool.request.v1` events
2. **Execute** the requested operation
3. **Publish results** as `tool.response.v1` or `tool.error.v1`
4. **Agents coordinate** tools via the same breadcrumb interface

This creates a truly composable system where:
- LLM agents can discover and use any tool
- Tools can be developed independently
- UI updates happen automatically
- Everything is auditable through breadcrumbs
