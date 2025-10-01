# RCRT Tool SDK Proposal

## The Vision
Make tool creation so easy that developers can go from idea to working tool in 5 minutes.

## Three-Tier Approach

### 🥉 Tier 1: Simple Function Tools (No Code Required)
**For:** Non-developers, simple transformations
**Time:** 2 minutes
**Tool:** Web UI or `tool-creator` tool

```javascript
// Via tool-creator tool
{
  "tool": "tool-creator",
  "input": {
    "name": "uppercase",
    "description": "Convert text to uppercase",
    "code": "return { result: input.text.toUpperCase() };",
    "inputSchema": {
      "text": { "type": "string" }
    }
  }
}
```

Result: Tool breadcrumb created, immediately available!

### 🥈 Tier 2: SDK Tools (Recommended)
**For:** Developers who want type safety
**Time:** 15 minutes
**Tool:** `@rcrt-builder/tool-sdk` package

```typescript
import { defineRCRTTool, publishTool } from '@rcrt-builder/tool-sdk';
import { z } from 'zod';

// Define with Zod for automatic schema & validation
export const weatherTool = defineRCRTTool({
  name: 'weather',
  description: 'Get weather for a city',
  category: 'data',
  
  // Zod schemas automatically converted to JSON Schema
  input: z.object({
    city: z.string(),
    units: z.enum(['metric', 'imperial']).default('metric')
  }),
  
  output: z.object({
    temperature: z.number(),
    condition: z.string(),
    humidity: z.number()
  }),
  
  // Examples auto-generated from Zod + your code
  async execute(input, context) {
    const response = await fetch(
      `https://api.weather.com/v1?city=${input.city}&units=${input.units}`
    );
    const data = await response.json();
    
    return {
      temperature: data.temp,
      condition: data.weather,
      humidity: data.humidity
    };
  },
  
  // Optional: Configuration
  config: z.object({
    apiKey: z.string().secret()
  })
});

// Publish to RCRT (creates tool.v1 breadcrumb)
await publishTool(weatherTool, client, 'workspace:tools');
```

### 🥇 Tier 3: Advanced Tools (Full Control)
**For:** Complex integrations, custom behavior
**Time:** Varies
**Tool:** Full `RCRTTool` interface

```typescript
export class MyComplexTool implements RCRTTool {
  name = 'my-complex-tool';
  
  async initialize(context: ToolExecutionContext) {
    // Custom startup logic
  }
  
  async execute(input, context) {
    // Full control
  }
  
  async cleanup() {
    // Resource cleanup
  }
}
```

## SDK API Design

### Core Functions

```typescript
// 1. Define a tool
defineRCRTTool(config: ToolConfig): RCRTTool

// 2. Publish to RCRT
publishTool(tool: RCRTTool, client: RcrtClient, workspace: string): Promise<string>

// 3. Update tool
updateTool(toolId: string, updates: Partial<ToolConfig>): Promise<void>

// 4. Generate examples automatically
generateExamples(tool: RCRTTool, sampleInputs?: any[]): Example[]

// 5. Validate tool definition
validateToolDefinition(tool: RCRTTool): ValidationResult

// 6. Test tool locally
testTool(tool: RCRTTool, testCases: TestCase[]): TestResults
```

### Schema Integration

```typescript
import { z } from 'zod';
import { zodToJsonSchema } from '@rcrt-builder/tool-sdk/schema';

// Zod schemas provide:
// - Type inference
// - Runtime validation  
// - Automatic JSON Schema conversion
// - Better DX with autocomplete

const schema = z.object({
  count: z.number().min(1).max(10),
  message: z.string().optional()
});

// Auto-converts to JSON Schema for RCRT
const jsonSchema = zodToJsonSchema(schema);
```

### Example Generation

```typescript
// SDK generates examples from your execute function
const tool = defineRCRTTool({
  name: 'add',
  input: z.object({
    a: z.number(),
    b: z.number()
  }),
  output: z.object({
    sum: z.number()
  }),
  execute: async (input) => ({
    sum: input.a + input.b
  }),
  
  // Optional: Provide custom examples
  exampleInputs: [
    { a: 2, b: 3 },
    { a: 10, b: 5 }
  ]
});

// SDK runs execute with examples to generate output
// Result: Complete examples with explanations
```

## Tool Creator Tool Design

A tool that creates tools - very meta, very RCRT!

```typescript
{
  "tool": "tool-creator",
  "input": {
    "method": "interactive", // or "template", "from-example"
    
    // For simple tools
    "simple": {
      "name": "my-tool",
      "description": "What it does",
      "inputFields": [
        { "name": "text", "type": "string", "required": true }
      ],
      "outputFields": [
        { "name": "result", "type": "string" }
      ],
      "code": "return { result: input.text.toUpperCase() };"
    },
    
    // Or from existing tool as template
    "fromExample": {
      "baseTool": "random",
      "modifications": {
        "name": "dice-roller",
        "description": "Roll dice"
      }
    },
    
    // Or interactive
    "interactive": {
      "questions": [
        { "q": "Tool name?", "a": "weather" },
        { "q": "What does it do?", "a": "Get weather" },
        { "q": "What inputs?", "a": "city (string)" },
        { "q": "External API?", "a": "weather.com" }
      ]
    }
  }
}
```

## Development Workflow

### For Beginners
1. Browse existing tools
2. Use tool-creator to make simple tool
3. Test in chat
4. Iterate

### For Developers  
1. Install SDK: `npm install @rcrt-builder/tool-sdk`
2. Write TypeScript tool
3. Run `publishTool()` 
4. Tool is live!

### For Advanced
1. Implement `RCRTTool` interface
2. Add to builtinTools
3. Create breadcrumb manually
4. Full control

## Comparison Table

| Approach | Time | Skill Level | Flexibility | RCRT-Native |
|----------|------|-------------|-------------|-------------|
| Tool Creator Tool | 5 min | Beginner | Low | ⭐⭐⭐⭐⭐ |
| SDK | 15 min | Developer | Medium | ⭐⭐⭐⭐ |
| Boilerplate | 10 min | Developer | Medium | ⭐⭐ |
| Raw Interface | 1 hr | Advanced | High | ⭐⭐⭐⭐⭐ |
| Agent-Assisted | 5 min | Any | Medium | ⭐⭐⭐⭐⭐ |

## Recommendation

**Build all 3 in this order:**

1. **SDK First** (`@rcrt-builder/tool-sdk`)
   - Immediate value for developers
   - Establishes patterns
   - Foundation for other approaches
   - Can publish tools as breadcrumbs

2. **Tool Creator Tool**
   - Built using the SDK
   - RCRT-native approach
   - Usable by agents
   - Interactive for humans

3. **Agent Integration**
   - Default chat agent can create tools
   - Uses SDK under the hood
   - Natural language interface

## Next Steps

Should we:
- A) Start with the SDK package?
- B) Build the tool-creator tool first?
- C) Enable agents to create tools?
- D) Create web UI for tool creation?
- E) All of the above in sequence?

What's your preference?
