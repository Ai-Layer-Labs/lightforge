import { z } from 'zod';
import { BreadcrumbBaseSchema, PositionSchema } from './base';

// UI component schema (v1)
export const UIComponentV1Schema = BreadcrumbBaseSchema.extend({
  schema_name: z.literal('ui.component.v1'),
  context: z.object({
    component_type: z.string(),
    library: z.string(),
    props_schema: z.record(z.any()),
    render_template: z.string(),
    event_handlers: z.array(z.string()).optional(),
    children_allowed: z.boolean().optional(),
  }),
});

export type UIComponentV1 = z.infer<typeof UIComponentV1Schema>;

// UI instance schema (v1)
export const UIInstanceV1Schema = BreadcrumbBaseSchema.extend({
  schema_name: z.literal('ui.instance.v1'),
  context: z.object({
    component_ref: z.string(),
    instance_id: z.string(),
    props: z.record(z.any()),
    position: PositionSchema.optional(),
    parent_flow: z.string().optional(),
    bindings: z.record(z.object({
      action: z.string(),
      payload: z.any(),
    })).optional(),
  }),
});

export type UIInstanceV1 = z.infer<typeof UIInstanceV1Schema>;
