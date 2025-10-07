# RCRT System Diagrams

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          RCRT Ecosystem                                  │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  Chrome          │         │  Dashboard v2    │         │  External        │
│  Extension       │         │  (React)         │         │  Users/APIs      │
│                  │         │                  │         │                  │
│  ┌────────────┐  │         │  ┌────────────┐  │         │  ┌────────────┐  │
│  │  Chat UI   │  │         │  │  3D/2D     │  │         │  │  Webhooks  │  │
│  │  Side Panel│  │         │  │  Canvas    │  │         │  │  Callbacks │  │
│  └────────────┘  │         │  └────────────┘  │         │  └────────────┘  │
└────────┬─────────┘         └────────┬─────────┘         └────────┬─────────┘
         │                            │                            │
         │ JWT Auth                   │ JWT Auth                   │ HMAC
         │ /breadcrumbs               │ /breadcrumbs               │ HTTP POST
         │ SSE                        │ SSE                        │
         │                            │                            │
         └────────────────────────────┼────────────────────────────┘
                                      │
                                      ▼
         ┌────────────────────────────────────────────────────────────┐
         │              rcrt-server (Rust/Axum)                       │
         │                                                             │
         │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
         │  │   REST API  │  │  SSE Stream │  │  Webhook         │   │
         │  │   Endpoints │  │  /events    │  │  Dispatcher      │   │
         │  └─────────────┘  └─────────────┘  └──────────────────┘   │
         │                                                             │
         │  ┌─────────────────────────────────────────────────────┐   │
         │  │  Breadcrumb Manager                                 │   │
         │  │  • CRUD operations                                  │   │
         │  │  • Version control                                  │   │
         │  │  • ACL enforcement                                  │   │
         │  └─────────────────────────────────────────────────────┘   │
         │                                                             │
         │  ┌─────────────────────────────────────────────────────┐   │
         │  │  Hygiene System                                     │   │
         │  │  • Auto cleanup                                     │   │
         │  │  • TTL enforcement                                  │   │
         │  └─────────────────────────────────────────────────────┘   │
         └───────────┬───────────────────┬───────────────────┬─────────┘
                     │                   │                   │
                     │                   │                   │
         ┌───────────▼──────┐ ┌──────────▼─────────┐ ┌──────▼──────────┐
         │   PostgreSQL     │ │      NATS          │ │  Secrets Store  │
         │   + pgvector     │ │   (Pub/Sub)        │ │  (Encrypted)    │
         │                  │ │                    │ │                  │
         │  • Breadcrumbs   │ │  bc.*.updated      │ │  AES+XChaCha    │
         │  • Embeddings    │ │  agents.*.events   │ │  DEK/KEK        │
         └──────────────────┘ └────────────────────┘ └─────────────────┘
                     ▲                   │
                     │                   │ Subscribe
         ┌───────────┴───────────────────┴───────────────────────────┐
         │                                                            │
         │                    Event Consumers                         │
         │                                                            │
┌────────┴──────────┐                              ┌─────────────────┴────┐
│  agent-runner     │                              │  tools-runner        │
│  (Node.js)        │                              │  (Node.js)           │
│                   │                              │                      │
│  ┌─────────────┐  │                              │  ┌────────────────┐  │
│  │ Agent       │  │                              │  │ Tool Loader    │  │
│  │ Registry    │  │                              │  │                │  │
│  │             │  │                              │  │ • Load from    │  │
│  │ • Load      │  │                              │  │   breadcrumbs  │  │
│  │   agent.def │  │                              │  │ • Execute      │  │
│  │ • SSE       │  │                              │  │ • Respond      │  │
│  │   dispatch  │  │                              │  └────────────────┘  │
│  └─────────────┘  │                              │                      │
│                   │                              │  ┌────────────────┐  │
│  ┌─────────────┐  │                              │  │ EventBridge    │  │
│  │ Agent       │  │                              │  │                │  │
│  │ Executors   │  │                              │  │ • Wait for     │  │
│  │             │  │                              │  │   events       │  │
│  │ • Process   │  │                              │  │ • Correlate    │  │
│  │   events    │  │                              │  │   requests     │  │
│  │ • Call LLM  │  │                              │  └────────────────┘  │
│  │ • Create    │  │                              │                      │
│  │   responses │  │                              │  OpenRouter, etc.    │
│  └─────────────┘  │                              │                      │
└───────────────────┘                              └──────────────────────┘
         │                                                  │
         │ OpenRouter API                                  │ External APIs
         ▼                                                  ▼
