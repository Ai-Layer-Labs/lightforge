# Agent Execution Architecture - Design Discussion

## 🔍 **Current System Analysis**

### **How Tools Work Now**
```javascript
// Tools-runner watches for breadcrumbs with:
schema_name: 'tool.request.v1'
tags: ['tool:request', workspace]

// When found:
1. Gets tool name from context.tool
2. Executes the tool with context.input
3. Creates response breadcrumb with results
```

### **Current Agent Role**
- **Identity & Permissions**: Agents are currently just identity/permission entities
- **Subscriptions**: They can subscribe to breadcrumb events (notifications only)
- **Creation**: They can create breadcrumbs, but no execution logic

## 🚀 **Agent Execution Options**

### **Option 1: Agent-Runner Service (Recommended)**

**Architecture**: Copy tools-runner pattern but for agents
```javascript
// Agent-runner watches for:
schema_name: 'agent.request.v1'
tags: ['agent:request', workspace]

// Agent definitions stored as breadcrumbs:
{
  schema_name: 'agent.definition.v1',
  title: 'Data Processor Agent',
  tags: ['agent:definition', 'workspace:agents'],
  context: {
    agent_name: 'data-processor',
    trigger_patterns: ['data:raw'],
    code: 'javascript-code-here',
    dependencies: ['tool:calculator'],
    output_schema: 'data.processed.v1'
  }
}
```

**Benefits**:
- ✅ Follows existing architecture patterns
- ✅ Scalable (separate service)
- ✅ Secure (proper isolation)
- ✅ Visual (agents show up on dashboard)

### **Option 2: Agent Trigger Tool**

**Architecture**: Special tool that executes agent logic
```javascript
// Agent trigger requests:
{
  schema_name: 'tool.request.v1',
  context: {
    tool: 'agent-trigger',
    input: {
      agent_name: 'data-processor',
      trigger_data: { /* breadcrumb that triggered agent */ }
    }
  }
}
```

**Benefits**:
- ✅ Reuses existing tools infrastructure
- ✅ No new service needed
- ✅ Simpler deployment

**Drawbacks**:
- ❌ Agents aren't first-class citizens
- ❌ Mixed concerns (tools vs agents)

### **Option 3: Hybrid Approach**

**Architecture**: Agents can be both subscribers AND executors
```javascript
// Enhanced agent definitions:
{
  schema_name: 'agent.definition.v1',
  context: {
    roles: ['curator', 'emitter', 'subscriber'],
    execution_mode: 'reactive', // 'reactive' | 'proactive' | 'manual'
    triggers: [
      {
        selector: { any_tags: ['data:raw'] },
        action: 'process-data'
      }
    ],
    actions: {
      'process-data': {
        code: 'agent-logic-here',
        tools: ['calculator', 'validator']
      }
    }
  }
}
```

## 🎯 **Recommended Architecture: Agent-Runner Service**

### **Why Agent-Runner Makes Sense**

1. **Separation of Concerns**:
   - Tools = External services (OpenRouter, SerpAPI)
   - Agents = Internal logic/workflows

2. **Follows RCRT Patterns**:
   - Event-driven execution
   - Breadcrumb-based configuration
   - Visual dashboard integration

3. **Scalability**:
   - Independent service
   - Can handle multiple agent types
   - Proper resource isolation

### **Implementation Plan**

#### **1. Agent Definitions (Breadcrumbs)**
```javascript
{
  schema_name: 'agent.definition.v1',
  title: 'OpenRouter Monitor Agent',
  tags: ['agent:definition', 'workspace:agents'],
  context: {
    agent_name: 'openrouter-monitor',
    description: 'Monitors OpenRouter responses and creates summaries',
    trigger_selector: {
      any_tags: ['tool:response'],
      all_tags: ['workspace:tools'],
      context_match: [{ path: '$.tool', op: 'eq', value: 'openrouter' }]
    },
    execution: {
      type: 'javascript',
      code: `
        // Agent logic here
        const response = input.context.output;
        const summary = analyzeLLMResponse(response);
        
        return {
          title: 'OpenRouter Response Summary',
          context: { summary, original_response_id: input.id },
          tags: ['agent:output', 'llm:analysis']
        };
      `
    }
  }
}
```

#### **2. Agent Triggers (Breadcrumbs)**
```javascript
{
  schema_name: 'agent.request.v1',
  title: 'Trigger: OpenRouter Monitor',
  tags: ['agent:request', 'workspace:agents'],
  context: {
    agent_name: 'openrouter-monitor',
    trigger_breadcrumb_id: 'breadcrumb-that-triggered-this',
    input_data: { /* relevant data */ }
  }
}
```

#### **3. Agent-Runner Service**
```typescript
// Similar to tools-runner but for agents
async function dispatchEventToAgent(eventData: any, client: RcrtClient) {
  // Find matching agent definitions
  const agentDefs = await findAgentDefinitions(eventData);
  
  for (const agentDef of agentDefs) {
    // Execute agent logic
    const result = await executeAgent(agentDef, eventData);
    
    // Create agent response breadcrumb
    await client.createBreadcrumb({
      schema_name: 'agent.response.v1',
      title: `Agent Response: ${agentDef.context.agent_name}`,
      tags: ['agent:response', 'workspace:agents'],
      context: {
        agent_name: agentDef.context.agent_name,
        trigger_id: eventData.breadcrumb_id,
        output: result,
        execution_time_ms: executionTime
      }
    });
  }
}
```

## 🔗 **Connection Implications**

### **New Connection Types Would Emerge**
- **🤖 Agent Triggers**: Agent Definition → Triggering Breadcrumbs
- **⚡ Agent Responses**: Agent → Response Breadcrumbs
- **🔧 Agent Dependencies**: Agent → Tools They Use
- **📊 Agent Workflows**: Agent → Agent (chained execution)

### **Visual Dashboard Impact**
- **Agent Definition Nodes**: Special breadcrumb nodes for agent definitions
- **Trigger Lines**: Show what triggers each agent
- **Response Lines**: Show agent outputs
- **Dependency Lines**: Show agent → tool relationships

## 🎯 **My Recommendation**

**Go with Agent-Runner Service** because:

1. **✅ Clean Architecture**: Follows existing patterns
2. **✅ Visual Integration**: Agents show up on dashboard naturally
3. **✅ Extensible**: New agent types just need new definitions
4. **✅ Secure**: Proper isolation and permission handling
5. **✅ Scalable**: Can handle complex agent workflows

### **Implementation Steps**
1. Create `apps/agent-runner` (copy tools-runner structure)
2. Define agent schemas (`agent.definition.v1`, `agent.request.v1`)
3. Add agent execution engine
4. Update dashboard to show agent definitions as special nodes
5. Add agent trigger/response connection types

**This would give you a fully agentic system where agents can react to any breadcrumb pattern and execute custom logic!** 🤖✨

What do you think? Should we implement the agent-runner service?
