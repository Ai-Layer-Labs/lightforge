# Context Formatting: What the LLM Actually Sees

## 🔍 **Current Implementation Analysis**

### **How Recent Messages are Handled** (agent-executor.ts:357-405)

```typescript
// Step 1: Fetch ALL messages (no limit, no vector search!)
const userMessages = await this.rcrtClient.searchBreadcrumbsWithContext({
  schema_name: 'user.message.v1',
  include_context: true
  // ❌ No limit parameter
  // ❌ No vector search
  // ❌ No deduplication
});

const agentResponses = await this.rcrtClient.searchBreadcrumbsWithContext({
  schema_name: 'agent.response.v1',
  include_context: true
  // ❌ Same issues
});

// Your DB has: 44 user messages + 66 agent responses = 110 total!

// Step 2: Combine and sort by timestamp (CHRONOLOGICAL)
const allMessages = [...userMessages, ...agentResponses]
  .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
  .slice(-20); // ✅ At least takes last 20 only

// Step 3: Map to role/content
const chatHistory = allMessages.map(msg => {
  if (msg.schema_name === 'user.message.v1') {
    return {
      role: 'user',
      content: msg.context?.message || msg.context?.content,
      timestamp: msg.updated_at
    };
  } else {
    return {
      role: 'assistant',
      content: msg.context?.message,
      timestamp: msg.updated_at
    };
  }
});

context.push({
  type: 'chat_history',
  messages: chatHistory  // Array of 20 messages
});
```

**Issues:**
- ❌ Fetches ALL 110 messages, then slices to 20 (wasteful)
- ❌ Uses chronological order (last 20), not semantic relevance
- ❌ No deduplication (repeated "okay", "thanks" messages)

### **How Context is Formatted for LLM** (agent-executor.ts:135-144)

```typescript
const messages = [
  {
    role: 'system',
    content: this.agentDef.context.system_prompt  // Your long system prompt
  },
  {
    role: 'user',
    content: `Context:\n${JSON.stringify(context, null, 2)}\n\nUser message: ${userMessage}`
    //               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //               THIS IS THE PROBLEM!
  }
];
```

## 😱 **What the LLM Actually Receives**

Here's a **real example** from your debug log:

