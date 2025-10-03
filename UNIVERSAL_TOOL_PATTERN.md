# Universal Tool Pattern in RCRT

## ✅ **Every Tool Follows the SAME Pattern**

### **Step 1: Implement RCRTTool Interface**

```typescript
// ALL tools implement this interface
export interface RCRTTool {
  name: string;
  description: string;
  category?: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  examples?: Array<{...}>;
  
  execute(input: any, context?: ToolExecutionContext): Promise<any>;  // ← THE KEY METHOD
}
```

### **Step 2: Add to builtinTools**

```typescript
// index.ts
export const builtinTools = {
  // Simple tools (created via helper)
  'echo': createTool('echo', 'Returns input', {...}, {...}, async (input) => ({ echo: input })),
  'calculator': createTool('calculator', 'Math', {...}, {...}, async (input) => ({ result: eval(input.expression) })),
  
  // Complex tools (class instances)
  'openrouter': new OpenRouterTool(),
  'file-storage': new FileStorageTool(),
  'workflow': workflowOrchestrator,
  'context-builder': contextBuilderTool,  // ← Same pattern!
  
  // ALL implement RCRTTool, ALL added to builtinTools
};
```

### **Step 3: Bootstrap on Startup**

```typescript
// tools-runner startup:
await bootstrapTools(client, workspace);

// For EACH tool in builtinTools:
for (const [name, tool] of Object.entries(builtinTools)) {
  // Create tool.v1 breadcrumb
  await client.createBreadcrumb({
    schema_name: 'tool.v1',
    title: tool.name,
    tags: ['tool', `tool:${tool.name}`, workspace],
    context: {
      name: tool.name,
      description: tool.description,
      implementation: {
        type: 'builtin',
        module: '@rcrt-builder/tools',
        export: `builtinTools.${name}`
      },
      definition: {
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema
      }
    }
  });
}

// context-builder gets tool.v1 just like openrouter, calculator, etc.!
```

### **Step 4: Execute on tool.request.v1**

```typescript
// tools-runner SSE handler:
if (eventData.schema_name === 'tool.request.v1') {
  const breadcrumb = await client.getBreadcrumb(eventData.breadcrumb_id);
  const toolName = breadcrumb.context.tool;  // "openrouter", "calculator", "context-builder", etc.
  const toolInput = breadcrumb.context.input;
  
  // Load tool (same for ALL tools)
  const tool = await loader.loadToolByName(toolName);
  
  // Execute (same interface for ALL tools)
  const result = await tool.execute(toolInput, {
    rcrtClient: client,
    workspace: workspace,
    agentId: 'tools-runner'
  });
  
  // Create response (same for ALL tools)
  await client.createBreadcrumb({
    schema_name: 'tool.response.v1',
    title: `Response: ${toolName}`,
    tags: ['tool:response', workspace],
    context: {
      tool: toolName,
      status: 'success',
      output: result
    }
  });
}

// Works identically for openrouter, calculator, context-builder, etc.!
```

## 🎯 **The Pattern (Universal)**

```
Every Tool:
  ├─ Implements RCRTTool interface
  ├─ Added to builtinTools object
  ├─ Bootstrapped → creates tool.v1 breadcrumb
  ├─ Invoked via tool.request.v1
  ├─ Executes → calls tool.execute()
  └─ Responds → creates tool.response.v1
  
No exceptions!
```

## 🔍 **Example: 3 Different Tools, Same Pattern**

### **1. Simple Tool (calculator)**
```typescript
// Created via helper
'calculator': createTool(
  'calculator',
  'Perform calculations',
  { expression: 'string' },
  { result: 'number' },
  async (input) => ({ result: eval(input.expression) })
)

// Bootstrap → tool.v1
// Invoke → tool.request.v1
// Execute → tool.execute()
// Respond → tool.response.v1
```

