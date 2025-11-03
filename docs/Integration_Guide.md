## RCRT Integration Guide

### Quick start (Docker Compose)
1. Start services:
   - `docker compose up --build -d`
2. API base: `http://localhost:8081`
3. Docs: `/` and raw spec: `/openapi.json`
4. Health: `/health`, Metrics: `/metrics`

Environment defaults (compose):
- OWNER_ID, AUTH_MODE=disabled (dev), DB_URL, NATS_URL, EMBED_MODEL/TOKENIZER

### Register an agent and webhook (curl)
```
curl -X POST http://localhost:8081/tenants/$OWNER_ID -H 'Content-Type: application/json' -d '{"name":"local"}'
curl -X POST http://localhost:8081/agents/$AGENT_ID -H 'Content-Type: application/json' -d '{"roles":["curator","emitter","subscriber"]}'
curl -X POST http://localhost:8081/agents/$AGENT_ID/webhooks -H 'Content-Type: application/json' -d '{"url":"http://host.docker.internal:8082/webhook"}'
```

Optional: set webhook secret to receive HMAC header `X-RCRT-Signature` (sha256=...)
```
curl -X POST http://localhost:8081/agents/$AGENT_ID/secret -H 'Content-Type: application/json' -d '{"secret":"my-shared-secret"}'
```

### Create a breadcrumb
```
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

Read views and list:
```
curl http://localhost:8081/breadcrumbs/<id>
curl http://localhost:8081/breadcrumbs/<id>/full
curl http://localhost:8081/breadcrumbs/<id>/history
curl http://localhost:8081/breadcrumbs?tag=travel
```

Update with versioning and delete:
```
curl -X PATCH http://localhost:8081/breadcrumbs/<id> -H 'Content-Type: application/json' -H 'If-Match: "1"' -d '{"context":{"end_date":"2025-10-29"}}'
curl -X DELETE http://localhost:8081/breadcrumbs/<id>
```

### Subscriptions
Create selector (tags + optional context_match):
```
curl -X POST http://localhost:8081/subscriptions/selectors -H 'Content-Type: application/json' -d '{
  "any_tags":["travel"],
  "context_match":[{"path":"$.timezone","op":"eq","value":"Europe/London"}]
}'
```

SSE stream:
```
curl -N --http1.1 -H 'Accept: text/event-stream' http://localhost:8081/events/stream
```

### Webhooks
Delivery on create/update to matching agents. Retry with exponential backoff. Failed deliveries go to DLQ:
- List DLQ (curator): `GET /dlq`
- Retry an item: `POST /dlq/:id/retry`

Verify signature example (Node.js/TypeScript):
```
import crypto from 'crypto';
const sig = req.headers['x-rcrt-signature']; // 'sha256=...'
const hmac = crypto.createHmac('sha256', process.env.RCRT_WEBHOOK_SECRET!);
hmac.update(req.rawBody);
const expected = 'sha256=' + hmac.digest('hex');
if (sig !== expected) return res.status(400).send('invalid signature');
```

### Secrets Service (Native Encryption)

RCRT provides a native secrets service with envelope encryption (AES-256-GCM + XChaCha20-Poly1305).

#### Setup
Set `LOCAL_KEK_BASE64` (base64-encoded 32-byte key) for the server:
```bash
# Generate KEK
openssl rand -base64 32

# Add to .env for Docker
echo 'LOCAL_KEK_BASE64="your-kek-here"' >> .env

# Or set directly when running
LOCAL_KEK_BASE64="..." cargo run --bin rcrt-server
```

#### CRUD Operations
```bash
# Create encrypted secret
curl -X POST http://localhost:8081/secrets \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "api-key",
    "scope_type": "agent",
    "scope_id": "'$AGENT_ID'",
    "value": "super-secret"
  }'
# Response: {"id": "uuid", "name": "api-key", "scope_type": "agent", "scope_id": "..."}

# List secrets (filtered by scope)
curl "http://localhost:8081/secrets?scope_type=agent&scope_id=$AGENT_ID"

# Update secret (re-encrypts with new DEK)
curl -X PUT http://localhost:8081/secrets/$SECRET_ID \
  -H 'Content-Type: application/json' \
  -d '{"value": "new-secret-value"}'

# Decrypt secret (audited)
curl -X POST http://localhost:8081/secrets/$SECRET_ID/decrypt \
  -H 'Content-Type: application/json' \
  -d '{"reason": "scheduled task"}'
# Response: {"value": "new-secret-value"}

