# RCRT Full Agentic System Architecture

This document illustrates how RCRT serves as the foundation for a complete agentic system where multiple tools, agents, and UI components interact through a unified interface.

## System Overview

```mermaid
graph TB
    subgraph "Human Interface Layer"
        User[👤 End User]
        DevPortal[🛠️ Developer Portal]
        Admin[👔 Admin Dashboard]
    end

    subgraph "Tool Layer (All Equal Citizens)"
        VB[Visual Builder<br/>- UI authoring<br/>- Component catalog<br/>- Live preview]
        Search[Search Tool<br/>- Web search<br/>- Knowledge base<br/>- Vector search]
        ImgGen[Image Gen Tool<br/>- DALL-E/Stable Diffusion<br/>- Asset management]
        DataTool[Data Analysis Tool<br/>- SQL queries<br/>- Visualizations]
        CodeTool[Code Execution Tool<br/>- Sandboxed runtime<br/>- Result capture]
        CustomTool[Custom Tools<br/>- Domain-specific<br/>- Legacy integrations]
    end

    subgraph "Agent Layer"
        Orchestrator[Orchestrator Agent<br/>- Event → Plan mapping<br/>- Tool coordination<br/>- Context management]
        TaskAgent[Task Agents<br/>- Specialized workers<br/>- Domain experts]
        LLMAgent[LLM Agent<br/>- Natural language<br/>- Intent parsing<br/>- Plan generation]
        MonitorAgent[Monitor Agent<br/>- Health checks<br/>- Performance<br/>- Alerts]
    end

    subgraph "SDK Layer"
        SDK[RCRT SDK<br/>- Unified client<br/>- Auth handling<br/>- SSE subscriptions<br/>- CRUD operations<br/>- applyPlan helper]
    end

    subgraph "RCRT Core (The Substrate)"
        API[REST API<br/>/breadcrumbs<br/>/search<br/>/acl]
        SSE[SSE Stream<br/>/events/stream<br/>Real-time updates]
        Auth[Auth/ACL<br/>JWT validation<br/>Row-level security]
        VecSearch[Vector Search<br/>ONNX embeddings<br/>Semantic queries]
        DB[(PostgreSQL<br/>Breadcrumbs<br/>History<br/>ACL rules)]
        EventBus[NATS<br/>Event distribution<br/>Pub/Sub]
    end

    subgraph "Breadcrumb Schemas (The Language)"
        UISchemas[UI Schemas<br/>ui.layout.v1<br/>ui.instance.v1<br/>ui.event.v1<br/>ui.plan.v1<br/>ui.state.v1<br/>ui.asset.v1]
        ToolSchemas[Tool Schemas<br/>tool.request.v1<br/>tool.response.v1<br/>tool.error.v1]
        AgentSchemas[Agent Schemas<br/>agent.task.v1<br/>agent.result.v1<br/>agent.status.v1]
    end

    %% User interactions
    User --> VB
    User --> Search
    User --> ImgGen
    DevPortal --> CustomTool
    Admin --> MonitorAgent

    %% All tools use SDK equally
    VB --> SDK
    Search --> SDK
    ImgGen --> SDK
    DataTool --> SDK
    CodeTool --> SDK
    CustomTool --> SDK

    %% All agents use SDK equally
    Orchestrator --> SDK
    TaskAgent --> SDK
    LLMAgent --> SDK
    MonitorAgent --> SDK

    %% SDK talks to RCRT
    SDK --> API
    SDK --> SSE
    SDK --> Auth
    SDK --> VecSearch

    %% RCRT internals
    API --> DB
    API --> EventBus
    EventBus --> SSE
    API --> Auth
    VecSearch --> DB

    %% Schema usage
    VB -.-> UISchemas
    Search -.-> ToolSchemas
    ImgGen -.-> ToolSchemas
    ImgGen -.-> UISchemas
    Orchestrator -.-> UISchemas
    LLMAgent -.-> AgentSchemas
    TaskAgent -.-> ToolSchemas

    style RCRT fill:#e1f5e1
    style SDK fill:#e1e5f5
    style VB fill:#f5e1e1
    style Orchestrator fill:#f5f5e1
```

