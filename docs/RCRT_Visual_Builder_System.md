# RCRT Visual Agent Builder System Design

## Overview
A pure RCRT-based visual agent builder where everything - including UI components, flows, agents, and even the builder itself - exists as breadcrumbs. The system enables agents to build other agents, with real-time collaboration and self-improvement capabilities.

## Core Principles
- **Everything is a Breadcrumb**: UI components, flows, agents, templates, even button states
- **No Local State**: Pure RCRT storage, no hybrid approach
- **Agent-Built Agents**: Agents can create, modify, and optimize other agents
- **Real-time Collaborative**: Multiple users/agents can edit simultaneously via SSE
- **Self-Documenting**: The system describes itself through breadcrumbs

## Architecture

### Tech Stack
- **Backend**: RCRT System (existing Rust implementation - untouched)
- **Frontend Runtime**: Node.js + TypeScript
- **UI Framework**: React + HeroUI (components as breadcrumbs)
- **Canvas**: React Flow or Rete.js
- **Agent Runtime**: TypeScript service connecting to RCRT via SSE
- **LLM Provider**: OpenRouter API

### System Layers
```
┌─────────────────────────────────────────┐
│         Visual Builder UI (React)        │
│         HeroUI Components as BCRs        │
├─────────────────────────────────────────┤
│      Agent Runtime (TypeScript)          │
│         SSE Event Processing             │
├─────────────────────────────────────────┤
│          RCRT Client Library             │
│         (TypeScript SDK)                 │
├─────────────────────────────────────────┤
│      RCRT Backend (Rust - Untouched)     │
│    PostgreSQL + pgvector + NATS          │
└─────────────────────────────────────────┘
```

## Breadcrumb Schemas

### LLM Node I/O Schemas (Standardized)

#### Input Schema: llm.messages.v1
```json
{
  "schema_name": "llm.messages.v1",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "role": { "enum": ["system", "user", "assistant"] },
      "content": { "type": "string" }
    },
    "required": ["role", "content"]
  }
}
```

#### Output Schema: llm.response.v1
```json
{
  "schema_name": "llm.response.v1",
  "type": "object",
  "properties": {
    "content": { "type": "string" },
    "model": { "type": "string" },
    "usage": {
      "type": "object",
      "properties": {
        "prompt_tokens": { "type": "number" },
        "completion_tokens": { "type": "number" },
        "total_tokens": { "type": "number" }
      }
    },
    "metadata": { "type": "object" }
  },
  "required": ["content"]
}
```

### Example: Pure LLM Nodes vs Context-Aware Agents

#### Pure LLM Pipeline (No Context)
```json
{
  "schema_name": "flow.definition.v1",
  "title": "Flow: Pure LLM Pipeline",
  "tags": ["flow:definition", "llm:pipeline", "stateless"],
  "context": {
    "nodes": [
      {
        "id": "classifier",
        "type": "ClassifierLLMNode",
        "config": {
          "model": "openrouter/openai/gpt-4o-mini",
          "categories": ["technical", "business", "support"],
          "temperature": 0.3
        }
      },
      {
        "id": "router",
        "type": "RouterLLMNode",
        "config": {
          "model": "openrouter/openai/gpt-4o-mini",
          "routes": [
            { "name": "tech", "description": "Technical" },
            { "name": "biz", "description": "Business" },
            { "name": "support", "description": "Support" }
          ]
        }
      }
    ],
    "connections": [
      {
        "from": { "node": "input", "port": "messages" },
        "to": { "node": "classifier", "port": "messages" }
      },
      {
        "from": { "node": "classifier", "port": "response" },
        "to": { "node": "router", "port": "messages" }
      }
    ]
  }
}
```

#### Context-Aware Agent Pipeline
```json
{
  "schema_name": "flow.definition.v1",
  "title": "Flow: Context-Aware Agent Pipeline",
  "tags": ["flow:definition", "agent:pipeline", "stateful"],
  "context": {
    "nodes": [
      {
        "id": "research_agent",
        "type": "AgentNode",
        "config": {
          "subscriptions": [
            { "tags": ["workspace:research", "data:customer"] },
            { "schema": "knowledge.base.v1" }
          ],
          "llm_config": {
            "model": "openrouter/google/gemini-2.5-flash",
            "temperature": 0.7
          }
        }
      },
      {
        "id": "synthesis_llm",
        "type": "SummarizerLLMNode",
        "config": {
          "model": "openrouter/openai/gpt-4o",
          "summary_type": "key_insights"
        }
      }
    ],
    "connections": [
      {
        "from": { "node": "trigger", "port": "event" },
        "to": { "node": "research_agent", "port": "trigger" }
      },
      {
        "from": { "node": "research_agent", "port": "emitter" },
        "to": { "node": "synthesis_llm", "port": "messages" },
        "transform": "breadcrumb_to_messages"
      }
    ]
  }
}
```

### Node Instance Breadcrumbs (Runtime Configurations)

#### LLM Node Instance
```json
{
  "schema_name": "node.instance.v1",
  "title": "Classifier for Customer Requests",
  "tags": ["node:instance", "llm:classifier", "workspace:project-123", "flow:main"],
  "context": {
    "node_id": "classifier_001",
    "template": "node.template:ClassifierLLMNode",
    "position": { "x": 100, "y": 200 },
    "config": {
      "model": "openrouter/openai/gpt-4o-mini",
      "categories": ["technical", "billing", "feature-request"],
      "temperature": 0.3,
      "system_prompt": "Classify customer requests accurately"
    },
    "connections": {
      "inputs": {
        "messages": { "from": "input_node.output" }
      },
      "outputs": {
        "response": { "to": ["router_node.messages", "logger_node.data"] }
      }
    },
    "metadata": {
      "created_by": "agent:builder",
      "created_at": "2024-01-01T00:00:00Z",
      "version": 1
    }
  }
}
```

### Node SDK and Development Structure

#### Node SDK (`@rcrt-builder/node-sdk`)
```typescript
// packages/node-sdk/src/index.ts
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

export interface NodePort {
  id: string;
  type: 'messages' | 'response' | 'event' | 'data' | 'operation';
  schema?: string;
  multiple?: boolean;
}

export interface NodeConfig {
  [key: string]: any;
}

export interface NodeContext {
  breadcrumb_id: string;
  config: NodeConfig;
  rcrtClient: RcrtClientEnhanced;
  workspace: string;
}

export interface NodeExecutionResult {
  outputs: Record<string, any>;
  breadcrumbs?: Array<{
    schema: string;
    title: string;
    context: any;
    tags?: string[];
  }>;
  metadata?: Record<string, any>;
}

// Base class for all nodes
export abstract class BaseNode {
  protected context: NodeContext;
  protected rcrtClient: RcrtClientEnhanced;
  
  constructor(context: NodeContext) {
    this.context = context;
    this.rcrtClient = context.rcrtClient;
  }
  
  // Define node metadata
  abstract getMetadata(): {
    type: string;
    category: string;
    icon: string;
    inputs: NodePort[];
    outputs: NodePort[];
  };
  
  // Validate configuration
  abstract validateConfig(config: NodeConfig): boolean;
  
  // Execute node logic
  abstract execute(inputs: Record<string, any>): Promise<NodeExecutionResult>;
  
  // Helper methods
  protected async getBreadcrumb(id: string) {
    return this.rcrtClient.getBreadcrumb(id);
  }
  
  protected async createBreadcrumb(data: any) {
    return this.rcrtClient.createBreadcrumb({
      ...data,
      tags: [...(data.tags || []), this.context.workspace]
    });
  }
  
  protected async searchWorkspace(params: any) {
    return this.rcrtClient.searchBreadcrumbs({
      ...params,
      tag: this.context.workspace
    });
  }
}

// Decorator for auto-registration
export function RegisterNode(template: any) {
  return function(target: any) {
    // Auto-register node template as breadcrumb on first use
    NodeRegistry.register(target, template);
  };
}
```

#### Example LLM Node Implementation
```typescript
// packages/nodes/llm/src/base-llm-node.ts
import { BaseNode, RegisterNode, NodeExecutionResult } from '@rcrt-builder/node-sdk';
import { OpenRouterClient } from '@rcrt-builder/llm-client';

@RegisterNode({
  schema_name: "node.template.v1",
  title: "Base LLM Node",
  tags: ["node:template", "llm", "base"],
  context: {
    node_type: "LLMNode",
    category: "llm",
    icon: "🧠",
    color: "#9353d3"
  }
})
export class LLMNode extends BaseNode {
  private llmClient: OpenRouterClient;
  
  constructor(context: any) {
    super(context);
    this.llmClient = new OpenRouterClient(
      process.env.OPENROUTER_API_KEY
    );
  }
  
  getMetadata() {
    return {
      type: 'LLMNode',
      category: 'llm',
      icon: '🧠',
      inputs: [
        { id: 'messages', type: 'messages', schema: 'llm.messages.v1' }
      ],
      outputs: [
        { id: 'response', type: 'response', schema: 'llm.response.v1' },
        { id: 'tool_calls', type: 'data', schema: 'llm.tool_calls.v1', optional: true }
      ]
    };
  }
  
  validateConfig(config: any): boolean {
    return !!(config.model && config.temperature !== undefined);
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const { messages } = inputs;
    
    // Add system prompt if configured
    const enrichedMessages = this.context.config.system_prompt
      ? [
          { role: 'system', content: this.context.config.system_prompt },
          ...messages
        ]
      : messages;
    
    // Call LLM
    const response = await this.llmClient.complete({
      model: this.context.config.model,
      messages: enrichedMessages,
      temperature: this.context.config.temperature,
      max_tokens: this.context.config.max_tokens || 4096,
      tools: this.context.config.tools
    });
    
    // Return standardized output
    return {
      outputs: {
        response: {
          content: response.content,
          model: this.context.config.model,
          usage: response.usage,
          metadata: {
            node_id: this.context.breadcrumb_id,
            timestamp: new Date().toISOString()
          }
        },
        tool_calls: response.tool_calls
      },
      metadata: {
        execution_time_ms: response.latency
      }
    };
  }
}
```