# Delete secret
curl -X DELETE http://localhost:8081/secrets/$SECRET_ID
```

### Vector search
- Create auto-computes embedding (bundled MiniLM ONNX).
- `GET /breadcrumbs/search?q=Europe%2FLondon&nn=5` (auto-embed) or `?qvec=f1,f2,...`

### SDK usage
TypeScript:
```
import { RcrtClientEnhanced as RcrtClient } from '@rcrt-builder/sdk';
const c = new RcrtClient('http://localhost:8081');
await c.createBreadcrumb({ title:'Travel', context:{}, tags:['travel'] }, 'ikey-1');
```

Python:
```
from sdk.python.rcrt_client import RcrtClient
c = RcrtClient('http://localhost:8081')
print(c.create_breadcrumb({ 'title':'Travel', 'context':{}, 'tags':['travel'] }, 'ikey-1'))
```

### Kubernetes (Helm)
Values to set: `env.DB_URL`, `env.NATS_URL`, `env.OWNER_ID`, `LOCAL_KEK_BASE64` (as Secret), optionally enable JWT auth.
```
helm install rcrt ./helm/rcrt --set image.repository=your/repo --set image.tag=latest \
  --set env.DB_URL='postgres://...' --set env.NATS_URL='nats://...' --set env.OWNER_ID='...' \
  --set-file localKekBase64=./kek.b64
```

### Admin
- Purge expired TTLs: `POST /admin/purge` (curator)
- Metrics: `/metrics` (Prometheus format)



### Multi-agent example (Travel Planner ↔ Calendar Agent)

This example shows an emitter agent creating a breadcrumb and a subscriber agent reacting in real time using SSE (or webhooks).

Setup three agents (curator/emitter/subscriber):
```
export OWNER_ID=${OWNER_ID:-$(uuidgen)}
export PLANNER_ID=${PLANNER_ID:-$(uuidgen)}
export CAL_ID=${CAL_ID:-$(uuidgen)}

curl -X POST http://localhost:8081/tenants/$OWNER_ID -H 'Content-Type: application/json' -d '{"name":"local"}'
curl -X POST http://localhost:8081/agents/$PLANNER_ID -H 'Content-Type: application/json' -d '{"roles":["emitter"]}'
curl -X POST http://localhost:8081/agents/$CAL_ID -H 'Content-Type: application/json' -d '{"roles":["subscriber"]}'
```

Calendar Agent subscribes to travel date updates via selector (tags + optional context match):
```
curl -X POST http://localhost:8081/subscriptions/selectors -H 'Content-Type: application/json' -d '{
  "any_tags":["travel","dates"],
  "context_match":[{"path":"$.timezone","op":"eq","value":"Europe/London"}]
}'
```

Option A: Calendar Agent listens over SSE (Node.js example):
```javascript
// calendar_agent_sse.js
import EventSource from 'eventsource';
import fetch from 'node-fetch';

const BASE = process.env.RCRT_URL || 'http://localhost:8081';
const es = new EventSource(`${BASE}/events/stream`, { headers: { Accept: 'text/event-stream' } });

es.onmessage = async (m) => {
  try {
    const evt = JSON.parse(m.data);
    if (evt.type === 'breadcrumb.updated') {
      const id = evt.breadcrumb_id;
      // Read full breadcrumb data (untransformed)
      const ctx = await fetch(`${BASE}/breadcrumbs/${id}/full`).then((r) => r.json());
      console.log('Calendar received update:', ctx.title, ctx.context);
      // Note: Use /breadcrumbs/${id} (without /full) only if you want LLM-optimized transformed view
      // update calendar system here...
    }
  } catch (e) {
    console.error('event error', e);
  }
};

es.onerror = (e) => console.error('SSE error', e);
```

Run the SSE listener:
```
node calendar_agent_sse.js
```

Option B: Calendar Agent via webhook (register URL):
```
curl -X POST http://localhost:8081/agents/$CAL_ID/webhooks -H 'Content-Type: application/json' \
  -d '{"url":"http://host.docker.internal:8082/webhook"}'
```

Travel Planner emits a breadcrumb (TypeScript SDK example):
```typescript
// travel_planner.ts
import { RcrtClientEnhanced as RcrtClient } from '@rcrt-builder/sdk';

const BASE = process.env.RCRT_URL || 'http://localhost:8081';
const c = new RcrtClient(BASE);

async function main() {
  const res = await c.createBreadcrumb({
    title: 'Travel Dates',
    context: { start_date: '2025-10-20', end_date: '2025-10-28', timezone: 'Europe/London' },
    tags: ['travel', 'dates'],
    schema_name: 'travel.dates.v1',
    visibility: 'team',
    sensitivity: 'low'
  }, `ikey-${Date.now()}`);
  console.log('Created breadcrumb id', res.id);
}

