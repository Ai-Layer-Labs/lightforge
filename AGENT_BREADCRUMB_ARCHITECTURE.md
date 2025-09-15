# Agent Execution via Breadcrumbs - Redesigned Architecture

## 🎯 **The RCRT Way: Agents as Breadcrumbs**

You're absolutely right! In RCRT, **everything should be breadcrumbs**. Let me redesign the agent system properly:

### **Current Agent System**
- ✅ **Agent Entities**: Already exist (ID, roles, created_at)
- ✅ **Agent Nodes**: Already on dashboard
- ✅ **Agent Subscriptions**: Already working

### **What We Add: Agent Definitions as Breadcrumbs**
```javascript
{
  schema_name: 'agent.definition.v1',
  title: 'OpenRouter Monitor Agent',
  tags: ['agent:definition', 'workspace:agents', 'agent:openrouter-monitor'],
  context: {
    agent_name: 'openrouter-monitor',
    description: 'Monitors OpenRouter responses and creates analysis',
    version: '1.0.0',
    category: 'monitor',
    
    // What triggers this agent logic
    triggers: [{
      selector: {
        all_tags: ['tool:response', 'workspace:tools'],
        context_match: [
          { path: '$.tool', op: 'eq', value: 'openrouter' },
          { path: '$.status', op: 'eq', value: 'success' }
        ]
      },
      conditions: {
        max_executions_per_hour: 50,
        cooldown_seconds: 10
      }
    }],
    
    // Agent capabilities
    capabilities: {
      can_create: true,
      can_modify: false,
      can_use_tools: true,
      max_execution_time: 30000
    },
    
    // The actual executable code
    execution: {
      type: 'javascript',
      code: `
        async function execute(triggerBreadcrumb, context) {
          console.log('🤖 OpenRouter Monitor analyzing:', triggerBreadcrumb.title);
          
          const response = triggerBreadcrumb.context.output;
          const usage = response.usage || {};
          
          // Analyze the response
          const analysis = {
            model_used: response.model || 'unknown',
            token_usage: usage,
            response_length: response.content?.length || 0,
            cost_estimate: estimateCost(usage)
          };
          
          // Create summary
          const summary = createSummary(response, analysis);
          
          // Create response breadcrumb
          await context.rcrtClient.createBreadcrumb({
            schema_name: 'agent.response.v1',
            title: 'OpenRouter Analysis: ' + analysis.model_used,
            tags: [context.workspace, 'agent:response', 'llm:analysis'],
            context: {
              agent_name: 'openrouter-monitor',
              summary,
              analysis,
              original_response_id: triggerBreadcrumb.id
            }
          });
          
          return { summary, analysis };
        }
        
        function estimateCost(usage) {
          const promptTokens = usage.prompt_tokens || 0;
          const completionTokens = usage.completion_tokens || 0;
          return (promptTokens * 0.000001) + (completionTokens * 0.000002);
        }
        
        function createSummary(response, analysis) {
          return \`OpenRouter \${analysis.model_used} generated \${analysis.response_length} characters using \${analysis.token_usage.total_tokens || 0} tokens. Cost: $\${analysis.cost_estimate?.toFixed(6) || '0.000000'}.\`;
        }
      `
    }
  }
}
```

## 🔄 **How It Works**

### **1. Agent Definition Discovery**
```javascript
// Agent-runner finds agent definitions
const agentDefs = await client.listBreadcrumbs({
  tags: ['agent:definition'],
  schema: 'agent.definition.v1'
});
```

### **2. Event Matching**
```javascript
// For each incoming breadcrumb event, check all agent definitions
agentDefs.forEach(agentDef => {
  if (matchesTrigger(incomingBreadcrumb, agentDef.context.triggers)) {
    executeAgentCode(agentDef, incomingBreadcrumb);
  }
});
```

### **3. Code Execution**
```javascript
// Execute the JavaScript code stored in the breadcrumb
const agentFunction = new Function('triggerBreadcrumb', 'context', agentDef.context.execution.code);
const result = await agentFunction(triggerBreadcrumb, executionContext);
```

## 🎨 **Dashboard Integration**

### **Existing Agent Nodes**
- ✅ Keep current agent nodes (they represent agent entities)
- ✅ Add visual indicator when agent has executable definitions
- ✅ Click agent → show associated agent definitions

### **New Agent Definition Nodes**
- 🆕 **Agent Definition Nodes**: Special breadcrumb nodes for agent definitions
- 🔗 **Connection Lines**: Agent Entity → Agent Definitions
- ⚡ **Trigger Lines**: Agent Definition → Breadcrumbs that trigger it
- 📊 **Response Lines**: Agent Definition → Response Breadcrumbs

### **Visual Workflow**
```
Agent Entity (🤖) ← connected to → Agent Definition (📋) ← triggered by → Breadcrumbs
                                           ↓
                                   Response Breadcrumbs (📊)
```

## 🛠️ **Simplified Agent-Runner**

Instead of complex TypeScript classes, the agent-runner becomes much simpler:

```typescript
// 1. Find agent definitions (breadcrumbs)
const agentDefs = await findAgentDefinitions();

// 2. For each breadcrumb event, check triggers
const matchingAgents = findTriggeredAgents(breadcrumb, agentDefs);

// 3. Execute agent code from breadcrumb context
for (const agentDef of matchingAgents) {
  const result = await executeAgentCode(agentDef.context.execution.code, breadcrumb);
  await createAgentResponse(result, agentDef, breadcrumb);
}
```

## 🎯 **Benefits of Breadcrumb-Based Agents**

1. **✅ Visual Management**: Create/edit agents on dashboard
2. **✅ Dynamic Updates**: Update agent logic without redeployment  
3. **✅ Searchable**: Find agents by tags, content, triggers
4. **✅ Versionable**: Agent definitions have version history
5. **✅ Collaborative**: Multiple people can edit agent definitions
6. **✅ Discoverable**: Agent connections automatically appear on dashboard

## 🚀 **Implementation Plan**

1. **Simplify Agent-Runner**: Remove TypeScript classes, make it execute breadcrumb code
2. **Agent Definition UI**: Add forms to create agent definition breadcrumbs
3. **Dashboard Integration**: Show agent definitions as special breadcrumb nodes
4. **Connection Logic**: Connect agent entities to their definitions automatically

**This is the true RCRT way** - agents as living, editable, visual breadcrumbs! 🧠✨

Should I redesign the agent system to follow this breadcrumb-first approach?
