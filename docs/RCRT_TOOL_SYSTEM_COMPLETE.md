# RCRT Tool System - Complete Architecture

## The Core Principle

**Tools in RCRT = Definition (Breadcrumb) + Implementation (Code)**

## Components

### 1. Tool Breadcrumb (`tool.v1`)
```json
{
  "schema_name": "tool.v1",
  "context": {
    "name": "my-tool",
    "definition": { /* schemas, examples */ },
    "configuration": { /* settings */ },
    "implementation": { /* how to find the code */ }
  }
}
```

### 2. Tool Implementation (Code)
```javascript
// The actual execute function
export const myTool = {
  name: 'my-tool',
  execute: async (input, context) => {
    // Tool logic here
    return result;
  }
};
```

### 3. Tool Discovery & Loading
```javascript
// 1. Find tool breadcrumb
const toolBreadcrumb = await searchTools({ name: 'my-tool' });

// 2. Load implementation
const implementation = toolBreadcrumb.context.implementation;
const toolCode = await loadImplementation(implementation);

// 3. Execute
const result = await toolCode.execute(input, context);
```

## Implementation Types

### Builtin (Ships with tools-runner)
```json
{
  "implementation": {
    "type": "builtin",
    "module": "@rcrt-builder/tools",
    "export": "builtinTools.calculator"
  }
}
```

### External Module
```json
{
  "implementation": {
    "type": "module",
    "module": "my-npm-package",
    "export": "myTool"
  }
}
```

### HTTP Service
```json
{
  "implementation": {
    "type": "http",
    "endpoint": "https://api.example.com/tool"
  }
}
```

### JavaScript Breadcrumb
```json
{
  "implementation": {
    "type": "breadcrumb",
    "breadcrumb_id": "tool-code-my-tool-v1"
  }
}
```

## The Complete Flow

```
1. Tool Creation
   ├─> Developer writes tool code
   ├─> Creates tool.v1 breadcrumb with implementation reference
   └─> Tool is now discoverable

2. Tool Discovery
   ├─> Agent searches for tools
   ├─> Finds tool.v1 breadcrumbs
   └─> Reads schemas and examples

3. Tool Catalog
   ├─> Aggregates all tool.v1 breadcrumbs
   ├─> Creates tool.catalog.v1
   └─> Provides unified view

4. Tool Execution
   ├─> Tool request received
   ├─> Find tool breadcrumb
   ├─> Load implementation
   ├─> Execute with input
   └─> Return tool.response.v1

5. Dynamic Updates
   ├─> New tool.v1 breadcrumb created
   ├─> Catalog automatically updates
   └─> Tool immediately available
```

## Benefits Over Current System

### Current (Memory-Based)
- Tools registered in code
- Memory holds registry
- Restart to add tools
- No version history
- Hidden from agents

### New (Breadcrumb-Based)
- Tools are breadcrumbs
- Discovery via search
- Add tools anytime
- Full version history
- Agents see everything

## Example: Adding a New Tool

### 1. Write the Code
```javascript
// weather-tool.js
export const weatherTool = {
  name: 'weather',
  execute: async ({ city }) => {
    const data = await fetchWeather(city);
    return { temperature: data.temp, condition: data.weather };
  }
};
```

### 2. Create Tool Breadcrumb
```javascript
await client.createBreadcrumb({
  schema_name: 'tool.v1',
  title: 'Weather Tool',
  tags: ['tool', 'tool:weather'],
  context: {
    name: 'weather',
    implementation: {
      type: 'module',
      module: './weather-tool.js',
      export: 'weatherTool'
    },
    definition: {
      inputSchema: { /* ... */ },
      outputSchema: { /* ... */ },
      examples: [ /* ... */ ]
    }
  }
});
```

### 3. Tool is Live!
- No restart needed
- Catalog updates automatically
- Agents can use immediately

## Key Insight

The tool breadcrumb is the **contract** between:
- **Agents**: Who need to understand what tools do
- **Code**: Which implements the functionality
- **System**: Which connects them together

This makes tools truly pluggable, discoverable, and dynamic!