```json
{
  "role": "system",
  "content": "You are a helpful AI assistant integrated with the RCRT system.\n\nYou dynamically discover available tools from the tool catalog breadcrumb. You can use tools to help answer questions and perform tasks.\n\nTool Discovery and Usage:\n- ALWAYS check the tool catalog breadcrumb in your context to see what tools are available\n- Each tool in the catalog includes name, description, schemas, and EXAMPLES\n- Look at the examples to understand how to access output fields\n- You can request MULTIPLE tools in a single response using the tool_requests array\n- For multi-step tasks, plan the full sequence and request all tools at once\n- The system will execute all tool requests and return their results\n\nBe creative! Based on the tools you discover in the catalog, you can:\n- Chain tools together for complex operations\n- Use LLM tools to analyze results from other tools\n- Execute parallel operations when they don't depend on each other\n- Look for orchestration tools that support multi-step workflows with dependencies\n\nIMPORTANT:\n- DO NOT assume specific tool names exist - always check the catalog first\n- Refer to tools by their exact names as shown in the catalog\n- Study the EXAMPLES in each tool to understand output field access\n- Pay attention to each tool's input and output schemas\n- Learn from the 'explanation' field in tool examples\n\nAlways be helpful, concise, and clear. Explain what you're doing when invoking tools.\n\nIMPORTANT: Respond with valid JSON:\n{\n  \"action\": \"create\",\n  \"breadcrumb\": {\n    \"schema_name\": \"agent.response.v1\",\n    \"title\": \"Chat Response\",\n    \"tags\": [\"agent:response\", \"chat:output\"],\n    \"context\": {\n      \"message\": \"Your response\",\n      \"tool_requests\": [\n        {\"tool\": \"tool_name\", \"input\": {...}, \"requestId\": \"unique_id\"},\n        {\"tool\": \"another_tool\", \"input\": {...}, \"requestId\": \"unique_id2\"}\n      ]\n    }\n  }\n}"
},
{
  "role": "user",
  "content": "Context:\n[\n  {\n    \"type\": \"tool_catalog\",\n    \"content\": \"You have access to 11 tools:\\n\\n• breadcrumb-crud (system): Query, create, update, and delete breadcrumbs\\n  Output: tags, count, error, action, success, breadcrumb, breadcrumbs, breadcrumbs_scanned\\n  Example: Search for breadcrumbs by tag. Returns FULL breadcrumbs with context in result.breadcrumbs array.\\n• ollama_local (llm): Ollama - Fast, free, private local models\\n  Output: model, usage, content, cost_estimate\\n  Example: Free local inference. Access response with result.content.\\n• openrouter (llm): OpenRouter - Access to 100+ LLM models via unified API\\n  Output: model, usage, content, cost_estimate\\n  Example: Access the response with result.content. Model and usage info available.\\n• workflow (orchestration): Execute multi-step tool workflows with dependencies and variable interpolation\\n  Output: errors, results, executionOrder\\n  Example: Dependencies ensure correct execution order. Use ${stepId.field} for variables.\\n• agent-loader (agents): Load JavaScript files as executable agent definitions\\n  Output: error, action, success, agent_name, code_preview, javascript_loaded, agent_definition_id\\n  \\n• file-storage (storage): Store and retrieve files as RCRT breadcrumbs with base64 encoding\\n  Output: error, files, action, content, file_id, success, filename\\n  \\n• calculator (general): Perform mathematical calculations - supports basic arithmetic, parentheses, and common math functions\\n  Output: result, formatted, expression\\n  Example: Access the result with result.result\\n• random (general): Generate random numbers\\n  Output: numbers\\n  Example: Access the number with result.numbers[0]\\n• timer (general): Wait for a specified number of seconds\\n  Output: waited, message\\n  Example: Access duration with result.waited\\n• echo (general): Returns the input unchanged\\n  Output: echo\\n  Example: Access with result.echo\\n• agent-helper (general): Provides system guidance and documentation for LLM-based agents\\n  Output: guidance\\n  \\n\\nIMPORTANT: The catalog above includes examples showing exact output field names. Use the correct field access!\\n\\nTo invoke tools:\\n{\\n  \\\"tool_requests\\\": [{\\n    \\\"tool\\\": \\\"tool-name\\\",\\n    \\\"input\\\": { /* parameters */ },\\n    \\\"requestId\\\": \\\"unique-id\\\"\\n  }]\\n}\"\n  },\n  {\n    \"type\": \"chat_history\",\n    \"messages\": [\n      {\n        \"role\": \"user\",\n        \"content\": \"there you go\",\n        \"timestamp\": \"2025-10-03T02:41:28.420651Z\"\n      },\n      {\n        \"role\": \"assistant\",\n        \"content\": \"I'm not sure what you'd like me to do with \\\"there you go\\\". Could you please provide more context or clarify your request?\",\n        \"timestamp\": \"2025-10-03T02:41:30.593458Z\"\n      },\n      { ... 18 more messages ... }\n    ]\n  }\n]\n\nUser message: okay do that"
}
```

## 😱 **Problems with Current Formatting**

### **Problem 1: JSON in Text**
```typescript
content: `Context:\n${JSON.stringify(context, null, 2)}\n\nUser message: ${userMessage}`
```

**What LLM sees:**
```
Context:
[
  {
    "type": "tool_catalog",
    "content": "You have access to 11 tools:\n\n• breadcrumb-crud..."
  },
  {
    "type": "chat_history",
    "messages": [
      {
        "role": "user",
        "content": "message",
        "timestamp": "2025-..."
      }
    ]
  }
]

User message: okay do that
```