#### Node Project Structure
```
packages/
├── node-sdk/                 # Core SDK for building nodes
│   ├── src/
│   │   ├── index.ts         # Base classes and interfaces
│   │   ├── registry.ts      # Node registration system
│   │   └── helpers.ts       # Utility functions
│   └── package.json
│
├── nodes/                    # Node implementations
│   ├── llm/                 # LLM nodes family
│   │   ├── src/
│   │   │   ├── base-llm-node.ts
│   │   │   ├── classifier-node.ts
│   │   │   ├── summarizer-node.ts
│   │   │   ├── router-node.ts
│   │   │   └── code-gen-node.ts
│   │   └── package.json
│   │
│   ├── agent/               # Agent nodes
│   │   ├── src/
│   │   │   ├── agent-node.ts
│   │   │   └── supervisor-node.ts
│   │   └── package.json
│   │
│   ├── breadcrumb/          # RCRT operation nodes
│   │   ├── src/
│   │   │   └── breadcrumb-node.ts  # Single unified node for ALL operations
│   │   └── package.json
│   │
│   └── utility/             # Utility nodes
│       ├── src/
│       │   ├── context-injector.ts
│       │   ├── transformer.ts
│       │   └── logger.ts
│       └── package.json
│
└── node-registry/           # Central registry
    ├── src/
    │   └── index.ts        # Auto-discovery and registration
    └── breadcrumbs.json    # Exported node templates
```

### Node Registration and Discovery

#### Node Registry Breadcrumb
```json
{
  "schema_name": "node.registry.v1",
  "title": "Available Nodes Registry",
  "tags": ["system:registry", "nodes:available"],
  "context": {
    "nodes": [
      {
        "type": "LLMNode",
        "package": "@rcrt-builder/nodes-llm",
        "template_id": "node.template:LLMNode",
        "category": "llm",
        "variants": ["classifier", "summarizer", "router", "codegen"]
      },
      {
        "type": "AgentNode",
        "package": "@rcrt-builder/nodes-agent",
        "template_id": "node.template:AgentNode",
        "category": "agent"
      }
    ],
    "auto_discover": true,
    "scan_paths": ["packages/nodes/*/dist"]
  }
}
```

### Node Lifecycle and Hot-Reloading

#### Node Development Workflow
```typescript
// packages/node-sdk/src/dev-server.ts
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { watch } from 'chokidar';
import { NodeRegistry } from './registry';

export class NodeDevServer {
  private rcrtClient: RcrtClientEnhanced;
  private watcher: any;
  
  async start(options: {
    watchPaths: string[];
    rcrtUrl: string;
    autoRegister: boolean;
  }) {
    this.rcrtClient = new RcrtClientEnhanced(options.rcrtUrl);
    
    // Watch for node changes
    this.watcher = watch(options.watchPaths, {
      persistent: true,
      ignoreInitial: false
    });
    
    this.watcher.on('change', async (path: string) => {
      console.log(`Node changed: ${path}`);
      
      // Clear module cache
      delete require.cache[require.resolve(path)];
      
      // Reload node
      const NodeClass = require(path).default;
      
      if (options.autoRegister) {
        // Update node template breadcrumb
        await this.registerNode(NodeClass);
      }
      
      // Notify all connected flows
      await this.notifyFlowsOfUpdate(NodeClass.name);
    });
  }
  
  private async registerNode(NodeClass: any) {
    const instance = new NodeClass({ 
      breadcrumb_id: 'dev',
      config: {},
      rcrtClient: this.rcrtClient,
      workspace: 'dev'
    });
    
    const metadata = instance.getMetadata();
    const template = NodeClass.__template || {};
    
    // Create or update node template breadcrumb
    const existing = await this.rcrtClient.searchBreadcrumbs({
      tag: `node:template:${metadata.type}`
    });
    
    if (existing.length > 0) {
      await this.rcrtClient.updateBreadcrumb(
        existing[0].id,
        existing[0].version,
        {
          context: {
            ...template.context,
            ...metadata,
            last_updated: new Date().toISOString()
          }
        }
      );
    } else {
      await this.rcrtClient.createBreadcrumb({
        schema_name: 'node.template.v1',
        title: `Node Template: ${metadata.type}`,
        tags: ['node:template', metadata.category, metadata.type],
        context: {
          ...template.context,
          ...metadata
        }
      });
    }
  }
  
  private async notifyFlowsOfUpdate(nodeType: string) {
    // Create update notification breadcrumb
    await this.rcrtClient.createBreadcrumb({
      schema_name: 'node.update.v1',
      title: `Node Updated: ${nodeType}`,
      tags: ['node:update', 'dev:hot-reload'],
      context: {
        node_type: nodeType,
        timestamp: new Date().toISOString(),
        action: 'reload'
      }
    });
  }
}
```

#### Node Testing Framework (Real RCRT)
```typescript
// packages/node-sdk/src/testing.ts
import { BaseNode, NodeExecutionResult } from './index';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

export class NodeTestHarness {
  private node: BaseNode;
  private rcrtClient: RcrtClientEnhanced;
  private testWorkspace: string;
  
  constructor(NodeClass: typeof BaseNode, config: any) {
    // Use real RCRT client with test workspace
    this.rcrtClient = new RcrtClientEnhanced(
      process.env.RCRT_URL || 'http://localhost:8081'
    );
    this.testWorkspace = `test:${Date.now()}`;
    
    this.node = new NodeClass({
      breadcrumb_id: 'test-node',
      config,
      rcrtClient: this.rcrtClient,
      workspace: this.testWorkspace
    });
  }
  
  async testExecution(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    // Validate inputs match expected schema
    const metadata = this.node.getMetadata();
    for (const input of metadata.inputs) {
      if (!input.optional && !(input.id in inputs)) {
        throw new Error(`Missing required input: ${input.id}`);
      }
    }
    
    // Execute node with real RCRT backend
    const result = await this.node.execute(inputs);
    
    // Validate outputs match expected schema
    for (const output of metadata.outputs) {
      if (!output.optional && !(output.id in result.outputs)) {
        throw new Error(`Missing required output: ${output.id}`);
      }
    }
    
    return result;
  }
  
  async cleanup() {
    // Clean up test breadcrumbs
    const testBreadcrumbs = await this.rcrtClient.searchBreadcrumbs({
      tag: this.testWorkspace
    });
    for (const b of testBreadcrumbs) {
      await this.rcrtClient.deleteBreadcrumb(b.id, b.version);
    }
  }
}
```

### Secrets Management Node

#### Secrets Provider Node
```typescript
// packages/nodes/security/src/secrets-node.ts
import { BaseNode, RegisterNode, NodeExecutionResult } from '@rcrt-builder/node-sdk';

@RegisterNode({
  schema_name: "node.template.v1",
  title: "Secrets Provider Node",
  tags: ["node:template", "security", "secrets"],
  context: {
    node_type: "SecretsNode",
    category: "security",
    icon: "🔐",
    color: "#dc2626"
  }
})
export class SecretsNode extends BaseNode {
  private secretsCache: Map<string, string> = new Map();
  
  getMetadata() {
    return {
      type: 'SecretsNode',
      category: 'security',
      icon: '🔐',
      inputs: [
        { id: 'request', type: 'data', schema: 'secrets.request.v1' }
      ],
      outputs: [
        { id: 'credentials', type: 'data', schema: 'secrets.credentials.v1' },
        { id: 'passthrough', type: 'data', description: 'Original request for chaining' }
      ]
    };
  }
  
  validateConfig(config: any): boolean {
    return !!config.secrets_breadcrumb_id || !!config.secrets_selector;
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const { request } = inputs;
    const requestedKeys = request.keys || [];
    const credentials: Record<string, any> = {};
    
    // Load secrets from RCRT if not cached
    if (this.secretsCache.size === 0) {
      await this.loadSecrets();
    }
    
    // Provide requested secrets
    for (const key of requestedKeys) {
      const secret = this.secretsCache.get(key);
      if (!secret && !request.optional?.includes(key)) {
        throw new Error(`Required secret not found: ${key}`);
      }
      if (secret) {
        credentials[key] = secret;
      }
    }
    
    // Log access (without exposing secrets)
    await this.createBreadcrumb({
      schema_name: 'secrets.access.v1',
      title: 'Secrets Accessed',
      tags: ['security:audit', 'secrets:access'],
      context: {
        requested_keys: requestedKeys,
        provided_keys: Object.keys(credentials),
        requesting_node: request.node_id,
        timestamp: new Date().toISOString()
      }
    });
    
    return {
      outputs: {
        credentials,
        passthrough: request
      }
    };
  }
  
  private async loadSecrets() {
    // Load from RCRT's native secrets service (encrypted at rest)
    // Using vault ID or tag from config
    const vaultIdOrTag = this.context.config.vault_id || 
                         this.context.config.vault_tag ||
                         this.context.config.secrets_breadcrumb_id;
    
    if (vaultIdOrTag) {
      // Fetch and decrypt secrets using native service
      const secrets = await this.rcrtClient.getSecretsFromVault(
        vaultIdOrTag,
        `Node ${this.context.breadcrumb_id} loading secrets`
      );
      this.cacheSecrets(secrets);
    } 
    // Or load by selector (for backward compatibility)
    else if (this.context.config.secrets_selector) {
      const secretsBreadcrumbs = await this.rcrtClient.searchBreadcrumbs({
        ...this.context.config.secrets_selector,
        tag: this.context.workspace
      });
      
      for (const sb of secretsBreadcrumbs) {
        const full = await this.getBreadcrumb(sb.id);
        this.cacheSecrets(full.context.secrets);
      }
    }
  }
  
  private cacheSecrets(secrets: Record<string, string>) {
    for (const [key, value] of Object.entries(secrets)) {
      this.secretsCache.set(key, value);
    }
  }
}
```

#### Project Secrets Vault Breadcrumb

The secrets vault breadcrumb stores **references** to encrypted secrets in RCRT's native secrets service.
Actual secret values are encrypted at rest using envelope encryption (AES-256-GCM + XChaCha20-Poly1305).

```json
{
  "schema_name": "secrets.vault.v1",
  "title": "Project Secrets Vault",
  "tags": ["secrets:vault", "workspace:project-123"],
  "context": {
    "secret_ids": {
      "OPENROUTER_API_KEY": "26c230f0-fa1c-4405-998b-0082687f3a8b",
      "BRAVE_SEARCH_API_KEY": "cd7effd3-4f48-426f-88f6-be8d08814e4b",
      "LANGFUSE_PUBLIC_KEY": "1fcb0bbb-7d84-4a3f-8c71-4e9c3e8f9a12",
      "LANGFUSE_SECRET_KEY": "9359f958-2a1e-4b8f-9e7d-3c4b5d6e7f8a",
      "POSTGRES_CONNECTION": "d4eba9d6-8e9f-4a1b-9c2d-3e4f5a6b7c8d",
      "STRIPE_SECRET_KEY": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "TWILIO_AUTH_TOKEN": "98765432-dcba-4321-0987-654321fedcba"
    },
    "metadata": {
      "created_at": "2024-01-01T00:00:00Z",
      "created_by": "admin",
      "encryption": "aes-256-gcm",
      "rotation_schedule": "90d"
    }
  }
}
```

### Example: Wrapping External Services as Nodes (With Secrets)

