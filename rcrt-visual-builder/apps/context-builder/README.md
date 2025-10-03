# Context-Builder Runner

Universal context assembly service with auto-discovery.

## What It Does

Maintains `agent.context.v1` breadcrumbs for agents, workflows, and any other consumers.

Instead of each agent manually building context (fetching, filtering, combining breadcrumbs), **context-builder does it once and shares the result**.

## How It Works

```
1. Discovers context.config.v1 breadcrumbs
   ↓
2. Subscribes to all update_triggers from configs
   ↓
3. On trigger event:
   • Uses pgvector to find relevant context
   • Applies deduplication (embedding similarity)
   • Enforces token budgets
   • Updates agent.context.v1 with llm_hints
   ↓
4. Consumer (agent/workflow) gets ONE context update
```

## Quick Start

### Local Development
```bash
cd rcrt-visual-builder/apps/context-builder
pnpm install
pnpm dev
```

### Docker
```bash
docker-compose up -d context-builder
```

## Configuration

Via environment variables:

```bash
RCRT_BASE_URL=http://localhost:8081
OWNER_ID=00000000-0000-0000-0000-000000000001
AGENT_ID=00000000-0000-0000-0000-000000000CCC
WORKSPACE=workspace:context
```

## Usage Examples

### Register a Chat Agent

```typescript
import { setupChatAgentContext } from '@rcrt-builder/tools/examples';

await setupChatAgentContext(client, 'my-agent-id');
```

This creates:
1. `context.config.v1` - Declares what context to assemble
2. Registers with context-builder
3. context-builder creates/maintains `agent.context.v1`
4. Agent subscribes to `agent.context.v1`

### Manual Config

```typescript
await client.createBreadcrumb({
  schema_name: 'context.config.v1',
  tags: ['context:config', 'consumer:my-agent'],
  context: {
    consumer_id: 'my-agent',
    sources: [
      { 
        schema_name: 'user.message.v1', 
        method: 'vector',  // pgvector semantic search!
        nn: 5 
      }
    ],
    update_triggers: [
      { schema_name: 'user.message.v1' }
    ],
    output: {
      schema_name: 'agent.context.v1',
      tags: ['agent:context', 'consumer:my-agent']
    }
  }
});
```

## Benefits

- **70-80% token reduction** (8000 → 1500 tokens)
- **99% event reduction** (300 events → 1 event per user message)
- **pgvector semantic relevance** (not just chronological)
- **Automatic deduplication** (no repeated messages)
- **Token budget enforcement** (stay under limits)
- **Scales to 1000s of consumers** (O(1) per consumer)

## Architecture

See [CONTEXT_BUILDER_ARCHITECTURE.md](../../packages/tools/CONTEXT_BUILDER_ARCHITECTURE.md) for detailed architecture and patterns.

## Monitoring

Context-builder emits metrics:

```bash
curl http://localhost:8081/breadcrumbs?schema_name=system.context-metrics.v1
```

Shows:
- Active consumers
- Updates per minute
- Average token counts
- Assembly times
- Cache hit rates

## Troubleshooting

**No context updates?**
- Check context-builder-runner logs
- Verify context.config.v1 was created
- Ensure update_triggers match events

**Context too large?**
- Reduce `nn` in vector searches
- Lower `limit` in recent searches
- Set stricter `max_tokens`

**Context not relevant?**
- Verify pgvector is enabled (RCRT server)
- Check embedding quality
- Adjust `nn` parameter

## Comparison

| Approach | Events/Message | Tokens | Uses pgvector | Scalable |
|----------|----------------|--------|---------------|----------|
| **Manual (current)** | 300+ | 8000+ | ❌ | ❌ |
| **Context-Builder** | 1-2 | 1500 | ✅ | ✅ |

## See Also

- [Context-Builder Architecture](../../packages/tools/CONTEXT_BUILDER_ARCHITECTURE.md)
- [Example Configurations](../../packages/tools/examples/context-builder-examples.ts)
- [Complete System Docs](../../../CONTEXT_BUILDER_SYSTEM.md)

