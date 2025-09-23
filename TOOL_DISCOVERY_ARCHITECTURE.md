# RCRT Tool Discovery & Prompting Architecture

## Core Principle
Agents are data + context. They discover capabilities from breadcrumbs and adapt their prompts dynamically.

## Architecture

### 1. Tool Catalog Breadcrumb (Pure Data)
The `tool.catalog.v1` breadcrumb contains raw tool information:
```json
{
  "schema_name": "tool.catalog.v1",
  "title": "Tool Catalog",
  "tags": ["tool:catalog", "workspace:tools"],
  "context": {
    "tools": [
      {
        "name": "openrouter",
        "description": "Access to 100+ LLM models via unified API",
        "category": "llm",
        "inputSchema": { /* JSON Schema */ },
        "outputSchema": { /* JSON Schema */ },
        "capabilities": {
          "async": true,
          "timeout": 30000
        }
      }
      // ... more tools
    ]
  }
}
```

### 2. Agent Prompt Adapter (Logic)
The agent transforms this data into LLM-friendly prompts:

```typescript
class ToolPromptAdapter {
  static generateToolPrompt(toolCatalog: any): string {
    const tools = toolCatalog.context.tools;
    
    // Generate concise tool descriptions
    const toolDescriptions = tools.map(tool => 
      `- ${tool.name}: ${tool.description}`
    ).join('\n');
    
    // Generate tool usage instructions
    const toolInstructions = `
You have access to the following tools:
${toolDescriptions}

To use a tool, respond with JSON in this format:
{
  "action": "invoke_tool",
  "tool": "tool_name",
  "input": { /* tool-specific parameters */ }
}
`;
    
    return toolInstructions;
  }
  
  static generateToolSchema(tools: any[]): any[] {
    // Convert to OpenAI function calling format
    return tools.map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));
  }
}
```

### 3. Agent Definition with Dynamic Discovery
```json
{
  "schema_name": "agent.definition.v1",
  "title": "Smart Chat Agent",
  "context": {
    "agent_id": "smart-chat-agent",
    "model": "google/gemini-2.5-flash",
    "system_prompt": "You are a helpful AI assistant. You will discover available tools from the system context.",
    "subscriptions": {
      "selectors": [
        {
          "all_tags": ["user:message", "chat:input"]
        },
        {
          "schema_name": "tool.catalog.v1",
          "all_tags": ["workspace:tools"]
        }
      ]
    },
    "context_builders": {
      "tool_discovery": {
        "type": "breadcrumb_search",
        "schema_name": "tool.catalog.v1",
        "transform": "prompt_adapter"
      }
    }
  }
}
```

### 4. Enhanced AgentExecutor
```typescript
private async buildContext(trigger: any): Promise<any[]> {
  const context: any[] = [];
  
  // Add trigger
  context.push({ type: 'trigger', data: trigger });
  
  // Discover tools dynamically
  const toolCatalogs = await this.rcrtClient.searchBreadcrumbs({
    schema_name: 'tool.catalog.v1',
    tags: [this.workspace]
  });
  
  if (toolCatalogs.length > 0) {
    const latestCatalog = toolCatalogs[0];
    context.push({
      type: 'tool_catalog',
      data: latestCatalog,
      prompt: ToolPromptAdapter.generateToolPrompt(latestCatalog)
    });
  }
  
  return context;
}

private buildMessages(trigger: any, context: any[]): any[] {
  const messages: any[] = [];
  
  // System prompt
  messages.push({
    role: 'system',
    content: this.agentDef.context.system_prompt
  });
  
  // Add tool instructions if available
  const toolContext = context.find(c => c.type === 'tool_catalog');
  if (toolContext) {
    messages.push({
      role: 'system',
      content: toolContext.prompt
    });
  }
  
  // User message
  messages.push({
    role: 'user',
    content: `Process: ${JSON.stringify(trigger.context)}`
  });
  
  return messages;
}
```

## Benefits

1. **Dynamic Discovery**: Agents automatically adapt to new tools
2. **Separation of Concerns**: Data stays in breadcrumbs, logic in agents
3. **Customizable Prompts**: Each agent can format tool info differently
4. **Version Independence**: Tool catalog updates don't break agents
5. **Context Efficiency**: Only relevant tool info sent to LLM

## Tool Invocation Flow

1. Agent receives trigger
2. Agent searches for `tool.catalog.v1` breadcrumb
3. Agent transforms catalog into LLM prompt
4. LLM decides to use a tool
5. Agent creates `tool.request.v1` breadcrumb
6. Tools-runner processes request
7. Tools-runner creates `tool.response.v1` breadcrumb
8. Agent receives response (via subscription)

## Prompt Optimization

Instead of sending full schemas, we can:
- Send only tool name + description for discovery
- Use function calling when LLM picks a tool
- Cache tool catalog in agent memory
- Filter tools by category based on context
