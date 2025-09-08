import { z } from 'zod';
export declare const FlowNodeSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
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
}, "strip", z.ZodTypeAny, {
    id: string;
    type: string;
    position: {
        x: number;
        y: number;
    };
    config: Record<string, any>;
}, {
    id: string;
    type: string;
    position: {
        x: number;
        y: number;
    };
    config: Record<string, any>;
}>;
export type FlowNode = z.infer<typeof FlowNodeSchema>;
export declare const FlowDefinitionV1Schema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    created_at: z.ZodOptional<z.ZodString>;
    updated_at: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
} & {
    schema_name: z.ZodLiteral<"flow.definition.v1">;
    context: z.ZodObject<{
        flow_id: z.ZodString;
        version: z.ZodOptional<z.ZodNumber>;
        nodes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodString;
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
        }, "strip", z.ZodTypeAny, {
            id: string;
            type: string;
            position: {
                x: number;
                y: number;
            };
            config: Record<string, any>;
        }, {
            id: string;
            type: string;
            position: {
                x: number;
                y: number;
            };
            config: Record<string, any>;
        }>, "many">;
        connections: z.ZodArray<z.ZodObject<{
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
        }>, "many">;
        viewport: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            zoom: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            zoom: number;
        }, {
            x: number;
            y: number;
            zoom: number;
        }>>;
        metadata: z.ZodOptional<z.ZodObject<{
            created_by: z.ZodOptional<z.ZodString>;
            created_at: z.ZodOptional<z.ZodString>;
            last_modified_by: z.ZodOptional<z.ZodString>;
            last_modified_at: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            benefits: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            execution_stats: z.ZodOptional<z.ZodObject<{
                total_runs: z.ZodNumber;
                avg_latency_ms: z.ZodNumber;
                success_rate: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                total_runs: number;
                avg_latency_ms: number;
                success_rate: number;
            }, {
                total_runs: number;
                avg_latency_ms: number;
                success_rate: number;
            }>>;
        }, "strip", z.ZodTypeAny, {
            created_at?: string | undefined;
            description?: string | undefined;
            created_by?: string | undefined;
            last_modified_by?: string | undefined;
            last_modified_at?: string | undefined;
            benefits?: string[] | undefined;
            execution_stats?: {
                total_runs: number;
                avg_latency_ms: number;
                success_rate: number;
            } | undefined;
        }, {
            created_at?: string | undefined;
            description?: string | undefined;
            created_by?: string | undefined;
            last_modified_by?: string | undefined;
            last_modified_at?: string | undefined;
            benefits?: string[] | undefined;
            execution_stats?: {
                total_runs: number;
                avg_latency_ms: number;
                success_rate: number;
            } | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        connections: {
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
        }[];
        nodes: {
            id: string;
            type: string;
            position: {
                x: number;
                y: number;
            };
            config: Record<string, any>;
        }[];
        flow_id: string;
        version?: number | undefined;
        metadata?: {
            created_at?: string | undefined;
            description?: string | undefined;
            created_by?: string | undefined;
            last_modified_by?: string | undefined;
            last_modified_at?: string | undefined;
            benefits?: string[] | undefined;
            execution_stats?: {
                total_runs: number;
                avg_latency_ms: number;
                success_rate: number;
            } | undefined;
        } | undefined;
        viewport?: {
            x: number;
            y: number;
            zoom: number;
        } | undefined;
    }, {
        connections: {
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
        }[];
        nodes: {
            id: string;
            type: string;
            position: {
                x: number;
                y: number;
            };
            config: Record<string, any>;
        }[];
        flow_id: string;
        version?: number | undefined;
        metadata?: {
            created_at?: string | undefined;
            description?: string | undefined;
            created_by?: string | undefined;
            last_modified_by?: string | undefined;
            last_modified_at?: string | undefined;
            benefits?: string[] | undefined;
            execution_stats?: {
                total_runs: number;
                avg_latency_ms: number;
                success_rate: number;
            } | undefined;
        } | undefined;
        viewport?: {
            x: number;
            y: number;
            zoom: number;
        } | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    schema_name: "flow.definition.v1";
    title: string;
    tags: string[];
    context: {
        connections: {
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
        }[];
        nodes: {
            id: string;
            type: string;
            position: {
                x: number;
                y: number;
            };
            config: Record<string, any>;
        }[];
        flow_id: string;
        version?: number | undefined;
        metadata?: {
            created_at?: string | undefined;
            description?: string | undefined;
            created_by?: string | undefined;
            last_modified_by?: string | undefined;
            last_modified_at?: string | undefined;
            benefits?: string[] | undefined;
            execution_stats?: {
                total_runs: number;
                avg_latency_ms: number;
                success_rate: number;
            } | undefined;
        } | undefined;
        viewport?: {
            x: number;
            y: number;
            zoom: number;
        } | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}, {
    schema_name: "flow.definition.v1";
    title: string;
    tags: string[];
    context: {
        connections: {
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
        }[];
        nodes: {
            id: string;
            type: string;
            position: {
                x: number;
                y: number;
            };
            config: Record<string, any>;
        }[];
        flow_id: string;
        version?: number | undefined;
        metadata?: {
            created_at?: string | undefined;
            description?: string | undefined;
            created_by?: string | undefined;
            last_modified_by?: string | undefined;
            last_modified_at?: string | undefined;
            benefits?: string[] | undefined;
            execution_stats?: {
                total_runs: number;
                avg_latency_ms: number;
                success_rate: number;
            } | undefined;
        } | undefined;
        viewport?: {
            x: number;
            y: number;
            zoom: number;
        } | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}>;
export type FlowDefinitionV1 = z.infer<typeof FlowDefinitionV1Schema>;
export declare const FlowExecutionStateV1Schema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    created_at: z.ZodOptional<z.ZodString>;
    updated_at: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
} & {
    schema_name: z.ZodLiteral<"flow.execution.v1">;
    context: z.ZodObject<{
        flow_id: z.ZodString;
        execution_id: z.ZodString;
        status: z.ZodEnum<["running", "completed", "failed", "paused"]>;
        started_at: z.ZodString;
        completed_at: z.ZodOptional<z.ZodString>;
        current_node: z.ZodOptional<z.ZodString>;
        node_states: z.ZodRecord<z.ZodString, z.ZodObject<{
            status: z.ZodEnum<["pending", "running", "completed", "failed", "skipped"]>;
            inputs: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            outputs: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            error: z.ZodOptional<z.ZodString>;
            started_at: z.ZodOptional<z.ZodString>;
            completed_at: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "running" | "completed" | "failed" | "pending" | "skipped";
            inputs?: Record<string, any> | undefined;
            outputs?: Record<string, any> | undefined;
            started_at?: string | undefined;
            completed_at?: string | undefined;
            error?: string | undefined;
        }, {
            status: "running" | "completed" | "failed" | "pending" | "skipped";
            inputs?: Record<string, any> | undefined;
            outputs?: Record<string, any> | undefined;
            started_at?: string | undefined;
            completed_at?: string | undefined;
            error?: string | undefined;
        }>>;
        errors: z.ZodOptional<z.ZodArray<z.ZodObject<{
            node_id: z.ZodString;
            error: z.ZodString;
            timestamp: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            node_id: string;
            timestamp: string;
            error: string;
        }, {
            node_id: string;
            timestamp: string;
            error: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        status: "running" | "completed" | "failed" | "paused";
        flow_id: string;
        execution_id: string;
        started_at: string;
        node_states: Record<string, {
            status: "running" | "completed" | "failed" | "pending" | "skipped";
            inputs?: Record<string, any> | undefined;
            outputs?: Record<string, any> | undefined;
            started_at?: string | undefined;
            completed_at?: string | undefined;
            error?: string | undefined;
        }>;
        completed_at?: string | undefined;
        current_node?: string | undefined;
        errors?: {
            node_id: string;
            timestamp: string;
            error: string;
        }[] | undefined;
    }, {
        status: "running" | "completed" | "failed" | "paused";
        flow_id: string;
        execution_id: string;
        started_at: string;
        node_states: Record<string, {
            status: "running" | "completed" | "failed" | "pending" | "skipped";
            inputs?: Record<string, any> | undefined;
            outputs?: Record<string, any> | undefined;
            started_at?: string | undefined;
            completed_at?: string | undefined;
            error?: string | undefined;
        }>;
        completed_at?: string | undefined;
        current_node?: string | undefined;
        errors?: {
            node_id: string;
            timestamp: string;
            error: string;
        }[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    schema_name: "flow.execution.v1";
    title: string;
    tags: string[];
    context: {
        status: "running" | "completed" | "failed" | "paused";
        flow_id: string;
        execution_id: string;
        started_at: string;
        node_states: Record<string, {
            status: "running" | "completed" | "failed" | "pending" | "skipped";
            inputs?: Record<string, any> | undefined;
            outputs?: Record<string, any> | undefined;
            started_at?: string | undefined;
            completed_at?: string | undefined;
            error?: string | undefined;
        }>;
        completed_at?: string | undefined;
        current_node?: string | undefined;
        errors?: {
            node_id: string;
            timestamp: string;
            error: string;
        }[] | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}, {
    schema_name: "flow.execution.v1";
    title: string;
    tags: string[];
    context: {
        status: "running" | "completed" | "failed" | "paused";
        flow_id: string;
        execution_id: string;
        started_at: string;
        node_states: Record<string, {
            status: "running" | "completed" | "failed" | "pending" | "skipped";
            inputs?: Record<string, any> | undefined;
            outputs?: Record<string, any> | undefined;
            started_at?: string | undefined;
            completed_at?: string | undefined;
            error?: string | undefined;
        }>;
        completed_at?: string | undefined;
        current_node?: string | undefined;
        errors?: {
            node_id: string;
            timestamp: string;
            error: string;
        }[] | undefined;
    };
    id?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    version?: number | undefined;
}>;
export type FlowExecutionStateV1 = z.infer<typeof FlowExecutionStateV1Schema>;
//# sourceMappingURL=flow.d.ts.map