#### Brave Search Node (Using Secrets)
```typescript
// packages/nodes/search/src/brave-search-node.ts
import { BaseNode, RegisterNode, NodeExecutionResult } from '@rcrt-builder/node-sdk';
import fetch from 'node-fetch';

@RegisterNode({
  schema_name: "node.template.v1",
  title: "Brave Search Node",
  tags: ["node:template", "search", "brave"],
  context: {
    node_type: "BraveSearchNode",
    category: "search",
    icon: "🔍",
    color: "#fb542b"
  }
})
export class BraveSearchNode extends BaseNode {
  getMetadata() {
    return {
      type: 'BraveSearchNode',
      category: 'search',
      icon: '🔍',
      inputs: [
        { id: 'query', type: 'data', schema: 'search.query.v1' },
        { id: 'credentials', type: 'data', schema: 'secrets.credentials.v1' },
        { id: 'options', type: 'data', schema: 'search.options.v1', optional: true }
      ],
      outputs: [
        { id: 'results', type: 'data', schema: 'search.results.v1' },
        { id: 'metadata', type: 'data', schema: 'search.metadata.v1' }
      ]
    };
  }
  
  validateConfig(config: any): boolean {
    return true; // No hardcoded API key needed
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const { query, credentials, options = {} } = inputs;
    
    // Get API key from credentials input
    const apiKey = credentials.BRAVE_SEARCH_API_KEY;
    if (!apiKey) {
      throw new Error('BRAVE_SEARCH_API_KEY not provided in credentials');
    }
    
    // Call Brave Search API
    const response = await fetch('https://api.search.brave.com/res/v1/web/search', {
      method: 'GET',
      headers: {
        'X-Subscription-Token': apiKey,
        'Accept': 'application/json'
      },
      params: {
        q: query,
        count: options.count || 10,
        ...options
      }
    });
    
    const data = await response.json();
    
    // Store search results as breadcrumb for audit/history
    await this.createBreadcrumb({
      schema_name: 'search.history.v1',
      title: `Search: ${query}`,
      tags: ['search:history', 'brave'],
      context: {
        query,
        results_count: data.web?.results?.length || 0,
        timestamp: new Date().toISOString()
      }
    });
    
    return {
      outputs: {
        results: data.web?.results || [],
        metadata: {
          query,
          total: data.web?.total || 0,
          source: 'brave'
        }
      }
    };
  }
}
```

#### Langfuse Observability Node
```typescript
// packages/nodes/observability/src/langfuse-node.ts
import { BaseNode, RegisterNode, NodeExecutionResult } from '@rcrt-builder/node-sdk';
import { Langfuse } from 'langfuse';

@RegisterNode({
  schema_name: "node.template.v1",
  title: "Langfuse Trace Node",
  tags: ["node:template", "observability", "langfuse"],
  context: {
    node_type: "LangfuseNode",
    category: "observability",
    icon: "📊",
    color: "#8b5cf6"
  }
})
export class LangfuseNode extends BaseNode {
  private langfuse: Langfuse;
  
  constructor(context: any) {
    super(context);
    this.langfuse = new Langfuse({
      publicKey: this.context.config.public_key,
      secretKey: this.context.config.secret_key,
      baseUrl: this.context.config.base_url
    });
  }
  
  getMetadata() {
    return {
      type: 'LangfuseNode',
      category: 'observability',
      icon: '📊',
      inputs: [
        { id: 'trace_data', type: 'data', schema: 'trace.data.v1' },
        { id: 'metadata', type: 'data', schema: 'trace.metadata.v1', optional: true }
      ],
      outputs: [
        { id: 'trace_id', type: 'data' },
        { id: 'passthrough', type: 'data' }
      ]
    };
  }
  
  validateConfig(config: any): boolean {
    return !!(config.public_key && config.secret_key);
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const { trace_data, metadata = {} } = inputs;
    
    // Create Langfuse trace
    const trace = this.langfuse.trace({
      name: metadata.name || 'rcrt-flow',
      metadata: {
        ...metadata,
        workspace: this.context.workspace,
        node_id: this.context.breadcrumb_id
      },
      input: trace_data.input,
      output: trace_data.output
    });
    
    // Store trace reference in RCRT
    await this.createBreadcrumb({
      schema_name: 'trace.reference.v1',
      title: `Trace: ${trace.id}`,
      tags: ['trace:langfuse'],
      context: {
        trace_id: trace.id,
        langfuse_url: `${this.context.config.base_url}/trace/${trace.id}`,
        timestamp: new Date().toISOString()
      }
    });
    
    return {
      outputs: {
        trace_id: trace.id,
        passthrough: trace_data  // Pass data through for chaining
      }
    };
  }
}
```

#### Database Query Node
```typescript
// packages/nodes/database/src/postgres-node.ts
import { BaseNode, RegisterNode, NodeExecutionResult } from '@rcrt-builder/node-sdk';
import { Pool } from 'pg';

@RegisterNode({
  schema_name: "node.template.v1",
  title: "PostgreSQL Query Node",
  tags: ["node:template", "database", "postgres"],
  context: {
    node_type: "PostgresNode",
    category: "database",
    icon: "🐘",
    color: "#336791"
  }
})
export class PostgresNode extends BaseNode {
  private pool: Pool;
  
  constructor(context: any) {
    super(context);
    // Connection can be stored as encrypted breadcrumb
    this.pool = new Pool({
      connectionString: this.context.config.connection_string
    });
  }
  
  getMetadata() {
    return {
      type: 'PostgresNode',
      category: 'database',
      icon: '🐘',
      inputs: [
        { id: 'query', type: 'data', schema: 'sql.query.v1' },
        { id: 'params', type: 'data', schema: 'sql.params.v1', optional: true }
      ],
      outputs: [
        { id: 'results', type: 'data', schema: 'sql.results.v1' },
        { id: 'row_count', type: 'data' }
      ]
    };
  }
  
  validateConfig(config: any): boolean {
    return !!config.connection_string;
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const { query, params = [] } = inputs;
    
    try {
      const result = await this.pool.query(query, params);
      
      // Log query execution to RCRT
      await this.createBreadcrumb({
        schema_name: 'database.query.v1',
        title: 'Query Executed',
        tags: ['database:postgres', 'query:log'],
        context: {
          query: query.substring(0, 100), // Truncate for security
          row_count: result.rowCount,
          execution_time_ms: result.duration
        }
      });
      
      return {
        outputs: {
          results: result.rows,
          row_count: result.rowCount
        }
      };
    } catch (error: any) {
      // Log error to RCRT
      await this.createBreadcrumb({
        schema_name: 'database.error.v1',
        title: 'Query Failed',
        tags: ['database:postgres', 'error'],
        context: {
          error: error.message,
          query: query.substring(0, 100)
        }
      });
      
      throw error;
    }
  }
  
  async destroy() {
    await this.pool.end();
  }
}
```

### Example Flow: Secrets-Connected Pipeline

```json
{
  "schema_name": "flow.definition.v1",
  "title": "Flow: Secure Multi-Service Pipeline",
  "tags": ["flow:definition", "secure", "multi-service"],
  "context": {
    "nodes": [
      {
        "id": "secrets_provider",
        "type": "SecretsNode",
        "config": {
          "secrets_selector": {
            "schema_name": "secrets.vault.v1",
            "tag": "workspace:project-123"
          }
        },
        "position": { "x": 100, "y": 200 }
      },
      {
        "id": "search_request",
        "type": "InputNode",
        "config": {
          "schema": "search.request.v1"
        },
        "position": { "x": 100, "y": 100 }
      },
      {
        "id": "brave_search",
        "type": "BraveSearchNode",
        "config": {},
        "position": { "x": 300, "y": 150 }
      },
      {
        "id": "llm_processor",
        "type": "LLMNode",
        "config": {
          "model": "openrouter/openai/gpt-4o",
          "system_prompt": "Summarize search results"
        },
        "position": { "x": 500, "y": 150 }
      },
      {
        "id": "langfuse_trace",
        "type": "LangfuseNode",
        "config": {},
        "position": { "x": 700, "y": 150 }
      },
      {
        "id": "postgres_store",
        "type": "PostgresNode",
        "config": {},
        "position": { "x": 900, "y": 150 }
      }
    ],
    "connections": [
      {
        "from": { "node": "search_request", "port": "output" },
        "to": { "node": "secrets_provider", "port": "request" },
        "transform": {
          "type": "add_keys_request",
          "keys": ["BRAVE_SEARCH_API_KEY", "OPENROUTER_API_KEY", "LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY", "POSTGRES_CONNECTION"]
        }
      },
      {
        "from": { "node": "secrets_provider", "port": "credentials" },
        "to": { "node": "brave_search", "port": "credentials" }
      },
      {
        "from": { "node": "secrets_provider", "port": "passthrough" },
        "to": { "node": "brave_search", "port": "query" }
      },
      {
        "from": { "node": "brave_search", "port": "results" },
        "to": { "node": "llm_processor", "port": "messages" },
        "transform": { "type": "results_to_messages" }
      },
      {
        "from": { "node": "secrets_provider", "port": "credentials" },
        "to": { "node": "llm_processor", "port": "credentials" }
      },
      {
        "from": { "node": "llm_processor", "port": "response" },
        "to": { "node": "langfuse_trace", "port": "trace_data" }
      },
      {
        "from": { "node": "secrets_provider", "port": "credentials" },
        "to": { "node": "langfuse_trace", "port": "credentials" }
      },
      {
        "from": { "node": "langfuse_trace", "port": "passthrough" },
        "to": { "node": "postgres_store", "port": "query" },
        "transform": { "type": "build_insert_query" }
      },
      {
        "from": { "node": "secrets_provider", "port": "credentials" },
        "to": { "node": "postgres_store", "port": "credentials" }
      }
    ],
    "metadata": {
      "description": "All services get credentials from a single secrets node",
      "benefits": [
        "Single source of truth for credentials",
        "Easy key rotation (update one breadcrumb)",
        "Audit trail of which nodes access which secrets",
        "No hardcoded keys in node configurations",
        "Workspace-scoped secrets isolation"
      ]
    }
  }
}
```

### Secrets Node Benefits

1. **Centralized Management**: One breadcrumb holds all project secrets
2. **Access Control**: RCRT's ACLs control who can read/write secrets
3. **Audit Trail**: Every secret access is logged as a breadcrumb
4. **Key Rotation**: Update secrets in one place, all nodes get new keys
5. **Environment Isolation**: Different secrets per workspace/environment
6. **Encryption**: RCRT handles encryption at rest
7. **No Hardcoding**: Nodes never store credentials directly

### Secret Injection Pattern

```
Input → Secrets Node → Service Node
         ↓
         credentials
```

