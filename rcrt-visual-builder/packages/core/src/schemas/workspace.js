import { z } from 'zod';
import { BreadcrumbBaseSchema } from './base';
// Workspace definition schema (v1)
export const WorkspaceDefinitionV1Schema = BreadcrumbBaseSchema.extend({
    schema_name: z.literal('workspace.def.v1'),
    context: z.object({
        workspace_id: z.string().optional(),
        tenant_id: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        policy: z.object({
            token_budget_bytes: z.number(),
            delivery_throttle_ms: z.number(),
        }).optional(),
        quotas: z.object({
            max_breadcrumbs: z.number().optional(),
            max_agents: z.number().optional(),
            max_flows: z.number().optional(),
            max_storage_gb: z.number().optional(),
        }).optional(),
        settings: z.object({
            default_model: z.string().optional(),
            timezone: z.string().optional(),
            features: z.array(z.string()).optional(),
        }).optional(),
    }),
});
// Tool catalog schema (v1)
export const ToolsCatalogV1Schema = BreadcrumbBaseSchema.extend({
    schema_name: z.literal('tools.catalog.v1'),
    context: z.object({
        tools: z.array(z.object({
            name: z.string(),
            description: z.string(),
            input_schema: z.record(z.any()),
            output_schema: z.record(z.any()).optional(),
            executor: z.string(),
            category: z.string().optional(),
            icon: z.string().optional(),
        })),
    }),
});
// Secrets vault schema (v1)
export const SecretsVaultV1Schema = BreadcrumbBaseSchema.extend({
    schema_name: z.literal('secrets.vault.v1'),
    context: z.object({
        secret_ids: z.record(z.string()),
        metadata: z.object({
            created_at: z.string().datetime(),
            created_by: z.string(),
            encryption: z.string(),
            rotation_schedule: z.string().optional(),
        }),
    }),
});
// Secrets request schema (v1)
export const SecretsRequestV1Schema = z.object({
    schema_name: z.literal('secrets.request.v1'),
    keys: z.array(z.string()),
    optional: z.array(z.string()).optional(),
    node_id: z.string().optional(),
});
// Secrets credentials schema (v1)
export const SecretsCredentialsV1Schema = z.object({
    schema_name: z.literal('secrets.credentials.v1'),
    credentials: z.record(z.string()),
});
// Secrets access audit schema (v1)
export const SecretsAccessV1Schema = BreadcrumbBaseSchema.extend({
    schema_name: z.literal('secrets.access.v1'),
    context: z.object({
        requested_keys: z.array(z.string()),
        provided_keys: z.array(z.string()),
        requesting_node: z.string().optional(),
        timestamp: z.string().datetime(),
    }),
});
//# sourceMappingURL=workspace.js.map