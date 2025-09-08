import { z } from 'zod';
import { BreadcrumbBaseSchema, NodePortSchema, PositionSchema } from './base';

// Node template schema (v1)
export const NodeTemplateV1Schema = BreadcrumbBaseSchema.extend({
  schema_name: z.literal('node.template.v1'),
  context: z.object({
    node_type: z.string(),
    category: z.string(),
    icon: z.string(),
    color: z.string(),
    description: z.string().optional(),
    extends: z.string().optional(),
    ports: z.object({
      inputs: z.array(NodePortSchema),
      outputs: z.array(NodePortSchema),
    }).optional(),
    config_ui: z.object({
      fields: z.array(z.object({
        name: z.string(),
        type: z.enum(['text', 'textarea', 'number', 'select', 'slider', 'json', 'array', 'object', 'boolean', 'selector']),
        label: z.string().optional(),
        placeholder: z.string().optional(),
        default: z.any().optional(),
        required: z.boolean().optional(),
        options: z.array(z.any()).optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        step: z.number().optional(),
        rows: z.number().optional(),
        pattern: z.string().optional(),
        description: z.string().optional(),
        items: z.any().optional(),
        properties: z.any().optional(),
      })),
      inherits: z.string().optional(),
      additional_fields: z.array(z.any()).optional(),
    }),
    executor: z.object({
      runtime: z.enum(['typescript', 'python', 'native']),
      module: z.string(),
      handler: z.string(),
    }),
    system_prompt_template: z.string().optional(),
    output_processing: z.string().optional(),
    internal_behavior: z.object({
      description: z.string(),
      steps: z.array(z.string()),
    }).optional(),
  }),
});

export type NodeTemplateV1 = z.infer<typeof NodeTemplateV1Schema>;

// Node instance schema (v1)
export const NodeInstanceV1Schema = BreadcrumbBaseSchema.extend({
  schema_name: z.literal('node.instance.v1'),
  context: z.object({
    node_id: z.string(),
    template: z.string(),
    position: PositionSchema,
    config: z.record(z.any()),
    connections: z.object({
      inputs: z.record(z.object({
        from: z.string(),
      })).optional(),
      outputs: z.record(z.object({
        to: z.array(z.string()),
      })).optional(),
    }).optional(),
    metadata: z.object({
      created_by: z.string().optional(),
      created_at: z.string().datetime().optional(),
      version: z.number().optional(),
    }).optional(),
  }),
});

export type NodeInstanceV1 = z.infer<typeof NodeInstanceV1Schema>;

// Node registry schema (v1)
export const NodeRegistryV1Schema = BreadcrumbBaseSchema.extend({
  schema_name: z.literal('node.registry.v1'),
  context: z.object({
    nodes: z.array(z.object({
      type: z.string(),
      package: z.string(),
      template_id: z.string(),
      category: z.string(),
      variants: z.array(z.string()).optional(),
    })),
    auto_discover: z.boolean().optional(),
    scan_paths: z.array(z.string()).optional(),
  }),
});

export type NodeRegistryV1 = z.infer<typeof NodeRegistryV1Schema>;

// Node update notification schema (v1)
export const NodeUpdateV1Schema = BreadcrumbBaseSchema.extend({
  schema_name: z.literal('node.update.v1'),
  context: z.object({
    node_type: z.string(),
    timestamp: z.string().datetime(),
    action: z.enum(['reload', 'update', 'delete']),
  }),
});

export type NodeUpdateV1 = z.infer<typeof NodeUpdateV1Schema>;
