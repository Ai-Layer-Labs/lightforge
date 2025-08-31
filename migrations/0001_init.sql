-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- Tenants
create table if not exists tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Agents
create table if not exists agents (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references tenants(id),
  agent_key text unique not null,
  roles text[] not null,
  webhook_secret text,
  created_at timestamptz not null default now()
);

-- Enums
do $$ begin
  create type visibility as enum ('public','team','private');
exception when duplicate_object then null; end $$;
do $$ begin
  create type sensitivity as enum ('low','pii','secret');
exception when duplicate_object then null; end $$;

-- Breadcrumbs
create table if not exists breadcrumbs (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references tenants(id),
  title text not null,
  context jsonb not null,
  tags text[] not null default '{}',
  schema_name text,
  visibility visibility not null default 'team',
  sensitivity sensitivity not null default 'low',
  version int not null default 1,
  checksum text not null,
  ttl timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references agents(id),
  updated_by uuid references agents(id),
  size_bytes int not null,
  embedding vector(384)
);

create index if not exists idx_breadcrumbs_owner on breadcrumbs(owner_id);
create index if not exists idx_breadcrumbs_tags on breadcrumbs using gin(tags);
create index if not exists idx_breadcrumbs_schema on breadcrumbs(schema_name);
create index if not exists idx_breadcrumbs_updated on breadcrumbs(updated_at desc);
create index if not exists idx_breadcrumbs_ttl on breadcrumbs(ttl);
create index if not exists idx_breadcrumbs_embedding on breadcrumbs using ivfflat (embedding vector_cosine_ops);

-- History
create table if not exists breadcrumb_history (
  breadcrumb_id uuid not null references breadcrumbs(id) on delete cascade,
  version int not null,
  context jsonb not null,
  updated_at timestamptz not null,
  updated_by uuid references agents(id),
  checksum text not null,
  primary key (breadcrumb_id, version)
);

-- Subscriptions
create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references tenants(id),
  breadcrumb_id uuid references breadcrumbs(id) on delete cascade,
  agent_id uuid not null references agents(id),
  channels jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists selector_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references tenants(id),
  agent_id uuid not null references agents(id),
  selector jsonb not null,
  created_at timestamptz not null default now()
);

-- ACL
do $$ begin
  create type acl_action as enum ('read_context','read_full','update','delete','subscribe');
exception when duplicate_object then null; end $$;

create table if not exists acl_entries (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references tenants(id),
  breadcrumb_id uuid not null references breadcrumbs(id) on delete cascade,
  grantee_agent_id uuid references agents(id),
  grantee_owner_id uuid references tenants(id),
  actions acl_action[] not null,
  created_at timestamptz not null default now()
);

-- Secrets
create table if not exists secrets (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references tenants(id),
  name text not null,
  scope_type text not null,
  scope_id uuid,
  enc_blob bytea not null,
  dek_encrypted bytea not null,
  kek_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_rotation_at timestamptz
);

-- RLS enable and policies
alter table agents enable row level security;
alter table breadcrumbs enable row level security;
alter table breadcrumb_history enable row level security;
alter table subscriptions enable row level security;
alter table selector_subscriptions enable row level security;
alter table acl_entries enable row level security;
alter table secrets enable row level security;

-- Ensure custom GUCs exist at runtime; policies use them
create or replace function app_current_owner_id() returns uuid language sql stable as $$
  select current_setting('app.current_owner_id', true)::uuid
$$;
create or replace function app_current_agent_id() returns uuid language sql stable as $$
  select current_setting('app.current_agent_id', true)::uuid
$$;

-- Tenant isolation baseline
create policy tenant_isolation_agents on agents using (owner_id = app_current_owner_id());
create policy tenant_isolation_breadcrumbs on breadcrumbs using (
  owner_id = app_current_owner_id()
  or exists (
    select 1 from acl_entries a
    where a.breadcrumb_id = breadcrumbs.id
      and (a.grantee_owner_id = app_current_owner_id() or a.grantee_agent_id = app_current_agent_id())
      and 'read_context' = any(a.actions)
  )
);
create policy tenant_isolation_breadcrumb_history on breadcrumb_history using (
  exists (select 1 from breadcrumbs b where b.id = breadcrumb_history.breadcrumb_id and (b.owner_id = app_current_owner_id()))
);
create policy tenant_isolation_subscriptions on subscriptions using (owner_id = app_current_owner_id());
create policy tenant_isolation_selector_subscriptions on selector_subscriptions using (owner_id = app_current_owner_id());
create policy tenant_isolation_acl on acl_entries using (owner_id = app_current_owner_id());
create policy tenant_isolation_secrets on secrets using (owner_id = app_current_owner_id());


