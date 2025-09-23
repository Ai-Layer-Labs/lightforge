# Agent Runner Migration Guide

## Overview

The agent-runner has been completely rewritten using the modern `AgentExecutor` pattern. This guide helps you migrate from the old implementation to the new one.

## Key Changes

### 1. Architecture

**Old**: Manual SSE handling, polling for LLM responses, SDK bypass patterns
**New**: Clean AgentExecutor pattern with centralized SSE and event correlation

### 2. Dependencies

**Old**: Direct implementation in index.ts
**New**: Uses `@rcrt-builder/runtime` AgentExecutor class

### 3. Build Process

**Old**: JavaScript directly (no build)
**New**: TypeScript with proper build pipeline

## Migration Steps

### 1. Update Dependencies

```bash
# Clean install to get new dependencies
pnpm install
```

### 2. Rebuild

```bash
# Build the new TypeScript implementation
pnpm build
```

### 3. Agent Definition Changes

No changes needed! The `agent.def.v1` schema remains the same:

```typescript
{
  schema_name: 'agent.def.v1',
  context: {
    agent_id: 'my-agent',
    agent_name: 'My Agent',
    system_prompt: '...',
    subscriptions: { selectors: [...] },
    capabilities: { ... }
  }
}
```

### 4. Environment Variables

No changes - same environment variables work:
- `RCRT_BASE_URL`
- `WORKSPACE` 
- `OPENROUTER_API_KEY`
- `OWNER_ID`
- `AGENT_ID`

### 5. Docker Deployment

The Dockerfile has been updated to handle the build process:

```bash
# Rebuild the image
docker-compose build agent-runner

# Run as before
docker-compose up agent-runner
```

## Benefits of New Implementation

1. **No Polling**: Event-driven architecture with proper correlation
2. **Better Error Handling**: Structured error reporting and recovery
3. **Memory Support**: Agents can persist state between runs
4. **Metrics**: Built-in performance and health monitoring
5. **Clean Code**: Separation of concerns with AgentExecutor pattern

## Testing

Run the test script to verify your setup:

```bash
pnpm test
```

This will:
1. Create a test agent definition
2. Trigger the agent
3. Verify the response

## Troubleshooting

### Agent Not Processing Events

Check the agent catalog:
```bash
curl http://localhost:8081/breadcrumbs?tag=agent:catalog
```

### LLM Errors

Ensure `OPENROUTER_API_KEY` is set and valid.

### Build Errors

```bash
# Clean and rebuild
pnpm clean
pnpm build
```

## Removed Features

The following patterns from the old implementation have been removed:
- `callLLM()` - Now handled by AgentExecutor
- `waitForToolResponse()` - Replaced with event correlation
- `createBreadcrumbDirect()` - Always use SDK
- `processingStatus` Map - Handled by AgentExecutor state

## Need Help?

Check the README.md for detailed documentation of the new implementation.
