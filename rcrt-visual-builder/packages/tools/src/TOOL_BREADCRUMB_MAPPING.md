# Tool Breadcrumb Mapping

## Current Builtin Tools to Breadcrumb Implementation

### 1. Random Tool
Code Location: `index.ts` - `builtinTools.random`
```javascript
random: createTool('random', 'Generate random numbers', ...)
```

Breadcrumb Implementation:
```json
{
  "implementation": {
    "type": "builtin",
    "runtime": "nodejs",
    "module": "@rcrt-builder/tools",
    "export": "builtinTools.random"
  }
}
```

### 2. Calculator Tool
Code Location: `index.ts` - `builtinTools.calculator`
```javascript
calculator: createTool('calculator', 'Perform mathematical calculations', ...)
```

Breadcrumb Implementation:
```json
{
  "implementation": {
    "type": "builtin",
    "runtime": "nodejs", 
    "module": "@rcrt-builder/tools",
    "export": "builtinTools.calculator"
  }
}
```

### 3. Workflow Tool
Code Location: `workflow-orchestrator.ts` - `workflowOrchestrator`
```javascript
export const workflowOrchestrator = new WorkflowOrchestratorTool()
```

Breadcrumb Implementation:
```json
{
  "implementation": {
    "type": "builtin",
    "runtime": "nodejs",
    "module": "@rcrt-builder/tools",
    "export": "workflowOrchestrator"
  }
}
```

### 4. OpenRouter Tool  
Code Location: `llm-tools/openrouter.ts` - Class instance created by registry
```javascript
export class OpenRouterTool extends SimpleLLMTool { ... }
```

Breadcrumb Implementation:
```json
{
  "implementation": {
    "type": "builtin",
    "runtime": "nodejs",
    "module": "@rcrt-builder/tools/llm-tools",
    "export": "OpenRouterTool",
    "instantiate": true,
    "constructor_args": []
  }
}
```

### 5. File Storage Tool
Code Location: `file-tools/file-storage.ts` - `FileStorageTool`
```javascript
export class FileStorageTool implements RCRTTool { ... }
```

Breadcrumb Implementation:
```json
{
  "implementation": {
    "type": "builtin",
    "runtime": "nodejs",
    "module": "@rcrt-builder/tools",
    "export": "FileStorageTool",
    "instantiate": true
  }
}
```

## Tool Runner Loading Logic

```javascript
async function loadToolFromBreadcrumb(breadcrumb) {
  const { implementation } = breadcrumb.context;
  
  if (implementation.type === 'builtin') {
    // Load from our packages
    let toolModule;
    
    switch (implementation.module) {
      case '@rcrt-builder/tools':
        toolModule = await import('./index.js');
        break;
      case '@rcrt-builder/tools/llm-tools':
        toolModule = await import('./llm-tools/index.js');
        break;
      // etc...
    }
    
    // Get the export
    const parts = implementation.export.split('.');
    let tool = toolModule;
    for (const part of parts) {
      tool = tool[part];
    }
    
    // Instantiate if needed
    if (implementation.instantiate) {
      const args = implementation.constructor_args || [];
      tool = new tool(...args);
    }
    
    return tool;
  }
  
  // Handle other implementation types...
}
```

## Migration Steps

1. Update each tool to create its breadcrumb on startup
2. Include implementation details in breadcrumb
3. Update tool runner to load from breadcrumbs
4. Remove in-memory registry

This preserves the existing code structure while making tools discoverable via breadcrumbs!