┌───────────────────┐                              ┌──────────────────────┐
│  LLM Providers    │                              │  Tool APIs           │
│  (OpenRouter)     │                              │  • SerpAPI           │
│                   │                              │  • File systems      │
│  • Claude         │                              │  • Custom services   │
│  • GPT-4          │                              └──────────────────────┘
│  • Gemini         │
└───────────────────┘
```

---

## Data Flow: User Message to Agent Response

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Step-by-Step: User sends "Hello" via Extension                         │
└──────────────────────────────────────────────────────────────────────────┘

1. User Types Message
┌──────────────┐
│  Extension   │  User: "Hello"
│  Chat UI     │  
└──────┬───────┘
       │
       │ POST /breadcrumbs
       │ {
       │   schema_name: "user.message.v1",
       │   tags: ["user:message"],
       │   context: { content: "Hello" }
       │ }
       │
       ▼
┌────────────────────────────────────────┐
│  rcrt-server                           │
│                                        │
│  1. Create breadcrumb                  │
│  2. Compute embedding (ONNX)           │
│  3. Store in PostgreSQL                │
│  4. Return { id: "bc-123" }            │
└──────┬─────────────────────────────────┘
       │
       │ Publish to NATS
       │ Subject: bc.bc-123.updated
       │ {
       │   type: "breadcrumb.updated",
       │   breadcrumb_id: "bc-123",
       │   schema_name: "user.message.v1",
       │   tags: ["user:message"]
       │ }
       │
       ├─────────────────┬─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Extension    │  │ Dashboard v2 │  │agent-runner  │
│ (SSE)        │  │ (SSE)        │  │ (SSE)        │
│              │  │              │  │              │
│ Shows msg    │  │ Renders node │  │ Routes event │
└──────────────┘  └──────────────┘  └──────┬───────┘
                                           │
                     ┌─────────────────────┘
                     │ Match subscriptions
                     │ Agent subscribed to:
                     │   {any_tags: ["user:message"]}
                     │
                     ▼
              ┌──────────────────┐
              │  AgentExecutor   │
              │                  │
              │  1. Load agent   │
              │     definition   │
              │  2. Build prompt │
              │  3. Call LLM     │
              └──────┬───────────┘
                     │
                     │ POST openrouter.ai/chat/completions
                     │ {
                     │   model: "claude-3.5-sonnet",
                     │   messages: [...]
                     │ }
                     │
                     ▼
              ┌──────────────────┐
              │  OpenRouter      │
              │  (Claude API)    │
              │                  │
              │  Returns:        │
              │  "Hi there!"     │
              └──────┬───────────┘
                     │
                     ▼
              ┌──────────────────┐
              │  AgentExecutor   │
              │                  │
              │  POST /breadcrumbs
              │  {
              │    schema_name: "agent.response.v1",
              │    tags: ["agent:response"],
              │    context: {
              │      content: "Hi there!",
              │      conversation_id: "conv-123"
              │    }
              │  }
              └──────┬───────────┘
                     │
                     ▼
┌────────────────────────────────────────┐
│  rcrt-server                           │
│                                        │
│  1. Create breadcrumb                  │
│  2. Return { id: "bc-456" }            │
│  3. Publish to NATS                    │
└──────┬─────────────────────────────────┘
       │
       │ Publish: bc.bc-456.updated
       │ {
       │   type: "breadcrumb.updated",
       │   breadcrumb_id: "bc-456",
       │   schema_name: "agent.response.v1",
       │   tags: ["agent:response"]
       │ }
       │
       ├─────────────────┬─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Extension    │  │ Dashboard v2 │  │ Webhooks     │
│ (SSE)        │  │ (SSE)        │  │              │
│              │  │              │  │              │
│ Filter match │  │ Renders      │  │ Selector     │
│ agent:response│  │ response node│  │ match →      │
│              │  │              │  │ POST webhook │
│ GET /breadcrumbs/bc-456         │  │              │
│ Display: "Hi there!"            │  └──────────────┘
└─────────────────────────────────┘

4. User sees response in Extension
```

