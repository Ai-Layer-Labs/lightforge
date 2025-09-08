import { z } from 'zod';
export declare const NodeTemplateV1Schema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    created_at: z.ZodOptional<z.ZodString>;
    updated_at: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
} & {
    schema_name: z.ZodLiteral<"node.template.v1">;
    context: z.ZodObject<{
        node_type: z.ZodString;
        category: z.ZodString;
        icon: z.ZodString;
        color: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        extends: z.ZodOptional<z.ZodString>;
        ports: z.ZodOptional<z.ZodObject<{
            inputs: z.ZodArray<z.ZodObject<{
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
            }>, "many">;
            outputs: z.ZodArray<z.ZodObject<{
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
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            inputs: {
                id: string;
                type: "messages" | "response" | "event" | "data" | "operation" | "selectors" | "tools";
                schema?: string | undefined;
                description?: string | undefined;
                multiple?: boolean | undefined;
                optional?: boolean | undefined;
                color?: string | undefined;
            }[];
            outputs: {
                id: string;
                type: "messages" | "response" | "event" | "data" | "operation" | "selectors" | "tools";
                schema?: string | undefined;
                description?: string | undefined;
                multiple?: boolean | undefined;
                optional?: boolean | undefined;
                color?: string | undefined;
            }[];
        }, {
            inputs: {
                id: string;
                type: "messages" | "response" | "event" | "data" | "operation" | "selectors" | "tools";
                schema?: string | undefined;
                description?: string | undefined;
                multiple?: boolean | undefined;
                optional?: boolean | undefined;
                color?: string | undefined;
            }[];
            outputs: {
                id: string;
                type: "messages" | "response" | "event" | "data" | "operation" | "selectors" | "tools";
                schema?: string | undefined;
                description?: string | undefined;
                multiple?: boolean | undefined;
                optional?: boolean | undefined;
                color?: string | undefined;
            }[];
        }>>;
        config_ui: z.ZodObject<{
            fields: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodEnum<["text", "textarea", "number", "select", "slider", "json", "array", "object", "boolean", "selector"]>;
                label: z.ZodOptional<z.ZodString>;
                placeholder: z.ZodOptional<z.ZodString>;
                default: z.ZodOptional<z.ZodAny>;
                required: z.ZodOptional<z.ZodBoolean>;
                options: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
                min: z.ZodOptional<z.ZodNumber>;
                max: z.ZodOptional<z.ZodNumber>;
                step: z.ZodOptional<z.ZodNumber>;
                rows: z.ZodOptional<z.ZodNumber>;
                pattern: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                items: z.ZodOptional<z.ZodAny>;
                properties: z.ZodOptional<z.ZodAny>;
            }, "strip", z.ZodTypeAny, {
                type: "number" | "boolean" | "object" | "array" | "text" | "textarea" | "select" | "slider" | "json" | "selector";
                name: string;
                options?: any[] | undefined;
                description?: string | undefined;
                label?: string | undefined;
                placeholder?: string | undefined;
                default?: any;
                required?: boolean | undefined;
                min?: number | undefined;
                max?: number | undefined;
                step?: number | undefined;
                rows?: number | undefined;
                pattern?: string | undefined;
                items?: any;
                properties?: any;
            }, {
                type: "number" | "boolean" | "object" | "array" | "text" | "textarea" | "select" | "slider" | "json" | "selector";
                name: string;
                options?: any[] | undefined;
                description?: string | undefined;
                label?: string | undefined;
                placeholder?: string | undefined;
                default?: any;
                required?: boolean | undefined;
                min?: number | undefined;
                max?: number | undefined;
                step?: number | undefined;
                rows?: number | undefined;
                pattern?: string | undefined;
                items?: any;
                properties?: any;
            }>, "many">;
            inherits: z.ZodOptional<z.ZodString>;
            additional_fields: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        }, "strip", z.ZodTypeAny, {
            fields: {
                type: "number" | "boolean" | "object" | "array" | "text" | "textarea" | "select" | "slider" | "json" | "selector";
                name: string;
                options?: any[] | undefined;
                description?: string | undefined;
                label?: string | undefined;
                placeholder?: string | undefined;
                default?: any;
                required?: boolean | undefined;
                min?: number | undefined;
                max?: number | undefined;
                step?: number | undefined;
                rows?: number | undefined;
                pattern?: string | undefined;
                items?: any;
                properties?: any;
            }[];
            inherits?: string | undefined;
            additional_fields?: any[] | undefined;
        }, {
            fields: {
                type: "number" | "boolean" | "object" | "array" | "text" | "textarea" | "select" | "slider" | "json" | "selector";
                name: string;
                options?: any[] | undefined;
                description?: string | undefined;
                label?: string | undefined;
                placeholder?: string | undefined;
                default?: any;
                required?: boolean | undefined;
                min?: number | undefined;
                max?: number | undefined;
                step?: number | undefined;
                rows?: number | undefined;
                pattern?: string | undefined;
                items?: any;
                properties?: any;
            }[];
            inherits?: string | undefined;
            additional_fields?: any[] | undefined;
        }>;
        executor: z.ZodObject<{
            runtime: z.ZodEnum<["typescript", "python", "native"]>;
            module: z.ZodString;
            handler: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            runtime: "typescript" | "python" | "native";
            module: string;
            handler: string;
        }, {
            runtime: "typescript" | "python" | "native";
            module: string;
            handler: string;
        }>;
        system_prompt_template: z.ZodOptional<z.ZodString>;
        output_processing: z.ZodOptional<z.ZodString>;
        internal_behavior: z.ZodOptional<z.ZodObject<{
            description: z.ZodString;
            steps: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            description: string;
            steps: string[];
        }, {
            description: string;
            steps: string[];
        }>>;
    }, "strip", z.ZodTypeAny, {
        color: string;
        node_type: string;
        category: string;
        icon: string;
        config_ui: {
            fields: {
                type: "number" | "boolean" | "object" | "array" | "text" | "textarea" | "select" | "slider" | "json" | "selector";
                name: string;
                options?: any[] | undefined;
                description?: string | undefined;
                label?: string | undefined;
                placeholder?: string | undefined;
                default?: any;
                required?: boolean | undefined;
                min?: number | undefined;
                max?: number | undefined;
                step?: number | undefined;
                rows?: number | undefined;
                pattern?: string | undefined;
                items?: any;
                properties?: any;
            }[];
            inherits?: string | undefined;
            additional_fields?: any[] | undefined;
        };
        executor: {
            runtime: "typescript" | "python" | "native";
            module: string;
            handler: string;
        };
        description?: string | undefined;
        extends?: string | undefined;
        ports?: {
            inputs: {
                id: string;
                type: "messages" | "response" | "event" | "data" | "operation" | "selectors" | "tools";
                schema?: string | undefined;
                description?: string | undefined;
                multiple?: boolean | undefined;
                optional?: boolean | undefined;
                color?: string | undefined;
            }[];
            outputs: {
                id: string;
                type: "messages" | "response" | "event" | "data" | "operation" | "selectors" | "tools";
                schema?: string | undefined;
                description?: string | undefined;
                multiple?: boolean | undefined;
                optional?: boolean | undefined;
                color?: string | undefined;
            }[];
        } | undefined;
        system_prompt_template?: string | undefined;
        output_processing?: string | undefined;
        internal_behavior?: {
            description: string;
            steps: string[];
        } | undefined;
    }, {
        color: string;
        node_type: string;
        category: string;
        icon: string;
        config_ui: {
            fields: {
                type: "number" | "boolean" | "object" | "array" | "text" | "textarea" | "select" | "slider" | "json" | "selector";
                name: string;
                options?: any[] | undefined;
                description?: string | undefined;
                label?: string | undefined;
                placeholder?: string | undefined;
                default?: any;
                required?: boolean | undefined;
                min?: number | undefined;
                max?: number | undefined;
                step?: number | undefined;
                rows?: number | undefined;
                pattern?: string | undefined;
                items?: any;
                properties?: any;
            }[];
            inherits?: string | undefined;
            additional_fields?: any[] | undefined;
        };
        executor: {
            runtime: "typescript" | "python" | "native";
            module: string;
            handler: string;
        };
        description?: string | undefined;
        extends?: string | undefined;
        ports?: {
            inputs: {
                id: string;
                type: "messages" | "response" | "event" | "data" | "operation" | "selectors" | "tools";
                schema?: string | undefined;
                description?: string | undefined;
                multiple?: boolean | undefined;
                optional?: boolean | undefined;
                color?: string | undefined;
            }[];
            outputs: {
                id: string;
                type: "messages" | "response" | "event" | "data" | "operation" | "selectors" | "tools";
                schema?: string | undefined;
                description?: string | undefined;
                multiple?: boolean | undefined;
                optional?: boolean | undefined;
                color?: string | undefined;
            }[];
        } | undefined;
        system_prompt_template?: string | undefined;
        output_processing?: string | undefined;
        internal_behavior?: {
            description: string;
            steps: string[];
        } | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    schema_name: "node.template.v1";
    title: string;
    tags: string[];
    context: {
        color: string;
        node_type: string;
        category: string;
        icon: string;
        config_ui: {
            fields: {
                type: "number" | "boolean" | "object" | "array" | "text" | "textarea" | "select" | "slider" | "json" | "selector";
                name: string;
                options?: any[] | undefined;
                description?: string | undefined;
                label?: string | undefined;
                placeholder?: string | undefined;
                default?: any;
                required?: boolean | undefined;
                min?: number | undefined;
                max?: number | undefined;
                step?: number | undefined;
                rows?: number | undefined;
                pattern?: string | undefined;
                items?: any;
                properties?: any;
            }[];
            inherits?: string | undefined;
            additional_fields?: any[] | undefined;
        };
        executor: {
            runtime: "typescript" | "python" | "native";
            module: string;
            handler: string;
        };
        description?: string | undefined;
        extends?: string | undefined;
        ports?: {
            inputs: {
                id: string;
                type: "messages" | "response" | "event" | "data" | "operation" | "selectors" | "tools";
                schema?: string | undefined;
                description?: string | undefined;
                multiple?: boolean | undefined;
                optional?: boolean | undefined;
                color?: string | undefined;
            }[];
            outputs: {
                id: string;
                type: "messages" | "response" | "event" | "data" | "operation" | "selectors" | "tools";
                schema?: string | undefined;
                description?: string | undefined;
                multiple?: boolean | undefined;
                optional?: boolean | undefined;
                color?: string | undefined;
            }[];
        } | undefined;
        system_prompt_template?: string | undefined;
        output_processing?: string | undefined;
        internal_behavior?: {
            description: string;
            steps: string[];
        } | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}, {
    schema_name: "node.template.v1";
    title: string;
    tags: string[];
    context: {
        color: string;
        node_type: string;
        category: string;
        icon: string;
        config_ui: {
            fields: {
                type: "number" | "boolean" | "object" | "array" | "text" | "textarea" | "select" | "slider" | "json" | "selector";
                name: string;
                options?: any[] | undefined;
                description?: string | undefined;
                label?: string | undefined;
                placeholder?: string | undefined;
                default?: any;
                required?: boolean | undefined;
                min?: number | undefined;
                max?: number | undefined;
                step?: number | undefined;
                rows?: number | undefined;
                pattern?: string | undefined;
                items?: any;
                properties?: any;
            }[];
            inherits?: string | undefined;
            additional_fields?: any[] | undefined;
        };
        executor: {
            runtime: "typescript" | "python" | "native";
            module: string;
            handler: string;
        };
        description?: string | undefined;
        extends?: string | undefined;
        ports?: {
            inputs: {
                id: string;
                type: "messages" | "response" | "event" | "data" | "operation" | "selectors" | "tools";
                schema?: string | undefined;
                description?: string | undefined;
                multiple?: boolean | undefined;
                optional?: boolean | undefined;
                color?: string | undefined;
            }[];
            outputs: {
                id: string;
                type: "messages" | "response" | "event" | "data" | "operation" | "selectors" | "tools";
                schema?: string | undefined;
                description?: string | undefined;
                multiple?: boolean | undefined;
                optional?: boolean | undefined;
                color?: string | undefined;
            }[];
        } | undefined;
        system_prompt_template?: string | undefined;
        output_processing?: string | undefined;
        internal_behavior?: {
            description: string;
            steps: string[];
        } | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}>;
export type NodeTemplateV1 = z.infer<typeof NodeTemplateV1Schema>;
export declare const NodeInstanceV1Schema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    created_at: z.ZodOptional<z.ZodString>;
    updated_at: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
} & {
    schema_name: z.ZodLiteral<"node.instance.v1">;
    context: z.ZodObject<{
        node_id: z.ZodString;
        template: z.ZodString;
        position: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>;
        config: z.ZodRecord<z.ZodString, z.ZodAny>;
        connections: z.ZodOptional<z.ZodObject<{
            inputs: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                from: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                from: string;
            }, {
                from: string;
            }>>>;
            outputs: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                to: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                to: string[];
            }, {
                to: string[];
            }>>>;
        }, "strip", z.ZodTypeAny, {
            inputs?: Record<string, {
                from: string;
            }> | undefined;
            outputs?: Record<string, {
                to: string[];
            }> | undefined;
        }, {
            inputs?: Record<string, {
                from: string;
            }> | undefined;
            outputs?: Record<string, {
                to: string[];
            }> | undefined;
        }>>;
        metadata: z.ZodOptional<z.ZodObject<{
            created_by: z.ZodOptional<z.ZodString>;
            created_at: z.ZodOptional<z.ZodString>;
            version: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            created_at?: string | undefined;
            version?: number | undefined;
            created_by?: string | undefined;
        }, {
            created_at?: string | undefined;
            version?: number | undefined;
            created_by?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        node_id: string;
        template: string;
        position: {
            x: number;
            y: number;
        };
        config: Record<string, any>;
        metadata?: {
            created_at?: string | undefined;
            version?: number | undefined;
            created_by?: string | undefined;
        } | undefined;
        connections?: {
            inputs?: Record<string, {
                from: string;
            }> | undefined;
            outputs?: Record<string, {
                to: string[];
            }> | undefined;
        } | undefined;
    }, {
        node_id: string;
        template: string;
        position: {
            x: number;
            y: number;
        };
        config: Record<string, any>;
        metadata?: {
            created_at?: string | undefined;
            version?: number | undefined;
            created_by?: string | undefined;
        } | undefined;
        connections?: {
            inputs?: Record<string, {
                from: string;
            }> | undefined;
            outputs?: Record<string, {
                to: string[];
            }> | undefined;
        } | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    schema_name: "node.instance.v1";
    title: string;
    tags: string[];
    context: {
        node_id: string;
        template: string;
        position: {
            x: number;
            y: number;
        };
        config: Record<string, any>;
        metadata?: {
            created_at?: string | undefined;
            version?: number | undefined;
            created_by?: string | undefined;
        } | undefined;
        connections?: {
            inputs?: Record<string, {
                from: string;
            }> | undefined;
            outputs?: Record<string, {
                to: string[];
            }> | undefined;
        } | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}, {
    schema_name: "node.instance.v1";
    title: string;
    tags: string[];
    context: {
        node_id: string;
        template: string;
        position: {
            x: number;
            y: number;
        };
        config: Record<string, any>;
        metadata?: {
            created_at?: string | undefined;
            version?: number | undefined;
            created_by?: string | undefined;
        } | undefined;
        connections?: {
            inputs?: Record<string, {
                from: string;
            }> | undefined;
            outputs?: Record<string, {
                to: string[];
            }> | undefined;
        } | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}>;
export type NodeInstanceV1 = z.infer<typeof NodeInstanceV1Schema>;
export declare const NodeRegistryV1Schema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    created_at: z.ZodOptional<z.ZodString>;
    updated_at: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
} & {
    schema_name: z.ZodLiteral<"node.registry.v1">;
    context: z.ZodObject<{
        nodes: z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            package: z.ZodString;
            template_id: z.ZodString;
            category: z.ZodString;
            variants: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            type: string;
            category: string;
            package: string;
            template_id: string;
            variants?: string[] | undefined;
        }, {
            type: string;
            category: string;
            package: string;
            template_id: string;
            variants?: string[] | undefined;
        }>, "many">;
        auto_discover: z.ZodOptional<z.ZodBoolean>;
        scan_paths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        nodes: {
            type: string;
            category: string;
            package: string;
            template_id: string;
            variants?: string[] | undefined;
        }[];
        auto_discover?: boolean | undefined;
        scan_paths?: string[] | undefined;
    }, {
        nodes: {
            type: string;
            category: string;
            package: string;
            template_id: string;
            variants?: string[] | undefined;
        }[];
        auto_discover?: boolean | undefined;
        scan_paths?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    schema_name: "node.registry.v1";
    title: string;
    tags: string[];
    context: {
        nodes: {
            type: string;
            category: string;
            package: string;
            template_id: string;
            variants?: string[] | undefined;
        }[];
        auto_discover?: boolean | undefined;
        scan_paths?: string[] | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}, {
    schema_name: "node.registry.v1";
    title: string;
    tags: string[];
    context: {
        nodes: {
            type: string;
            category: string;
            package: string;
            template_id: string;
            variants?: string[] | undefined;
        }[];
        auto_discover?: boolean | undefined;
        scan_paths?: string[] | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}>;
export type NodeRegistryV1 = z.infer<typeof NodeRegistryV1Schema>;
export declare const NodeUpdateV1Schema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    created_at: z.ZodOptional<z.ZodString>;
    updated_at: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
} & {
    schema_name: z.ZodLiteral<"node.update.v1">;
    context: z.ZodObject<{
        node_type: z.ZodString;
        timestamp: z.ZodString;
        action: z.ZodEnum<["reload", "update", "delete"]>;
    }, "strip", z.ZodTypeAny, {
        node_type: string;
        timestamp: string;
        action: "reload" | "update" | "delete";
    }, {
        node_type: string;
        timestamp: string;
        action: "reload" | "update" | "delete";
    }>;
}, "strip", z.ZodTypeAny, {
    schema_name: "node.update.v1";
    title: string;
    tags: string[];
    context: {
        node_type: string;
        timestamp: string;
        action: "reload" | "update" | "delete";
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}, {
    schema_name: "node.update.v1";
    title: string;
    tags: string[];
    context: {
        node_type: string;
        timestamp: string;
        action: "reload" | "update" | "delete";
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}>;
export type NodeUpdateV1 = z.infer<typeof NodeUpdateV1Schema>;
//# sourceMappingURL=node.d.ts.map