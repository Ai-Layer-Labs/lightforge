# The Simple RCRT Pattern (No Overcomplications!)

## 🎯 **The Core Pattern**

```
Breadcrumb created/updated
    ↓
NATS publishes event
    ↓
SSE stream delivers to subscribers
    ↓
Subscriber's selector matches?
    ↓ YES
Handler executes
```

**That's ALL RCRT does!**

## ❌ **What We DON'T Need**

- ❌ Special discovery functions (`discoverContextConfigs()`)
- ❌ Manual trigger checking (`checkContextTriggers()`)
- ❌ Separate state tracking (`activeContextConfigs` Map)
- ❌ Custom subscription logic (RCRT already has selectors!)

## ✅ **What We SHOULD Use**

**JUST the existing selector system:**

```typescript
// tool.v1 breadcrumb for context-builder
{
  schema_name: 'tool.v1',
  context: {
    name: 'context-builder',
    
    // THIS IS ALL WE NEED!
    subscriptions: {
      selectors: [
        { schema_name: 'user.message.v1', any_tags: ['user:message'] },
        { schema_name: 'tool.response.v1' }
      ]
    }
  }
}

// tools-runner just:
1. Load tool.v1 breadcrumbs
2. For each with subscriptions:
3. When event arrives, check selectors
4. If match: Create tool.request.v1
5. Done!
```

## 🔄 **The Simple Flow**

```
user.message.v1 event arrives
    ↓
tools-runner checks ALL tool.v1 breadcrumbs:
  • Does context-builder.subscriptions match this event?
  • YES! (selector: { schema_name: 'user.message.v1' })
    ↓
  Create tool.request.v1 for context-builder
    ↓
tools-runner executes context-builder
    ↓
context-builder updates agent.context.v1
    ↓
agent.context.v1 event arrives
    ↓
agent-runner checks agent subscriptions:
  • Does default-chat-assistant.subscriptions match?
  • YES! (selector: { schema_name: 'agent.context.v1' })
    ↓
  Agent processes event
```

**Everything uses selectors! No special logic!**

## 📊 **What context.config.v1 Is**

**NOT a trigger mechanism!** Just data for context-builder:

```
context.config.v1 is:
  ✅ Input data (what sources to assemble)
  ❌ NOT trigger config (that's in tool.v1.subscriptions)
  
When context-builder executes:
  1. Read context.config.v1 (to know what to assemble)
  2. Do vector search
  3. Update agent.context.v1
```

## ✨ **Simplified Code**

```typescript
// tools-runner SSE handler:
async function handleEvent(eventData) {
  // Check tool subscriptions (SAME as agent subscriptions!)
  for (const tool of allTools) {
    if (tool.context.subscriptions) {
      for (const selector of tool.context.subscriptions.selectors) {
        if (matchesSelector(eventData, selector)) {
          // Auto-create tool.request.v1
          await createBreadcrumb({
            schema_name: 'tool.request.v1',
            context: {
              tool: tool.context.name,
              input: { event: eventData }
            }
          });
        }
      }
    }
  }
  
  // Execute tool requests
  if (eventData.schema_name === 'tool.request.v1') {
    await executeTool(eventData);
  }
}
```

**One loop, one pattern, works for all tools!**

Let me refactor to this simpler approach...