---

## Component Interaction Matrix

```
┌─────────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│                 │ rcrt-server  │ agent-runner │ tools-runner │ Dashboard v2 │  Extension   │
├─────────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ rcrt-server     │      -       │  JWT, SSE    │  JWT, SSE    │  JWT, SSE    │  JWT, SSE    │
├─────────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ agent-runner    │  REST API    │      -       │   Events     │   Events     │   Events     │
│                 │  SSE Events  │              │  (via NATS)  │  (via NATS)  │  (via NATS)  │
├─────────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ tools-runner    │  REST API    │   Events     │      -       │   Events     │   Events     │
│                 │  SSE Events  │  (via NATS)  │              │  (via NATS)  │  (via NATS)  │
├─────────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Dashboard v2    │  REST API    │      -       │      -       │      -       │      -       │
│                 │  SSE Events  │              │              │              │              │
├─────────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Extension       │  REST API    │      -       │      -       │      -       │      -       │
│                 │  SSE Events  │              │              │              │              │
└─────────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘

Legend:
  REST API = Direct HTTP requests to rcrt-server
  SSE      = Server-Sent Events subscription
  Events   = Indirect communication via breadcrumbs + NATS
  JWT      = JWT-based authentication
```

---

## Breadcrumb Lifecycle

```
┌────────────────────────────────────────────────────────────────────────┐
│                    Breadcrumb Lifecycle                                │
└────────────────────────────────────────────────────────────────────────┘

       POST /breadcrumbs
              │
              ▼
       ┌────────────┐
       │  Created   │  version = 1
       │            │  checksum = hash(context)
       │  Events:   │  created_at = now
       │  - bc.created
       │  - bc.updated
       └─────┬──────┘
             │
             │ Optional: Agent/User modifies
             ▼
       PATCH /breadcrumbs/:id
       If-Match: 1
              │
              ▼
       ┌────────────┐
       │  Updated   │  version = 2
       │            │  checksum = hash(context)
       │  Events:   │  updated_at = now
       │  - bc.updated   updated_by = agent_id
       └─────┬──────┘
             │
             │ Multiple updates possible
             │ Each increments version
             │
             ├──────────────────┬──────────────────┐
             │                  │                  │
             ▼                  ▼                  ▼
       ┌──────────┐       ┌──────────┐       ┌──────────┐
       │ TTL      │       │ Manual   │       │ Hygiene  │
       │ Expires  │       │ Delete   │       │ Cleanup  │
       │          │       │          │       │          │
       │ ttl <    │       │ DELETE   │       │ Auto     │
       │  now()   │       │ /breadcrumb       │ cleanup  │
       └────┬─────┘       └────┬─────┘       └────┬─────┘
            │                  │                  │
            └──────────────────┼──────────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   Deleted    │
                        │              │
                        │  • Removed   │
                        │    from DB   │
                        │  • No events │
                        └──────────────┘

Breadcrumb States:
┌────────────────────────────────────────────────────────────────┐
│  Active      │  Normal state, can be read/updated/deleted     │
│  Expired     │  ttl < now(), will be deleted by hygiene       │
│  Deleted     │  Removed from database                         │
└────────────────────────────────────────────────────────────────┘

Version Control:
  • Optimistic locking with If-Match header
  • Version increments on each update
  • Conflicts return 412 Precondition Failed
  • Client must retry with latest version

Checksum:
  • SHA256 hash of context JSON
  • Detects corruption or tampering
  • Automatically computed on create/update
```

---

## Agent Subscription Matching

