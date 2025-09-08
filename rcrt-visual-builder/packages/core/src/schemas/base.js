import { z } from 'zod';
// Base breadcrumb schema
export const BreadcrumbBaseSchema = z.object({
    id: z.string().uuid().optional(),
    schema_name: z.string(),
    title: z.string(),
    tags: z.array(z.string()),
    context: z.record(z.any()),
    created_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional(),
    version: z.number().optional(),
});
// Selector schema for subscriptions
export const SelectorSchema = z.object({
    any_tags: z.array(z.string()).optional(),
    all_tags: z.array(z.string()).optional(),
    schema_name: z.string().optional(),
    context_path: z.string().optional(),
    workspace: z.string().optional(),
});
// Port schema for node connections
export const NodePortSchema = z.object({
    id: z.string(),
    type: z.enum(['messages', 'response', 'event', 'data', 'operation', 'selectors', 'tools']),
    schema: z.string().optional(),
    description: z.string().optional(),
    multiple: z.boolean().optional(),
    optional: z.boolean().optional(),
    color: z.string().optional(),
});
// Connection schema
export const ConnectionSchema = z.object({
    id: z.string().optional(),
    from: z.object({
        node: z.string(),
        port: z.string(),
    }),
    to: z.object({
        node: z.string(),
        port: z.string(),
    }),
    transform: z.any().optional(),
});
// Position schema
export const PositionSchema = z.object({
    x: z.number(),
    y: z.number(),
});
//# sourceMappingURL=base.js.map