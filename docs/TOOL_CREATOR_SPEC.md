# Tool Creator Tool - Specification

## Overview
A meta-tool that creates other tools. The most RCRT-native approach to tool development.

## Why This Approach?

1. **Pure RCRT** - Tools creating tools via breadcrumbs
2. **Agent-Friendly** - Agents can create tools autonomously
3. **No Installation** - No SDK needed, works via chat/API
4. **Immediate** - Tool available as soon as breadcrumb is created
5. **Self-Service** - Browse existing tools, modify, create new

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Tool name (lowercase, hyphens)"
    },
    "description": {
      "type": "string",
      "description": "What the tool does"
    },
    "category": {
      "type": "string",
      "enum": ["general", "llm", "storage", "web", "data", "ai"],
      "default": "general"
    },
    
    "method": {
      "type": "string",
      "enum": ["simple", "template", "clone", "advanced"],
      "default": "simple"
    },
    
    "simple": {
      "type": "object",
      "description": "For simple function-based tools",
      "properties": {
        "code": {
          "type": "string",
          "description": "JavaScript function body (receives 'input' and 'context')"
        },
        "inputs": {
          "type": "object",
          "description": "Input field definitions"
        },
        "outputs": {
          "type": "object",
          "description": "Output field definitions"
        },
        "testInputs": {
          "type": "array",
          "description": "Sample inputs for testing"
        }
      }
    },
    
    "clone": {
      "type": "object",
      "description": "Clone and modify existing tool",
      "properties": {
        "baseTool": {
          "type": "string",
          "description": "Tool to clone from"
        },
        "modifications": {
          "type": "object",
          "description": "What to change"
        }
      }
    },
    
    "template": {
      "type": "object",
      "description": "Use predefined template",
      "properties": {
        "templateName": {
          "type": "string",
          "enum": ["http-api", "data-transform", "llm-wrapper"]
        },
        "params": {
          "type": "object",
          "description": "Template-specific parameters"
        }
      }
    }
  },
  "required": ["name", "description", "method"]
}
```

## Usage Examples

### Example 1: Simple Tool
```javascript
{
  "tool": "tool-creator",
  "input": {
    "name": "reverse-text",
    "description": "Reverse a string",
    "method": "simple",
    "simple": {
      "code": "return { reversed: input.text.split('').reverse().join('') };",
      "inputs": {
        "text": { "type": "string", "description": "Text to reverse" }
      },
      "outputs": {
        "reversed": { "type": "string", "description": "Reversed text" }
      },
      "testInputs": [
        { "text": "hello" }
      ]
    }
  }
}
```

**Result:**
- ✅ Tool breadcrumb created
- ✅ Code validated
- ✅ Examples generated automatically
- ✅ Tool immediately available

### Example 2: Clone Existing Tool
```javascript
{
  "tool": "tool-creator",
  "input": {
    "name": "dice-roller",
    "description": "Roll dice (1-6)",
    "method": "clone",
    "clone": {
      "baseTool": "random",
      "modifications": {
        "description": "Roll dice",
        "defaultMin": 1,
        "defaultMax": 6
      }
    }
  }
}
```

**Result:**
- Copies `random` tool
- Applies modifications
- New tool created

### Example 3: HTTP API Template
```javascript
{
  "tool": "tool-creator",
  "input": {
    "name": "weather",
    "description": "Get weather for a city",
    "method": "template",
    "template": {
      "templateName": "http-api",
      "params": {
        "endpoint": "https://api.openweathermap.org/data/2.5/weather",
        "method": "GET",
        "queryParams": {
          "q": "${input.city}",
          "appid": "${config.apiKey}"
        },
        "outputMapping": {
          "temperature": "$.main.temp",
          "condition": "$.weather[0].description"
        }
      }
    }
  }
}
```

**Result:**
- HTTP wrapper created automatically
- No code needed
- Config schema generated

## Agent Usage

```
User: "Create a tool that converts Celsius to Fahrenheit"

Agent: {
  "tool_requests": [{
    "tool": "tool-creator",
    "input": {
      "name": "celsius-to-fahrenheit",
      "description": "Convert Celsius to Fahrenheit",
      "method": "simple",
      "simple": {
        "code": "return { fahrenheit: (input.celsius * 9/5) + 32 };",
        "inputs": {
          "celsius": { "type": "number" }
        },
        "outputs": {
          "fahrenheit": { "type": "number" }
        },
        "testInputs": [{ "celsius": 0 }, { "celsius": 100 }]
      }
    },
    "requestId": "create-tool-1"
  }]
}

