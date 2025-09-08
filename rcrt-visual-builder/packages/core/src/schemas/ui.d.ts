import { z } from 'zod';
export declare const UIComponentV1Schema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    created_at: z.ZodOptional<z.ZodString>;
    updated_at: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
} & {
    schema_name: z.ZodLiteral<"ui.component.v1">;
    context: z.ZodObject<{
        component_type: z.ZodString;
        library: z.ZodString;
        props_schema: z.ZodRecord<z.ZodString, z.ZodAny>;
        render_template: z.ZodString;
        event_handlers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        children_allowed: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        component_type: string;
        library: string;
        props_schema: Record<string, any>;
        render_template: string;
        event_handlers?: string[] | undefined;
        children_allowed?: boolean | undefined;
    }, {
        component_type: string;
        library: string;
        props_schema: Record<string, any>;
        render_template: string;
        event_handlers?: string[] | undefined;
        children_allowed?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    schema_name: "ui.component.v1";
    title: string;
    tags: string[];
    context: {
        component_type: string;
        library: string;
        props_schema: Record<string, any>;
        render_template: string;
        event_handlers?: string[] | undefined;
        children_allowed?: boolean | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}, {
    schema_name: "ui.component.v1";
    title: string;
    tags: string[];
    context: {
        component_type: string;
        library: string;
        props_schema: Record<string, any>;
        render_template: string;
        event_handlers?: string[] | undefined;
        children_allowed?: boolean | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}>;
export type UIComponentV1 = z.infer<typeof UIComponentV1Schema>;
export declare const UIInstanceV1Schema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    created_at: z.ZodOptional<z.ZodString>;
    updated_at: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
} & {
    schema_name: z.ZodLiteral<"ui.instance.v1">;
    context: z.ZodObject<{
        component_ref: z.ZodString;
        instance_id: z.ZodString;
        props: z.ZodRecord<z.ZodString, z.ZodAny>;
        position: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>>;
        parent_flow: z.ZodOptional<z.ZodString>;
        bindings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            action: z.ZodString;
            payload: z.ZodAny;
        }, "strip", z.ZodTypeAny, {
            action: string;
            payload?: any;
        }, {
            action: string;
            payload?: any;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        component_ref: string;
        instance_id: string;
        props: Record<string, any>;
        position?: {
            x: number;
            y: number;
        } | undefined;
        parent_flow?: string | undefined;
        bindings?: Record<string, {
            action: string;
            payload?: any;
        }> | undefined;
    }, {
        component_ref: string;
        instance_id: string;
        props: Record<string, any>;
        position?: {
            x: number;
            y: number;
        } | undefined;
        parent_flow?: string | undefined;
        bindings?: Record<string, {
            action: string;
            payload?: any;
        }> | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    schema_name: "ui.instance.v1";
    title: string;
    tags: string[];
    context: {
        component_ref: string;
        instance_id: string;
        props: Record<string, any>;
        position?: {
            x: number;
            y: number;
        } | undefined;
        parent_flow?: string | undefined;
        bindings?: Record<string, {
            action: string;
            payload?: any;
        }> | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}, {
    schema_name: "ui.instance.v1";
    title: string;
    tags: string[];
    context: {
        component_ref: string;
        instance_id: string;
        props: Record<string, any>;
        position?: {
            x: number;
            y: number;
        } | undefined;
        parent_flow?: string | undefined;
        bindings?: Record<string, {
            action: string;
            payload?: any;
        }> | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}>;
export type UIInstanceV1 = z.infer<typeof UIInstanceV1Schema>;
//# sourceMappingURL=ui.d.ts.map