```
┌────────────────────────────────────────────────────────────────────────┐
│                    Selector Matching Algorithm                          │
└────────────────────────────────────────────────────────────────────────┘

         Incoming Event
         ──────────────
         {
           type: "breadcrumb.updated",
           breadcrumb_id: "bc-123",
           schema_name: "user.message.v1",
           tags: ["user:message", "urgent"],
           context: {
             content: "Help!",
             priority: 10
           }
         }
                │
                ▼
         ┌─────────────────┐
         │  Load Agents    │
         │  with           │
         │  Subscriptions  │
         └────────┬────────┘
                  │
                  ▼
      ┌───────────────────────────┐
      │  Agent 1 Selectors        │
      │  ────────────────────      │
      │  1. {any_tags: ["user:message"]}           ✓ Match
      │  2. {schema_name: "user.message.v1"}       ✓ Match
      │  3. {all_tags: ["urgent", "priority"]}     ✗ No "priority" tag
      │  4. {context_match: [                      │
      │       {path: "$.priority", op: "gt", value: 5}  ✓ Match (10 > 5)
      │     ]}                                      │
      │                                             │
      │  Result: ROUTE TO AGENT 1 (any match = true)
      └───────────┬───────────────────────────────┘
                  │
                  ▼
      ┌───────────────────────────┐
      │  Agent 2 Selectors        │
      │  ────────────────────      │
      │  1. {any_tags: ["admin:message"]}          ✗ No match
      │  2. {schema_name: "tool.response.v1"}      ✗ No match
      │                                             │
      │  Result: SKIP (no matches)                 │
      └────────────────────────────────────────────┘

Matching Rules:
┌─────────────────────────────────────────────────────────────────────┐
│  Selector Type    │  Match Condition                                │
├───────────────────┼─────────────────────────────────────────────────┤
│  any_tags         │  At least one tag in selector exists in event  │
│  all_tags         │  All tags in selector exist in event           │
│  schema_name      │  Exact match with event.schema_name             │
│  context_match    │  All context rules match                        │
└───────────────────┴─────────────────────────────────────────────────┘

Context Match Operations:
┌──────────────┬────────────────────────────────────────────────────┐
│  op: "eq"    │  context.path === value                            │
│  op: "ne"    │  context.path !== value                            │
│  op: "gt"    │  context.path > value                              │
│  op: "lt"    │  context.path < value                              │
│  op: "contains" │ context.path.includes(value)                    │
└──────────────┴────────────────────────────────────────────────────┘
```

---

## Tool Execution Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                    Tool Execution with EventBridge                      │
└────────────────────────────────────────────────────────────────────────┘

   Agent needs to call OpenRouter
            │
            ▼
   ┌────────────────────┐
   │ Agent creates      │
   │ tool.request.v1    │
   │                    │
   │ POST /breadcrumbs  │
   │ {                  │
   │   schema_name: "tool.request.v1",
   │   tags: ["tool:request"],
   │   context: {       │
   │     tool: "openrouter",
   │     input: {       │
   │       messages: [...]
   │     },             │
   │     requestId: "req-123"
   │   }                │
   │ }                  │
   └──────┬─────────────┘
          │
          │ Publish: bc.*.updated
          │
          ├──────────────────┬─────────────────────┐
          │                  │                     │
          ▼                  ▼                     │
   ┌──────────────┐   ┌──────────────┐            │
   │ EventBridge  │   │ tools-runner │            │
   │ (Agent)      │   │ (SSE)        │            │
   │              │   │              │            │
   │ Waiting...   │   │ 1. Receive   │            │
   │              │   │    event     │            │
   │ waitForEvent(│   │ 2. Match     │            │
   │   {          │   │    tool name │            │
   │     schema:  │   │ 3. Load tool │            │
   │     "tool.response.v1",          │            │
   │     request_id: "req-123"        │            │
   │   },         │   │              │            │
   │   60000      │   └──────┬───────┘            │
   │ )            │          │                    │
   └──────────────┘          │ Execute tool       │
                             │                    │
                             ▼                    │
                      ┌──────────────┐            │
                      │ Tool Logic   │            │
                      │              │            │
                      │ • Parse input│            │
                      │ • Call API   │            │
                      │ • Format     │            │
                      │   response   │            │
                      └──────┬───────┘            │
                             │                    │
                             │ Return result      │
                             ▼                    │
                      ┌──────────────┐            │
                      │ tools-runner │            │
                      │              │            │
                      │ POST /breadcrumbs         │
                      │ {            │            │
                      │   schema_name: "tool.response.v1",
                      │   tags: ["tool:response", "request:req-123"],
                      │   context: { │            │
                      │     request_id: "req-123",│
                      │     tool: "openrouter",   │
                      │     status: "success",    │
                      │     output: { ... }       │
                      │   }          │            │
                      │ }            │            │
                      └──────┬───────┘            │
                             │                    │
                             │ Publish: bc.*.updated
                             │                    │
                             ├────────────────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │ EventBridge  │
                      │ (Agent)      │
                      │              │
                      │ Event matches!
                      │              │
                      │ waitForEvent │
                      │   resolves   │
                      │              │
                      │ return       │
                      │ { output: {...} }
                      └──────┬───────┘
                             │
                             ▼
                      ┌──────────────┐
                      │ Agent        │
                      │ continues... │
                      │              │
                      │ Use tool     │
                      │ output in    │
                      │ response     │
                      └──────────────┘