→ Tool created and ready to use!
```

## Implementation

```typescript
export class ToolCreatorTool implements RCRTTool {
  name = 'tool-creator';
  description = 'Create new RCRT tools';
  category = 'system';
  
  async execute(input: any, context: ToolExecutionContext) {
    // 1. Validate input
    const validation = this.validateToolSpec(input);
    if (!validation.valid) {
      return { error: validation.errors, success: false };
    }
    
    // 2. Generate tool definition based on method
    let toolDef;
    
    switch (input.method) {
      case 'simple':
        toolDef = await this.createSimpleTool(input);
        break;
      case 'clone':
        toolDef = await this.cloneTool(input, context);
        break;
      case 'template':
        toolDef = await this.createFromTemplate(input);
        break;
    }
    
    // 3. Validate the generated tool
    const codeValidation = await this.validateCode(toolDef.code);
    if (!codeValidation.valid) {
      return { error: codeValidation.errors, success: false };
    }
    
    // 4. Generate examples
    const examples = await this.generateExamples(toolDef, input);
    
    // 5. Create tool breadcrumb
    const breadcrumb = {
      schema_name: 'tool.v1',
      title: toolDef.name,
      tags: ['tool', `tool:${toolDef.name}`, `category:${toolDef.category}`],
      context: {
        name: toolDef.name,
        description: toolDef.description,
        category: toolDef.category,
        version: '1.0.0',
        
        implementation: {
          type: 'breadcrumb',
          runtime: 'javascript',
          breadcrumb_id: `tool-code-${toolDef.name}-v1`
        },
        
        definition: {
          inputSchema: toolDef.inputSchema,
          outputSchema: toolDef.outputSchema,
          examples: examples
        }
      }
    };
    
    // 6. Create code breadcrumb (if code-based)
    if (toolDef.code) {
      await context.rcrtClient.createBreadcrumb({
        schema_name: 'tool.code.v1',
        title: `${toolDef.name} Implementation`,
        tags: ['tool:code', `tool:${toolDef.name}`],
        context: {
          toolName: toolDef.name,
          language: 'javascript',
          code: toolDef.code,
          runtime: 'nodejs'
        }
      });
    }
    
    // 7. Create tool breadcrumb
    const created = await context.rcrtClient.createBreadcrumb(breadcrumb);
    
    // 8. Update catalog
    await this.updateCatalog(context);
    
    return {
      success: true,
      toolId: created.id,
      toolName: toolDef.name,
      message: `Tool ${toolDef.name} created and ready to use!`,
      examples: examples.length
    };
  }
  
  private async createSimpleTool(input: any) {
    // Wrap user code in function
    const code = `
      async function execute(input, context) {
        ${input.simple.code}
      }
    `;
    
    return {
      name: input.name,
      description: input.description,
      category: input.category || 'general',
      code: code,
      inputSchema: this.fieldsToSchema(input.simple.inputs),
      outputSchema: this.fieldsToSchema(input.simple.outputs)
    };
  }
  
  private async cloneTool(input: any, context: ToolExecutionContext) {
    // Find base tool
    const baseTools = await context.rcrtClient.searchBreadcrumbs({
      schema_name: 'tool.v1',
      tag: `tool:${input.clone.baseTool}`
    });
    
    if (baseTools.length === 0) {
      throw new Error(`Base tool ${input.clone.baseTool} not found`);
    }
    
    const base = await context.rcrtClient.getBreadcrumb(baseTools[0].id);
    
    // Clone and modify
    return {
      ...base.context,
      name: input.name,
      description: input.description,
      ...input.clone.modifications
    };
  }
}
```

## Comparison: SDK vs Tool Creator

| Feature | SDK | Tool Creator |
|---------|-----|--------------|
| Type Safety | ✅ TypeScript | ❌ Runtime only |
| Code Completion | ✅ Full | ❌ None |
| Agent Usable | ❌ No | ✅ Yes |
| RCRT-Native | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Installation | npm | None |
| Learning Curve | Medium | Low |
| Complex Tools | ✅ Better | ⚠️ Limited |

## My Recommendation

**Build BOTH:**

1. **Tool Creator Tool first** (2-3 days)
   - Enables immediate tool creation
   - Works for agents
   - RCRT-native
   - Good for 80% of use cases

2. **SDK second** (3-4 days)
   - Better DX for developers
   - Type safety
   - Advanced use cases
   - Can use Tool Creator under the hood

The tool-creator tool IS the SDK for agents, while the TypeScript SDK is the SDK for developers!

**Thoughts?**