Every service node receives credentials as an input, making the flow:
- **Explicit**: You can see which nodes need secrets
- **Testable**: Inject test credentials for testing
- **Secure**: Credentials never stored in node configs
- **Flexible**: Switch between secret sources easily

### 1. UI Component Breadcrumbs

#### HeroUI Component Template
```json
{
  "schema_name": "ui.component.v1",
  "title": "UI Component: Button",
  "tags": ["ui:component", "heroui:button", "interactive"],
  "context": {
    "component_type": "Button",
    "library": "heroui",
    "props_schema": {
      "color": { "enum": ["primary", "secondary", "success", "warning", "danger"] },
      "size": { "enum": ["sm", "md", "lg"] },
      "variant": { "enum": ["solid", "bordered", "light", "flat", "faded", "shadow"] },
      "isDisabled": { "type": "boolean" },
      "isLoading": { "type": "boolean" }
    },
    "render_template": "HeroUIButton",
    "event_handlers": ["onClick", "onPress"],
    "children_allowed": true
  }
}
```

#### Component Instance
```json
{
  "schema_name": "ui.instance.v1",
  "title": "Button Instance: Submit Form",
  "tags": ["ui:instance", "flow:123", "node:456"],
  "context": {
    "component_ref": "ui.component.button",
    "instance_id": "btn_submit_789",
    "props": {
      "color": "primary",
      "size": "lg",
      "children": "Submit"
    },
    "position": { "x": 200, "y": 150 },
    "parent_flow": "flow_123",
    "bindings": {
      "onClick": {
        "action": "emit_breadcrumb",
        "payload": { "tags": ["form:submitted"] }
      }
    }
  }
}
```

### 2. Node Template Breadcrumbs

#### Core Node Types

**Note**: The unified BreadcrumbNode is the ONLY implementation. No separate role nodes, no fallbacks - one node handles ALL RCRT operations through configuration.

```json
{
  "schema_name": "node.template.v1",
  "title": "Node Template: Breadcrumb (Unified)",
  "tags": ["node:template", "core", "v2.0.0"],
  "context": {
    "node_type": "BreadcrumbNode",
    "category": "core",
    "icon": "📝",
    "color": "#0072f5",
    "description": "Single node for all RCRT operations - replaces separate role nodes",
    "ports": {
      "inputs": [
        { "id": "trigger", "type": "event", "description": "Trigger operation" },
        { "id": "data", "type": "data", "description": "Input data for create/update" }
      ],
      "outputs": [
        { "id": "result", "type": "data", "description": "Operation result" },
        { "id": "context", "type": "data", "schema": "context.view", "color": "#0072f5" },
        { "id": "full", "type": "data", "schema": "full.view", "color": "#7828c8" },
        { "id": "events", "type": "event", "schema": "event.stream", "color": "#f5a524" }
      ]
    },
    "config_ui": {
      "fields": [
        {
          "name": "operation",
          "type": "select",
          "options": ["create", "read", "update", "delete", "search", "vector_search", "subscribe"],
          "default": "read",
          "description": "CRUD operation to perform"
        },
        {
          "name": "workspace",
          "type": "text",
          "pattern": "^workspace:.*",
          "required": true
        },
        {
          "name": "role",
          "type": "select",
          "options": ["emitter", "subscriber", "curator"],
          "description": "Required role for operation",
          "dynamic": "based_on_operation"
        }
      ]
    },
    "executor": {
      "runtime": "typescript",
      "module": "@rcrt-builder/executors",
      "handler": "BreadcrumbNodeExecutor"
    }
  }
}
```

#### LLM Node Template (Standardized I/O)
```json
{
  "schema_name": "node.template.v1",
  "title": "Node Template: LLM",
  "tags": ["node:template", "core", "llm"],
  "context": {
    "node_type": "LLMNode",
    "category": "llm",
    "icon": "🧠",
    "color": "#9353d3",
    "ports": {
      "inputs": [
        { 
          "id": "messages", 
          "type": "messages",
          "schema": "llm.messages.v1",
          "description": "Array of {role, content} messages"
        }
      ],
      "outputs": [
        {
          "id": "response",
          "type": "response",
          "schema": "llm.response.v1",
          "description": "LLM response with content and metadata"
        },
        {
          "id": "tool_calls",
          "type": "tools",
          "schema": "llm.tool_calls.v1",
          "description": "Tool calls if tools were provided",
          "optional": true
        }
      ]
    },
    "config_ui": {
      "fields": [
        {
          "name": "provider",
          "type": "select",
          "options": ["openrouter", "openai", "anthropic", "local"],
          "default": "openrouter"
        },
        {
          "name": "model",
          "type": "select",
          "dynamic": "based_on_provider",
          "options": [
            "google/gemini-2.5-flash",
            "openai/gpt-4o",
            "openai/gpt-4o-mini",
            "google/gemini-pro-1.5"
          ]
        },
        {
          "name": "system_prompt",
          "type": "textarea",
          "rows": 5,
          "placeholder": "Optional system prompt"
        },
        {
          "name": "temperature",
          "type": "slider",
          "min": 0,
          "max": 2,
          "step": 0.1,
          "default": 0.7
        },
        {
          "name": "max_tokens",
          "type": "number",
          "default": 4096
        },
        {
          "name": "tools",
          "type": "json",
          "placeholder": "Optional tools schema",
          "optional": true
        }
      ]
    },
    "executor": {
      "runtime": "typescript",
      "module": "@rcrt-builder/llm",
      "handler": "LLMNodeExecutor"
    }
  }
}
```

#### Agent Node Template (Context-Aware LLM Wrapper)
```json
{
  "schema_name": "node.template.v1",
  "title": "Node Template: Agent",
  "tags": ["node:template", "core", "agent"],
  "context": {
    "node_type": "AgentNode",
    "category": "agent",
    "icon": "🤖",
    "color": "#7828c8",
    "description": "Agent = Subscribed Context + LLM + Decision Execution",
    "ports": {
      "inputs": [
        { "id": "trigger", "type": "event", "description": "Triggering event" }
      ],
      "outputs": [
        { "id": "emitter", "type": "operation" },
        { "id": "curator", "type": "operation", "condition": "has_role" }
      ]
    },
    "config_ui": {
      "fields": [
        {
          "name": "subscriptions",
          "type": "array",
          "items": {
            "type": "selector",
            "properties": {
              "tags": { "type": "array", "items": "string" },
              "schema": { "type": "string" },
              "context_path": { "type": "string" }
            }
          },
          "description": "Breadcrumb selectors this agent subscribes to for context"
        },
        {
          "name": "llm_config",
          "type": "object",
          "description": "LLM configuration (model, temperature, etc.)"
        }
      ]
    },
    "internal_behavior": {
      "description": "Agent automatically enriches LLM messages with subscribed breadcrumbs",
      "steps": [
        "1. Receive trigger event",
        "2. Fetch all breadcrumbs matching subscriptions",
        "3. Build context-enriched messages: system prompt + context breadcrumbs + trigger",
        "4. Call LLM with enriched messages",
        "5. Execute decision based on LLM response"
      ]
    }
  }
}
```

#### Context Injector Node (Explicit Context Builder)
```json
{
  "schema_name": "node.template.v1",
  "title": "Node Template: Context Injector",
  "tags": ["node:template", "utility", "context"],
  "context": {
    "node_type": "ContextInjectorNode",
    "category": "utility",
    "icon": "📎",
    "color": "#52525b",
    "description": "Explicitly fetches and injects breadcrumb context into messages",
    "ports": {
      "inputs": [
        { "id": "messages", "type": "messages", "schema": "llm.messages.v1" },
        { "id": "selectors", "type": "selectors", "description": "Breadcrumb selectors to fetch" }
      ],
      "outputs": [
        { "id": "enriched_messages", "type": "messages", "schema": "llm.messages.v1" }
      ]
    },
    "behavior": {
      "description": "Fetches breadcrumbs and prepends them to messages",
      "example_output": [
        { "role": "system", "content": "Context: [breadcrumb1, breadcrumb2...]" },
        { "role": "user", "content": "original message" }
      ]
    }
  }
}
```

#### Specialized LLM Nodes (Same I/O Interface)

##### Classifier LLM Node
```json
{
  "schema_name": "node.template.v1",
  "title": "Node Template: Classifier LLM",
  "tags": ["node:template", "llm", "classifier"],
  "context": {
    "node_type": "ClassifierLLMNode",
    "extends": "LLMNode",
    "icon": "🏷️",
    "color": "#f5a524",
    "config_ui": {
      "inherits": "LLMNode",
      "additional_fields": [
        {
          "name": "categories",
          "type": "array",
          "items": "string",
          "description": "Classification categories"
        },
        {
          "name": "output_format",
          "type": "select",
          "options": ["single_label", "multi_label", "confidence_scores"]
        }
      ]
    },
    "system_prompt_template": "Classify the input into one of these categories: {categories}. Return only the category name."
  }
}
```

##### Summarizer LLM Node
```json
{
  "schema_name": "node.template.v1",
  "title": "Node Template: Summarizer LLM",
  "tags": ["node:template", "llm", "summarizer"],
  "context": {
    "node_type": "SummarizerLLMNode",
    "extends": "LLMNode",
    "icon": "📄",
    "color": "#17c964",
    "config_ui": {
      "inherits": "LLMNode",
      "additional_fields": [
        {
          "name": "summary_type",
          "type": "select",
          "options": ["brief", "detailed", "bullet_points", "key_insights"]
        },
        {
          "name": "max_length",
          "type": "number",
          "default": 500,
          "description": "Maximum summary length in characters"
        }
      ]
    },
    "system_prompt_template": "Summarize the following content in {summary_type} format, maximum {max_length} characters."
  }
}
```

##### Code Generator LLM Node
```json
{
  "schema_name": "node.template.v1",
  "title": "Node Template: Code Generator LLM",
  "tags": ["node:template", "llm", "code"],
  "context": {
    "node_type": "CodeGenLLMNode",
    "extends": "LLMNode",
    "icon": "💻",
    "color": "#0072f5",
    "config_ui": {
      "inherits": "LLMNode",
      "additional_fields": [
        {
          "name": "language",
          "type": "select",
          "options": ["typescript", "python", "rust", "go", "javascript"]
        },
        {
          "name": "style_guide",
          "type": "textarea",
          "placeholder": "Optional coding style guidelines"
        }
      ]
    },
    "system_prompt_template": "Generate {language} code. Follow these style guidelines: {style_guide}. Return only code, no explanations."
  }
}
```

