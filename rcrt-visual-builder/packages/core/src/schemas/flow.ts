import { z } from 'zod';
import { BreadcrumbBaseSchema, ConnectionSchema, PositionSchema } from './base';

// Flow node definition
export const FlowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: PositionSchema,
  config: z.record(z.any()),
});

export type FlowNode = z.infer<typeof FlowNodeSchema>;

// Flow definition schema (v1)
export const FlowDefinitionV1Schema = BreadcrumbBaseSchema.extend({
  schema_name: z.literal('flow.definition.v1'),
  context: z.object({
    flow_id: z.string(),
    version: z.number().optional(),
    nodes: z.array(FlowNodeSchema),
    connections: z.array(ConnectionSchema),
    viewport: z.object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    }).optional(),
    metadata: z.object({
      created_by: z.string().optional(),
      created_at: z.string().datetime().optional(),
      last_modified_by: z.string().optional(),
      last_modified_at: z.string().datetime().optional(),
      description: z.string().optional(),
      benefits: z.array(z.string()).optional(),
      execution_stats: z.object({
        total_runs: z.number(),
        avg_latency_ms: z.number(),
        success_rate: z.number(),
      }).optional(),
    }).optional(),
  }),
});

export type FlowDefinitionV1 = z.infer<typeof FlowDefinitionV1Schema>;

// Flow execution state schema (v1)
export const FlowExecutionStateV1Schema = BreadcrumbBaseSchema.extend({
  schema_name: z.literal('flow.execution.v1'),
  context: z.object({
    flow_id: z.string(),
    execution_id: z.string(),
    status: z.enum(['running', 'completed', 'failed', 'paused']),
    started_at: z.string().datetime(),
    completed_at: z.string().datetime().optional(),
    current_node: z.string().optional(),
    node_states: z.record(z.object({
      status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
      inputs: z.record(z.any()).optional(),
      outputs: z.record(z.any()).optional(),
      error: z.string().optional(),
      started_at: z.string().datetime().optional(),
      completed_at: z.string().datetime().optional(),
    })),
    errors: z.array(z.object({
      node_id: z.string(),
      error: z.string(),
      timestamp: z.string().datetime(),
    })).optional(),
  }),
});

export type FlowExecutionStateV1 = z.infer<typeof FlowExecutionStateV1Schema>;
