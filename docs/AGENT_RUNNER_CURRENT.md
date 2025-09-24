# Agent Runner - Current Implementation

## Overview
The Agent Runner executes agent definitions stored as breadcrumbs in RCRT using the modern AgentExecutor pattern.

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

## Key Components

### ModernAgentRegistry
- Manages all agent executors
- Maintains agent catalog breadcrumb
- Handles dynamic agent loading via SSE
- Provides centralized SSE dispatcher

### AgentExecutor (from @rcrt-builder/runtime)
- Executes individual agent logic
- Handles LLM integration via OpenRouter
- Manages agent state and metrics
- Processes events based on subscriptions

## Agent Definition Schema
```typescript
{
  schema_name: 'agent.def.v1',
  title: 'My Agent',
  context: {
    agent_id: 'unique-agent-id',
    agent_name: 'display-name',
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

## How It Works

1. **Startup**: Registry loads all `agent.def.v1` breadcrumbs from workspace
2. **Registration**: Creates AgentExecutor for each definition
3. **Event Stream**: Centralized SSE dispatcher routes events to agents
4. **Processing**: Agents process events based on subscriptions
5. **LLM Integration**: Uses OpenRouter for decision making
6. **Actions**: Agents create/update breadcrumbs based on capabilities

## Environment Variables
- `RCRT_BASE_URL`: RCRT server URL (default: http://localhost:8081)
- `WORKSPACE`: Agent workspace tag (default: workspace:agents)
- `OPENROUTER_API_KEY`: API key for LLM access
- `OWNER_ID`: Tenant ID
- `AGENT_ID`: Runner's agent ID

## Dynamic Features
- **Auto-discovery**: Detects new agent definitions via SSE
- **Hot-reload**: Can reload agents without restart
- **Health monitoring**: Reports metrics as breadcrumbs
- **Token refresh**: Automatic JWT token renewal

## Troubleshooting
- If showing "0 agents": Run `./reload-agents.js` or restart service
- Check logs: `docker compose logs -f agent-runner`
- Verify default agent exists: Check for `agent.def.v1` breadcrumbs
