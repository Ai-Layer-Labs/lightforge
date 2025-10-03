# Agent Executor Refactor: The RCRT Way

## 🎯 **Core Philosophy Change**

### **OLD: Agent Does Everything**
```typescript
Agent receives user.message.v1 →
  ├─ Fetches ALL user messages
  ├─ Fetches ALL agent responses  
  ├─ Fetches tool catalog
  ├─ Sorts chronologically
  ├─ Takes last 20
  ├─ JSON.stringify() for LLM
  └─ Creates tool.request.v1
```

**Problems:**
- Agent does work that should be a tool's job
- Fetches 110 breadcrumbs, uses 20
- Chronological (not semantic)
- Poor formatting (JSON-in-text)

### **NEW: Agent Receives Pre-Built Context**
```typescript
Agent receives agent.context.v1 →
  ├─ Context already assembled (by context-builder tool!)
  ├─ Vector search already applied (semantic relevance)
  ├─ Token budget already enforced (< 4000 tokens)
  ├─ llm_hints already transformed (clean formatting)
  ├─ Format as clean Markdown
  └─ Creates tool.request.v1
```

**Benefits:**
- ✅ Agent only does agent work (reasoning, tool selection)
- ✅ Context assembly is tool work (separation of concerns)
- ✅ Semantic relevance (pgvector)
- ✅ Clean formatting (Markdown)

## 📊 **Subscription Changes**

### **OLD Agent Definition**
```json
{
  "subscriptions": {
    "selectors": [
      { "schema_name": "user.message.v1" },          // 44 events
      { "schema_name": "tool.catalog.v1" },          // 1 event  
      { "schema_name": "tool.response.v1" },         // 69 events
      { "schema_name": "agent.response.v1" },        // 66 events
      { "schema_name": "workflow:progress" },        // N events
      { "schema_name": "system.message.v1" }         // 8 events
    ]
  }
}
```

**Total events per conversation:** ~300+

### **NEW Agent Definition (RCRT Way)**
```json
{
  "subscriptions": {
    "selectors": [
      {
        "comment": "PRIMARY: Pre-built context from context-builder",
        "schema_name": "agent.context.v1",
        "all_tags": ["consumer:default-chat-assistant"]
      },
      {
        "comment": "Tool responses for follow-up",
        "schema_name": "tool.response.v1",
        "context_match": [{
          "path": "$.requestedBy",
          "op": "eq",
          "value": "default-chat-assistant"
        }]
      },
      {
        "comment": "FALLBACK: Direct user messages if no context-builder",
        "schema_name": "user.message.v1",
        "any_tags": ["user:message"]
      }
    ]
  }
}
```

**Total events per conversation:** ~2

**Reduction: 99.3%!**

## 🔄 **Event Flow**

### **OLD Flow**
```
User sends message
  ↓ (user.message.v1 created)
  ├─→ Agent receives event
  │   ├─ Fetches 110 breadcrumbs
  │   ├─ Builds context (150ms)
  │   └─ Calls LLM (8000 tokens)
  │
  ├─→ Tool catalog updates
  │   └─ Agent receives event (rebuild context)
  │
  └─→ Other agents respond
      └─ Agent receives events (rebuild context)

Agent processes: ~300 events, rebuilds context each time!
```

### **NEW Flow (RCRT Way)**
```
User sends message
  ↓ (user.message.v1 created)
  │
  ├─→ context-builder-runner receives event
  │   ├─ Matches update_trigger
  │   ├─ Invokes context-builder tool
  │   ├─ Vector search (50ms)
  │   ├─ Assembles context (10ms)
  │   └─ Updates agent.context.v1
  │
  └─→ Agent receives agent.context.v1 update
      ├─ Context pre-built (0ms assembly)
      ├─ Formats as Markdown (2ms)
      └─ Calls LLM (1500 tokens)

Agent processes: 1-2 events, context pre-built!
```

## 💡 **Key Code Changes**

### **1. New Handler: handleAgentContext()**

```typescript
/**
 * THE RCRT WAY: Handle pre-built context from context-builder
 */
private async handleAgentContext(event, breadcrumb) {
  console.log(`🎯 Received pre-built context from context-builder`);
  
  // Context already assembled with vector search!
  const assembledContext = breadcrumb.context;
  
  // Get trigger event (what user asked)
  const triggerEvent = await this.rcrtClient.getBreadcrumb(
    assembledContext.trigger_event_id
  );
  const userMessage = triggerEvent.context?.message;
  
  // Format for LLM (already has llm_hints applied!)
  const formattedContext = this.formatPrebuiltContext(
    assembledContext, 
    userMessage
  );
  
  // Call LLM with clean context
  const messages = [
    { role: 'system', content: this.systemPrompt },
    { role: 'user', content: formattedContext }  // Clean Markdown!
  ];
  
  await this.createLLMRequest(messages);
}
```

### **2. Proper Formatting: formatPrebuiltContext()**

```typescript
private formatPrebuiltContext(context, userMessage): string {
  const sections = [];
  
  // Tool catalog (llm_hints already applied)
  if (context.tool_catalog) {
    sections.push('# Available Tools\n' + context.tool_catalog);
  }
  
  // Chat history (vector-searched!)
  if (context.chat_history) {
    sections.push('# Relevant Conversation');
    for (const msg of context.chat_history) {
      sections.push(`${msg.role}: ${msg.content}`);
    }
  }
  
  // Current request
  sections.push(`# Current Request\n${userMessage}`);
  
  return sections.join('\n\n');  // Clean Markdown, not JSON!
}
```

### **3. Fallback Mode: handleChatMessageDirect()**

```typescript
/**
 * FALLBACK: If no context-builder, agent builds context itself
 * Uses vector search at least!
 */