##### Router LLM Node
```json
{
  "schema_name": "node.template.v1",
  "title": "Node Template: Router LLM",
  "tags": ["node:template", "llm", "router"],
  "context": {
    "node_type": "RouterLLMNode",
    "extends": "LLMNode",
    "icon": "🔀",
    "color": "#f31260",
    "config_ui": {
      "inherits": "LLMNode",
      "additional_fields": [
        {
          "name": "routes",
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "description": { "type": "string" },
              "conditions": { "type": "string" }
            }
          }
        }
      ]
    },
    "system_prompt_template": "Route this request to one of these destinations: {routes}. Return only the route name.",
    "output_processing": "route_name_to_port_activation"
  }
}
```

### 3. Flow Definition Breadcrumbs

```json
{
  "schema_name": "flow.definition.v1",
  "title": "Flow: Customer Research Pipeline",
  "tags": ["flow:definition", "workspace:123", "editable"],
  "context": {
    "flow_id": "flow_research_001",
    "version": 3,
    "nodes": [
      {
        "id": "node_trigger",
        "type": "EventStreamNode",
        "position": { "x": 100, "y": 200 },
        "config": {
          "mode": "sse",
          "filters": { "tags": ["user:query"] }
        }
      },
      {
        "id": "node_agent",
        "type": "AgentNode",
        "position": { "x": 400, "y": 200 },
        "config": {
          "model": "openrouter/google/gemini-2.5-flash",
          "system_prompt": "You are a research agent...",
          "owned_tags": ["owned_by:researcher_001"]
        }
      },
      {
        "id": "node_breadcrumb",
        "type": "BreadcrumbNode",
        "position": { "x": 700, "y": 200 },
        "config": {
          "operation": "create",
          "workspace": "workspace:123"
        }
      }
    ],
    "connections": [
      {
        "id": "conn_1",
        "from": { "node": "node_trigger", "port": "subscriber" },
        "to": { "node": "node_agent", "port": "trigger" }
      },
      {
        "id": "conn_2",
        "from": { "node_agent", "port": "emitter" },
        "to": { "node_breadcrumb", "port": "emitter" }
      }
    ],
    "viewport": {
      "x": 0,
      "y": 0,
      "zoom": 1.0
    },
    "metadata": {
      "created_by": "user_123",
      "created_at": "2025-01-15T10:00:00Z",
      "last_modified_by": "agent.optimizer",
      "execution_stats": {
        "total_runs": 156,
        "avg_latency_ms": 234,
        "success_rate": 0.98
      }
    }
  }
}
```

### 4. Agent Definition Breadcrumbs

```json
{
  "schema_name": "agent.def.v1",
  "title": "Agent: Research Assistant",
  "tags": ["agent:def", "workspace:123", "auto-scaling"],
  "context": {
    "agent_id": "agent.researcher",
    "model": "openrouter/openai/gpt-4o-mini",
    "system_prompt": "You are a research assistant...",
    "capabilities": {
      "can_create_breadcrumbs": true,
      "can_update_own": true,
      "can_delete_own": true,
      "can_spawn_agents": false
    },
    "subscriptions": {
      "selectors": [
        { "any_tags": ["workspace:123", "research:request"] },
        { "schema_name": "tool.result.v1" }
      ]
    },
    "emits": {
      "tags": ["research:complete"],
      "schemas": ["research.finding.v1"]
    },
    "memory": {
      "type": "breadcrumb",
      "tags": ["agent.researcher:memory"],
      "ttl_hours": 24
    },
    "scaling": {
      "min_instances": 1,
      "max_instances": 5,
      "scale_on": "queue_depth",
      "threshold": 10
    }
  }
}
```

### 5. Tool Catalog Breadcrumbs

```json
{
  "schema_name": "tools.catalog.v1",
  "title": "Tool Catalog: Research Tools",
  "tags": ["tools:catalog", "workspace:123"],
  "context": {
    "tools": [
      {
        "name": "web_search",
        "description": "Search the web for information",
        "input_schema": {
          "type": "object",
          "properties": {
            "query": { "type": "string" },
            "max_results": { "type": "number", "default": 5 }
          }
        },
        "executor": "tool.runner.web"
      },
      {
        "name": "vector_search",
        "description": "Search breadcrumbs by semantic similarity",
        "input_schema": {
          "type": "object",
          "properties": {
            "query": { "type": "string" },
            "workspace": { "type": "string" },
            "limit": { "type": "number", "default": 10 }
          }
        },
        "executor": "native:rcrt"
      }
    ]
  }
}
```

### 6. Meta-Agent Breadcrumbs

```json
{
  "schema_name": "agent.def.v1",
  "title": "Agent: Builder",
  "tags": ["agent:def", "meta:agent", "builder"],
  "context": {
    "agent_id": "agent.builder",
    "model": "openrouter/google/gemini-2.5-flash",
    "system_prompt": "You build other agents by creating agent.def breadcrumbs...",
    "capabilities": {
      "can_spawn_agents": true,
      "can_modify_agents": true,
      "can_create_flows": true
    },
    "subscriptions": {
      "selectors": [
        { "any_tags": ["agent:request"] },
        { "any_tags": ["optimize:request"] }
      ]
    },
    "tools": [
      {
        "name": "create_agent",
        "creates": "agent.def.v1"
      },
      {
        "name": "create_flow",
        "creates": "flow.definition.v1"
      },
      {
        "name": "analyze_performance",
        "reads": ["agent:metrics", "flow:metrics"]
      }
    ]
  }
}
```

## Workspace & Tenant Management Components (SHOULD HAVE)

### 5. Tenant Management System
```typescript
// packages/ui/src/components/Workspace/TenantManager.tsx
export const TenantManager: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const switchTenant = async (tenantId: string) => {
    const tenant = await client.getTenant(tenantId);
    setCurrentTenant(tenant);
    
    // Update all breadcrumb queries to use new tenant
    await updateWorkspaceContext(tenantId);
    
    // Reload UI with new tenant context
    window.location.reload();
  };
  
  const createTenant = async (name: string, config: TenantConfig) => {
    const tenantId = `tenant-${slugify(name)}-${Date.now()}`;
    await client.createOrUpdateTenant(tenantId, name);
    
    // Initialize tenant with default workspace
    await client.createBreadcrumb({
      title: `Workspace: ${name}`,
      tags: [`tenant:${tenantId}`, 'workspace:default'],
      schema_name: 'workspace.def.v1',
      context: {
        tenant_id: tenantId,
        quotas: config.quotas,
        settings: config.settings
      }
    });
    
    await switchTenant(tenantId);
  };
  
  return (
    <Dropdown>
      <Dropdown.Trigger>
        <Button variant="flat">
          {currentTenant?.name || 'Select Workspace'}
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Menu>
        {tenants.map(tenant => (
          <Dropdown.Item 
            key={tenant.id}
            onClick={() => switchTenant(tenant.id)}
          >
            {tenant.name}
          </Dropdown.Item>
        ))}
        <Dropdown.Item onClick={() => setShowCreateModal(true)}>
          + Create New Workspace
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
};
```

### 6. Visual Selector Builder
```typescript
// packages/ui/src/components/Selectors/SelectorBuilder.tsx
export const VisualSelectorBuilder: React.FC<{
  onSave: (selector: Selector) => void
}> = ({ onSave }) => {
  const [selector, setSelector] = useState<Selector>({});
  const [preview, setPreview] = useState<Breadcrumb[]>([]);
  const [isLive, setIsLive] = useState(false);
  
  // Live preview of matching breadcrumbs
  useEffect(() => {
    if (isLive && Object.keys(selector).length > 0) {
      const updatePreview = async () => {
        const matches = await client.searchBreadcrumbs(selector);
        setPreview(matches);
      };
      updatePreview();
      const interval = setInterval(updatePreview, 2000);
      return () => clearInterval(interval);
    }
  }, [selector, isLive]);
  
  return (
    <div className="selector-builder">
      <BuilderPanel>
        <Section title="Tags">
          <TagInput 
            placeholder="Add tags to match (ANY)"
            onAdd={(tag) => setSelector({
              ...selector,
              any_tags: [...(selector.any_tags || []), tag]
            })}
          />
          <TagList>
            {selector.any_tags?.map(tag => (
              <Tag key={tag} onRemove={() => removeTag(tag)}>
                {tag}
              </Tag>
            ))}
          </TagList>
        </Section>
        
        <Section title="Schema">
          <SchemaSelector 
            value={selector.schema_name}
            onChange={(schema) => setSelector({
              ...selector,
              schema_name: schema
            })}
          />
        </Section>
        
        <Section title="Context Path">
          <JsonPathInput 
            placeholder="$.context.status"
            value={selector.context_path}
            onChange={(path) => setSelector({
              ...selector,
              context_path: path
            })}
          />
        </Section>
      </BuilderPanel>
      
      <PreviewPanel>
        <PreviewHeader>
          <h3>Live Preview ({preview.length} matches)</h3>
          <Switch 
            checked={isLive}
            onChange={setIsLive}
            label="Live"
          />
        </PreviewHeader>
        <BreadcrumbList>
          {preview.map(bc => (
            <BreadcrumbCard key={bc.id} breadcrumb={bc} />
          ))}
        </BreadcrumbList>
      </PreviewPanel>
      
      <Actions>
        <Button onClick={() => onSave(selector)} color="primary">
          Save Selector
        </Button>
      </Actions>
    </div>
  );
};
```

## Module Structure

```
rcrt-visual-builder/
├── packages/
│   ├── core/                    # Core types and utilities
│   │   ├── src/
│   │   │   ├── schemas/         # Breadcrumb schema definitions
│   │   │   ├── types/           # TypeScript types
│   │   │   └── validators/      # Schema validators
│   │   └── package.json
│   │
│   ├── management/               # NEW! Management UI components
│   │   ├── src/
│   │   │   ├── AgentPanel/      # Agent management
│   │   │   ├── DLQMonitor/      # DLQ dashboard
│   │   │   ├── ACLViewer/       # Security viewer
│   │   │   ├── SystemHealth/    # Unified health panel
│   │   │   ├── TenantManager/   # Workspace management
│   │   │   └── SelectorBuilder/ # Visual selector builder
│   │   └── package.json
│   │
│   ├── runtime/                  # Agent runtime
│   │   ├── src/
│   │   │   ├── executor/        # Node executors
│   │   │   ├── agent/           # Agent loop implementation
│   │   │   ├── tools/           # Tool implementations
│   │   │   └── sse/             # SSE client
│   │   └── package.json
│   │
│   ├── ui/                       # Visual builder UI
│   │   ├── src/
│   │   │   ├── components/      # React components
│   │   │   ├── canvas/          # Flow canvas
│   │   │   ├── nodes/           # Node components
│   │   │   ├── breadcrumbs/     # UI as breadcrumbs
│   │   │   └── hooks/           # React hooks for RCRT
│   │   └── package.json
│   │
│   └── heroui-breadcrumbs/      # HeroUI components as breadcrumbs
│       ├── src/
│       │   ├── components/      # Breadcrumb-wrapped HeroUI
│       │   ├── renderer/        # Breadcrumb to React renderer
│       │   └── sync/            # Two-way binding
│       └── package.json
│
├── apps/
│   ├── builder/                  # Main visual builder app
│   │   ├── pages/
│   │   ├── public/
│   │   └── package.json
│   │
│   └── agent-runner/            # Standalone agent runner
│       ├── src/
│       └── package.json
│
├── scripts/
│   ├── bootstrap.ts             # Initialize breadcrumb templates
│   ├── migrate.ts               # Migration utilities
│   └── dev.ts                   # Development helpers
│
├── docker-compose.yml           # Local dev environment
├── package.json                 # Monorepo root
├── pnpm-workspace.yaml         # PNPM workspace config
└── tsconfig.json               # TypeScript config
```

