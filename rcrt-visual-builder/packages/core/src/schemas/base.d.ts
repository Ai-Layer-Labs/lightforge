import { z } from 'zod';
export declare const BreadcrumbBaseSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    schema_name: z.ZodString;
    title: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    context: z.ZodRecord<z.ZodString, z.ZodAny>;
    created_at: z.ZodOptional<z.ZodString>;
    updated_at: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    schema_name: string;
    title: string;
    tags: string[];
    context: Record<string, any>;
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}, {
    schema_name: string;
    title: string;
    tags: string[];
    context: Record<string, any>;
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}>;
export type BreadcrumbBase = z.infer<typeof BreadcrumbBaseSchema>;
export declare const SelectorSchema: z.ZodObject<{
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
}>;
export type Selector = z.infer<typeof SelectorSchema>;
export declare const NodePortSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["messages", "response", "event", "data", "operation", "selectors", "tools"]>;
    schema: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    multiple: z.ZodOptional<z.ZodBoolean>;
    optional: z.ZodOptional<z.ZodBoolean>;
    color: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: "messages" | "response" | "event" | "data" | "operation" | "selectors" | "tools";
    schema?: string | undefined;
    description?: string | undefined;
    multiple?: boolean | undefined;
    optional?: boolean | undefined;
    color?: string | undefined;
}, {
    id: string;
    type: "messages" | "response" | "event" | "data" | "operation" | "selectors" | "tools";
    schema?: string | undefined;
    description?: string | undefined;
    multiple?: boolean | undefined;
    optional?: boolean | undefined;
    color?: string | undefined;
}>;
export type NodePort = z.infer<typeof NodePortSchema>;
export declare const ConnectionSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    from: z.ZodObject<{
        node: z.ZodString;
        port: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        node: string;
        port: string;
    }, {
        node: string;
        port: string;
    }>;
    to: z.ZodObject<{
        node: z.ZodString;
        port: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        node: string;
        port: string;
    }, {
        node: string;
        port: string;
    }>;
    transform: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    from: {
        node: string;
        port: string;
    };
    to: {
        node: string;
        port: string;
    };
    id?: string | undefined;
    transform?: any;
}, {
    from: {
        node: string;
        port: string;
    };
    to: {
        node: string;
        port: string;
    };
    id?: string | undefined;
    transform?: any;
}>;
export type Connection = z.infer<typeof ConnectionSchema>;
export declare const PositionSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    x: number;
    y: number;
}, {
    x: number;
    y: number;
}>;
export type Position = z.infer<typeof PositionSchema>;
//# sourceMappingURL=base.d.ts.map