private async handleChatMessageDirect(userMessage, event) {
  // Try vector search
  const relevantMessages = await this.rcrtClient.vectorSearch({
    q: userMessage,
    nn: 5,  // Just 5, not 20!
    filters: { schema_name: 'user.message.v1' }
  });
  
  // Format properly
  const formattedContext = [
    '# Recent Conversation',
    ...relevantMessages.map(m => `User: ${m.context.content}`),
    '',
    `# Current Request`,
    userMessage
  ].join('\n');
  
  // No JSON.stringify!
  await this.createLLMRequest([
    { role: 'system', content: this.systemPrompt },
    { role: 'user', content: formattedContext }
  ]);
}
```

### **4. Deprecated: buildContext()**

```typescript
/**
 * DEPRECATED - Agents should NOT build their own context!
 * Kept only for compatibility.
 */
private async buildContext_DEPRECATED_FALLBACK() {
  console.warn(`⚠️ Using deprecated buildContext!`);
  // Minimal fallback implementation
}
```

## 🎨 **What LLM Receives Now**

### **With Context-Builder (Optimal)**

```
System: You are a helpful AI assistant...

User: # Available Tools
You have access to 11 tools:
• breadcrumb-crud: Query, create, update breadcrumbs
• openrouter: Access to 100+ LLM models
• workflow: Execute multi-step workflows
... (8 more)

# Relevant Conversation (5 messages)
User: What was that API key?
Assistant: I mentioned OPENROUTER_API_KEY earlier
User: Where do I set it?
Assistant: Set it in the secrets configuration
User: Can you show me?

# Current Request
okay do that
```

**Tokens:** ~1200 (vs 8000 before)
**Relevance:** HIGH (vector search found related messages)
**Format:** Clean Markdown (no JSON)

### **Without Context-Builder (Fallback)**

```
System: You are a helpful AI assistant...

User: # Recent Conversation
User: What was that API key?
User: Where do I set it?
User: Can you show me?
User: I mentioned it earlier
User: The format is sk-or-...

# Current Request
okay do that
```

**Tokens:** ~600 (still better than 8000!)
**Relevance:** MEDIUM (vector search, but no agent responses)
**Format:** Clean Markdown

## 📋 **Migration Checklist**

- [x] Update agent-executor.ts with new handlers
  - [x] handleAgentContext() - Process pre-built context
  - [x] formatPrebuiltContext() - Clean Markdown formatting
  - [x] checkForContextBuilder() - Detect if context-builder available
  - [x] handleChatMessageDirect() - Fallback with vector search
  - [x] Deprecate buildContext() - Agents shouldn't build context

- [ ] Update agent definition
  - [ ] Change subscriptions to agent.context.v1
  - [ ] Add fallback subscription to user.message.v1
  - [ ] Update system prompt for context-builder mode

- [ ] Deploy context-builder
  - [ ] Build and deploy context-builder-runner service
  - [ ] Create context.config.v1 for default-chat-assistant
  - [ ] Register with context-builder tool

- [ ] Test end-to-end
  - [ ] Send test message
  - [ ] Verify context-builder updates agent.context.v1
  - [ ] Verify agent receives and processes context
  - [ ] Check token usage (should be ~1500)

## 🚀 **Deployment Order**

1. **Deploy updated RCRT server** (with schema_name filter)
   ```bash
   docker-compose up -d --build rcrt
   ```

2. **Deploy context-builder service**
   ```bash
   docker-compose up -d --build context-builder
   ```

3. **Create context config for default-chat-assistant**
   ```bash
   node scripts/setup-agent-context.js
   ```

4. **Deploy updated agent-runner** (with new agent-executor)
   ```bash
   docker-compose up -d --build agent-runner
   ```

5. **Test**
   ```bash
   # Send test message via browser extension
   # Check logs: context-builder should update agent.context.v1
   # Check logs: agent should receive and process context
   ```

## 📊 **Expected Improvements**

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Events/Conversation** | 300+ | 1-2 | 99.3% reduction |
| **Tokens/Message** | 8000 | 1500 | 81% reduction |
| **Context Assembly Time** | 150ms | 0ms | Agent doesn't build |
| **Relevance** | Low (chronological) | High (semantic) | pgvector |
| **Format** | JSON-in-text | Clean Markdown | Readable |
| **Cost/1K Messages** | $42 | $7.50 | $34.50 savings |

## 🎯 **The RCRT Way Summary**

**Agents:**
- ✅ Subscribe to pre-built context (agent.context.v1)
- ✅ Receive clean, formatted, relevant context
- ✅ Focus on reasoning and tool usage
- ❌ Don't build context manually
- ❌ Don't fetch hundreds of breadcrumbs

**Context-Builder Tool:**
- ✅ Subscribes to update triggers
- ✅ Uses pgvector for semantic search
- ✅ Applies token budgets and deduplication
- ✅ Formats with llm_hints
- ✅ Maintains agent.context.v1 for ALL consumers

**Separation of Concerns:**
- Context assembly = Tool (code)
- Context requirements = Config (data)
- Context consumption = Agent (reasoning)

This is the composable primitive pattern you envisioned!

