-- Ensure default system agent exists for hygiene and other system operations
-- This prevents foreign key violations when system processes create breadcrumbs

-- Ensure default tenant exists first
INSERT INTO tenants (id, owner_id, name, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Default Tenant',
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Ensure system agent exists
INSERT INTO agents (id, owner_id, roles, created_at)
VALUES (
    '00000000-0000-0000-0000-0000000000aa'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    ARRAY['emitter', 'curator'],
    NOW()
)
ON CONFLICT (id, owner_id) DO UPDATE
SET roles = ARRAY['emitter', 'curator']
WHERE agents.id = EXCLUDED.id AND agents.owner_id = EXCLUDED.owner_id;

-- Also ensure the tools runner agent exists if needed
INSERT INTO agents (id, owner_id, roles, created_at)
VALUES (
    '00000000-0000-0000-0000-0000000000bb'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    ARRAY['emitter', 'curator'],
    NOW()
)
ON CONFLICT (id, owner_id) DO UPDATE
SET roles = ARRAY['emitter', 'curator']
WHERE agents.id = EXCLUDED.id AND agents.owner_id = EXCLUDED.owner_id;

-- Verify the agents were created
SELECT id, owner_id, roles, created_at 
FROM agents 
WHERE owner_id = '00000000-0000-0000-0000-000000000001'::uuid
ORDER BY created_at;