Key Points:
• Agent doesn't poll - waits via EventBridge
• Tools-runner listens via SSE
• Correlation via requestId in tags
• Timeout configurable (default 60s)
• EventBridge maintains event history (100 events)
```

---

## Database Schema (PostgreSQL)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Database Tables                                 │
└─────────────────────────────────────────────────────────────────────────┘

breadcrumbs
┌──────────────────┬────────────────────┬───────────────────────────────┐
│ Column           │ Type               │ Description                   │
├──────────────────┼────────────────────┼───────────────────────────────┤
│ id               │ UUID               │ Primary key                   │
│ owner_id         │ UUID               │ Foreign key → tenants         │
│ title            │ VARCHAR(255)       │ Human-readable title          │
│ context          │ JSONB              │ Arbitrary JSON data           │
│ tags             │ TEXT[]             │ Array of tags                 │
│ schema_name      │ VARCHAR(100)       │ Schema identifier             │
│ version          │ INTEGER            │ Optimistic locking            │
│ checksum         │ VARCHAR(64)        │ SHA256 of context             │
│ embedding        │ VECTOR(384)        │ pgvector embedding            │
│ visibility       │ VARCHAR(20)        │ public/team/private           │
│ sensitivity      │ VARCHAR(20)        │ low/pii/secret                │
│ ttl              │ TIMESTAMPTZ        │ Expiration time               │
│ created_at       │ TIMESTAMPTZ        │ Creation timestamp            │
│ updated_at       │ TIMESTAMPTZ        │ Last update timestamp         │
│ created_by       │ UUID               │ Foreign key → agents          │
│ updated_by       │ UUID               │ Foreign key → agents          │
│ size_bytes       │ INTEGER            │ Context size                  │
└──────────────────┴────────────────────┴───────────────────────────────┘

Indexes:
• idx_breadcrumbs_tags (GIN on tags)
• idx_breadcrumbs_schema (B-tree on schema_name)
• idx_breadcrumbs_owner (B-tree on owner_id)
• idx_breadcrumbs_embedding (HNSW on embedding)
• idx_breadcrumbs_ttl (B-tree on ttl WHERE ttl IS NOT NULL)

agents
┌──────────────────┬────────────────────┬───────────────────────────────┐
│ id               │ UUID               │ Primary key                   │
│ owner_id         │ UUID               │ Foreign key → tenants         │
│ roles            │ TEXT[]             │ Roles array                   │
│ created_at       │ TIMESTAMPTZ        │ Creation timestamp            │
└──────────────────┴────────────────────┴───────────────────────────────┘

selector_subscriptions
┌──────────────────┬────────────────────┬───────────────────────────────┐
│ id               │ UUID               │ Primary key                   │
│ owner_id         │ UUID               │ Foreign key → tenants         │
│ agent_id         │ UUID               │ Foreign key → agents          │
│ selector         │ JSONB              │ Selector rules                │
│ created_at       │ TIMESTAMPTZ        │ Creation timestamp            │
└──────────────────┴────────────────────┴───────────────────────────────┘

acls
┌──────────────────┬────────────────────┬───────────────────────────────┐
│ id               │ UUID               │ Primary key                   │
│ owner_id         │ UUID               │ Foreign key → tenants         │
│ breadcrumb_id    │ UUID               │ Foreign key → breadcrumbs     │
│ grantee_agent_id │ UUID               │ Foreign key → agents          │
│ actions          │ TEXT[]             │ Allowed actions               │
│ created_at       │ TIMESTAMPTZ        │ Creation timestamp            │
└──────────────────┴────────────────────┴───────────────────────────────┘

secrets
┌──────────────────┬────────────────────┬───────────────────────────────┐
│ id               │ UUID               │ Primary key                   │
│ owner_id         │ UUID               │ Foreign key → tenants         │
│ name             │ VARCHAR(255)       │ Secret name                   │
│ scope_type       │ VARCHAR(50)        │ global/workspace/agent        │
│ scope_id         │ UUID               │ Optional scope reference      │
│ encrypted_value  │ BYTEA              │ AES-256-GCM encrypted         │
│ dek_wrapped      │ BYTEA              │ XChaCha20 wrapped DEK         │
│ kek_id           │ VARCHAR(100)       │ KEK identifier                │
│ created_at       │ TIMESTAMPTZ        │ Creation timestamp            │
└──────────────────┴────────────────────┴───────────────────────────────┘

webhook_dlq (Dead Letter Queue)
┌──────────────────┬────────────────────┬───────────────────────────────┐
│ id               │ UUID               │ Primary key                   │
│ owner_id         │ UUID               │ Foreign key → tenants         │
│ agent_id         │ UUID               │ Foreign key → agents          │
│ url              │ TEXT               │ Webhook URL                   │
│ payload          │ JSONB              │ Event payload                 │
│ last_error       │ TEXT               │ Error message                 │
│ created_at       │ TIMESTAMPTZ        │ Creation timestamp            │
└──────────────────┴────────────────────┴───────────────────────────────┘
```

