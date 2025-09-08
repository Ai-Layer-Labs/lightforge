import { z } from 'zod';

// Standard LLM message format
export const LLMMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'function']),
  content: z.string(),
  name: z.string().optional(),
  function_call: z.any().optional(),
});

export type LLMMessage = z.infer<typeof LLMMessageSchema>;

// LLM messages input schema (v1)
export const LLMMessagesV1Schema = z.object({
  schema_name: z.literal('llm.messages.v1'),
  messages: z.array(LLMMessageSchema),
});

export type LLMMessagesV1 = z.infer<typeof LLMMessagesV1Schema>;

// LLM response schema (v1)
export const LLMResponseV1Schema = z.object({
  schema_name: z.literal('llm.response.v1'),
  content: z.string(),
  model: z.string().optional(),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),
  }).optional(),
  metadata: z.record(z.any()).optional(),
});

export type LLMResponseV1 = z.infer<typeof LLMResponseV1Schema>;

// Tool call schema
export const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

// Tool calls schema (v1)
export const LLMToolCallsV1Schema = z.object({
  schema_name: z.literal('llm.tool_calls.v1'),
  tool_calls: z.array(ToolCallSchema),
});

export type LLMToolCallsV1 = z.infer<typeof LLMToolCallsV1Schema>;

// Tool definition schema
export const ToolDefinitionSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.record(z.any()),
  }),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
