## RCRT – Right Context, Right Time

RCRT is a production‑grade system for delivering the right context to agents at the right time using minimal, persistent context packets called breadcrumbs. It provides CRUD APIs, real‑time events, vector search, fine‑grained access control (RLS + ACL), and secure secret management. No mocks or hidden fallbacks – all components are real and deployable.

### What it does
- **Breadcrumbs**: Minimal JSON packets that agents can create, update, read, and subscribe to.
- **Two views**: A minimal context view for LLMs and a full operational view for privileged agents.
- **Eventing**: Notifies subscribers on updates via NATS JetStream, SSE, and webhooks.
- **Access control**: JWT auth, tenant isolation via RLS, per‑breadcrumb ACLs, and roles (emitter, subscriber, curator).
- **Vector search**: `pgvector` embeddings with local ONNX by default for semantic search.
- **Secrets**: Envelope encryption service with audited decrypts and rotation support.
- **Deployability**: Single binary service, Docker/Compose, and Helm chart.

### How it works (high level)
- The service is built in Rust (Axum + Tokio). Business logic lives in `rcrt-core`; the HTTP/SSE service is `rcrt-server`.
- Data is stored in PostgreSQL with `pgvector`; `context` lives in JSONB and embeddings in a vector column.
- Events are produced to NATS JetStream and fanned out to SSE clients and registered webhooks with HMAC signatures and retries (DLQ on failure).
- Row‑Level Security (RLS) isolates tenants; ACLs enable cross‑tenant sharing per breadcrumb action.
- The embedding provider defaults to an embedded ONNX model (MiniLM L6 v2, 384d), configurable via env.
- Envelope encryption secures secrets (DEK per secret, wrapped by KEK), with an audit log for decrypt accesses.

### RCRT Agentic Ecosystem

RCRT serves as the foundation for a complete agentic system where tools, agents, and UIs interact through a unified interface. The Visual Builder (`rcrt-visual-builder/`) demonstrates this by implementing live UI updates via breadcrumb schemas.

```mermaid
graph TB
    subgraph "Human Interface Layer"
        User[👤 End User]
        DevPortal[🛠️ Developer Portal]
        Admin[👔 Admin Dashboard]
    end

    subgraph "Tool Layer (All Equal Citizens)"
        VB[🎨 Visual Builder<br/>- UI authoring<br/>- Component catalog<br/>- Live preview<br/>- Plan validation/apply]
        Search[🔍 Search Tool<br/>- Web search<br/>- Knowledge base<br/>- Vector search]
        ImgGen[🖼️ Image Gen Tool<br/>- DALL-E/Stable Diffusion<br/>- Asset management]
        DataTool[📊 Data Analysis Tool<br/>- SQL queries<br/>- Visualizations]
        CodeTool[⚙️ Code Execution Tool<br/>- Sandboxed runtime<br/>- Result capture]
        CustomTool[🔧 Custom Tools<br/>- Domain-specific<br/>- Legacy integrations]
    end

    subgraph "Agent Layer"
        Orchestrator[🎭 Orchestrator Agent<br/>- Event → Plan mapping<br/>- Tool coordination<br/>- Context management]
        TaskAgent[🤖 Task Agents<br/>- Specialized workers<br/>- Domain experts]
        LLMAgent[🧠 LLM Agent<br/>- Natural language<br/>- Intent parsing<br/>- Plan generation]
        MonitorAgent[📈 Monitor Agent<br/>- Health checks<br/>- Performance<br/>- Alerts]
    end

    subgraph "SDK Layer"
        SDK[📦 RCRT SDK<br/>- createClient()<br/>- Auth handling<br/>- SSE subscriptions<br/>- CRUD operations<br/>- applyPlan() helper]
    end

    subgraph "RCRT Core (The Substrate)"
        API[🌐 REST API<br/>/breadcrumbs<br/>/search<br/>/acl]
        SSE[📡 SSE Stream<br/>/events/stream<br/>Real-time updates]
        Auth[🔐 Auth/ACL<br/>JWT validation<br/>Row-level security]
        VecSearch[🔎 Vector Search<br/>ONNX embeddings<br/>Semantic queries]
        DB[(🗄️ PostgreSQL<br/>Breadcrumbs<br/>History<br/>ACL rules)]
        EventBus[📨 NATS<br/>Event distribution<br/>Pub/Sub]
    end

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

    %% User interactions
    User --> VB
    User --> Search
    User --> ImgGen
    DevPortal --> CustomTool
    Admin --> MonitorAgent

    %% Styling
    classDef rcrtCore fill:#e1f5e1
    classDef sdkLayer fill:#e1e5f5
    classDef visualBuilder fill:#f5e1e1
    classDef orchestratorAgent fill:#f5f5e1

    class API,SSE,Auth,VecSearch,DB,EventBus rcrtCore
    class SDK sdkLayer
    class VB visualBuilder
    class Orchestrator orchestratorAgent
```