---

## Deployment Topologies

### Development (Local)
```
┌────────────────────────────────────────┐
│  Developer Machine                     │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ PostgreSQL (Docker)              │  │
│  │ Port: 5432                       │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ NATS (Docker)                    │  │
│  │ Port: 4222                       │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ rcrt-server (cargo run)          │  │
│  │ Port: 8081                       │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ agent-runner (npm run dev)       │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ tools-runner (npm run dev)       │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ Dashboard v2 (npm run dev)       │  │
│  │ Port: 8082                       │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ Extension (built, loaded)        │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

### Production (Docker Compose)
```
┌──────────────────────────────────────────────────────────────┐
│  Docker Compose                                              │
│                                                              │
│  ┌────────────────────┐  ┌────────────────────┐             │
│  │  postgres          │  │  nats              │             │
│  │  pgvector/pgvector │  │  nats:latest       │             │
│  │  :5432             │  │  :4222             │             │
│  └────────────────────┘  └────────────────────┘             │
│           ▲                      ▲                           │
│           │                      │                           │
│  ┌────────┴──────────────────────┴────────────┐             │
│  │  rcrt-server                                │             │
│  │  :8080 (internal) → :8081 (external)        │             │
│  │                                             │             │
│  │  Health: /health                            │             │
│  │  Metrics: /metrics                          │             │
│  └────────┬────────────────────┬───────────────┘             │
│           │                    │                             │
│  ┌────────▼──────────┐  ┌──────▼────────────┐               │
│  │  agent-runner     │  │  tools-runner     │               │
│  │                   │  │                   │               │
│  │  Restarts: always │  │  Restarts: always │               │
│  └───────────────────┘  └───────────────────┘               │
│                                                              │
│  ┌───────────────────────────────────────────┐              │
│  │  frontend (nginx)                         │              │
│  │  :80 (internal) → :8082 (external)        │              │
│  │                                           │              │
│  │  Serves: Dashboard v2 SPA                 │              │
│  └───────────────────────────────────────────┘              │
└──────────────────────────────────────────────────────────────┘

