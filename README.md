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
docker compose up --build -d
```

- API base: `http://localhost:8081`
- Health: `GET /health`
- Docs: Redoc `/docs`, Swagger `/swagger`, raw spec `/openapi.json`

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
- **Secrets**: Envelope encryption (DEK encrypted by KEK). Audited decrypts, rotation via rewrap.

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

### Further reading
- Design document: `docs/RCRT_System_Design.md`
- Integration guide: `docs/Integration_Guide.md`
- OpenAPI spec: `docs/openapi.json`

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


