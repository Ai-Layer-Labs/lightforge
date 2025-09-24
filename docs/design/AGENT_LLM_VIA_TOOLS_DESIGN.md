# Agent LLM Access via Tools Only

## Current Problem
- Agents have direct OpenRouter API access built into AgentExecutor
- Tools also provide OpenRouter access
- This creates:
  - Duplicate API key management
  - Different error handling paths
  - Confusion about which approach to use
  - Maintenance headaches

## Proposed Solution

### 1. Remove Direct LLM Access from AgentExecutor

The AgentExecutor should NOT have:
- SimpleOpenRouterClient
- Direct API calls to OpenRouter
- openRouterApiKey in options

### 2. Agent Decision Making

Agents should use a **two-phase approach**:

#### Phase 1: Simple Rule-Based Decision
```typescript
private async makeDecision(messages: any[], context: any[]): Promise<any> {
  // Check if this needs LLM intelligence
  const needsLLM = this.requiresLLMProcessing(messages, context);
  
  if (!needsLLM) {
    // Handle simple cases with templates/rules
    return this.makeSimpleDecision(messages, context);
  }
  
  // Phase 2: Create tool request for LLM
  return {
    action: 'create',
    breadcrumb: {
      schema_name: 'tool.request.v1',
      title: 'LLM Decision Request',
      tags: ['tool:request', 'workspace:tools'],
      context: {
        tool: 'openrouter',
        input: {
          messages: this.prepareLLMMessages(messages, context),
          temperature: 0.7,
          max_tokens: 2000,
          model: 'google/gemini-2.0-flash-exp' // or from config
        },
        requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        metadata: {
          agent_id: this.agentDef.context.agent_id,
          decision_context: 'agent_decision'
        }
      }
    }
  };
}
```

#### Phase 2: Process LLM Tool Response
```typescript
// In processEvent, handle tool.response.v1
if (event.schema_name === 'tool.response.v1') {
  const response = await this.rcrtClient.getBreadcrumb(event.breadcrumb_id!);
  
  if (response.context?.metadata?.decision_context === 'agent_decision') {
    // This is our LLM decision response
    const llmResponse = response.context.output.content;
    const decision = this.parseLLMResponse(llmResponse);
    await this.executeDecision(decision);
  }
}
```

### 3. Benefits

1. **Single Source of Truth**: All LLM access goes through tools
2. **Consistent Secret Management**: Tools handle all API keys
3. **Better Observability**: All LLM calls create breadcrumbs
4. **Flexible Provider Switching**: Change LLM provider without touching agents
5. **Cost Tracking**: Tools can track usage/costs centrally
6. **Error Handling**: One place to handle API errors

### 4. Migration Path

1. Update AgentExecutor to remove SimpleOpenRouterClient
2. Implement rule-based decision making for simple cases
3. Add tool request creation for complex decisions
4. Update agent definitions to remove direct model configuration
5. Test with existing agents

### 5. Agent Definition Changes

Before:
```json
{
  "model": "openrouter/google/gemini-2.0-flash-exp:free",
  "agent_id": "default-chat-agent",
  "max_tokens": 2000,
  "temperature": 0.7
}
```

After:
```json
{
  "agent_id": "default-chat-agent",
  "llm_tool": "openrouter",  // Which tool to use for LLM
  "llm_config": {             // Config passed to the tool
    "model": "google/gemini-2.0-flash-exp",
    "max_tokens": 2000,
    "temperature": 0.7
  }
}
```

## Example: Chat Agent Flow

1. User sends chat message → creates `chat.message.v1`
2. Agent receives event via subscription
3. Agent makes simple decision: "This needs LLM processing"
4. Agent creates `tool.request.v1` for openrouter tool
5. OpenRouter tool processes request → creates `tool.response.v1`
6. Agent receives tool response via subscription
7. Agent parses LLM response and creates `agent.response.v1`
8. User sees the response

This keeps the separation clean: Agents orchestrate, Tools execute.
