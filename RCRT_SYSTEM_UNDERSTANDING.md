# RCRT System Architecture - My Understanding

## 🎯 **Core RCRT Concepts**

### **📋 Breadcrumbs - The Foundation**
- **Purpose**: Semantic memory units that store context and knowledge
- **Structure**: JSON context + metadata (tags, schema, version, TTL)
- **Function**: Like "thoughts" or "memories" that can be searched, retrieved, and connected
- **Examples**: Tool responses, agent thoughts, configuration data, user inputs

### **🤖 Agents - The Actors**
- **Purpose**: Entities that interact with the breadcrumb system
- **Capabilities**: Create, read, subscribe to breadcrumbs based on their roles
- **Identity**: Each has UUID, roles, and belongs to a tenant
- **Examples**: Dashboard agent, tools-runner agent, RCRT server agent

### **🛠️ Tools - The Extensions**
- **Purpose**: External services/functions that agents can invoke
- **Integration**: Tools create breadcrumbs with their responses
- **Configuration**: Tools can be configured with secrets (API keys, etc.)
- **Examples**: OpenRouter (LLM), SerpAPI (search), calculator, echo

### **📡 Subscriptions - The Event System**
- **Purpose**: Real-time event delivery based on selectors
- **Mechanism**: Agents subscribe to breadcrumb patterns
- **Delivery**: SSE streams, webhooks, NATS JetStream
- **Flexibility**: Tag matching, schema matching, context matching

## 🔐 **Permission System**

### **Role-Based Access Control**
- **👑 Curator**: Full system access (manage agents, secrets, tenants)
- **✍️ Emitter**: Can create and update breadcrumbs
- **👀 Subscriber**: Can read breadcrumbs and subscribe to events

### **Multi-Tenancy**
- **🏢 Tenants**: Logical isolation boundaries
- **🔒 Scope**: Secrets can be global, workspace, or agent-scoped
- **🌐 Workspaces**: Logical groupings within tenants (tools, agents, ui, test)

## 🔄 **Data Flow Architecture**

### **1. Creation Flow**
```
Agent/Tool → Creates Breadcrumb → Stored in DB → Events Published → Subscribers Notified
```

### **2. Subscription Flow**
```
Agent → Defines Selector → Subscribes → New Matching Breadcrumbs → Real-time Events
```

### **3. Tool Integration Flow**
```
Agent → Invokes Tool → Tool Processes → Tool Creates Response Breadcrumb → Agent Receives
```

### **4. Secret Management Flow**
```
Curator → Creates Secret → Tool Configuration → Tool Uses Secret → Secure Operations
```

## 🎨 **Visual Dashboard Integration**

### **Node Types on Canvas**
- **📋 Breadcrumbs**: Blue rectangles (core data)
- **🤖 Agents**: Orange circles (actors)
- **🛠️ Tools**: Green squares (extensions)
- **🔐 Secrets**: Red rectangles (credentials)

### **Connection Types**
- **📡 Subscription Lines**: Agent → Breadcrumbs (based on selectors)
- **🛠️ Creation Lines**: Tool → Breadcrumbs (creation relationships)
- **🔐 Usage Lines**: Secret → Tool/Agent (configuration relationships)

## 🌐 **System Patterns I've Observed**

### **1. Tag-Based Organization**
```javascript
// Workspace organization
["workspace:tools", "workspace:agents", "workspace:ui", "workspace:test"]

// Functional organization  
["tool:request", "tool:response", "tool:config", "tool:catalog"]

// System organization
["system:hygiene", "system:stats", "internal:monitoring"]
```

### **2. Schema Evolution**
```javascript
// Versioned schemas for structured data
"tool.config.v1"
"agent.def.v1" 
"workflow.step.v1"
"user.profile.v1"
```

### **3. Context Patterns**
```javascript
// Rich context for relationships
{
  tool_name: "openrouter",
  secret_id: "uuid",
  configured_at: "timestamp",
  endpoint: "custom-url"
}
```

## 🚀 **Architectural Strengths**

### **1. Semantic Storage**
- Breadcrumbs store rich context, not just data
- Vector embeddings for semantic search
- Versioning and conflict resolution

### **2. Event-Driven Architecture**
- Real-time updates via SSE/NATS
- Subscription-based event delivery
- Scalable pub/sub patterns

### **3. Flexible Security**
- Multi-tenant isolation
- Role-based permissions
- Scoped secret management
- Audit trails

### **4. Tool Ecosystem**
- Plugin-like tool integration
- Secure credential management
- Standardized request/response patterns
- Health monitoring

## 🎯 **What Makes It Powerful**

### **1. Emergent Connections**
- Relationships emerge from data patterns
- No hardcoded integrations
- Self-organizing based on tags and context

### **2. Semantic Intelligence**
- Vector search for finding related content
- Context-aware matching
- Intelligent clustering and organization

### **3. Real-Time Collaboration**
- Multiple agents can work together
- Event streams keep everyone synchronized
- Shared context and knowledge base

### **4. Extensible Architecture**
- New tools integrate via standard patterns
- New schemas can be added dynamically
- New connection types emerge from data relationships

## 🔧 **Practical Understanding**

From implementing the secrets management system, I can see that RCRT is:

- **📊 Data-Centric**: Everything is a breadcrumb with rich context
- **🔄 Event-Driven**: Real-time updates via subscriptions
- **🔐 Security-First**: Proper isolation, encryption, and audit trails
- **🎨 Visual**: Rich dashboard for understanding relationships
- **🚀 Scalable**: Designed for multiple agents, tools, and workspaces

The system is essentially a **semantic knowledge graph** with **real-time collaboration** capabilities, **secure tool integration**, and **visual relationship mapping**.

Pretty sophisticated architecture! 🎉
