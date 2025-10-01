# @rcrt-builder/tool-sdk Prototype

## Installation
```bash
npm install @rcrt-builder/tool-sdk zod
```

## Basic Example

```typescript
import { defineRCRTTool, publishTool } from '@rcrt-builder/tool-sdk';
import { z } from 'zod';
import { createClient } from '@rcrt-builder/sdk';

// Define your tool
const uppercaseTool = defineRCRTTool({
  name: 'uppercase',
  description: 'Convert text to uppercase',
  category: 'text',
  
  // Zod for type-safe schemas
  input: z.object({
    text: z.string().describe('Text to convert')
  }),
  
  output: z.object({
    result: z.string().describe('Uppercased text')
  }),
  
  // Your implementation
  async execute(input) {
    return { result: input.text.toUpperCase() };
  }
});

// Publish to RCRT
const client = await createClient({ baseUrl: 'http://localhost:8081' });
const toolId = await publishTool(uppercaseTool, client, 'workspace:tools');

console.log(`Tool published! ID: ${toolId}`);
```

## Advanced Example with Configuration

```typescript
const aiImageTool = defineRCRTTool({
  name: 'ai-image',
  description: 'Generate images using AI',
  category: 'ai',
  
  input: z.object({
    prompt: z.string(),
    size: z.enum(['256x256', '512x512', '1024x1024']).default('512x512'),
    style: z.enum(['realistic', 'artistic']).optional()
  }),
  
  output: z.object({
    imageUrl: z.string().url(),
    revisedPrompt: z.string().optional()
  }),
  
  // Configuration schema
  config: z.object({
    apiKey: z.string().secret().describe('OpenAI API key'),
    defaultModel: z.string().default('dall-e-3')
  }),
  
  // Provide sample inputs for example generation
  exampleInputs: [
    { prompt: 'A serene mountain landscape', size: '1024x1024' },
    { prompt: 'Futuristic city at night', style: 'artistic' }
  ],
  
  async execute(input, context) {
    // Get config from context
    const config = await context.getConfig();
    const apiKey = await context.getSecret(config.apiKey);
    
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.defaultModel,
        prompt: input.prompt,
        size: input.size,
        style: input.style
      })
    });
    
    const data = await response.json();
    
    return {
      imageUrl: data.data[0].url,
      revisedPrompt: data.data[0].revised_prompt
    };
  }
});
```

## SDK API

### `defineRCRTTool(config)`
```typescript
interface ToolConfig<TInput, TOutput> {
  name: string;
  description: string;
  category?: string;
  version?: string;
  
  // Schemas (Zod or JSON Schema)
  input: z.ZodType<TInput> | JSONSchema;
  output: z.ZodType<TOutput> | JSONSchema;
  
  // Configuration
  config?: z.ZodType<any> | JSONSchema;
  configDefaults?: Record<string, any>;
  
  // Implementation
  execute(input: TInput, context: ToolContext): Promise<TOutput>;
  
  // Optional
  validate?(input: TInput): boolean | string;
  initialize?(context: ToolContext): Promise<void>;
  cleanup?(): Promise<void>;
  
  // Example generation
  exampleInputs?: TInput[];
  exampleExplanations?: string[];
}
```

### `publishTool(tool, client, workspace)`
```typescript
async function publishTool(
  tool: RCRTTool,
  client: RcrtClient,
  workspace: string,
  options?: {
    update?: boolean; // Update if exists
    dryRun?: boolean; // Test without publishing
    validate?: boolean; // Validate before publishing
  }
): Promise<string> // Returns breadcrumb ID
```

### `ToolContext` Helpers
```typescript
interface ToolContext extends ToolExecutionContext {
  // Helper: Get tool configuration
  getConfig(): Promise<any>;
  
  // Helper: Get secret by name
  getSecret(secretName: string): Promise<string>;
  
  // Helper: Call another tool
  callTool(toolName: string, input: any): Promise<any>;
  
  // Helper: Create progress update
  updateProgress(message: string, percent?: number): Promise<void>;
  
  // Helper: Log to breadcrumbs
  log(level: 'info' | 'warn' | 'error', message: string): Promise<void>;
}
```

## Helper Functions