main().catch(console.error);
```

When `travel_planner.ts` runs, the Calendar Agent immediately receives the event via SSE or webhook and can update calendars accordingly. Subsequent updates via `PATCH /breadcrumbs/:id` will bump the version and trigger new events; agents should ignore stale versions.

Cross-tenant share (optional): curator grants `read_context` to another tenant’s agent for a single breadcrumb:
```
curl -X POST http://localhost:8081/acl/grant -H 'Content-Type: application/json' -d '{
  "breadcrumb_id":"<id>",
  "grantee_owner_id":"<other-tenant>",
  "actions":["read_context"]
}'
```

### 3-agent chain (Supervisor ↔ Researcher ↔ Synthesizer)

Agents coordinate only through RCRT breadcrumbs/events.

1) Agents and selectors
```
export OWNER_ID=${OWNER_ID:-$(uuidgen)}
export SUP_ID=${SUP_ID:-$(uuidgen)}
export RES_ID=${RES_ID:-$(uuidgen)}
export SYN_ID=${SYN_ID:-$(uuidgen)}

curl -X POST http://localhost:8081/tenants/$OWNER_ID -H 'Content-Type: application/json' -d '{"name":"local"}'
curl -X POST http://localhost:8081/agents/$SUP_ID -H 'Content-Type: application/json' -d '{"roles":["curator","subscriber","emitter"]}'
curl -X POST http://localhost:8081/agents/$RES_ID -H 'Content-Type: application/json' -d '{"roles":["subscriber","emitter"]}'
curl -X POST http://localhost:8081/agents/$SYN_ID -H 'Content-Type: application/json' -d '{"roles":["subscriber","emitter"]}'

curl -X POST http://localhost:8081/subscriptions/selectors -H 'Content-Type: application/json' -d '{"any_tags":["user_message","research_done","synthesis_done"]}'
curl -X POST http://localhost:8081/subscriptions/selectors -H 'Content-Type: application/json' -d '{"any_tags":["research_task"]}'
curl -X POST http://localhost:8081/subscriptions/selectors -H 'Content-Type: application/json' -d '{"any_tags":["synthesis_task"]}'
```

2) SSE listeners
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
  const bc = await fetch(`${BASE}/breadcrumbs/${evt.breadcrumb_id}/full`).then(r=>r.json());
  const tags = bc.tags || [];
  if (tags.includes('user_message')) {
    lastUser = bc;
    await fetch(`${BASE}/breadcrumbs`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ title:'Research task', context:{ query: bc.context.text }, tags:['research_task'] })});
    await fetch(`${BASE}/breadcrumbs`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ title:'Synthesis task', context:{ placeholder:true }, tags:['synthesis_task'] })});
  }
  if (tags.includes('research_done') && lastUser) {
    await fetch(`${BASE}/breadcrumbs`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ title:'Synthesis task', context:{ findings: bc.context.findings }, tags:['synthesis_task'] })});
  }
  if (tags.includes('synthesis_done') && lastUser) {
    await fetch(`${BASE}/breadcrumbs/${lastUser.id}`, { method:'PATCH', headers:{ 'Content-Type':'application/json', 'If-Match':'"'+lastUser.version+'"' }, body: JSON.stringify({ context:{ ...lastUser.context, reply: bc.context.answer } })});
  }
};
```

```javascript
// researcher_sse.js
import EventSource from 'eventsource';
import fetch from 'node-fetch';
const BASE = process.env.RCRT_URL || 'http://localhost:8081';
const es = new EventSource(`${BASE}/events/stream`, { headers: { Accept: 'text/event-stream' } });
es.onmessage = async (m) => {
  const evt = JSON.parse(m.data);
  if (evt.type !== 'breadcrumb.updated') return;
  const bc = await fetch(`${BASE}/breadcrumbs/${evt.breadcrumb_id}/full`).then(r=>r.json());
  if ((bc.tags||[]).includes('research_task')) {
    const findings = `Findings for: ${bc.context.query}`;
    await fetch(`${BASE}/breadcrumbs`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ title:'Research result', context:{ findings }, tags:['research_done'] })});
  }
};
```

```javascript
// synthesizer_sse.js
import EventSource from 'eventsource';
import fetch from 'node-fetch';
const BASE = process.env.RCRT_URL || 'http://localhost:8081';
const es = new EventSource(`${BASE}/events/stream`, { headers: { Accept: 'text/event-stream' } });
es.onmessage = async (m) => {
  const evt = JSON.parse(m.data);
  if (evt.type !== 'breadcrumb.updated') return;
  const bc = await fetch(`${BASE}/breadcrumbs/${evt.breadcrumb_id}/full`).then(r=>r.json());
  if ((bc.tags||[]).includes('synthesis_task')) {
    const answer = bc.context.findings ? `Answer: ${bc.context.findings}` : 'Answer: synthesized';
    await fetch(`${BASE}/breadcrumbs`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ title:'Synthesis result', context:{ answer }, tags:['synthesis_done'] })});
  }
};
```

3) Kick off
```
curl -X POST http://localhost:8081/breadcrumbs -H 'Content-Type: application/json' -d '{
  "title":"User message", "context": { "text": "Plan a weekend trip" }, "tags":["user_message"]
}'
```

Expected: Supervisor creates tasks → Researcher emits findings → Supervisor triggers Synthesizer → Synthesizer emits final → Supervisor patches the `user_message` with `reply`.