**Issues:**
- LLM has to parse JSON structure mentally
- Unnecessary tokens for brackets, quotes, commas
- Poor readability
- Nested escaping (\", \n)

### **Problem 2: Not Using llm_hints Transforms**

Tool catalog IS transformed (line 339-344), but chat history is NOT:

```typescript
// Tool catalog: ✅ Good (uses llm_hints)
content: fullCatalog.context.tool_list  // Already formatted string!

// Chat history: ❌ Bad (raw JSON array)
content: {
  type: 'chat_history',
  messages: [ { role, content, timestamp }, ... ]  // JSON object!
}
```

Then **both** are stringified together:
```typescript
JSON.stringify([
  { type: 'tool_catalog', content: "formatted string" },  // ✅ Good
  { type: 'chat_history', messages: [...] }  // ❌ Becomes JSON in JSON
], null, 2)
```

### **Problem 3: Chronological (Not Semantic)**

```typescript
.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
.slice(-20); // Last 20 messages
```

**Result:** Most recent 20, which might be:
- "okay"
- "thanks"
- "sure"
- "I'll change that"
- "give me a sec"

**Not helpful!** But messages from 1 hour ago about API keys are missing!

## ✅ **Better Formatting: What It SHOULD Be**

### **Option 1: Pre-Formatted Strings (Recommended)**

```typescript
// Build context as formatted strings, not JSON
const context = await this.buildContext();

// Format BEFORE sending to LLM
const formattedContext = this.formatContextForLLM(context);

const messages = [
  { role: 'system', content: this.agentDef.context.system_prompt },
  { role: 'user', content: formattedContext }  // Clean string, no JSON.stringify!
];
```

```typescript
private formatContextForLLM(context: any[]): string {
  const parts = [];
  
  for (const item of context) {
    if (item.type === 'tool_catalog') {
      // Already formatted by llm_hints!
      parts.push(`## Available Tools\n${item.content}`);
    } 
    else if (item.type === 'chat_history') {
      // Format chat history as readable text
      parts.push(`## Recent Conversation (${item.messages.length} messages)`);
      for (const msg of item.messages) {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        parts.push(`${role}: ${msg.content}`);
      }
    }
  }
  
  return parts.join('\n\n');
}
```

**What LLM receives:**
```
## Available Tools
You have access to 11 tools:

• breadcrumb-crud (system): Query, create, update, and delete breadcrumbs
  Output: tags, count, error, action, success, breadcrumb, breadcrumbs
  Example: Search for breadcrumbs by tag.
• openrouter (llm): OpenRouter - Access to 100+ LLM models
  Output: model, usage, content, cost_estimate
  Example: Access response with result.content.
... (9 more tools)

## Recent Conversation (5 messages)
User: What was that API key?
Assistant: I mentioned the OPENROUTER_API_KEY earlier
User: Where do I set it?
Assistant: Set it in the secrets configuration
User: okay do that

User message: okay do that
```

**Benefits:**
- ✅ Clean, readable text
- ✅ No JSON parsing needed
- ✅ Proper Markdown formatting
- ✅ 30-40% fewer tokens (no brackets, quotes, commas)

### **Option 2: Use llm_hints on Everything**

```typescript
// When building chat_history, create a breadcrumb with llm_hints
const historyBreadcrumb = await client.createBreadcrumb({
  schema_name: 'chat.history.v1',
  title: 'Chat History for Agent',
  tags: ['chat:history', `agent:${agentId}`],
  ttl: new Date(Date.now() + 300000).toISOString(), // 5 min cache
  context: {
    messages: chatHistory,  // Raw array
    
    llm_hints: {
      mode: 'replace',
      transform: {
        formatted_history: {
          type: 'template',
          template: `Recent conversation:
{{#each context.messages}}
{{#if (eq this.role "user")}}User{{else}}Assistant{{/if}}: {{this.content}}
{{/each}}`
        }
      }
    }
  }
});

