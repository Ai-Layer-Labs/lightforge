import { z } from 'zod';
export declare const WorkspaceDefinitionV1Schema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    created_at: z.ZodOptional<z.ZodString>;
    updated_at: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
} & {
    schema_name: z.ZodLiteral<"workspace.def.v1">;
    context: z.ZodObject<{
        workspace_id: z.ZodOptional<z.ZodString>;
        tenant_id: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        policy: z.ZodOptional<z.ZodObject<{
            token_budget_bytes: z.ZodNumber;
            delivery_throttle_ms: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            token_budget_bytes: number;
            delivery_throttle_ms: number;
        }, {
            token_budget_bytes: number;
            delivery_throttle_ms: number;
        }>>;
        quotas: z.ZodOptional<z.ZodObject<{
            max_breadcrumbs: z.ZodOptional<z.ZodNumber>;
            max_agents: z.ZodOptional<z.ZodNumber>;
            max_flows: z.ZodOptional<z.ZodNumber>;
            max_storage_gb: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            max_breadcrumbs?: number | undefined;
            max_agents?: number | undefined;
            max_flows?: number | undefined;
            max_storage_gb?: number | undefined;
        }, {
            max_breadcrumbs?: number | undefined;
            max_agents?: number | undefined;
            max_flows?: number | undefined;
            max_storage_gb?: number | undefined;
        }>>;
        settings: z.ZodOptional<z.ZodObject<{
            default_model: z.ZodOptional<z.ZodString>;
            timezone: z.ZodOptional<z.ZodString>;
            features: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            default_model?: string | undefined;
            timezone?: string | undefined;
            features?: string[] | undefined;
        }, {
            default_model?: string | undefined;
            timezone?: string | undefined;
            features?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        description?: string | undefined;
        name?: string | undefined;
        workspace_id?: string | undefined;
        tenant_id?: string | undefined;
        policy?: {
            token_budget_bytes: number;
            delivery_throttle_ms: number;
        } | undefined;
        quotas?: {
            max_breadcrumbs?: number | undefined;
            max_agents?: number | undefined;
            max_flows?: number | undefined;
            max_storage_gb?: number | undefined;
        } | undefined;
        settings?: {
            default_model?: string | undefined;
            timezone?: string | undefined;
            features?: string[] | undefined;
        } | undefined;
    }, {
        description?: string | undefined;
        name?: string | undefined;
        workspace_id?: string | undefined;
        tenant_id?: string | undefined;
        policy?: {
            token_budget_bytes: number;
            delivery_throttle_ms: number;
        } | undefined;
        quotas?: {
            max_breadcrumbs?: number | undefined;
            max_agents?: number | undefined;
            max_flows?: number | undefined;
            max_storage_gb?: number | undefined;
        } | undefined;
        settings?: {
            default_model?: string | undefined;
            timezone?: string | undefined;
            features?: string[] | undefined;
        } | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    schema_name: "workspace.def.v1";
    title: string;
    tags: string[];
    context: {
        description?: string | undefined;
        name?: string | undefined;
        workspace_id?: string | undefined;
        tenant_id?: string | undefined;
        policy?: {
            token_budget_bytes: number;
            delivery_throttle_ms: number;
        } | undefined;
        quotas?: {
            max_breadcrumbs?: number | undefined;
            max_agents?: number | undefined;
            max_flows?: number | undefined;
            max_storage_gb?: number | undefined;
        } | undefined;
        settings?: {
            default_model?: string | undefined;
            timezone?: string | undefined;
            features?: string[] | undefined;
        } | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}, {
    schema_name: "workspace.def.v1";
    title: string;
    tags: string[];
    context: {
        description?: string | undefined;
        name?: string | undefined;
        workspace_id?: string | undefined;
        tenant_id?: string | undefined;
        policy?: {
            token_budget_bytes: number;
            delivery_throttle_ms: number;
        } | undefined;
        quotas?: {
            max_breadcrumbs?: number | undefined;
            max_agents?: number | undefined;
            max_flows?: number | undefined;
            max_storage_gb?: number | undefined;
        } | undefined;
        settings?: {
            default_model?: string | undefined;
            timezone?: string | undefined;
            features?: string[] | undefined;
        } | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}>;
export type WorkspaceDefinitionV1 = z.infer<typeof WorkspaceDefinitionV1Schema>;
export declare const ToolsCatalogV1Schema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    created_at: z.ZodOptional<z.ZodString>;
    updated_at: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
} & {
    schema_name: z.ZodLiteral<"tools.catalog.v1">;
    context: z.ZodObject<{
        tools: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            description: z.ZodString;
            input_schema: z.ZodRecord<z.ZodString, z.ZodAny>;
            output_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            executor: z.ZodString;
            category: z.ZodOptional<z.ZodString>;
            icon: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            description: string;
            name: string;
            executor: string;
            input_schema: Record<string, any>;
            category?: string | undefined;
            icon?: string | undefined;
            output_schema?: Record<string, any> | undefined;
        }, {
            description: string;
            name: string;
            executor: string;
            input_schema: Record<string, any>;
            category?: string | undefined;
            icon?: string | undefined;
            output_schema?: Record<string, any> | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        tools: {
            description: string;
            name: string;
            executor: string;
            input_schema: Record<string, any>;
            category?: string | undefined;
            icon?: string | undefined;
            output_schema?: Record<string, any> | undefined;
        }[];
    }, {
        tools: {
            description: string;
            name: string;
            executor: string;
            input_schema: Record<string, any>;
            category?: string | undefined;
            icon?: string | undefined;
            output_schema?: Record<string, any> | undefined;
        }[];
    }>;
}, "strip", z.ZodTypeAny, {
    schema_name: "tools.catalog.v1";
    title: string;
    tags: string[];
    context: {
        tools: {
            description: string;
            name: string;
            executor: string;
            input_schema: Record<string, any>;
            category?: string | undefined;
            icon?: string | undefined;
            output_schema?: Record<string, any> | undefined;
        }[];
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}, {
    schema_name: "tools.catalog.v1";
    title: string;
    tags: string[];
    context: {
        tools: {
            description: string;
            name: string;
            executor: string;
            input_schema: Record<string, any>;
            category?: string | undefined;
            icon?: string | undefined;
            output_schema?: Record<string, any> | undefined;
        }[];
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}>;
export type ToolsCatalogV1 = z.infer<typeof ToolsCatalogV1Schema>;
export declare const SecretsVaultV1Schema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    created_at: z.ZodOptional<z.ZodString>;
    updated_at: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
} & {
    schema_name: z.ZodLiteral<"secrets.vault.v1">;
    context: z.ZodObject<{
        secret_ids: z.ZodRecord<z.ZodString, z.ZodString>;
        metadata: z.ZodObject<{
            created_at: z.ZodString;
            created_by: z.ZodString;
            encryption: z.ZodString;
            rotation_schedule: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            created_at: string;
            created_by: string;
            encryption: string;
            rotation_schedule?: string | undefined;
        }, {
            created_at: string;
            created_by: string;
            encryption: string;
            rotation_schedule?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        metadata: {
            created_at: string;
            created_by: string;
            encryption: string;
            rotation_schedule?: string | undefined;
        };
        secret_ids: Record<string, string>;
    }, {
        metadata: {
            created_at: string;
            created_by: string;
            encryption: string;
            rotation_schedule?: string | undefined;
        };
        secret_ids: Record<string, string>;
    }>;
}, "strip", z.ZodTypeAny, {
    schema_name: "secrets.vault.v1";
    title: string;
    tags: string[];
    context: {
        metadata: {
            created_at: string;
            created_by: string;
            encryption: string;
            rotation_schedule?: string | undefined;
        };
        secret_ids: Record<string, string>;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}, {
    schema_name: "secrets.vault.v1";
    title: string;
    tags: string[];
    context: {
        metadata: {
            created_at: string;
            created_by: string;
            encryption: string;
            rotation_schedule?: string | undefined;
        };
        secret_ids: Record<string, string>;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}>;
export type SecretsVaultV1 = z.infer<typeof SecretsVaultV1Schema>;
export declare const SecretsRequestV1Schema: z.ZodObject<{
    schema_name: z.ZodLiteral<"secrets.request.v1">;
    keys: z.ZodArray<z.ZodString, "many">;
    optional: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    node_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    schema_name: "secrets.request.v1";
    keys: string[];
    optional?: string[] | undefined;
    node_id?: string | undefined;
}, {
    schema_name: "secrets.request.v1";
    keys: string[];
    optional?: string[] | undefined;
    node_id?: string | undefined;
}>;
export type SecretsRequestV1 = z.infer<typeof SecretsRequestV1Schema>;
export declare const SecretsCredentialsV1Schema: z.ZodObject<{
    schema_name: z.ZodLiteral<"secrets.credentials.v1">;
    credentials: z.ZodRecord<z.ZodString, z.ZodString>;
}, "strip", z.ZodTypeAny, {
    schema_name: "secrets.credentials.v1";
    credentials: Record<string, string>;
}, {
    schema_name: "secrets.credentials.v1";
    credentials: Record<string, string>;
}>;
export type SecretsCredentialsV1 = z.infer<typeof SecretsCredentialsV1Schema>;
export declare const SecretsAccessV1Schema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    created_at: z.ZodOptional<z.ZodString>;
    updated_at: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
} & {
    schema_name: z.ZodLiteral<"secrets.access.v1">;
    context: z.ZodObject<{
        requested_keys: z.ZodArray<z.ZodString, "many">;
        provided_keys: z.ZodArray<z.ZodString, "many">;
        requesting_node: z.ZodOptional<z.ZodString>;
        timestamp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        requested_keys: string[];
        provided_keys: string[];
        requesting_node?: string | undefined;
    }, {
        timestamp: string;
        requested_keys: string[];
        provided_keys: string[];
        requesting_node?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    schema_name: "secrets.access.v1";
    title: string;
    tags: string[];
    context: {
        timestamp: string;
        requested_keys: string[];
        provided_keys: string[];
        requesting_node?: string | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}, {
    schema_name: "secrets.access.v1";
    title: string;
    tags: string[];
    context: {
        timestamp: string;
        requested_keys: string[];
        provided_keys: string[];
        requesting_node?: string | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}>;
export type SecretsAccessV1 = z.infer<typeof SecretsAccessV1Schema>;
//# sourceMappingURL=workspace.d.ts.map