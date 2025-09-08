import { z } from 'zod';
export declare const AgentDefinitionV1Schema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    created_at: z.ZodOptional<z.ZodString>;
    updated_at: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
} & {
    schema_name: z.ZodLiteral<"agent.def.v1">;
    context: z.ZodObject<{
        agent_id: z.ZodString;
        model: z.ZodString;
        system_prompt: z.ZodString;
        temperature: z.ZodOptional<z.ZodNumber>;
        max_tokens: z.ZodOptional<z.ZodNumber>;
        capabilities: z.ZodObject<{
            can_create_breadcrumbs: z.ZodBoolean;
            can_update_own: z.ZodBoolean;
            can_delete_own: z.ZodBoolean;
            can_spawn_agents: z.ZodBoolean;
            can_modify_agents: z.ZodOptional<z.ZodBoolean>;
            can_create_flows: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            can_create_breadcrumbs: boolean;
            can_update_own: boolean;
            can_delete_own: boolean;
            can_spawn_agents: boolean;
            can_modify_agents?: boolean | undefined;
            can_create_flows?: boolean | undefined;
        }, {
            can_create_breadcrumbs: boolean;
            can_update_own: boolean;
            can_delete_own: boolean;
            can_spawn_agents: boolean;
            can_modify_agents?: boolean | undefined;
            can_create_flows?: boolean | undefined;
        }>;
        subscriptions: z.ZodObject<{
            selectors: z.ZodArray<z.ZodObject<{
                any_tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                all_tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                schema_name: z.ZodOptional<z.ZodString>;
                context_path: z.ZodOptional<z.ZodString>;
                workspace: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                schema_name?: string | undefined;
                any_tags?: string[] | undefined;
                all_tags?: string[] | undefined;
                context_path?: string | undefined;
                workspace?: string | undefined;
            }, {
                schema_name?: string | undefined;
                any_tags?: string[] | undefined;
                all_tags?: string[] | undefined;
                context_path?: string | undefined;
                workspace?: string | undefined;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            selectors: {
                schema_name?: string | undefined;
                any_tags?: string[] | undefined;
                all_tags?: string[] | undefined;
                context_path?: string | undefined;
                workspace?: string | undefined;
            }[];
        }, {
            selectors: {
                schema_name?: string | undefined;
                any_tags?: string[] | undefined;
                all_tags?: string[] | undefined;
                context_path?: string | undefined;
                workspace?: string | undefined;
            }[];
        }>;
        emits: z.ZodOptional<z.ZodObject<{
            tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            schemas: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            tags?: string[] | undefined;
            schemas?: string[] | undefined;
        }, {
            tags?: string[] | undefined;
            schemas?: string[] | undefined;
        }>>;
        memory: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["breadcrumb", "local", "none"]>;
            tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            ttl_hours: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            type: "breadcrumb" | "local" | "none";
            tags?: string[] | undefined;
            ttl_hours?: number | undefined;
        }, {
            type: "breadcrumb" | "local" | "none";
            tags?: string[] | undefined;
            ttl_hours?: number | undefined;
        }>>;
        scaling: z.ZodOptional<z.ZodObject<{
            min_instances: z.ZodNumber;
            max_instances: z.ZodNumber;
            scale_on: z.ZodEnum<["queue_depth", "cpu", "memory", "manual"]>;
            threshold: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            min_instances: number;
            max_instances: number;
            scale_on: "memory" | "queue_depth" | "cpu" | "manual";
            threshold: number;
        }, {
            min_instances: number;
            max_instances: number;
            scale_on: "memory" | "queue_depth" | "cpu" | "manual";
            threshold: number;
        }>>;
        tools: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodObject<{
            type: z.ZodLiteral<"function">;
            function: z.ZodObject<{
                name: z.ZodString;
                description: z.ZodString;
                parameters: z.ZodRecord<z.ZodString, z.ZodAny>;
            }, "strip", z.ZodTypeAny, {
                description: string;
                name: string;
                parameters: Record<string, any>;
            }, {
                description: string;
                name: string;
                parameters: Record<string, any>;
            }>;
        }, "strip", z.ZodTypeAny, {
            function: {
                description: string;
                name: string;
                parameters: Record<string, any>;
            };
            type: "function";
        }, {
            function: {
                description: string;
                name: string;
                parameters: Record<string, any>;
            };
            type: "function";
        }>, z.ZodObject<{
            name: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            creates: z.ZodOptional<z.ZodString>;
            reads: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            description?: string | undefined;
            creates?: string | undefined;
            reads?: string[] | undefined;
        }, {
            name: string;
            description?: string | undefined;
            creates?: string | undefined;
            reads?: string[] | undefined;
        }>]>, "many">>;
        owned_tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        model: string;
        agent_id: string;
        system_prompt: string;
        capabilities: {
            can_create_breadcrumbs: boolean;
            can_update_own: boolean;
            can_delete_own: boolean;
            can_spawn_agents: boolean;
            can_modify_agents?: boolean | undefined;
            can_create_flows?: boolean | undefined;
        };
        subscriptions: {
            selectors: {
                schema_name?: string | undefined;
                any_tags?: string[] | undefined;
                all_tags?: string[] | undefined;
                context_path?: string | undefined;
                workspace?: string | undefined;
            }[];
        };
        tools?: ({
            function: {
                description: string;
                name: string;
                parameters: Record<string, any>;
            };
            type: "function";
        } | {
            name: string;
            description?: string | undefined;
            creates?: string | undefined;
            reads?: string[] | undefined;
        })[] | undefined;
        temperature?: number | undefined;
        max_tokens?: number | undefined;
        emits?: {
            tags?: string[] | undefined;
            schemas?: string[] | undefined;
        } | undefined;
        memory?: {
            type: "breadcrumb" | "local" | "none";
            tags?: string[] | undefined;
            ttl_hours?: number | undefined;
        } | undefined;
        scaling?: {
            min_instances: number;
            max_instances: number;
            scale_on: "memory" | "queue_depth" | "cpu" | "manual";
            threshold: number;
        } | undefined;
        owned_tags?: string[] | undefined;
    }, {
        model: string;
        agent_id: string;
        system_prompt: string;
        capabilities: {
            can_create_breadcrumbs: boolean;
            can_update_own: boolean;
            can_delete_own: boolean;
            can_spawn_agents: boolean;
            can_modify_agents?: boolean | undefined;
            can_create_flows?: boolean | undefined;
        };
        subscriptions: {
            selectors: {
                schema_name?: string | undefined;
                any_tags?: string[] | undefined;
                all_tags?: string[] | undefined;
                context_path?: string | undefined;
                workspace?: string | undefined;
            }[];
        };
        tools?: ({
            function: {
                description: string;
                name: string;
                parameters: Record<string, any>;
            };
            type: "function";
        } | {
            name: string;
            description?: string | undefined;
            creates?: string | undefined;
            reads?: string[] | undefined;
        })[] | undefined;
        temperature?: number | undefined;
        max_tokens?: number | undefined;
        emits?: {
            tags?: string[] | undefined;
            schemas?: string[] | undefined;
        } | undefined;
        memory?: {
            type: "breadcrumb" | "local" | "none";
            tags?: string[] | undefined;
            ttl_hours?: number | undefined;
        } | undefined;
        scaling?: {
            min_instances: number;
            max_instances: number;
            scale_on: "memory" | "queue_depth" | "cpu" | "manual";
            threshold: number;
        } | undefined;
        owned_tags?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    schema_name: "agent.def.v1";
    title: string;
    tags: string[];
    context: {
        model: string;
        agent_id: string;
        system_prompt: string;
        capabilities: {
            can_create_breadcrumbs: boolean;
            can_update_own: boolean;
            can_delete_own: boolean;
            can_spawn_agents: boolean;
            can_modify_agents?: boolean | undefined;
            can_create_flows?: boolean | undefined;
        };
        subscriptions: {
            selectors: {
                schema_name?: string | undefined;
                any_tags?: string[] | undefined;
                all_tags?: string[] | undefined;
                context_path?: string | undefined;
                workspace?: string | undefined;
            }[];
        };
        tools?: ({
            function: {
                description: string;
                name: string;
                parameters: Record<string, any>;
            };
            type: "function";
        } | {
            name: string;
            description?: string | undefined;
            creates?: string | undefined;
            reads?: string[] | undefined;
        })[] | undefined;
        temperature?: number | undefined;
        max_tokens?: number | undefined;
        emits?: {
            tags?: string[] | undefined;
            schemas?: string[] | undefined;
        } | undefined;
        memory?: {
            type: "breadcrumb" | "local" | "none";
            tags?: string[] | undefined;
            ttl_hours?: number | undefined;
        } | undefined;
        scaling?: {
            min_instances: number;
            max_instances: number;
            scale_on: "memory" | "queue_depth" | "cpu" | "manual";
            threshold: number;
        } | undefined;
        owned_tags?: string[] | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}, {
    schema_name: "agent.def.v1";
    title: string;
    tags: string[];
    context: {
        model: string;
        agent_id: string;
        system_prompt: string;
        capabilities: {
            can_create_breadcrumbs: boolean;
            can_update_own: boolean;
            can_delete_own: boolean;
            can_spawn_agents: boolean;
            can_modify_agents?: boolean | undefined;
            can_create_flows?: boolean | undefined;
        };
        subscriptions: {
            selectors: {
                schema_name?: string | undefined;
                any_tags?: string[] | undefined;
                all_tags?: string[] | undefined;
                context_path?: string | undefined;
                workspace?: string | undefined;
            }[];
        };
        tools?: ({
            function: {
                description: string;
                name: string;
                parameters: Record<string, any>;
            };
            type: "function";
        } | {
            name: string;
            description?: string | undefined;
            creates?: string | undefined;
            reads?: string[] | undefined;
        })[] | undefined;
        temperature?: number | undefined;
        max_tokens?: number | undefined;
        emits?: {
            tags?: string[] | undefined;
            schemas?: string[] | undefined;
        } | undefined;
        memory?: {
            type: "breadcrumb" | "local" | "none";
            tags?: string[] | undefined;
            ttl_hours?: number | undefined;
        } | undefined;
        scaling?: {
            min_instances: number;
            max_instances: number;
            scale_on: "memory" | "queue_depth" | "cpu" | "manual";
            threshold: number;
        } | undefined;
        owned_tags?: string[] | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}>;
export type AgentDefinitionV1 = z.infer<typeof AgentDefinitionV1Schema>;
export declare const AgentMemoryV1Schema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    created_at: z.ZodOptional<z.ZodString>;
    updated_at: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
} & {
    schema_name: z.ZodLiteral<"agent.memory.v1">;
    context: z.ZodObject<{
        agent_id: z.ZodString;
        memory_type: z.ZodEnum<["short_term", "long_term", "working"]>;
        content: z.ZodAny;
        created_at: z.ZodString;
        expires_at: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        created_at: string;
        agent_id: string;
        memory_type: "short_term" | "long_term" | "working";
        content?: any;
        expires_at?: string | undefined;
    }, {
        created_at: string;
        agent_id: string;
        memory_type: "short_term" | "long_term" | "working";
        content?: any;
        expires_at?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    schema_name: "agent.memory.v1";
    title: string;
    tags: string[];
    context: {
        created_at: string;
        agent_id: string;
        memory_type: "short_term" | "long_term" | "working";
        content?: any;
        expires_at?: string | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}, {
    schema_name: "agent.memory.v1";
    title: string;
    tags: string[];
    context: {
        created_at: string;
        agent_id: string;
        memory_type: "short_term" | "long_term" | "working";
        content?: any;
        expires_at?: string | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}>;
export type AgentMemoryV1 = z.infer<typeof AgentMemoryV1Schema>;
export declare const AgentMetricsV1Schema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    created_at: z.ZodOptional<z.ZodString>;
    updated_at: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
} & {
    schema_name: z.ZodLiteral<"agent.metrics.v1">;
    context: z.ZodObject<{
        agent_id: z.ZodString;
        timestamp: z.ZodString;
        metrics: z.ZodObject<{
            total_events_processed: z.ZodNumber;
            breadcrumbs_created: z.ZodNumber;
            breadcrumbs_updated: z.ZodNumber;
            breadcrumbs_deleted: z.ZodNumber;
            llm_calls: z.ZodNumber;
            tool_calls: z.ZodNumber;
            avg_processing_time_ms: z.ZodNumber;
            error_count: z.ZodNumber;
            success_rate: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            tool_calls: number;
            success_rate: number;
            total_events_processed: number;
            breadcrumbs_created: number;
            breadcrumbs_updated: number;
            breadcrumbs_deleted: number;
            llm_calls: number;
            avg_processing_time_ms: number;
            error_count: number;
        }, {
            tool_calls: number;
            success_rate: number;
            total_events_processed: number;
            breadcrumbs_created: number;
            breadcrumbs_updated: number;
            breadcrumbs_deleted: number;
            llm_calls: number;
            avg_processing_time_ms: number;
            error_count: number;
        }>;
        period: z.ZodEnum<["minute", "hour", "day"]>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        agent_id: string;
        metrics: {
            tool_calls: number;
            success_rate: number;
            total_events_processed: number;
            breadcrumbs_created: number;
            breadcrumbs_updated: number;
            breadcrumbs_deleted: number;
            llm_calls: number;
            avg_processing_time_ms: number;
            error_count: number;
        };
        period: "minute" | "hour" | "day";
    }, {
        timestamp: string;
        agent_id: string;
        metrics: {
            tool_calls: number;
            success_rate: number;
            total_events_processed: number;
            breadcrumbs_created: number;
            breadcrumbs_updated: number;
            breadcrumbs_deleted: number;
            llm_calls: number;
            avg_processing_time_ms: number;
            error_count: number;
        };
        period: "minute" | "hour" | "day";
    }>;
}, "strip", z.ZodTypeAny, {
    schema_name: "agent.metrics.v1";
    title: string;
    tags: string[];
    context: {
        timestamp: string;
        agent_id: string;
        metrics: {
            tool_calls: number;
            success_rate: number;
            total_events_processed: number;
            breadcrumbs_created: number;
            breadcrumbs_updated: number;
            breadcrumbs_deleted: number;
            llm_calls: number;
            avg_processing_time_ms: number;
            error_count: number;
        };
        period: "minute" | "hour" | "day";
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}, {
    schema_name: "agent.metrics.v1";
    title: string;
    tags: string[];
    context: {
        timestamp: string;
        agent_id: string;
        metrics: {
            tool_calls: number;
            success_rate: number;
            total_events_processed: number;
            breadcrumbs_created: number;
            breadcrumbs_updated: number;
            breadcrumbs_deleted: number;
            llm_calls: number;
            avg_processing_time_ms: number;
            error_count: number;
        };
        period: "minute" | "hour" | "day";
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}>;
export type AgentMetricsV1 = z.infer<typeof AgentMetricsV1Schema>;
//# sourceMappingURL=agent.d.ts.map