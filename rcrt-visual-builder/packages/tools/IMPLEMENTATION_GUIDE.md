# Tool System Implementation Guide

## Current Code to Update

### 1. RCRTToolWrapper (index.ts)
Currently has comment:
```typescript
// Tool definitions are now managed centrally by the ToolRegistry
// Individual tools no longer publish separate definition breadcrumbs
```

Should be updated to:
```typescript
async initialize() {
  // Create tool.v1 breadcrumb
  await this.createToolBreadcrumb();
  
  // Start listening for requests
  await this.startListening();
}

private async createToolBreadcrumb() {
  const toolDef = {
    schema_name: 'tool.v1',
    title: this.tool.name,
    tags: ['tool', `tool:${this.tool.name}`, `category:${this.tool.category || 'general'}`],
    context: {
      name: this.tool.name,
      version: this.tool.version || '1.0.0',
      description: this.tool.description,
      category: this.tool.category || 'general',
      
      definition: {
        inputSchema: this.tool.inputSchema,
        outputSchema: this.tool.outputSchema,
        examples: this.tool.examples || []
      },
      
      configuration: {
        configurable: !!this.tool.configSchema,
        configSchema: this.tool.configSchema,
        currentConfig: await this.loadConfig()
      },
      
      capabilities: {
        async: true,
        timeout: this.options.timeout || 30000,
        retries: this.options.retries || 0
      }
    }
  };
  
  await this.client.createBreadcrumb(toolDef);
}
```

### 2. Tool Interface Update
Add examples to RCRTTool interface:
```typescript
export interface RCRTTool {
  // ... existing fields ...
  
  examples?: Array<{
    title: string;
    input: any;
    output: any;
    explanation: string;
  }>;
  
  configSchema?: JSONSchema;
}
```

### 3. Registry Catalog Builder
Update to search for tools:
```typescript
private async buildCatalogFromBreadcrumbs() {
  // Search for all tool.v1 breadcrumbs
  const toolBreadcrumbs = await this.client.searchBreadcrumbs({
    schema_name: 'tool.v1',
    tag: this.workspace
  });
  
  // Get full details
  const tools = await Promise.all(
    toolBreadcrumbs.map(t => this.client.getBreadcrumb(t.id))
  );
  
  // Build catalog
  this.catalog = tools.map(t => ({
    name: t.context.name,
    description: t.context.description,
    category: t.context.category,
    version: t.context.version,
    inputSchema: t.context.definition.inputSchema,
    outputSchema: t.context.definition.outputSchema,
    examples: t.context.definition.examples,
    capabilities: t.context.capabilities,
    status: 'active',
    lastSeen: new Date().toISOString()
  }));
  
  // Update catalog breadcrumb
  await this.updateCatalog();
}
```

### 4. Add Examples to Existing Tools

Example for random tool:
```typescript
export const builtinTools = {
  random: createTool(
    'random',
    'Generate random numbers',
    { /* inputSchema */ },
    { /* outputSchema */ },
    async (input) => { /* execute */ },
    // NEW: Add examples
    [
      {
        title: "Single number",
        input: { min: 1, max: 10 },
        output: { numbers: [7] },
        explanation: "Access with result.numbers[0]"
      },
      {
        title: "Workflow usage",
        input: { min: 0, max: 100 },
        output: { numbers: [42] },
        explanation: "In workflows: ${stepId.numbers[0]}"
      }
    ]
  )
};
```

## Testing

1. Start tools-runner
2. Check for tool.v1 breadcrumbs
3. Verify catalog aggregates correctly
4. Test agent uses examples

## Migration Path

1. Add examples to tool definitions
2. Update wrapper to create breadcrumbs
3. Update catalog to search breadcrumbs
4. Test with one tool first
5. Migrate all tools