### **2. Complex Tool (openrouter)**
```typescript
// Class instance
'openrouter': new OpenRouterTool()

class OpenRouterTool implements RCRTTool {
  name = 'openrouter';
  inputSchema = {...};
  outputSchema = {...};
  
  async execute(input, context) {
    // Call OpenRouter API
    return { content, model, usage };
  }
}

// Bootstrap → tool.v1
// Invoke → tool.request.v1
// Execute → tool.execute()
// Respond → tool.response.v1
```

### **3. Context Tool (context-builder)**
```typescript
// Class instance (same as openrouter!)
'context-builder': contextBuilderTool

export class ContextBuilderTool implements RCRTTool {
  name = 'context-builder';
  inputSchema = {...};
  outputSchema = {...};
  
  async execute(input, context) {
    // Assemble context via vector search
    return { success: true, context_id, token_estimate };
  }
}

// Bootstrap → tool.v1
// Invoke → tool.request.v1 (auto-created on triggers!)
// Execute → tool.execute()
// Respond → tool.response.v1
```

**Identical pattern!**

## 🎨 **The ONLY Difference: Auto-Triggering**

context-builder has ONE addition:

```typescript
// In tools-runner:
if (eventData.schema_name === 'user.message.v1') {
  // Check if matches context config trigger
  if (matchesTrigger(eventData, contextConfig.update_triggers)) {
    // Auto-create tool.request.v1 for context-builder
    await client.createBreadcrumb({
      schema_name: 'tool.request.v1',
      context: {
        tool: 'context-builder',  // ← Auto-invoke this tool
        input: { action: 'update', consumer_id, trigger_event }
      }
    });
  }
}

// Then the normal flow:
// tool.request.v1 → dispatchEventToTool() → tool.execute()
```

**But the tool execution itself is identical!**

## 📊 **Tool Lifecycle (Universal)**

| Stage | calculator | openrouter | context-builder |
|-------|-----------|------------|----------------|
| **Define** | `createTool(...)` | `class OpenRouterTool` | `class ContextBuilderTool` |
| **Register** | `builtinTools['calculator']` | `builtinTools['openrouter']` | `builtinTools['context-builder']` |
| **Bootstrap** | `bootstrapTools()` | `bootstrapTools()` | `bootstrapTools()` |
| **tool.v1** | ✅ Created | ✅ Created | ✅ Created |
| **Invoke** | tool.request.v1 | tool.request.v1 | tool.request.v1 |
| **Auto-trigger** | ❌ No | ❌ No | ✅ Yes (on triggers) |
| **Execute** | `tool.execute()` | `tool.execute()` | `tool.execute()` |
| **Respond** | tool.response.v1 | tool.response.v1 | tool.response.v1 |

**Same pattern, with context-builder having optional auto-triggering!**

## ✨ **Why This is Beautiful**

```
From tools-runner's perspective:

ALL tools are the same:
  • Load from builtinTools
  • Call tool.execute(input, context)
  • Return result
  
Doesn't matter if it's:
  • Simple function (calculator)
  • API call (openrouter)
  • Vector search (context-builder)
  • File storage (file-storage)
  • Workflow orchestration (workflow)
  
Universal interface, universal execution!
```

## 🎯 **Summary**

**Your question:** "So all tools have exactly the same pattern?"

**Answer:** **YES!**

1. ✅ All implement `RCRTTool` interface
2. ✅ All in `builtinTools` object
3. ✅ All bootstrapped via `bootstrapTools()` → tool.v1
4. ✅ All invoked via `tool.request.v1`
5. ✅ All executed via `tool.execute(input, context)`
6. ✅ All respond via `tool.response.v1`

**Special feature for context-builder:**
- Has `bootstrapContextConfigs()` to create context.config.v1 (like tools have tool.catalog.v1)
- Auto-triggers on matching events (creates tool.request.v1 automatically)
- But execution is identical to all other tools!

**This is the power of the RCRT way: Universal patterns, composable primitives!** 🎯