External Access:
• Dashboard v2: http://localhost:8082
• rcrt-server API: http://localhost:8081
• Extension connects to: http://localhost:8081
```

### Production (Kubernetes)
```
┌──────────────────────────────────────────────────────────────┐
│  Kubernetes Cluster                                          │
│                                                              │
│  ┌────────────────────────────────────────────┐             │
│  │  Ingress                                   │             │
│  │  ┌──────────────┐  ┌──────────────────┐   │             │
│  │  │ /api/*       │  │ /*               │   │             │
│  │  │ → rcrt-svc   │  │ → dashboard-svc  │   │             │
│  │  └──────────────┘  └──────────────────┘   │             │
│  └────────────────────────────────────────────┘             │
│           │                      │                           │
│  ┌────────▼──────────┐  ┌────────▼──────────┐               │
│  │  rcrt-server      │  │  dashboard-v2     │               │
│  │  Deployment       │  │  Deployment       │               │
│  │  Replicas: 3      │  │  Replicas: 2      │               │
│  │                   │  │                   │               │
│  │  Resources:       │  │  Resources:       │               │
│  │  - CPU: 1000m     │  │  - CPU: 100m      │               │
│  │  - RAM: 2Gi       │  │  - RAM: 256Mi     │               │
│  └──────┬────────────┘  └───────────────────┘               │
│         │                                                    │
│  ┌──────▼────────────────────────────────┐                  │
│  │  Postgres StatefulSet                 │                  │
│  │  ┌──────────────┐  ┌──────────────┐   │                  │
│  │  │ Primary      │→ │ Replica      │   │                  │
│  │  │ PVC: 100Gi   │  │ PVC: 100Gi   │   │                  │
│  │  └──────────────┘  └──────────────┘   │                  │
│  └───────────────────────────────────────┘                  │
│                                                              │
│  ┌──────────────────────────────────────┐                   │
│  │  NATS StatefulSet                    │                   │
│  │  Replicas: 3 (clustered)             │                   │
│  └──────────────────────────────────────┘                   │
│                                                              │
│  ┌──────────────────────────────────────┐                   │
│  │  agent-runner Deployment             │                   │
│  │  Replicas: 2                         │                   │
│  │  (share load via NATS)               │                   │
│  └──────────────────────────────────────┘                   │
│                                                              │
│  ┌──────────────────────────────────────┐                   │
│  │  tools-runner Deployment             │                   │
│  │  Replicas: 3                         │                   │
│  └──────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────────┘

ConfigMaps:
• rcrt-config (JWT keys, settings)
• agent-config (OpenRouter API keys)

Secrets:
• postgres-credentials
• jwt-private-key
• api-keys (sealed secrets)

Services:
• rcrt-svc (ClusterIP)
• dashboard-svc (ClusterIP)
• postgres-svc (ClusterIP)
• nats-svc (ClusterIP)
```

---

## Monitoring & Observability

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Metrics & Logging Stack                          │
└────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  Application Metrics                                                 │
│                                                                      │
│  rcrt-server                                                         │
│  • http_requests_total (counter)                                     │
│  • http_request_duration_seconds (histogram)                         │
│  • webhook_delivery_total (counter)                                  │
│  • webhook_delivery_duration_seconds (histogram)                     │
│                                                                      │
│  agent-runner                                                        │
│  • agent_events_processed_total                                      │
│  • agent_llm_calls_total                                             │
│  • agent_llm_duration_seconds                                        │
│                                                                      │
│  tools-runner                                                        │
│  • tool_executions_total                                             │
│  • tool_execution_duration_seconds                                   │
│  • tool_errors_total                                                 │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  Monitoring Flow                                                     │
│                                                                      │
│  Components                                                          │
│      │                                                               │
│      │ /metrics (Prometheus format)                                 │
│      ▼                                                               │
│  ┌────────────┐     scrape_interval: 15s                            │
│  │ Prometheus │────────────────────────────────────┐                │
│  │            │                                    │                │
│  │ • Scrapes  │                                    │                │
│  │ • Stores   │                                    │                │
│  │ • Alerts   │                                    ▼                │
│  └──────┬─────┘                            ┌───────────────┐        │
│         │                                  │  Alertmanager │        │
│         │ PromQL queries                   │               │        │
│         │                                  │  • Slack      │        │
│         ▼                                  │  • Email      │        │
│  ┌────────────┐                            │  • PagerDuty  │        │
│  │  Grafana   │                            └───────────────┘        │
│  │            │                                                     │
│  │ Dashboards:│                                                     │
│  │ • RCRT Overview                                                  │
│  │ • Agent Performance                                              │
│  │ • Tool Execution                                                 │
│  │ • Breadcrumb Growth                                              │
│  └────────────┘                                                     │
└──────────────────────────────────────────────────────────────────────┘

Useful PromQL Queries:
• Request rate: rate(http_requests_total[5m])
• Error rate: rate(http_requests_total{status=~"5.."}[5m])
• P95 latency: histogram_quantile(0.95, http_request_duration_seconds)
• Active agents: count(agent_events_processed_total)
```

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Related Docs**: SYSTEM_ARCHITECTURE_OVERVIEW.md, QUICK_REFERENCE.md