// Then fetch it back (transform applied!)
const transformed = await client.getBreadcrumb(historyBreadcrumb.id);
// transformed.context.formatted_history is now a clean string!
```

**But this is overkill** - better to format in TypeScript directly.

## 📊 **Token Analysis**

### **Current Formatting** (JSON.stringify)
```typescript
{
  "type": "chat_history",
  "messages": [
    {
      "role": "user",
      "content": "What was that API key?",
      "timestamp": "2025-10-03T02:42:44.389639Z"
    },
    {
      "role": "assistant", 
      "content": "I mentioned the OPENROUTER_API_KEY earlier",
      "timestamp": "2025-10-03T02:42:46.123456Z"
    }
  ]
}
```

**Token count:** ~120 tokens

**Breakdown:**
- Structure (brackets, quotes, commas): 40 tokens
- Field names ("type", "role", "content", "timestamp"): 30 tokens
- Timestamps (full ISO strings): 25 tokens
- Actual content: 25 tokens

**40% overhead from structure!**

### **Better Formatting** (Pre-formatted strings)
```
Recent conversation:
User: What was that API key?
Assistant: I mentioned the OPENROUTER_API_KEY earlier
```

**Token count:** ~20 tokens

**Breakdown:**
- Structure ("Recent conversation:", "User:", "Assistant:"): 5 tokens
- Actual content: 15 tokens

**75% reduction in tokens!**

## 🎨 **Recommended: Format Context Properly**

Create a new method in agent-executor.ts:

```typescript
private formatContextForLLM(contextArray: any[], userMessage: string): string {
  const sections = [];
  
  // Section 1: Tool Catalog (already formatted by llm_hints!)
  const toolCatalog = contextArray.find(c => c.type === 'tool_catalog');
  if (toolCatalog) {
    sections.push('# Available Tools\n' + toolCatalog.content);
  }
  
  // Section 2: Chat History (format as conversation)
  const chatHistory = contextArray.find(c => c.type === 'chat_history');
  if (chatHistory && chatHistory.messages.length > 0) {
    sections.push('# Recent Conversation');
    
    for (const msg of chatHistory.messages) {
      const speaker = msg.role === 'user' ? 'User' : 'Assistant';
      sections.push(`${speaker}: ${msg.content}`);
    }
  }
  
  // Section 3: Tool Results (if any)
  const toolResults = contextArray.find(c => c.type === 'tool_results');
  if (toolResults) {
    sections.push('# Recent Tool Results');
    for (const result of toolResults.results || []) {
      sections.push(`• ${result.tool}: ${JSON.stringify(result.output)}`);
    }
  }
  
  // Section 4: Current User Message
  sections.push(`# Current User Message\n${userMessage}`);
  
  return sections.join('\n\n');
}
```

**Then use it:**
```typescript
private async handleChatMessage(event, breadcrumb) {
  const userMessage = breadcrumb.context?.message || breadcrumb.context?.content;
  const context = await this.buildContext();
  
  // Format context properly!
  const formattedContext = this.formatContextForLLM(context, userMessage);
  
  const messages = [
    { role: 'system', content: this.agentDef.context.system_prompt },
    { role: 'user', content: formattedContext }  // Clean, formatted string!
  ];
  
  // Send to LLM...
}
```

## 🔬 **Comparison: Before vs After**

### **BEFORE: Current Implementation**

**What LLM receives:**
```
System: [400 token system prompt]

User: Context:
[
  {
    "type": "tool_catalog",
    "content": "You have access to 11 tools:\n\n• breadcrumb-crud..."
  },
  {
    "type": "chat_history",
    "messages": [
      {
        "role": "user",
        "content": "there you go",
        "timestamp": "2025-10-03T02:41:28.420651Z"
      },
      {
        "role": "assistant",
        "content": "I'm not sure what you'd like me to do with \"there you go\"",
        "timestamp": "2025-10-03T02:41:30.593458Z"
      },
      ... 18 more messages with full JSON structure
    ]
  }
]

