create table if not exists secret_audit (
  id uuid primary key default uuid_generate_v4(),
  secret_id uuid not null references secrets(id) on delete cascade,
  agent_id uuid,
  action text not null, -- 'decrypt' | 'rotate' | 'create'
  reason text,
  created_at timestamptz not null default now()
);