## Implementation Phases

### Phase 1: Foundation (Week 1-2) ✅ COMPLETED
- [x] Set up monorepo structure with pnpm
- [x] Create TypeScript SDK wrapper for RCRT (Enhanced SDK with full features)
- [x] Implement breadcrumb schemas and validators
- [x] Build SSE client with reconnection logic (Auto-reconnect tested)
- [x] Create basic agent runtime loop (AgentExecutor tested)
- [x] Add full CRUD operations for all RCRT resources
- [x] Implement unified BreadcrumbNode (no separate role nodes, no fallbacks!)

### Phase 2: Core Management UI (Week 2) 🚀 MUST HAVE - NEW!
- [ ] **Agent Management Panel**
  - [ ] Agent registry showing all active agents
  - [ ] Agent inspector for node-to-agent linking
  - [ ] Role management UI (emitter/subscriber/curator)
  - [ ] Agent lifecycle controls (start/stop/restart)
- [ ] **DLQ Monitoring Dashboard**
  - [ ] Real-time failure monitoring
  - [ ] One-click retry interface
  - [ ] Error analysis and debugging tools
  - [ ] Auto-alerting for high failure rates
- [ ] **ACL Security Viewer**
  - [ ] Permission visualization
  - [ ] Access control matrix
  - [ ] Security audit trail
  - [ ] Grant/revoke UI

### Phase 3: UI Components as Breadcrumbs (Week 3)
- [ ] Implement HeroUI component wrappers
- [ ] Build breadcrumb-to-React renderer
- [ ] Create two-way data binding system
- [ ] Implement component instance management
- [ ] Add real-time collaborative editing

### Phase 4: Visual Canvas (Week 3-4)
- [ ] Integrate React Flow or Rete.js
- [ ] Build node components with ports
- [ ] Implement drag-and-drop from palette
- [ ] Add connection validation
- [ ] Create viewport synchronization
- [ ] **Link visual nodes to RCRT agents** (NEW!)

### Phase 5: Workspace & Tenant Management (Week 4) 📋 SHOULD HAVE
- [ ] **Tenant Management System**
  - [ ] Workspace switcher UI
  - [ ] Multi-organization support
  - [ ] Resource quota management
  - [ ] Tenant isolation controls
- [ ] **Selector Builder Interface**
  - [ ] Visual selector composition
  - [ ] Live preview of matching breadcrumbs
  - [ ] Drag-and-drop selector creation
  - [ ] Subscription management UI

### Phase 6: Agent Integration (Week 5)
- [ ] Build agent executor nodes
- [ ] Implement LLM integration via OpenRouter
- [ ] Create tool runner system
- [ ] Add context injection pipeline
- [ ] Implement agent memory management
- [ ] **Connect to Agent CRUD for lifecycle** (NEW!)

### Phase 7: Meta-Agents & Optimization (Week 6)
- [ ] Create agent builder agent
- [ ] Implement flow optimizer agent
- [ ] Build performance analyzer
- [ ] Add self-modification capabilities
- [ ] Create agent spawning system

### Phase 8: Polish & Deploy (Week 7)
- [ ] Add authentication via JWT
- [ ] Create onboarding flow
- [ ] Build template library
- [ ] Performance optimization
- [ ] Deploy to production

## Core Management Components (NEW!)

### 1. Agent Management Panel
```typescript
// packages/ui/src/components/AgentManagement/AgentPanel.tsx
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { useState, useEffect } from 'react';
import { Card, Table, Badge, Button, Modal } from '@heroui/react';

export const AgentManagementPanel: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [nodeAgentMap, setNodeAgentMap] = useState<Map<string, string>>(new Map());
  
  useEffect(() => {
    // Poll for agent updates
    const interval = setInterval(async () => {
      const agentList = await client.listAgents();
      setAgents(agentList);
      
      // Update node-to-agent mappings
      updateNodeMappings(agentList);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  const handleRoleUpdate = async (agentId: string, newRoles: string[]) => {
    await client.createOrUpdateAgent(agentId, newRoles);
    toast.success(`Agent ${agentId} roles updated`);
  };
  
  const handleAgentDelete = async (agentId: string) => {
    if (confirm(`Delete agent ${agentId}?`)) {
      await client.deleteAgent(agentId);
      // Remove from visual canvas
      removeAgentNode(agentId);
    }
  };
  
  return (
    <Card className="agent-panel">
      <Card.Header>
        <h3>Active Agents ({agents.length})</h3>
        <Badge color={agents.length > 0 ? 'success' : 'warning'}>
          {agents.length > 0 ? 'ONLINE' : 'NO AGENTS'}
        </Badge>
      </Card.Header>
      <Card.Body>
        <Table>
          <Table.Header>
            <Table.Column>Agent ID</Table.Column>
            <Table.Column>Roles</Table.Column>
            <Table.Column>Created</Table.Column>
            <Table.Column>Actions</Table.Column>
          </Table.Header>
          <Table.Body>
            {agents.map(agent => (
              <Table.Row key={agent.id}>
                <Table.Cell>{agent.id}</Table.Cell>
                <Table.Cell>
                  <RoleBadges roles={agent.roles} />
                </Table.Cell>
                <Table.Cell>{formatDate(agent.created_at)}</Table.Cell>
                <Table.Cell>
                  <Button.Group size="sm">
                    <Button onClick={() => setSelectedAgent(agent)}>Inspect</Button>
                    <Button onClick={() => linkToNode(agent.id)}>Link</Button>
                    <Button color="error" onClick={() => handleAgentDelete(agent.id)}>
                      Delete
                    </Button>
                  </Button.Group>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Card.Body>
      
      {selectedAgent && (
        <AgentInspectorModal 
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onRoleUpdate={handleRoleUpdate}
        />
      )}
    </Card>
  );
};
```

### 2. DLQ Monitoring Dashboard
```typescript
// packages/ui/src/components/DLQMonitor/DLQDashboard.tsx
export const DLQMonitorDashboard: React.FC = () => {
  const [dlqItems, setDlqItems] = useState<DLQItem[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [autoRetry, setAutoRetry] = useState(true);
  const [alertThreshold] = useState(10);
  
  const checkDLQ = async () => {
    const items = await client.listDlq();
    setDlqItems(items);
    
    // Auto-alert on high failure rate
    if (items.length > alertThreshold) {
      showNotification({
        type: 'error',
        title: 'High Failure Rate',
        message: `${items.length} items in DLQ!`,
        action: {
          label: 'Retry All',
          onClick: () => retryAll()
        }
      });
    }
    
    // Auto-retry if enabled
    if (autoRetry && items.length > 0) {
      await retryFailedItems(items.filter(i => 
        i.last_error.includes('timeout') || 
        i.last_error.includes('network')
      ));
    }
  };
  
  const retryAll = async () => {
    setIsRetrying(true);
    const results = await Promise.allSettled(
      dlqItems.map(item => client.retryDlqItem(item.id))
    );
    
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    toast.success(`Retried ${succeeded}/${dlqItems.length} items`);
    
    await checkDLQ();
    setIsRetrying(false);
  };
  
  useEffect(() => {
    checkDLQ();
    const interval = setInterval(checkDLQ, 30000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="dlq-dashboard">
      <StatusBar>
        <StatusIndicator 
          status={dlqItems.length === 0 ? 'healthy' : 'warning'}
          label={`DLQ: ${dlqItems.length} items`}
        />
        <Switch 
          checked={autoRetry} 
          onChange={setAutoRetry}
          label="Auto-Retry"
        />
        <Button 
          onClick={retryAll}
          loading={isRetrying}
          disabled={dlqItems.length === 0}
          color="primary"
        >
          Retry All
        </Button>
      </StatusBar>
      
      {dlqItems.length > 0 && (
        <ErrorList>
          {dlqItems.map(item => (
            <ErrorCard key={item.id}>
              <ErrorDetails>
                <span>Agent: {item.agent_id}</span>
                <span>URL: {item.url}</span>
                <ErrorMessage>{item.last_error}</ErrorMessage>
              </ErrorDetails>
              <Button 
                size="sm"
                onClick={() => client.retryDlqItem(item.id)}
              >
                Retry
              </Button>
            </ErrorCard>
          ))}
        </ErrorList>
      )}
    </div>
  );
};
```

### 3. ACL Security Viewer
```typescript
// packages/ui/src/components/Security/ACLViewer.tsx
export const ACLSecurityViewer: React.FC = () => {
  const [acls, setAcls] = useState<ACL[]>([]);
  const [selectedBreadcrumb, setSelectedBreadcrumb] = useState<string | null>(null);
  const [permissionMatrix, setPermissionMatrix] = useState<Map<string, Set<string>>>(new Map());
  
  useEffect(() => {
    loadACLs();
  }, []);
  
  const loadACLs = async () => {
    const aclList = await client.listAcls();
    setAcls(aclList);
    
    // Build permission matrix
    const matrix = new Map<string, Set<string>>();
    aclList.forEach(acl => {
      const key = `${acl.breadcrumb_id}:${acl.grantee_agent_id || 'public'}`;
      if (!matrix.has(key)) {
        matrix.set(key, new Set());
      }
      acl.actions.forEach(action => matrix.get(key)!.add(action));
    });
    setPermissionMatrix(matrix);
  };
  
  const checkPermission = (breadcrumbId: string, agentId: string, action: string): boolean => {
    const key = `${breadcrumbId}:${agentId}`;
    return permissionMatrix.get(key)?.has(action) || false;
  };
  
  return (
    <div className="acl-viewer">
      <Tabs>
        <Tab title="Permission Matrix">
          <PermissionMatrix>
            <Table>
              <Table.Header>
                <Table.Column>Breadcrumb</Table.Column>
                <Table.Column>Agent/Grantee</Table.Column>
                <Table.Column>Read</Table.Column>
                <Table.Column>Write</Table.Column>
                <Table.Column>Delete</Table.Column>
                <Table.Column>Grant</Table.Column>
              </Table.Header>
              <Table.Body>
                {Array.from(permissionMatrix.entries()).map(([key, actions]) => {
                  const [breadcrumbId, grantee] = key.split(':');
                  return (
                    <Table.Row key={key}>
                      <Table.Cell>{breadcrumbId.substring(0, 8)}...</Table.Cell>
                      <Table.Cell>{grantee}</Table.Cell>
                      <Table.Cell>
                        <PermissionBadge granted={actions.has('read')} />
                      </Table.Cell>
                      <Table.Cell>
                        <PermissionBadge granted={actions.has('write')} />
                      </Table.Cell>
                      <Table.Cell>
                        <PermissionBadge granted={actions.has('delete')} />
                      </Table.Cell>
                      <Table.Cell>
                        <PermissionBadge granted={actions.has('grant')} />
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
          </PermissionMatrix>
        </Tab>
        
        <Tab title="Audit Trail">
          <AuditLog>
            {acls.map(acl => (
              <AuditEntry key={acl.id}>
                <Timestamp>{formatDate(acl.created_at)}</Timestamp>
                <Action>
                  Granted {acl.actions.join(', ')} on {acl.breadcrumb_id} 
                  to {acl.grantee_agent_id || 'public'}
                </Action>
              </AuditEntry>
            ))}
          </AuditLog>
        </Tab>
        
        <Tab title="Security Alerts">
          <SecurityAlerts acls={acls} />
        </Tab>
      </Tabs>
    </div>
  );
};
```

