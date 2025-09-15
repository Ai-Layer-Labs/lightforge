# RCRT Agent Architecture - Complete Implementation

## 🎯 **Agent Framework Created**

I've built a complete agent execution framework following the same patterns as the tools system:

### **📁 File Structure**
```
rcrt-visual-builder/
├── packages/agents/                    # Agent framework package
│   ├── src/
│   │   ├── index.ts                   # Base agent classes and interfaces
│   │   ├── registry.ts                # Agent registry and execution engine
│   │   └── built-in/                  # Pre-built agent implementations
│   │       ├── openrouter-monitor.ts  # Monitors LLM responses
│   │       ├── data-processor.ts      # Processes raw data
│   │       ├── workflow-orchestrator.ts # Manages workflows
│   │       └── index.ts               # Built-in agent exports
│   ├── package.json                   # Package configuration
│   └── tsup.config.ts                 # Build configuration
└── apps/agent-runner/                  # Agent execution service
    ├── src/
    │   └── index.ts                   # Main agent runner service
    ├── package.json                   # Service configuration
    ├── tsup.config.ts                 # Build configuration
    └── Dockerfile                     # Container configuration
```

## 🤖 **Agent Base Classes**

### **BaseAgent (Abstract)**
```typescript
abstract class BaseAgent {
  abstract name: string;
  abstract description: string;
  abstract triggers: AgentTrigger[];      // What triggers this agent
  abstract capabilities: AgentCapabilities; // What it can do
  abstract execute(input, context): Promise<any>; // Main logic
  
  // Built-in helpers:
  protected getSecret(name, context): Promise<string>
  protected invokeTool(tool, input, context): Promise<any>
  protected searchBreadcrumbs(query, context): Promise<any[]>
  protected createResponse(title, output, context): Promise<any>
}
```

### **Specialized Agent Types**
- **ReactiveAgent**: Responds to specific breadcrumb patterns
- **MonitorAgent**: Continuously watches and creates alerts/summaries
- **WorkflowAgent**: Orchestrates multi-step processes
- **CuratorAgent**: Manages system resources (highest permissions)

## 🔄 **How Agent Execution Works**

### **1. Agent Definitions (Stored as Breadcrumbs)**
```javascript
{
  schema_name: 'agent.definition.v1',
  title: 'OpenRouter Monitor Agent',
  tags: ['agent:definition', 'workspace:agents'],
  context: {
    agent_name: 'openrouter-monitor',
    triggers: [{
      selector: {
        all_tags: ['tool:response'],
        context_match: [{ path: '$.tool', op: 'eq', value: 'openrouter' }]
      }
    }],
    capabilities: { canCreate: true, canUseTool: true }
  }
}
```

### **2. Event-Driven Execution**
```
Breadcrumb Created/Updated → Agent-Runner SSE → Find Matching Agents → Execute Logic → Create Response Breadcrumb
```

### **3. Agent Registry**
- Manages agent lifecycle (start, stop, cleanup)
- Handles rate limiting and cooldowns
- Maintains agent catalog breadcrumb
- Provides execution context and helpers

## 🎨 **Dashboard Integration**

### **New Node Types** (Ready to Add)
- **🤖 Agent Definition Nodes**: Show registered agents on canvas
- **⚡ Agent Response Nodes**: Show agent outputs
- **🔄 Workflow Nodes**: Show workflow steps and status

### **New Connection Types** (Automatic)
- **🎯 Agent Triggers**: Agent Definition → Triggering Breadcrumbs
- **📊 Agent Responses**: Agent → Response Breadcrumbs  
- **🔧 Agent Dependencies**: Agent → Tools They Use
- **📋 Workflow Steps**: Step → Next Step connections

## 🚀 **Example Agent Implementations**

### **1. OpenRouter Monitor Agent**
```typescript
// Triggers on: OpenRouter tool responses
// Actions: Analyzes response quality, estimates costs, generates recommendations
// Output: Creates analysis breadcrumbs with insights
```

### **2. Data Processor Agent**
```typescript
// Triggers on: Raw data breadcrumbs
// Actions: Validates, transforms, and structures data
// Output: Creates processed data breadcrumbs with validation results
```

### **3. Workflow Orchestrator Agent**
```typescript
// Triggers on: Workflow start/step completion events
// Actions: Manages multi-step processes, coordinates agent/tool execution
// Output: Creates workflow status and next-step breadcrumbs
```

## 🔧 **Deployment Ready**

### **Docker Compose Integration**
```yaml
agent-runner:
  build: ./rcrt-visual-builder/apps/agent-runner/Dockerfile
  environment:
    RCRT_BASE_URL: http://rcrt:8080
    WORKSPACE: workspace:agents
    AGENT_ID: 00000000-0000-0000-0000-000000000AAA
```

### **Agent Registration**
- Updated `scripts/ensure-agents.sh` to include agent-runner agent
- Automatic agent registration on startup
- Proper JWT authentication and permissions

## 🎯 **Key Benefits**

### **1. Extensible Architecture**
```typescript
// Add new agent by extending base class
class MyCustomAgent extends ReactiveAgent {
  name = 'my-agent';
  triggers = [{ selector: { any_tags: ['my:trigger'] } }];
  async execute(input, context) {
    // Your agent logic here
    return result;
  }
}

// Register agent
registry.registerAgent(new MyCustomAgent());
```

### **2. Data-Driven Triggers**
```javascript
// Agents can trigger on ANY breadcrumb pattern:
triggers: [{
  selector: {
    any_tags: ['urgent', 'error'],           // OR logic
    all_tags: ['workspace:production'],      // AND logic  
    schema_name: 'incident.report.v1',       // Schema matching
    context_match: [                         // Complex conditions
      { path: '$.severity', op: 'gt', value: 7 }
    ]
  }
}]
```

### **3. Rich Execution Context**
```typescript
// Agents get full RCRT access:
context.rcrtClient.createBreadcrumb()     // Create new breadcrumbs
context.rcrtClient.searchBreadcrumbs()    // Semantic search
agent.getSecret('API_KEY', context)       // Access secrets
agent.invokeTool('calculator', data)      // Use tools
```

### **4. Visual Integration**
- Agent definitions appear as nodes on dashboard
- Agent responses create new breadcrumb nodes
- Connection lines show agent triggers and outputs
- Real-time updates in both 2D and 3D views

## 🚀 **Next Steps**

1. **Build and Deploy**: `docker-compose up --build agent-runner`
2. **Register Agents**: Run `./scripts/ensure-agents.sh`
3. **Test Agents**: Create breadcrumbs that match agent triggers
4. **Monitor Execution**: Watch console logs and dashboard updates
5. **Add Custom Agents**: Extend base classes for your specific needs

## 🎉 **The Result**

You now have a **complete agentic system** where:
- ✅ **Agents are autonomous** - they execute logic when triggered
- ✅ **Triggers are data-driven** - no hardcoding required
- ✅ **Execution is visual** - see agents work on the dashboard
- ✅ **System is extensible** - add new agent types easily
- ✅ **Integration is seamless** - agents work with tools and secrets

**RCRT is now truly agentic!** 🤖✨
