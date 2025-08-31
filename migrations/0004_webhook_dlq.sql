create table if not exists webhook_dlq (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references tenants(id),
  agent_id uuid not null references agents(id),
  url text not null,
  payload jsonb not null,
  last_error text,
  created_at timestamptz not null default now()
);