**Key insight**: The Visual Builder is just one tool among many. From RCRT's perspective, all tools are authenticated clients that speak breadcrumbs. This creates a truly composable system where LLM agents can coordinate any combination of tools seamlessly.

### Key concepts
- **Breadcrumb**: Minimal, persistent JSON context packet optimized for LLMs/automations.
- **Roles**:
  - Emitter: create/update
  - Subscriber: receive updates (by ID or selector)
  - Curator: manage metadata/ACLs/subscriptions/tenants and admin ops
- **Views**:
  - Context view: redacted/minimal for LLM usage
  - Full view: privileged operational metadata
- **Selectors**: Tag/schema/context‑path rules that match breadcrumbs for event subscriptions.

### Quick start (local)
Prereqs: Docker and Docker Compose.

```bash
# Optional: Enable secrets service
echo 'LOCAL_KEK_BASE64="'$(openssl rand -base64 32)'"' >> .env

docker compose up --build -d
```

- API base: `http://localhost:8081`
- Health: `GET /health`
- Docs: Redoc `/docs`, Swagger `/swagger`, raw spec `/openapi.json`
- Secrets: Requires `LOCAL_KEK_BASE64` in `.env` for encryption

Register a tenant/agent and a webhook (see more in `docs/Integration_Guide.md`):

```bash
export OWNER_ID=$(uuidgen)
export AGENT_ID=$(uuidgen)
curl -X POST http://localhost:8081/tenants/$OWNER_ID -H 'Content-Type: application/json' -d '{"name":"local"}'
curl -X POST http://localhost:8081/agents/$AGENT_ID -H 'Content-Type: application/json' -d '{"roles":["curator","emitter","subscriber"]}'
curl -X POST http://localhost:8081/agents/$AGENT_ID/webhooks -H 'Content-Type: application/json' -d '{"url":"http://host.docker.internal:8082/webhook"}'
```

Create a breadcrumb:

```bash
curl -X POST http://localhost:8081/breadcrumbs \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: ikey-$(date +%s)" \
  -d '{
    "title":"Travel Dates",
    "context":{"start_date":"2025-10-20","end_date":"2025-10-28","timezone":"Europe/London"},
    "tags":["travel","dates"],
    "schema_name":"travel.dates.v1","visibility":"team","sensitivity":"low"
  }'
```

Read/list/search:

```bash
curl http://localhost:8081/breadcrumbs/<id>
curl http://localhost:8081/breadcrumbs/<id>/full
curl http://localhost:8081/breadcrumbs/<id>/history
curl http://localhost:8081/breadcrumbs?tag=travel
curl "http://localhost:8081/breadcrumbs/search?q=Europe%2FLondon&nn=5"
```

SSE events:

```bash
curl -N --http1.1 -H 'Accept: text/event-stream' http://localhost:8081/events/stream
```

### API surface
OpenAPI 3.0 is published at `docs/openapi.json` and served at `GET /openapi.json` with UI at `/docs` and `/swagger`.
Endpoints include breadcrumbs CRUD, history, vector search, selector subscriptions, events stream, webhooks management, secrets, DLQ ops, and admin purge. See the online docs for detailed schemas, parameters, and response bodies.

### Security and access control
- **Auth**: JWT (RS256/EdDSA) with claims `sub` (agent), `owner_id`, and `roles[]`. Dev mode can disable auth (`AUTH_MODE=disabled`).
- **Isolation**: PostgreSQL RLS enforces tenant isolation via `app.current_owner_id`/`app.current_agent_id`.
- **ACLs**: Per‑breadcrumb actions: `read_context`, `read_full`, `update`, `delete`, `subscribe`. Enables cross‑tenant sharing.
- **Webhooks**: HMAC signatures via per‑agent secret; retries with backoff; DLQ for failures.
- **Secrets**: Native encryption service using envelope encryption (AES-256-GCM data + XChaCha20-Poly1305 key wrapping). Full CRUD operations, audited decrypts, rotation support. Set `LOCAL_KEK_BASE64` env var.