### Generate Examples
```typescript
import { generateExamples } from '@rcrt-builder/tool-sdk';

const examples = await generateExamples(tool, [
  { input: { a: 1, b: 2 } },
  { input: { a: 10, b: 5 } }
]);

// Executes tool with each input, captures output
// Adds explanations for field access
```

### Validate Tool
```typescript
import { validateTool } from '@rcrt-builder/tool-sdk';

const result = validateTool(tool);

if (!result.valid) {
  console.error('Validation errors:', result.errors);
  // - Missing required fields
  // - Invalid schemas
  // - No examples
}
```

### Test Tool
```typescript
import { testTool } from '@rcrt-builder/tool-sdk';

const results = await testTool(tool, [
  {
    input: { text: 'hello' },
    expectedOutput: { result: 'HELLO' }
  }
]);

console.log(`${results.passed}/${results.total} tests passed`);
```

## CLI Tool

```bash
# Create new tool from template
rcrt-tool create my-tool --type simple

# Generate from existing tool
rcrt-tool clone random --name dice-roller

# Test tool
rcrt-tool test my-tool --input '{"text": "hello"}'

# Publish tool
rcrt-tool publish my-tool --workspace workspace:tools

# List all tools
rcrt-tool list

# Validate tool
rcrt-tool validate my-tool
```

## Benefits

1. **Type Safety** - Zod provides runtime + compile-time validation
2. **Auto Examples** - SDK generates examples by running code
3. **Quick Publishing** - One function to create breadcrumb
4. **Testing** - Built-in test utilities
5. **Helpers** - Common patterns abstracted
6. **Documentation** - Self-documenting via types

## Package Structure

```
@rcrt-builder/tool-sdk/
├── src/
│   ├── define.ts         # defineRCRTTool
│   ├── publish.ts        # publishTool, updateTool
│   ├── validate.ts       # validateTool
│   ├── examples.ts       # generateExamples
│   ├── test.ts           # testTool
│   ├── context.ts        # ToolContext helpers
│   ├── schema.ts         # Zod to JSON Schema
│   └── index.ts          # Main exports
├── templates/            # Tool templates
├── cli/                  # CLI tool
└── package.json
```

## Implementation Effort

- **SDK Core**: ~500 LOC, 1-2 days
- **CLI Tool**: ~200 LOC, 1 day  
- **Documentation**: ~2 hours
- **Examples**: ~1 hour
- **Testing**: ~1 day

**Total: 3-4 days for full SDK**

## Alternative: Tool Creator Tool

Instead of (or in addition to) SDK:

```typescript
export const toolCreatorTool = defineRCRTTool({
  name: 'tool-creator',
  description: 'Create new RCRT tools',
  
  input: z.object({
    name: z.string(),
    description: z.string(),
    category: z.string().optional(),
    
    // Simple code-based creation
    code: z.string().optional(),
    
    // Or schema-based
    inputSchema: z.record(z.any()).optional(),
    outputSchema: z.record(z.any()).optional(),
    
    // Or interactive
    interactive: z.boolean().default(false)
  }),
  
  async execute(input, context) {
    // Create tool breadcrumb
    // Validate code
    // Generate examples
    // Publish
    
    return {
      toolId: 'tool-xxx',
      toolName: input.name,
      status: 'ready'
    };
  }
});
```

This tool could be used by:
- **Humans** via chat: "Create a tool that rolls dice"
- **Agents** autonomously: Agent creates tools for its needs
- **Web UI**: Form interface that calls this tool

## My Recommendation

**Build in this sequence:**

1. **Week 1: Minimal SDK** (300 LOC)
   - `defineRCRTTool` with Zod
   - `publishTool` function
   - Basic schema conversion
   - This enables immediate tool development

2. **Week 2: Tool Creator Tool** (500 LOC)
   - Uses the SDK internally
   - RCRT-native approach
   - Can be used by agents
   - Validates and publishes

3. **Week 3: SDK Helpers** (200 LOC)
   - Example generation
   - Testing utilities
   - Validation helpers

4. **Week 4: CLI Tool** (optional)
   - For developers who prefer CLI
   - `rcrt-tool create/publish/test`

This gives us the most value quickly while staying RCRT-native!

**What do you think? Should we start with the SDK, the tool-creator tool, or both?**
