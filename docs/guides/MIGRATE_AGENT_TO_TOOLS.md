# Migration Guide: Agents Using Tools for LLM

## Step 1: Update Agent Definition

Change your agent definition from direct LLM configuration to tool-based:

### Before:
```json
{
  "schema_name": "agent.definition.v1",
  "title": "Default Chat Agent",
  "tags": ["agent:definition", "workspace:agents"],
  "context": {
    "agent_id": "default-chat-agent",
    "model": "openrouter/google/gemini-2.0-flash-exp:free",  // REMOVE THIS
    "max_tokens": 2000,                                      // MOVE TO llm_config
    "temperature": 0.7,                                      // MOVE TO llm_config
    "capabilities": {
      "can_create_breadcrumbs": true,
      "can_delete_own": false,
      "can_update_own": false,
      "can_spawn_agents": false
    },
    "subscriptions": {
      "selectors": [
        {
          "schema_name": "chat.message.v1",
          "all_tags": ["chat:message", "workspace:agents"]
        },
        {
          "schema_name": "tool.catalog.v1",
          "all_tags": ["workspace:tools"]
        },
        {
          "schema_name": "tool.response.v1",
          "all_tags": ["workspace:tools"]
        }
      ]
    },
    "system_prompt": "..."
  }
}
```

### After:
```json
{
  "schema_name": "agent.definition.v1",
  "title": "Default Chat Agent",
  "tags": ["agent:definition", "workspace:agents"],
  "context": {
    "agent_id": "default-chat-agent",
    "llm_tool": "openrouter",                    // Which tool to use
    "llm_config": {                              // Config for the tool
      "model": "google/gemini-2.0-flash-exp",    // Correct model ID
      "max_tokens": 2000,
      "temperature": 0.7
    },
    "capabilities": {
      "can_create_breadcrumbs": true,
      "can_delete_own": false,
      "can_update_own": false,
      "can_spawn_agents": false
    },
    "subscriptions": {
      "selectors": [
        {
          "schema_name": "chat.message.v1",
          "all_tags": ["chat:message", "workspace:agents"]
        },
        {
          "schema_name": "tool.catalog.v1",
          "all_tags": ["workspace:tools"]
        },
        {
          "schema_name": "tool.response.v1",
          "all_tags": ["workspace:tools"]  // IMPORTANT: Must subscribe to tool responses
        }
      ]
    },
    "system_prompt": "..."
  }
}
```

## Step 2: Update Agent Runner

The agent runner needs to use the new `ToolBasedAgentExecutor`:

```typescript
// In agent-runner/src/index.ts
import { ToolBasedAgentExecutor } from '@rcrt-builder/runtime';

// Remove openRouterApiKey from config and options
const executorOptions = {
  agentDef,
  rcrtClient: this.client,
  workspace: this.workspace,
  autoStart: true,
  metricsInterval: 60000
};

const executor = new ToolBasedAgentExecutor(executorOptions);
```

## Step 3: How It Works

1. **User sends message** → Creates `chat.message.v1`
2. **Agent receives event** → Processes in `handleChatMessage`
3. **Agent creates tool request**:
   ```json
   {
     "schema_name": "tool.request.v1",
     "context": {
       "tool": "openrouter",
       "input": {
         "messages": [...],
         "model": "google/gemini-2.0-flash-exp",
         "temperature": 0.7,
         "max_tokens": 2000
       },
       "requestId": "req-123456-abc",
       "requestedBy": "default-chat-agent"
     }
   }
   ```
4. **Tools runner processes** → OpenRouter tool handles API call
5. **Tool creates response** → `tool.response.v1`
6. **Agent receives response** → Processes in `handleToolResponse`
7. **Agent creates final response** → `agent.response.v1`

## Step 4: Benefits

1. **No duplicate API keys** - Tools manage all secrets
2. **Consistent error handling** - One place for API errors
3. **Better observability** - Every LLM call is a breadcrumb
4. **Provider flexibility** - Switch between openrouter/ollama/etc without changing agents
5. **Cost tracking** - Tools can track usage centrally
6. **Testing** - Can mock tool responses easily

## Step 5: Testing

Create a test message:
```bash
curl -X POST http://localhost:8081/breadcrumbs \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schema_name": "chat.message.v1",
    "title": "Test Message",
    "tags": ["chat:message", "workspace:agents"],
    "context": {
      "message": "Hello! Can you help me?",
      "role": "user"
    }
  }'
```

Expected flow:
1. Agent creates `tool.request.v1` for OpenRouter
2. OpenRouter tool processes and returns `tool.response.v1`
3. Agent creates `agent.response.v1` with the answer

## Next Steps

1. Update all agents to use tool-based LLM access
2. Remove direct LLM clients from agent code
3. Ensure all agents subscribe to `tool.response.v1`
4. Test with different LLM tools (ollama for local, openrouter for cloud)
5. Add monitoring for tool request/response pairs