### Embeddings and vector search
- Default: local ONNX MiniLM L6 v2 (384d). Configurable provider/dimension.
- Search via `GET /breadcrumbs/search` with `q` (auto‑embed) or `qvec` (explicit).

### Configuration (env)
- Common environment variables:
- **Database/Bus**: `DB_URL`, `NATS_URL`
- **Auth**: `AUTH_MODE=jwt|disabled`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_JWKS_URL`
- **Embeddings**: `EMBED_PROVIDER=onnx|remote`, `EMBED_DIM=384`, `EMBED_MODEL_PATH`, `EMBED_TOKENIZER_PATH`
- **Secrets**: `LOCAL_KEK_BASE64` or cloud KMS config (`KEK_PROVIDER`, `KEK_REF`)
- **Owner/Agent**: `OWNER_ID`, `AGENT_ID`

### Deployment
- **Docker**: Multi‑stage builds produce a static binary image; see `Dockerfile`.
- **Compose (local)**: Postgres + NATS + service; see `docker-compose.yml`.
- **Kubernetes**: Helm chart under `helm/rcrt/` with configurable values for DB/NATS/auth/embeddings and probes.

### Development
If you have Rust locally, you can build the workspace:

```bash
cargo build --workspace
```

Alternatively, use Docker/Compose for a consistent environment.

### Observability
- Prometheus metrics at `GET /metrics` (request counts, latency histograms, webhook delivery histograms).
- Structured JSON logs with request IDs.
- Tracing hooks prepared for OpenTelemetry.

### Troubleshooting
- Docs not loading: ensure `docs/openapi.json` is valid JSON and refresh `/swagger`.
- 500 on agent/webhook upsert: ensure tenant exists (`POST /tenants/:id`).
- SSE pings stop: ensure you run the latest image; message loops are isolated from the async runtime.
- Webhook 4xx/5xx: check HMAC secret and delivery endpoint; inspect DLQ via `GET /dlq`.

### Visual Builder Demo
The Visual Builder (`rcrt-visual-builder/`) showcases RCRT's capabilities with a live agentic demo:

```bash
# Start RCRT backend
docker compose up -d --build

# Start Visual Builder
cd rcrt-visual-builder/apps/builder
pnpm dev

# Open demo
open http://localhost:3000/agentic-demo
```

Click "Seed Agentic Demo" → "Gaming" to see live UI updates via SSE as agents react to events and apply UI plans.

### Further reading
- **Visual Builder**: `rcrt-visual-builder/docs/Quickstart.md`, `rcrt-visual-builder/docs/Auth.md`
- **Full ecosystem**: `docs/RCRT_Full_Ecosystem_Diagram.md`
- **Design document**: `docs/RCRT_System_Design.md`
- **Integration guide**: `docs/Integration_Guide.md`
- **OpenAPI spec**: `docs/openapi.json`

### 3-agent chain smoke test (Supervisor ↔ Researcher ↔ Synthesizer)

This demonstrates agents coordinating only via breadcrumbs and events (no side channels):

1) Create three agents and basic selectors
```
export OWNER_ID=${OWNER_ID:-$(uuidgen)}
export SUP_ID=${SUP_ID:-$(uuidgen)}
export RES_ID=${RES_ID:-$(uuidgen)}
export SYN_ID=${SYN_ID:-$(uuidgen)}

curl -X POST http://localhost:8081/tenants/$OWNER_ID -H 'Content-Type: application/json' -d '{"name":"local"}'
curl -X POST http://localhost:8081/agents/$SUP_ID -H 'Content-Type: application/json' -d '{"roles":["curator","subscriber","emitter"]}'
curl -X POST http://localhost:8081/agents/$RES_ID -H 'Content-Type: application/json' -d '{"roles":["subscriber","emitter"]}'
curl -X POST http://localhost:8081/agents/$SYN_ID -H 'Content-Type: application/json' -d '{"roles":["subscriber","emitter"]}'

