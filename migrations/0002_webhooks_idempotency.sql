-- Agent webhooks
create table if not exists agent_webhooks (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references agents(id) on delete cascade,
  url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Idempotency keys for create/update
create table if not exists idempotency_keys (
  key text primary key,
  owner_id uuid not null,
  agent_id uuid,
  resource_type text not null,
  resource_id uuid,
  created_at timestamptz not null default now()
);


