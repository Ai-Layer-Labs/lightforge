import { z } from 'zod';
export declare const LLMMessageSchema: z.ZodObject<{
    role: z.ZodEnum<["system", "user", "assistant", "function"]>;
    content: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    function_call: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    role: "function" | "system" | "user" | "assistant";
    content: string;
    name?: string | undefined;
    function_call?: any;
}, {
    role: "function" | "system" | "user" | "assistant";
    content: string;
    name?: string | undefined;
    function_call?: any;
}>;
export type LLMMessage = z.infer<typeof LLMMessageSchema>;
export declare const LLMMessagesV1Schema: z.ZodObject<{
    schema_name: z.ZodLiteral<"llm.messages.v1">;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["system", "user", "assistant", "function"]>;
        content: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        function_call: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        role: "function" | "system" | "user" | "assistant";
        content: string;
        name?: string | undefined;
        function_call?: any;
    }, {
        role: "function" | "system" | "user" | "assistant";
        content: string;
        name?: string | undefined;
        function_call?: any;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    schema_name: "llm.messages.v1";
    messages: {
        role: "function" | "system" | "user" | "assistant";
        content: string;
        name?: string | undefined;
        function_call?: any;
    }[];
}, {
    schema_name: "llm.messages.v1";
    messages: {
        role: "function" | "system" | "user" | "assistant";
        content: string;
        name?: string | undefined;
        function_call?: any;
    }[];
}>;
export type LLMMessagesV1 = z.infer<typeof LLMMessagesV1Schema>;
export declare const LLMResponseV1Schema: z.ZodObject<{
    schema_name: z.ZodLiteral<"llm.response.v1">;
    content: z.ZodString;
    model: z.ZodOptional<z.ZodString>;
    usage: z.ZodOptional<z.ZodObject<{
        prompt_tokens: z.ZodNumber;
        completion_tokens: z.ZodNumber;
        total_tokens: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    }, {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    }>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    schema_name: "llm.response.v1";
    content: string;
    model?: string | undefined;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    } | undefined;
    metadata?: Record<string, any> | undefined;
}, {
    schema_name: "llm.response.v1";
    content: string;
    model?: string | undefined;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    } | undefined;
    metadata?: Record<string, any> | undefined;
}>;
export type LLMResponseV1 = z.infer<typeof LLMResponseV1Schema>;
export declare const ToolCallSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"function">;
    function: z.ZodObject<{
        name: z.ZodString;
        arguments: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        arguments: string;
    }, {
        name: string;
        arguments: string;
    }>;
}, "strip", z.ZodTypeAny, {
    function: {
        name: string;
        arguments: string;
    };
    id: string;
    type: "function";
}, {
    function: {
        name: string;
        arguments: string;
    };
    id: string;
    type: "function";
}>;
export type ToolCall = z.infer<typeof ToolCallSchema>;
export declare const LLMToolCallsV1Schema: z.ZodObject<{
    schema_name: z.ZodLiteral<"llm.tool_calls.v1">;
    tool_calls: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"function">;
        function: z.ZodObject<{
            name: z.ZodString;
            arguments: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            arguments: string;
        }, {
            name: string;
            arguments: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        function: {
            name: string;
            arguments: string;
        };
        id: string;
        type: "function";
    }, {
        function: {
            name: string;
            arguments: string;
        };
        id: string;
        type: "function";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    schema_name: "llm.tool_calls.v1";
    tool_calls: {
        function: {
            name: string;
            arguments: string;
        };
        id: string;
        type: "function";
    }[];
}, {
    schema_name: "llm.tool_calls.v1";
    tool_calls: {
        function: {
            name: string;
            arguments: string;
        };
        id: string;
        type: "function";
    }[];
}>;
export type LLMToolCallsV1 = z.infer<typeof LLMToolCallsV1Schema>;
export declare const ToolDefinitionSchema: z.ZodObject<{
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
}>;
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
//# sourceMappingURL=llm.d.ts.map