### 4. System Health Panel (Unified Dashboard)
```typescript
// packages/ui/src/components/Dashboard/SystemHealth.tsx
export const SystemHealthPanel: React.FC = () => {
  const [metrics, setMetrics] = useState({
    agents: { total: 0, active: 0, failed: 0 },
    dlq: { count: 0, oldest: null },
    breadcrumbs: { total: 0, rate: 0 },
    acls: { total: 0, recent: 0 }
  });
  
  const updateMetrics = async () => {
    const [agents, dlq, acls] = await Promise.all([
      client.listAgents(),
      client.listDlq(),
      client.listAcls()
    ]);
    
    setMetrics({
      agents: {
        total: agents.length,
        active: agents.filter(a => isRecent(a.created_at)).length,
        failed: dlq.filter(d => d.agent_id).length
      },
      dlq: {
        count: dlq.length,
        oldest: dlq[0]?.created_at || null
      },
      breadcrumbs: await calculateBreadcrumbMetrics(),
      acls: {
        total: acls.length,
        recent: acls.filter(a => isRecent(a.created_at)).length
      }
    });
  };
  
  return (
    <Grid.Container gap={2}>
      <Grid xs={6}>
        <MetricCard 
          title="Agents"
          value={metrics.agents.total}
          status={metrics.agents.failed > 0 ? 'warning' : 'success'}
          detail={`${metrics.agents.active} active`}
        />
      </Grid>
      <Grid xs={6}>
        <MetricCard 
          title="DLQ"
          value={metrics.dlq.count}
          status={metrics.dlq.count > 10 ? 'error' : metrics.dlq.count > 0 ? 'warning' : 'success'}
          detail={metrics.dlq.oldest ? `Oldest: ${formatAge(metrics.dlq.oldest)}` : 'Clear'}
        />
      </Grid>
      <Grid xs={6}>
        <MetricCard 
          title="Breadcrumbs"
          value={metrics.breadcrumbs.total}
          status="info"
          detail={`${metrics.breadcrumbs.rate}/min`}
        />
      </Grid>
      <Grid xs={6}>
        <MetricCard 
          title="Security"
          value={metrics.acls.total}
          status="info"
          detail={`${metrics.acls.recent} recent grants`}
        />
      </Grid>
    </Grid.Container>
  );
};
```

## Key Components

### 1. RCRT Client (Enhanced SDK)
```typescript
// @rcrt-builder/sdk (packages/sdk) - Canonical SDK
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

export class RCRTClient extends RcrtClientEnhanced {
  // Full feature set already implemented and tested:
  
  // Breadcrumb operations
  async createBreadcrumb(body: BreadcrumbCreate, idempotencyKey?: string): Promise<{id: string}>;
  async updateBreadcrumb(id: string, version: number, updates: BreadcrumbUpdate): Promise<Breadcrumb>;
  async deleteBreadcrumb(id: string): Promise<void>;
  async getBreadcrumb(id: string): Promise<Breadcrumb>;
  async getBreadcrumbFull(id: string): Promise<Breadcrumb>;
  async getBreadcrumbHistory(id: string): Promise<BreadcrumbHistory[]>;
  
  // Search and discovery
  async searchBreadcrumbs(params: SearchParams): Promise<Breadcrumb[]>;
  async vectorSearch(params: VectorSearchParams): Promise<Breadcrumb[]>;
  
  // Agent CRUD operations (NEW!)
  async listAgents(): Promise<Array<{id: string, roles: string[], created_at: string}>>;
  async getAgent(agentId: string): Promise<{id: string, roles: string[], created_at: string}>;
  async createOrUpdateAgent(agentId: string, roles: string[]): Promise<{ok: boolean}>;
  async deleteAgent(agentId: string): Promise<{ok: boolean}>;
  
  // Tenant CRUD operations (NEW!)
  async listTenants(): Promise<Array<{id: string, name: string, created_at: string}>>;
  async getTenant(tenantId: string): Promise<{id: string, name: string, created_at: string}>;
  async createOrUpdateTenant(tenantId: string, name: string): Promise<{ok: boolean}>;
  async updateTenant(tenantId: string, name: string): Promise<{ok: boolean}>;
  async deleteTenant(tenantId: string): Promise<{ok: boolean}>;
  
  // ACL operations (NEW!)
  async listAcls(): Promise<Array<{
    id: string, breadcrumb_id: string, grantee_agent_id: string | null,
    actions: string[], created_at: string
  }>>;
  
  // Selector operations (NEW!)
  async createSelectorSubscription(selector: Selector): Promise<{id: string}>;
  async listSelectors(): Promise<Selector[]>;
  async updateSelector(selectorId: string, selector: Selector): Promise<{ok: boolean}>;
  async deleteSelector(selectorId: string): Promise<{ok: boolean}>;
  
  // DLQ operations (NEW!)
  async listDlq(): Promise<Array<{
    id: string, agent_id: string, url: string, payload: any,
    last_error: string, created_at: string
  }>>;
  async deleteDlqItem(dlqId: string): Promise<{ok: boolean}>;
  async retryDlqItem(dlqId: string): Promise<{requeued: boolean}>;
  
  // Secrets operations (Native RCRT service)
  async createSecret(name: string, value: string, scope?: SecretScope): Promise<{id: string}>;
  async getSecret(secretId: string): Promise<{value: string}>;
  async listSecrets(scope?: SecretScope): Promise<Array<{id: string, name: string, created_at: string}>>;
  async updateSecret(secretId: string, value: string): Promise<{ok: boolean}>;
  async deleteSecret(secretId: string): Promise<{ok: boolean}>;
  
  // Subscriptions with auto-reconnect
  startEventStream(
    onEvent: (event: BreadcrumbEvent) => void,
    options?: { reconnectDelay?: number; filters?: Selector }
  ): () => void;
  
  // Batch operations for efficiency
  async batchCreate(breadcrumbs: BreadcrumbCreate[]): Promise<{id: string}[]>;
  async batchGet(ids: string[], view?: 'context' | 'full'): Promise<Breadcrumb[]>;
  
  // Helper methods
  async getWorkspaceBreadcrumbs(workspaceTag: string): Promise<Breadcrumb[]>;
  async getAgentDefinitions(workspaceTag?: string): Promise<Breadcrumb[]>;
  async getFlowDefinitions(workspaceTag?: string): Promise<Breadcrumb[]>;
}
```

### 2. UI Component Renderer
```typescript
// packages/heroui-breadcrumbs/src/renderer/ComponentRenderer.tsx
export const ComponentRenderer: React.FC<{ breadcrumb: UIComponentBreadcrumb }> = ({ breadcrumb }) => {
  const { component_type, props, bindings } = breadcrumb.context;
  
  const Component = HeroUIComponents[component_type];
  
  const handleEvent = (eventName: string, ...args: any[]) => {
    const binding = bindings[eventName];
    if (binding?.action === 'emit_breadcrumb') {
      rcrtClient.createBreadcrumb(binding.payload);
    }
  };
  
  return <Component {...props} {...createEventHandlers(bindings, handleEvent)} />;
};
```

### 3. Agent Executor (Tested Implementation)
```typescript
// packages/runtime/src/agent/AgentExecutor.ts
import { RcrtClientEnhanced, BreadcrumbEvent } from '@rcrt-builder/sdk';

export class AgentExecutor {
  private agentDef: any;
  private rcrtClient: RcrtClientEnhanced;
  private llmClient: OpenRouterClient;
  private sseCleanup?: () => void;

  async start(): Promise<void> {
    // Subscribe to events with auto-reconnect
    this.sseCleanup = this.rcrtClient.startEventStream(
      async (event: BreadcrumbEvent) => {
        await this.processEvent(event);
      },
      {
        reconnectDelay: 5000,
        filters: this.agentDef.context?.subscriptions?.selectors?.[0]
      }
    );
  }

  async processEvent(event: BreadcrumbEvent): Promise<void> {
    // Skip ping events (they don't have breadcrumb_ids)
    if (event.type === 'ping' || !event.breadcrumb_id) {
      return;
    }
    
    // 1. Fetch triggering breadcrumb and context
    const breadcrumb = await this.rcrtClient.getBreadcrumb(event.breadcrumb_id);
    const context = await this.rcrtClient.getWorkspaceBreadcrumbs(this.extractWorkspace(breadcrumb.tags));
    
    // 2. Call LLM with context
    const decision = await this.llmClient.complete({
      model: this.agentDef.context.model,
      systemPrompt: this.agentDef.context.system_prompt,
      messages: [{ role: 'user', content: JSON.stringify({ trigger: breadcrumb, context }) }],
      tools: this.agentDef.context.tools
    });
    
    // 3. Execute decisions (with action filtering)
    const result = JSON.parse(decision.content);
    if (result.action !== 'none') {
      await this.executeDecision(result);
    }
  }
  
  stop(): void {
    this.sseCleanup?.();
  }
}
```

