import { z } from 'zod';
import { BreadcrumbBaseSchema, SelectorSchema } from './base';
import { ToolDefinitionSchema } from './llm';
// Agent definition schema (v1)
export const AgentDefinitionV1Schema = BreadcrumbBaseSchema.extend({
    schema_name: z.literal('agent.def.v1'),
    context: z.object({
        agent_id: z.string(),
        model: z.string(),
        system_prompt: z.string(),
        temperature: z.number().min(0).max(2).optional(),
        max_tokens: z.number().optional(),
        capabilities: z.object({
            can_create_breadcrumbs: z.boolean(),
            can_update_own: z.boolean(),
            can_delete_own: z.boolean(),
            can_spawn_agents: z.boolean(),
            can_modify_agents: z.boolean().optional(),
            can_create_flows: z.boolean().optional(),
        }),
        subscriptions: z.object({
            selectors: z.array(SelectorSchema),
        }),
        emits: z.object({
            tags: z.array(z.string()).optional(),
            schemas: z.array(z.string()).optional(),
        }).optional(),
        memory: z.object({
            type: z.enum(['breadcrumb', 'local', 'none']),
            tags: z.array(z.string()).optional(),
            ttl_hours: z.number().optional(),
        }).optional(),
        scaling: z.object({
            min_instances: z.number(),
            max_instances: z.number(),
            scale_on: z.enum(['queue_depth', 'cpu', 'memory', 'manual']),
            threshold: z.number(),
        }).optional(),
        tools: z.array(z.union([
            ToolDefinitionSchema,
            z.object({
                name: z.string(),
                description: z.string().optional(),
                creates: z.string().optional(),
                reads: z.array(z.string()).optional(),
            }),
        ])).optional(),
        owned_tags: z.array(z.string()).optional(),
    }),
});
// Agent memory schema (v1)
export const AgentMemoryV1Schema = BreadcrumbBaseSchema.extend({
    schema_name: z.literal('agent.memory.v1'),
    context: z.object({
        agent_id: z.string(),
        memory_type: z.enum(['short_term', 'long_term', 'working']),
        content: z.any(),
        created_at: z.string().datetime(),
        expires_at: z.string().datetime().optional(),
    }),
});
// Agent metrics schema (v1)
export const AgentMetricsV1Schema = BreadcrumbBaseSchema.extend({
    schema_name: z.literal('agent.metrics.v1'),
    context: z.object({
        agent_id: z.string(),
        timestamp: z.string().datetime(),
        metrics: z.object({
            total_events_processed: z.number(),
            breadcrumbs_created: z.number(),
            breadcrumbs_updated: z.number(),
            breadcrumbs_deleted: z.number(),
            llm_calls: z.number(),
            tool_calls: z.number(),
            avg_processing_time_ms: z.number(),
            error_count: z.number(),
            success_rate: z.number(),
        }),
        period: z.enum(['minute', 'hour', 'day']),
    }),
});
//# sourceMappingURL=agent.js.map