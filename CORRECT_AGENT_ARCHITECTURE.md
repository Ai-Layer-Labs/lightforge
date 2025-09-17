# CORRECT AGENT ARCHITECTURE - Back to RCRT Philosophy

## 🎯 **Core Principle: Tools are Code, Agents are Context + Data**

### ❌ **What We Did Wrong**
- Stored JavaScript execution code in agent breadcrumbs
- Made agent-runner execute code directly
- Turned agents into mini-programs

### ✅ **What We Should Do**
- Agents are data structures that describe LLM interactions
- Agent-runner gathers context and calls LLMs
- LLM responses trigger tools via structured output

## 🏗️ **Correct Architecture**

### **1. Agent Definition Schema**
```javascript
{
  schema_name: 'agent.definition.v1',
  title: 'File Manager Agent',
  tags: ['agent:definition', 'workspace:agents'],
  context: {
    agent_name: 'file-manager',
    agent_entity_id: '00000000-0000-0000-0000-0000000000aa', // Links to agent entity
    description: 'Helps users manage their stored files',
    
    // What events trigger this agent
    triggers: [{
      selector: {
        any_tags: ['user:message', 'chat:input'],
        context_match: [
          { path: '$.content', op: 'contains_any', value: ['file', 'list', 'javascript'] }
        ]
      }
    }],
    
    // No complex context gathering needed!
    // Agent gets the breadcrumb context via existing API: GET /breadcrumbs/{id}
    // This returns the minimal context-view designed for LLM usage
    
    // LLM configuration
    llm_config: {
      model: 'gpt-4',
      system_prompt: `You are a helpful file management assistant. You can:
        - List and analyze stored files
        - Help users find specific files
        - Invoke file-storage and agent-loader tools
        - Provide file management advice
        
        Always respond with structured JSON containing your response and any tools to invoke.`,
      
      response_schema: {
        type: 'object',
        required: ['response_text'],
        properties: {
          response_text: { 
            type: 'string', 
            description: 'Your response to the user' 
          },
          tools_to_invoke: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tool: { type: 'string' },
                input: { type: 'object' },
                reason: { type: 'string' }
              }
            }
          },
          create_breadcrumbs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                tags: { type: 'array' },
                context: { type: 'object' }
              }
            }
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        }
      }
    }
  }
}
```

### **2. Agent Runner Process**
```typescript
async function processAgentEvent(triggerBreadcrumbId: string, agentDefinition: any) {
  console.log(`🤖 Agent ${agentDefinition.context.agent_name} triggered`);
  
  // 1. Get breadcrumb context using existing API (designed for LLM usage)
  const breadcrumbContext = await client.getBreadcrumb(triggerBreadcrumbId);
  
  // 2. Format for LLM - just the breadcrumb context!
  const messages = [
    {
      role: 'system',
      content: agentDefinition.context.llm_config.system_prompt
    },
    {
      role: 'user', 
      content: `**Breadcrumb Context:**\nTitle: ${breadcrumbContext.title}\nTags: ${breadcrumbContext.tags.join(', ')}\nContext: ${JSON.stringify(breadcrumbContext.context, null, 2)}`
    }
  ];
  
  // 3. Call existing OpenRouter LLM tool via breadcrumb
  await client.createBreadcrumb({
    schema_name: 'tool.request.v1',
    title: 'LLM Request for Agent',
    tags: ['tool:request', 'workspace:tools'],
    context: {
      tool: 'openrouter',
      input: {
        messages,
        model: agentDefinition.context.llm_config.model || 'google/gemini-2.5-flash'
      }
    }
  });
  
  // Wait for and process tool response
  const llmResponse = await waitForToolResponse('openrouter');
  
  // 4. Process structured LLM response
  
  // Create agent response breadcrumb
  await createBreadcrumb({
    schema_name: 'agent.response.v1',
    title: `${agentDefinition.context.agent_name} Response`,
    tags: ['agent:response', 'workspace:agents'],
    context: {
      agent_name: agentDefinition.context.agent_name,
      response_to: triggerBreadcrumb.id,
      content: llmResponse.response_text,
      confidence: llmResponse.confidence,
      timestamp: new Date().toISOString()
    }
  });
  
  // Invoke tools if requested
  if (llmResponse.tools_to_invoke) {
    for (const toolRequest of llmResponse.tools_to_invoke) {
      await createBreadcrumb({
        schema_name: 'tool.request.v1',
        title: `Tool Request: ${toolRequest.tool}`,
        tags: ['tool:request', 'workspace:tools'],
        context: {
          tool: toolRequest.tool,
          input: toolRequest.input,
          requested_by: agentDefinition.context.agent_name,
          reason: toolRequest.reason
        }
      });
    }
  }
  
  // Create additional breadcrumbs if requested
  if (llmResponse.create_breadcrumbs) {
    for (const breadcrumb of llmResponse.create_breadcrumbs) {
      await createBreadcrumb(breadcrumb);
    }
  }
}
```

### **3. Context Gathering**
```typescript
async function gatherContext(gathering: any, trigger: any) {
  const context = {
    trigger_breadcrumb: trigger,
    gathered_context: []
  };
  
  // Search for relevant context
  if (gathering.search_queries) {
    for (const query of gathering.search_queries) {
      const results = await searchBreadcrumbs(query, {
        limit: gathering.max_context_items || 3
      });
      context.gathered_context.push(...results);
    }
  }
  
  // Include agent history if requested
  if (gathering.include_agent_history) {
    const history = await searchBreadcrumbs(`agent:${agent_name}`, {
      limit: 5,
      tags: ['agent:response']
    });
    context.agent_history = history;
  }
  
  return context;
}
```

## 🔄 **Flow Comparison**

### ❌ **Current Wrong Flow**
```
Event → Agent Runner → Execute JavaScript Code → Create Response
```

### ✅ **Correct RCRT Flow**
```
Event → Agent Runner → Find Agent Definition → Gather Context → LLM Call → Structured Response → Trigger Tools/Create Breadcrumbs
```

## 🎯 **Benefits of Correct Approach**

1. **True RCRT Integration**: Agents are searchable, versionable breadcrumbs
2. **No Code Execution**: Agents contain only data and configuration
3. **Uses Existing Tools**: Leverages existing OpenRouter LLM tool via breadcrumbs
4. **Simple Context**: Just uses breadcrumb context from existing API
5. **Observable**: All agent interactions are visible as breadcrumbs
6. **Composable**: Agents can trigger other agents through breadcrumbs
7. **Leverages Infrastructure**: Uses existing subscription, SSE, and tool systems

## 🚀 **Implementation Steps**

1. Remove JavaScript execution from agent-runner
2. Create agent definition schema and examples
3. Implement context gathering system
4. Add LLM integration to agent-runner
5. Create structured response processing
6. Test with example agents

This approach keeps **tools as executable code** while making **agents pure context and data** - exactly as RCRT intended!
