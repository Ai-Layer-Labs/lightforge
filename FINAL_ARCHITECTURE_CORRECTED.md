# Final Architecture: The RCRT Way (Corrected!)

## ✅ **The Correct Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│ RCRT SERVICES (Minimal!)                                    │
├─────────────────────────────────────────────────────────────┤
│ 1. rcrt (Rust server)     - Core API, pgvector, transforms │
│ 2. tools-runner (Node)    - ALL tools (including context)  │
│ 3. agent-runner (Node)    - Agents (reasoning only)        │
│ 4. dashboard (nginx)      - Admin UI                       │
├─────────────────────────────────────────────────────────────┤
│ INFRASTRUCTURE                                              │
│ • db (PostgreSQL + pgvector)                               │
│ • nats (Event bus)                                         │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 **tools-runner: The Universal Tool Executor**

**Runs ALL tools:**
- openrouter (LLM)
- breadcrumb-crud (System)
- calculator (Utility)
- workflow (Orchestration)
- **context-builder (Context Assembly)** ← Just another tool!
- ... (all other tools)

**Responsibilities:**
1. Bootstrap all tools from builtinTools
2. Discover context.config.v1 breadcrumbs
3. Subscribe to ALL events via SSE
4. Auto-trigger context-builder when events match triggers
5. Execute tools on tool.request.v1 events

**ONE service handles ALL tools!**

## 🔄 **The Flow (Corrected)**

```
┌────────────────────────────────────────────────────────┐
│ 1. User sends "What was that API key?"                 │
│    Creates: user.message.v1                            │
└────────────┬───────────────────────────────────────────┘
             │ NATS publishes event
             ↓
┌────────────────────────────────────────────────────────┐
│ 2. tools-runner receives SSE event                     │
│    checkContextTriggers() called:                      │
│    • Event schema: user.message.v1                     │
│    • Checks activeContextConfigs                       │
│    • Matches trigger for default-chat-assistant        │
│    • Creates tool.request.v1 for context-builder      │
└────────────┬───────────────────────────────────────────┘
             │ tool.request.v1 created
             ↓
┌────────────────────────────────────────────────────────┐
│ 3. tools-runner receives tool.request.v1              │
│    dispatchEventToTool() called:                       │
│    • tool: "context-builder"                          │
│    • Loads tool from builtinTools                     │
│    • Executes tool.execute(input, context)            │
│    • context-builder does vector search               │
│    • context-builder updates agent.context.v1         │
│    • Creates tool.response.v1                         │
└────────────┬───────────────────────────────────────────┘
             │ agent.context.v1 updated
             ↓
┌────────────────────────────────────────────────────────┐
│ 4. agent-runner receives agent.context.v1             │
│    • Pre-built context with vector search              │
│    • Clean Markdown formatting                         │
│    • Calls OpenRouter                                  │
└────────────────────────────────────────────────────────┘
```

**All happening in tools-runner! No separate service!**

## 🗑️ **What Was Deleted**

```
Deleted:
├─ rcrt-visual-builder/apps/context-builder/ (entire directory)
│  ├─ src/index.ts (not needed - logic in tools-runner now)
│  ├─ package.json
│  ├─ Dockerfile
│  ├─ tsup.config.ts
│  └─ README.md

Removed from docker-compose.yml:
└─ context-builder service definition
```

## ✅ **What Remains**

```
Keep (The Actual Tool):
└─ rcrt-visual-builder/packages/tools/src/context-tools/
   ├─ context-builder-tool.ts ← THE TOOL (code)
   └─ index.ts (exports)

Enhanced:
└─ rcrt-visual-builder/apps/tools-runner/src/index.ts
   ├─ discoverContextConfigs() ← Finds context.config.v1
   ├─ checkContextTriggers() ← Auto-invokes context-builder
   └─ dispatchEventToTool() ← Executes context-builder tool
```

## 📊 **Service Count**

| Architecture | Services | Comment |
|--------------|----------|---------|
| **Before** | 7 | tools-runner + context-builder-runner |
| **After** | 6 | tools-runner does both! |
| **RCRT Way** | ✅ | Tools are code, not services |

## 🎯 **The Key Insight**

**Tools = Code that runs in tools-runner**
**NOT separate services!**

```
openrouter tool:
  • Code: OpenRouterTool class
  • Runs in: tools-runner
  • Invoked via: tool.request.v1

context-builder tool:
  • Code: ContextBuilderTool class
  • Runs in: tools-runner ← SAME!
  • Invoked via: tool.request.v1 (auto-created on trigger)
```

**All tools are equal citizens in tools-runner!**

## 🚀 **Deployment (Simplified)**

```bash
# Just 3 app services now!
docker-compose up -d --build

Services that start:
├─ rcrt (Rust server)
├─ tools-runner (ALL tools including context-builder)
└─ agent-runner (Agents)

That's it!
```

## ✨ **Benefits of This Fix**

1. **Simpler deployment** - One less service
2. **Proper RCRT architecture** - Tools are not services
3. **Reuses existing infrastructure** - tools-runner already handles all tools
4. **Auto-triggering built-in** - tools-runner watches for triggers
5. **Consistent pattern** - context-builder like any other tool

**This is the RCRT way: Composable tools, not microservices!** 🎯