# Supervisor watches user channel and completions
curl -X POST http://localhost:8081/subscriptions/selectors -H 'Content-Type: application/json' -d '{
  "any_tags":["user_message","research_done","synthesis_done"]
}'
# Researcher watches research tasks
curl -X POST http://localhost:8081/subscriptions/selectors -H 'Content-Type: application/json' -d '{
  "any_tags":["research_task"]
}'
# Synthesizer watches synthesis tasks
curl -X POST http://localhost:8081/subscriptions/selectors -H 'Content-Type: application/json' -d '{
  "any_tags":["synthesis_task"]
}'
```

2) Run three SSE listeners (Node.js)

Supervisor:
```javascript
// supervisor_sse.js
import EventSource from 'eventsource';
import fetch from 'node-fetch';
const BASE = process.env.RCRT_URL || 'http://localhost:8081';
const es = new EventSource(`${BASE}/events/stream`, { headers: { Accept: 'text/event-stream' } });
let lastUser = null;
es.onmessage = async (m) => {
  const evt = JSON.parse(m.data);
  if (evt.type !== 'breadcrumb.updated') return;
  const bc = await fetch(`${BASE}/breadcrumbs/${evt.breadcrumb_id}`).then(r=>r.json());
  const tags = bc.tags || [];
  if (tags.includes('user_message')) {
    lastUser = bc;
    await fetch(`${BASE}/breadcrumbs`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ title:'Research task', context:{ query: bc.context.text }, tags:['research_task'] })});
    await fetch(`${BASE}/breadcrumbs`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ title:'Synthesis task', context:{ placeholder:true }, tags:['synthesis_task'] })});
  }
  if (tags.includes('research_done') && lastUser) {
    await fetch(`${BASE}/breadcrumbs`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ title:'Synthesis task', context:{ findings: bc.context.findings }, tags:['synthesis_task'] })});
  }
  if (tags.includes('synthesis_done') && lastUser) {
    await fetch(`${BASE}/breadcrumbs/${lastUser.id}`, { method:'PATCH', headers:{ 'Content-Type':'application/json', 'If-Match':'"'+lastUser.version+'"' }, body: JSON.stringify({ context:{ ...lastUser.context, reply: bc.context.answer } })});
  }
};
```

Researcher:
```javascript
// researcher_sse.js
import EventSource from 'eventsource';
import fetch from 'node-fetch';
const BASE = process.env.RCRT_URL || 'http://localhost:8081';
const es = new EventSource(`${BASE}/events/stream`, { headers: { Accept: 'text/event-stream' } });
es.onmessage = async (m) => {
  const evt = JSON.parse(m.data);
  if (evt.type !== 'breadcrumb.updated') return;
  const bc = await fetch(`${BASE}/breadcrumbs/${evt.breadcrumb_id}`).then(r=>r.json());
  if ((bc.tags||[]).includes('research_task')) {
    const findings = `Findings for: ${bc.context.query}`;
    await fetch(`${BASE}/breadcrumbs`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ title:'Research result', context:{ findings }, tags:['research_done'] })});
  }
};
```

Synthesizer:
```javascript
// synthesizer_sse.js
import EventSource from 'eventsource';
import fetch from 'node-fetch';
const BASE = process.env.RCRT_URL || 'http://localhost:8081';
const es = new EventSource(`${BASE}/events/stream`, { headers: { Accept: 'text/event-stream' } });
es.onmessage = async (m) => {
  const evt = JSON.parse(m.data);
  if (evt.type !== 'breadcrumb.updated') return;
  const bc = await fetch(`${BASE}/breadcrumbs/${evt.breadcrumb_id}`).then(r=>r.json());
  if ((bc.tags||[]).includes('synthesis_task')) {
    const answer = bc.context.findings ? `Answer: ${bc.context.findings}` : 'Answer: synthesized';
    await fetch(`${BASE}/breadcrumbs`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ title:'Synthesis result', context:{ answer }, tags:['synthesis_done'] })});
  }
};
```

3) Kick off the chain
```
curl -X POST http://localhost:8081/breadcrumbs -H 'Content-Type: application/json' -d '{
  "title":"User message", "context": { "text":"Plan a weekend trip" }, "tags":["user_message"]
}'
```

Expected: Supervisor creates tasks → Researcher emits findings → Supervisor triggers Synthesizer → Synthesizer emits final → Supervisor patches the original `user_message` with `reply`.

### License
Apache 2.0 (or your preferred license). Add a `LICENSE` file as appropriate.


David@XELNAGAv2 MINGW64 ~/Documents/GitHub/breadcrums/rcrt-visual-builder/apps/agent-runner (main)
$ npm run dev 2>&1
David@XELNAGAv2 MINGW64 ~/Documents/GitHub/breadcrums (main)
$ cd rcrt-visual-builder/apps/builder && pnpm -s dev --port 3000 | cat