## How Tools Interact (All Are Equal)

### 1. Visual Builder (A UI Tool)
```typescript
// Just another RCRT client that happens to render UI
const client = createClient({ baseUrl: '/api/rcrt' });

// Listen for events
client.startEventStream((evt) => {
  if (evt.schema_name === 'ui.event.v1') {
    // React to user interactions
  }
});

// Apply UI changes
await client.applyPlan({
  schema_name: 'ui.plan.v1',
  context: { actions: [...] }
});
```

### 2. Search Tool (A Compute Tool)
```typescript
// Exact same pattern
const client = createClient({ baseUrl: '/api/rcrt' });

// Listen for search requests
client.startEventStream((evt) => {
  if (evt.schema_name === 'tool.request.v1' && evt.context.tool === 'search') {
    const results = await performSearch(evt.context.query);
    
    // Write results as breadcrumbs
    await client.createBreadcrumb({
      schema_name: 'tool.response.v1',
      context: { tool: 'search', results }
    });
    
    // Optionally update UI
    await client.applyPlan({
      schema_name: 'ui.plan.v1',
      context: {
        actions: [{
          type: 'create_instance',
          instance: { 
            component_ref: 'SearchResults',
            props: { data: results }
          }
        }]
      }
    });
  }
});
```

### 3. Image Generation Tool
```typescript
// Still the same pattern
const client = createClient({ baseUrl: '/api/rcrt' });

client.startEventStream(async (evt) => {
  if (evt.schema_name === 'tool.request.v1' && evt.context.tool === 'image_gen') {
    const imageUrl = await generateImage(evt.context.prompt);
    
    // Store as asset
    const asset = await client.createBreadcrumb({
      schema_name: 'ui.asset.v1',
      context: { type: 'image', url: imageUrl, metadata: { prompt: evt.context.prompt } }
    });
    
    // Update UI to show image
    await client.applyPlan({
      schema_name: 'ui.plan.v1',
      context: {
        actions: [{
          type: 'create_instance',
          instance: {
            component_ref: 'Image',
            props: { src_tag: asset.id }
          }
        }]
      }
    });
  }
});
```

## Agent Architecture

### Orchestrator Agent (Traffic Controller)
```typescript
// The orchestrator coordinates between tools
const client = createClient({ baseUrl: '/api/rcrt' });

client.startEventStream(async (evt) => {
  if (evt.schema_name === 'ui.event.v1') {
    const { event_name, context } = evt.context;
    
    // Decide what to do based on event
    if (event_name === 'onSearch') {
      // Dispatch to search tool
      await client.createBreadcrumb({
        schema_name: 'tool.request.v1',
        context: { tool: 'search', query: context.query }
      });
    } else if (event_name === 'onGenerateImage') {
      // Dispatch to image tool
      await client.createBreadcrumb({
        schema_name: 'tool.request.v1',
        context: { tool: 'image_gen', prompt: context.prompt }
      });
    }
  }
  
  // Coordinate tool responses
  if (evt.schema_name === 'tool.response.v1') {
    // Update UI based on tool results
    const plan = buildUIUpdatePlan(evt);
    await client.applyPlan(plan);
  }
});
```

### LLM Agent (Natural Language Understanding)
```typescript
// LLM agent interprets natural language and generates plans
const client = createClient({ baseUrl: '/api/rcrt' });

client.startEventStream(async (evt) => {
  if (evt.schema_name === 'ui.event.v1' && evt.context.event_name === 'onChat') {
    const userMessage = evt.context.message;
    
    // Use LLM to understand intent
    const intent = await llm.parseIntent(userMessage);
    
    // Generate appropriate plan
    if (intent.type === 'search') {
      await client.createBreadcrumb({
        schema_name: 'tool.request.v1',
        context: { tool: 'search', query: intent.query }
      });
    } else if (intent.type === 'ui_modification') {
      const plan = await llm.generateUIPlan(intent);
      await client.applyPlan(plan);
    }
  }
});
```

