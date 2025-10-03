# Context-Builder: The RCRT Way (Fixed!)

## ❌ **What Was Wrong**

Created separate `context-builder-runner` service - **NOT the RCRT way!**

```
WRONG Architecture:
├─ tools-runner (runs openrouter, calculator, etc.)
├─ context-builder-runner (separate service!) ❌
└─ agent-runner (runs agents)
```

## ✅ **The RCRT Way**

context-builder is a **TOOL**, not a service!

```
RIGHT Architecture:
├─ tools-runner (runs ALL tools: openrouter, calculator, context-builder)
└─ agent-runner (runs agents)
```

## 🔄 **How It Should Work**

### **1. context-builder is registered as tool.v1**
```typescript
// During bootstrap (bootstrap-tools.ts)
{
  schema_name: 'tool.v1',
  title: 'context-builder',
  tags: ['tool', 'tool:context-builder', 'workspace:tools'],
  context: {
    name: 'context-builder',
    description: 'Universal context assembly primitive',
    implementation: {
      type: 'builtin',
      module: '@rcrt-builder/tools',
      export: 'builtinTools.context-builder'
    }
  }
}
```

### **2. tools-runner discovers context.config.v1 breadcrumbs**
```typescript
// Enhanced tools-runner SSE dispatcher

async function startCentralizedSSEDispatcher() {
  // Discover existing context configs
  const contextConfigs = await client.searchBreadcrumbs({
    schema_name: 'context.config.v1'
  });
  
  // Track all update_triggers from all configs
  const allTriggers = contextConfigs.flatMap(cfg => 
    cfg.context.update_triggers || []
  );
  
  // When event arrives, check if it matches ANY trigger
  client.startEventStream((event) => {
    // Check for new context.config.v1
    if (event.schema_name === 'context.config.v1') {
      // Reload configs
      discoverContextConfigs();
    }
    
    // Check if event matches any trigger
    for (const config of contextConfigs) {
      if (matchesTrigger(event, config.context.update_triggers)) {
        // Create tool.request.v1 for context-builder!
        createBreadcrumb({
          schema_name: 'tool.request.v1',
          tags: ['tool:request', 'workspace:tools'],
          context: {
            tool: 'context-builder',
            input: {
              action: 'update',
              consumer_id: config.context.consumer_id,
              trigger_event: event
            }
          }
        });
      }
    }
    
    // Normal tool request handling
    if (event.schema_name === 'tool.request.v1') {
      dispatchEventToTool(event, client, workspace);
    }
  });
}
```

### **3. tools-runner executes context-builder tool**
```typescript
// When tool.request.v1 arrives for context-builder
const toolName = breadcrumb.context.tool;  // "context-builder"
const toolInput = breadcrumb.context.input;  // { action: 'update', consumer_id, ... }

// Load tool (same as any other tool!)
const tool = await loader.loadToolByName(toolName);

// Execute it!
const result = await tool.execute(toolInput, {
  rcrtClient: client,
  workspace: workspace
});

// Create tool.response.v1
await client.createBreadcrumb({
  schema_name: 'tool.response.v1',
  tags: ['tool:response', workspace],
  context: {
    tool: 'context-builder',
    status: 'success',
    output: result
  }
});
```

## 🎯 **What Changes**

### **DELETE:**
- ❌ `rcrt-visual-builder/apps/context-builder/` (entire service!)
- ❌ context-builder service from docker-compose.yml

### **MODIFY:**
- ✅ `tools-runner/src/index.ts` - Add context.config.v1 discovery
- ✅ `tools-runner/src/index.ts` - Auto-create tool.request.v1 on triggers

### **KEEP:**
- ✅ `packages/tools/src/context-tools/context-builder-tool.ts` - The actual tool!
- ✅ `packages/tools/src/index.ts` - Exports context-builder

## 🏗️ **The Clean Architecture**

```
┌──────────────────────────────────────────────────────────┐
│ tools-runner (ONE SERVICE)                               │
│                                                           │
│ On startup:                                              │
│ 1. Bootstrap all tools (including context-builder)      │
│ 2. Discover context.config.v1 breadcrumbs               │
│ 3. Subscribe to ALL schemas in update_triggers          │
│                                                           │
│ On event:                                                │
│ 1. Check if matches any context config trigger          │
│ 2. If yes: Create tool.request.v1 for context-builder  │
│ 3. Execute context-builder tool                         │
│ 4. context-builder updates agent.context.v1             │
└──────────────────────────────────────────────────────────┘
```

**ONE service, not TWO!**

Let me refactor tools-runner to handle this properly...

