# RCRT Agent Runner - Modern Implementation

## Overview

The Agent Runner is a standalone service that executes agent definitions stored as breadcrumbs in RCRT. This modern implementation uses the `AgentExecutor` pattern for clean architecture and better maintainability.

## Key Features

- **AgentExecutor Pattern**: Each agent runs in its own executor with proper state management
- **Centralized SSE Dispatcher**: Single connection routing events to all agents (efficient)
- **Event Correlation**: Tool requests/responses are properly correlated
- **Agent Catalog**: Automatic discovery and registration of agent definitions
- **Health Monitoring**: Built-in health checks and metrics reporting
- **Memory Management**: Agents can persist memory as breadcrumbs

## Architecture

```
┌─────────────────────┐
│   Agent Registry    │
│  (Manages Catalog)  │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │    SSE    │
     │Dispatcher │
     └─────┬─────┘
           │
    ┌──────┴───────┐
    │              │
┌───▼───┐    ┌────▼────┐
│Agent 1│    │ Agent 2 │
│Executor│   │Executor │
└────────┘   └─────────┘
```

## Agent Definition Schema

Agents are defined as breadcrumbs with schema `agent.def.v1`:

```typescript
{
  schema_name: 'agent.def.v1',
  title: 'My Agent',
  context: {
    agent_id: 'unique-agent-id',
    agent_name: 'friendly-name',
    description: 'What this agent does',
    model: 'openrouter/openai/gpt-4',
    system_prompt: 'You are a helpful assistant...',
    
    subscriptions: {
      selectors: [
        { any_tags: ['user:message'] },
        { schema_name: 'specific.event.v1' }
      ]
    },
    
    capabilities: {
      can_create_breadcrumbs: true,
      can_update_own: true,
      can_spawn_agents: false
    }
  }
}
```

## Running Locally

```bash
# Install dependencies
pnpm install

# Build the TypeScript code
pnpm build

# Run in development mode (with hot reload)
pnpm dev

# Run production build
pnpm start
```

## Docker Deployment

```bash
# Build image
docker build -t rcrt-agent-runner .

# Run with environment variables
docker run -e RCRT_BASE_URL=http://rcrt:8081 \
           -e WORKSPACE=workspace:agents \
           -e OPENROUTER_API_KEY=your-key \
           rcrt-agent-runner
```

## Environment Variables

- `RCRT_BASE_URL`: RCRT server URL (default: http://localhost:8081)
- `WORKSPACE`: Agent workspace tag (default: workspace:agents)
- `DEPLOYMENT_MODE`: 'local' or 'docker' (affects startup delay)
- `OPENROUTER_API_KEY`: API key for LLM access
- `OWNER_ID`: Tenant ID (default: 00000000-0000-0000-0000-000000000001)
- `AGENT_ID`: Runner's agent ID (default: 00000000-0000-0000-0000-000000000AAA)

## How It Works

1. **Startup**: Registry loads all `agent.def.v1` breadcrumbs from the workspace
2. **Registration**: Creates an `AgentExecutor` for each agent definition
3. **Event Stream**: Centralized SSE dispatcher routes events to agents
4. **Processing**: Agents process events based on their subscriptions
5. **LLM Integration**: Uses OpenRouter for decision making
6. **Actions**: Agents can create/update breadcrumbs based on capabilities

## Metrics and Monitoring

Agents report metrics as breadcrumbs (`agent.metrics.v1`):
- Events processed
- Errors encountered
- Success rate
- Processing times

The agent catalog (`agent.catalog.v1`) provides a real-time view of all agents.

## Differences from Old Implementation

- **No polling**: Event-driven with proper correlation
- **No SDK bypass**: Consistent use of RcrtClientEnhanced
- **Clean architecture**: AgentExecutor handles all agent logic
- **Better error handling**: Structured error reporting
- **Memory support**: Agents can persist state between runs

## Related Components

- **Tools Runner**: Similar architecture for tool execution
- **AgentExecutor**: Core class from `@rcrt-builder/runtime`
- **RCRT SDK**: Client library for breadcrumb operations