## Key Design Principles

### 1. **Everything is a Breadcrumb Client**
- Visual Builder, Search Tool, Image Gen - all are peers
- They all read/write breadcrumbs and listen to SSE
- No tool has special privileges in the architecture

### 2. **Uniform Interface via SDK**
```typescript
// Every tool/agent uses the same SDK methods:
client.createBreadcrumb()     // Write data
client.searchBreadcrumbs()    // Query data
client.startEventStream()     // Subscribe to changes
client.applyPlan()           // Make UI changes
```

### 3. **Schema-Based Communication**
- Tools don't talk directly to each other
- They communicate via breadcrumb schemas
- RCRT is the event bus and source of truth

### 4. **Composable and Extensible**
- Add new tools by implementing the same interface
- Add new schemas for new capabilities
- Mix and match tools based on needs

## Real-World Example Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Visual Builder
    participant Orch as Orchestrator
    participant LLM as LLM Agent
    participant Search as Search Tool
    participant ImgGen as Image Tool
    participant RCRT

    User->>UI: "Find electric bikes and show me pictures"
    UI->>RCRT: create ui.event.v1 (chat message)
    RCRT-->>Orch: SSE: ui.event.v1
    Orch->>RCRT: create agent.task.v1 (parse intent)
    RCRT-->>LLM: SSE: agent.task.v1
    LLM->>LLM: Parse "search + images"
    LLM->>RCRT: create tool.request.v1 (search: electric bikes)
    LLM->>RCRT: create tool.request.v1 (images: electric bikes)
    RCRT-->>Search: SSE: tool.request.v1
    RCRT-->>ImgGen: SSE: tool.request.v1
    
    par Search execution
        Search->>Search: Query APIs
        Search->>RCRT: create tool.response.v1 (results)
    and Image generation
        ImgGen->>ImgGen: Generate images
        ImgGen->>RCRT: create ui.asset.v1 (image URLs)
        ImgGen->>RCRT: create tool.response.v1 (complete)
    end
    
    RCRT-->>Orch: SSE: tool.response.v1 (both)
    Orch->>RCRT: create ui.plan.v1 (render results + images)
    RCRT-->>UI: SSE: ui.plan.v1
    UI->>UI: Apply plan, render components
    UI->>User: Display results with images
```

## Why This Architecture Works

### 1. **Decoupled**
- Tools don't know about each other
- Can develop and deploy independently
- Easy to test in isolation

### 2. **Scalable**
- Add more tools without changing existing ones
- Horizontal scaling of individual tools
- RCRT handles coordination

### 3. **Debuggable**
- All communication is visible as breadcrumbs
- Full audit trail in PostgreSQL
- Can replay events for debugging

### 4. **Flexible**
- Tools can be serverless functions, containers, or processes
- Can be written in any language with HTTP client
- Can run anywhere with network access to RCRT

## Getting Started

### To Build a New Tool

1. **Use the SDK**
```typescript
import { createClient } from '@rcrt-builder/sdk';
const client = await createClient({ 
  baseUrl: 'https://your-rcrt.com/api',
  tokenEndpoint: '/auth/token' 
});
```

2. **Subscribe to Events**
```typescript
client.startEventStream((evt) => {
  if (evt.schema_name === 'tool.request.v1' && evt.context.tool === 'your_tool') {
    // Handle request
  }
});
```

3. **Write Results**
```typescript
await client.createBreadcrumb({
  schema_name: 'tool.response.v1',
  context: { tool: 'your_tool', result: data }
});
```

4. **Update UI (Optional)**
```typescript
await client.applyPlan({
  schema_name: 'ui.plan.v1',
  context: { actions: [...] }
});
```

That's it! Your tool is now part of the agentic system.

## Summary

RCRT provides the substrate (storage, events, auth, search) while tools and agents are equal citizens that:
- Read and write breadcrumbs
- Subscribe to real-time events
- Optionally update UI via plans

The Visual Builder is just one tool among many - special only in that it renders UI for humans. From RCRT's perspective, all tools are the same: authenticated clients that speak breadcrumbs.