### 4. Flow Executor
```typescript
// packages/runtime/src/executor/FlowExecutor.ts
export class FlowExecutor {
  private flow: FlowDefinition;
  private nodeExecutors: Map<string, NodeExecutor>;

  async execute(trigger: BreadcrumbEvent): Promise<void> {
    const executionGraph = this.buildExecutionGraph();
    
    for (const node of this.topologicalSort(executionGraph)) {
      const executor = this.nodeExecutors.get(node.type);
      const inputs = this.gatherInputs(node);
      const outputs = await executor.execute(node, inputs);
      this.propagateOutputs(node, outputs);
    }
  }
}
```

## Configuration

### Environment Variables
```env
# RCRT Connection
RCRT_URL=http://localhost:8081
RCRT_AUTH_MODE=disabled  # or jwt
RCRT_JWT_TOKEN=<token>

# OpenRouter
OPENROUTER_API_KEY=<your-key>
OPENROUTER_DEFAULT_MODEL=google/gemini-2.5-flash

# Builder Config
BUILDER_WORKSPACE=workspace:builder
BUILDER_PORT=3000
BUILDER_SSE_RECONNECT_MS=5000

# Agent Runner
AGENT_RUNNER_PORT=3001
AGENT_MAX_PARALLEL=10
AGENT_MEMORY_TTL_HOURS=24
```

### Docker Compose (Development)
```yaml
version: '3.8'
services:
  # RCRT backend (existing, untouched)
  rcrt:
    image: rcrt:latest
    ports:
      - "8081:8081"
    environment:
      - AUTH_MODE=disabled
      - DB_URL=postgres://...
      - NATS_URL=nats://...

  # Visual Builder UI
  builder:
    build: ./apps/builder
    ports:
      - "3000:3000"
    environment:
      - RCRT_URL=http://rcrt:8081
    depends_on:
      - rcrt

  # Agent Runner Service
  agent-runner:
    build: ./apps/agent-runner
    environment:
      - RCRT_URL=http://rcrt:8081
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
    depends_on:
      - rcrt
```

## Bootstrap Script

```typescript
// scripts/bootstrap.ts
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

async function bootstrap() {
  const client = new RcrtClientEnhanced(process.env.RCRT_URL || 'http://localhost:8081');
  const WORKSPACE = 'workspace:builder';
  
  // Create workspace
  await client.createBreadcrumb({
    title: "Workspace: Builder",
    tags: [WORKSPACE, "workspace:def"],
    schema_name: "workspace.def.v1",
    context: {
      policy: {
        token_budget_bytes: 120000,
        delivery_throttle_ms: 50
      }
    }
  }, 'workspace-init');
  
  // Create tool catalog
  await client.createBreadcrumb({
    title: "Tool Catalog",
    tags: [WORKSPACE, "tools:catalog"],
    schema_name: "tools.catalog.v1",
    context: {
      tools: [
        {
          name: "create_agent",
          description: "Create a new agent",
          input_schema: { type: "object" }
        },
        {
          name: "create_flow",
          description: "Create a new flow",
          input_schema: { type: "object" }
        }
      ]
    }
  }, 'tools-init');
  
  // Create meta-agent (builder)
  const metaAgent = await client.createBreadcrumb({
    title: "Agent: Builder",
    tags: [WORKSPACE, "agent:def", "meta:agent"],
    schema_name: "agent.def.v1",
    context: {
      agent_id: "agent.builder",
      model: "openrouter/google/gemini-2.5-flash",
      system_prompt: "You build other agents by creating agent.def breadcrumbs",
      capabilities: {
        can_spawn_agents: true,
        can_modify_agents: true,
        can_create_flows: true
      },
      subscriptions: {
        selectors: [
          { any_tags: [WORKSPACE, "agent:request"] },
          { any_tags: [WORKSPACE, "optimize:request"] }
        ]
      }
    }
  }, 'meta-agent-init');
  
  console.log('✅ Bootstrap complete');
  console.log(`   Workspace: ${WORKSPACE}`);
  console.log(`   Meta-agent: ${metaAgent.id}`);
}

bootstrap().catch(console.error);
```

## Usage Examples

### Creating an Agent via UI
1. Drag "Agent Node" from palette
2. Configure model and prompt
3. Connect to trigger and output nodes
4. System automatically creates `agent.def.v1` breadcrumb
5. Agent starts running immediately via SSE

### Creating an Agent via Agent (Tested Pattern)
```typescript
// User creates request breadcrumb
await client.createBreadcrumb({
  title: "Build me a customer service agent",
  tags: ["workspace:123", "agent:request"],
  context: {
    requirements: "Handle complaints, search KB, escalate",
    model_preference: "fast"
  }
}, `request-${Date.now()}`);

// Meta-agent receives event and creates exactly ONE agent.def
// Response structure (tested):
{
  action: 'create_agent',
  agent_def: {
    title: 'Agent: Customer Service',
    tags: ['workspace:123', 'agent:def', 'auto-generated'],
    schema_name: 'agent.def.v1',
    context: {
      agent_id: 'agent.customer_service',
      model: 'openrouter/openai/gpt-4o-mini',
      system_prompt: 'You handle customer complaints...',
      subscriptions: {
        selectors: [{ any_tags: ['workspace:123', 'complaint'] }]
      }
    }
  }
}
// New agent starts running automatically via SSE
```

### Managing Agents Programmatically (NEW!)
```typescript
// List all agents in the system
const agents = await client.listAgents();
console.log(`Found ${agents.length} agents`);

// Get specific agent details
const agent = await client.getAgent('agent-customer-service-001');
console.log(`Agent roles: ${agent.roles.join(', ')}`);

// Create or update an agent with specific roles
await client.createOrUpdateAgent('agent-researcher-002', [
  'emitter',     // Can create breadcrumbs
  'subscriber',  // Can receive events
  'curator'      // Can manage other breadcrumbs
]);

// Clean up old agents
const oldAgents = agents.filter(a => 
  new Date(a.created_at) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
);
for (const agent of oldAgents) {
  await client.deleteAgent(agent.id);
  console.log(`Deleted old agent: ${agent.id}`);
}

// Monitor DLQ for failed webhook deliveries
const dlqItems = await client.listDlq();
if (dlqItems.length > 0) {
  console.log(`Found ${dlqItems.length} failed deliveries`);
  // Retry failed items
  for (const item of dlqItems) {
    if (item.last_error.includes('timeout')) {
      await client.retryDlqItem(item.id);
    }
  }
}

// Manage ACL permissions
const acls = await client.listAcls();
const agentAcls = acls.filter(acl => acl.grantee_agent_id === agent.id);
console.log(`Agent has ${agentAcls.length} ACL grants`);
```

### Collaborative Editing
```typescript
// Multiple users see same flow
// User A adds node -> User B sees it instantly
// Agent optimizes flow -> Users see changes in real-time
// All via breadcrumb updates and SSE events
```

## Security Considerations

1. **Authentication**: Use RCRT's JWT auth in production
2. **Workspace Isolation**: Enforce workspace boundaries
3. **Agent Permissions**: Limit agent capabilities via roles
4. **Secret Management**: Use RCRT's envelope encryption for API keys
5. **Rate Limiting**: Implement per-agent rate limits
6. **Audit Trail**: All operations logged as breadcrumbs

## Performance (Tested & Validated)

### Actual Performance Metrics
Based on comprehensive testing against real RCRT backend:
- **Create**: 4ms p50 (target <100ms) - 25x better ✅
- **Read**: 1ms p50 (target <50ms) - 50x better ✅
- **Update**: 5ms p50 ✅
- **Search**: 1ms p50 ✅
- **Batch operations**: 5 breadcrumbs created/fetched in <10ms ✅

### Performance Optimizations
1. **Breadcrumb Caching**: Cache frequently accessed breadcrumbs in memory
2. **Batch Operations**: Implemented and tested - significant efficiency gains
3. **Selective Subscriptions**: Client-side filtering reduces processing
4. **Viewport Culling**: Only render visible nodes
5. **Debounced Updates**: Debounce rapid UI changes
6. **Connection Pooling**: SSE with auto-reconnect maintains persistent connection

## Future Enhancements

1. **Version Control**: Git-like branching for flows
2. **Marketplace**: Share agents and flows
3. **Analytics Dashboard**: Performance metrics visualization
4. **Mobile App**: React Native builder
5. **Voice Interface**: Build agents via voice commands
6. **AR/VR Canvas**: 3D flow visualization
7. **Quantum Agents**: Agents that exist in superposition (j/k... or am I?)

## Validated Capabilities

Through comprehensive testing, we've proven:

### ✅ Core Functionality
- **Agent-builds-agent**: Meta-agent successfully creates exactly one agent per request
- **Everything as breadcrumbs**: UI components, agents, flows, tools all work
- **Real-time collaboration**: Multiple agents run simultaneously without conflicts
- **SSE streaming**: Auto-reconnect handles network issues gracefully
- **Version control**: If-Match headers ensure safe concurrent updates

### ✅ Test Coverage
- **SDK Tests**: 19 scenarios all passing (14 original + 5 new CRUD tests)
- **Agent System**: Meta-agents, task processing, collaborative editing
- **CRUD Operations**: Full coverage for Agents, Tenants, ACLs, Selectors, DLQ
- **Secrets Management**: Native RCRT secrets service with full CRUD
- **Performance**: All operations under 10ms (25-50x better than targets)
- **Error Handling**: Ping events, missing context, action filtering

### ✅ Production Readiness
- **No mocks**: Everything tested against real RCRT backend
- **No fallbacks**: Pure RCRT approach validated
- **Idempotency**: All creates use idempotency keys
- **Type safety**: Full TypeScript types for all operations

## Conclusion

This system represents a paradigm shift in agent development:
- **Self-Hosting**: The builder is built with itself
- **Self-Improving**: Agents optimize other agents (proven in tests)
- **Self-Documenting**: Everything is a queryable breadcrumb
- **Infinitely Recursive**: Agents building agents building agents (demonstrated)
- **Complete Observability**: Full visibility into agent state, permissions, and failures
- **Production-Ready Management**: DLQ monitoring, ACL security, and health dashboards

The beauty is that we're not building a separate system - we're using RCRT to build RCRT applications, proving its power and flexibility. With the new CRUD operations and management UI components, this is no longer just a visual builder but a **complete RCRT System Management Console** that provides:

### Immediate Value (MUST HAVE):
- **Agent Lifecycle Management**: Start, stop, inspect, and manage agents visually
- **System Health Monitoring**: Real-time DLQ and failure tracking with auto-recovery
- **Security Visibility**: Complete ACL audit trail and permission matrix

### Next Phase Value (SHOULD HAVE):
- **Multi-Tenancy**: Full workspace isolation and resource management
- **Visual Selector Building**: Drag-and-drop subscription creation with live preview

The enhanced SDK with full CRUD support (19 test scenarios passing) and comprehensive management UI transforms the visual builder into an enterprise-grade platform for building, deploying, and managing agentic systems at scale.
