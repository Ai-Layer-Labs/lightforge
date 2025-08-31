-- Remove duplicate webhook rows, keep the newest by id
delete from agent_webhooks a using agent_webhooks b
where a.agent_id = b.agent_id and a.url = b.url and a.id < b.id;

-- Add unique constraint on (agent_id, url)
alter table agent_webhooks add constraint uq_agent_webhooks_agent_url unique (agent_id, url);