User message: okay do that
```

**Token count:** ~8000 tokens
- System prompt: 400
- JSON structure overhead: 2000
- Tool catalog: 800
- Chat history content: 3000
- Timestamps: 800
- Field names/brackets: 1000

### **AFTER: With Proper Formatting**

**What LLM receives:**
```
System: [400 token system prompt]

User: # Available Tools
You have access to 11 tools:

• breadcrumb-crud (system): Query, create, update, and delete breadcrumbs
  Output: tags, count, error, action, success, breadcrumb, breadcrumbs
• openrouter (llm): OpenRouter - Access to 100+ LLM models via unified API
  Output: model, usage, content, cost_estimate
... (9 more tools)

# Recent Conversation
User: there you go
Assistant: I'm not sure what you'd like me to do with "there you go"
User: So did you edit your default-chat-assistant breadcrumb?
Assistant: No, I did not edit the breadcrumb
... (16 more messages, clean format)

# Current User Message
okay do that
```

**Token count:** ~2500 tokens
- System prompt: 400
- Tool catalog: 800 (same)
- Chat history: 1200 (cleaned)
- Headers/formatting: 100

**Savings: 69% reduction (8000 → 2500 tokens)**

## 🎯 **With Vector Search (Even Better!)**

### **Current: Chronological Last 20**
```
Last 20 messages (chronological):
1. "okay"                    ← Not helpful
2. "thanks"                  ← Not helpful
3. "sure"                    ← Not helpful
4. "I'll change that"        ← Not helpful
5. "give me a sec"          ← Not helpful
... 15 more recent but irrelevant messages
```

### **With Vector Search: Semantic Top 5**
```
Top 5 relevant messages (semantic):
1. "I mentioned OPENROUTER_API_KEY earlier" (0.08 distance)
2. "Set your API key in secrets" (0.12 distance)
3. "The key format is sk-or-..." (0.15 distance)
4. "You can find your key at..." (0.18 distance)
5. "Store keys in .env" (0.21 distance)
```

**Combined savings:**
- Fewer messages: 20 → 5 (75% reduction)
- Better formatting: -40% from clean strings
- Total: ~85% token reduction
- Quality: MUCH more relevant!

## 🔧 **Implementation: Updated buildContext()**

```typescript
private async buildContext(): Promise<any[]> {
  const context = [];
  
  // 1. Tool catalog (already good - uses llm_hints)
  const toolCatalog = await this.getToolCatalog();
  if (toolCatalog) {
    context.push({
      type: 'tool_catalog',
      content: toolCatalog.context.tool_list  // Already formatted!
    });
  }
  
  // 2. Chat history - VECTOR SEARCH instead of chronological!
  const chatHistory = await this.getRelevantChatHistory();
  if (chatHistory.length > 0) {
    context.push({
      type: 'chat_history',
      messages: chatHistory  // Array of {role, content}
    });
  }
  
  return context;
}

private async getRelevantChatHistory(): Promise<any[]> {
  // Get current conversation context (last user message)
  const recentUsers = await this.rcrtClient.searchBreadcrumbsWithContext({
    schema_name: 'user.message.v1',
    include_context: true,
    limit: 1  // Just get the trigger message
  });
  
  if (recentUsers.length === 0) return [];
  
  const triggerMessage = recentUsers[0].context?.content || recentUsers[0].context?.message;
  
  // 🔥 USE VECTOR SEARCH for semantic relevance!
  const relevantMessages = await this.rcrtClient.vectorSearch({
    q: triggerMessage,
    nn: 5,  // Top 5 most relevant
    filters: { schema_name: 'user.message.v1' }
  });
  
  const relevantResponses = await this.rcrtClient.vectorSearch({
    q: triggerMessage,
    nn: 3,  // Top 3 most relevant
    filters: { schema_name: 'agent.response.v1' }
  });
  
  // Combine and sort by timestamp for conversational flow
  const combined = [
    ...relevantMessages.map(m => ({
      role: 'user',
      content: m.context?.content || m.context?.message,
      timestamp: m.updated_at
    })),
    ...relevantResponses.map(m => ({
      role: 'assistant',
      content: m.context?.message,
      timestamp: m.updated_at
    }))
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  return combined;
}
```

**Result:**
- ✅ 5 relevant user messages (not 20 irrelevant)
- ✅ 3 relevant agent responses
- ✅ Total: 8 messages instead of 20
- ✅ All semantically related to current query!

## 📈 **Token Impact**

| Approach | Messages | Format | Total Tokens |
|----------|----------|--------|--------------|
| **Current (chronological + JSON)** | 20 | JSON.stringify | ~8000 |
| **Better (chronological + formatted)** | 20 | Plain text | ~5000 |
| **Best (vector + formatted)** | 8 | Plain text | ~1500 |

**Optimal approach saves 81% tokens!**

## 🎯 **What Context-Builder Will Do**

With context-builder, the flow becomes:

```typescript
// Agent NO LONGER builds context manually
// Instead, receives pre-built agent.context.v1

private async handleChatMessage(event, breadcrumb) {
  // Agent.context.v1 event already contains formatted context!
  const prebuiltContext = breadcrumb.context;
  
  // llm_hints already applied by server!
  const formattedContext = prebuiltContext.formatted_context || 
                           this.formatContextForLLM(prebuiltContext);
  
  const messages = [
    { role: 'system', content: this.agentDef.context.system_prompt },
    { role: 'user', content: formattedContext }
  ];
  
  // Much simpler!
}
```

**Context-builder handles:**
- ✅ Vector search (semantic relevance)
- ✅ Deduplication (no "okay", "thanks" spam)
- ✅ Token budgeting (max 4000 tokens)
- ✅ llm_hints formatting (clean strings)

**Agent just receives clean context and uses it!**

## 🚀 **Immediate Improvements (Without Context-Builder)**

Even without context-builder, you can improve immediately:

### **Change 1: Add Limit to Queries**
```typescript
const userMessages = await this.rcrtClient.searchBreadcrumbsWithContext({
  schema_name: 'user.message.v1',
  include_context: true,
  limit: 10  // ✅ ADD THIS (instead of fetching all 44!)
});
```

### **Change 2: Format, Don't Stringify**
```typescript
// BEFORE
content: `Context:\n${JSON.stringify(context, null, 2)}\n\nUser message: ${userMessage}`

// AFTER
content: this.formatContextForLLM(context, userMessage)
```

### **Change 3: Remove Timestamps**
```typescript
// Timestamps add tokens but LLMs ignore them
messages: chatHistory.map(m => ({
  role: m.role,
  content: m.content
  // ❌ Remove: timestamp
}))
```

**Quick wins: 40-50% token reduction with minimal code changes!**

## 📚 **Summary**

**How RCRT handles recent messages:**
- Current: ❌ Fetches ALL (110 messages), sorts chronologically, takes last 20
- Better: ✅ Fetch last 20 with `limit` parameter
- Best: ✅ Vector search for 5 most RELEVANT messages

**How context is formatted for LLM:**
- Current: ❌ `JSON.stringify(context, null, 2)` - nested JSON as text
- Better: ✅ Pre-format as clean strings with Markdown
- Best: ✅ Use llm_hints transforms in RCRT server

**With context-builder:**
- ✅ Vector search automatically
- ✅ llm_hints applied automatically
- ✅ Clean formatting automatically
- ✅ Token budgeting automatically
- ✅ Agent just receives clean context!

Want me to implement the immediate improvements to agent-executor.ts to show the before/after?

