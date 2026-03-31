import { z } from "zod";

const jsonObjectSchema = z.record(z.string(), z.unknown());
const bindingMapSchema = z.record(z.string(), z.unknown());
const actionIdentifierSchema = z.string().min(1);
const stepIdentifierSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);

export const actionStepSchema = z.object({
  id: stepIdentifierSchema,
  action: actionIdentifierSchema,
  with: bindingMapSchema.default({}),
  if: z.string().min(1).optional(),
});

const actionBaseSchema = z.object({
  action_id: actionIdentifierSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  input_schema: jsonObjectSchema,
  output_schema: jsonObjectSchema,
  idempotent: z.boolean(),
});

export const primitiveActionDefinitionSchema = actionBaseSchema.extend({
  kind: z.literal("primitive"),
});

export const compositeActionDefinitionSchema = actionBaseSchema.extend({
  kind: z.literal("composite"),
  steps: z.array(actionStepSchema).min(1),
  returns: bindingMapSchema,
});

export const actionDefinitionSchema = z.discriminatedUnion("kind", [
  primitiveActionDefinitionSchema,
  compositeActionDefinitionSchema,
]);
export type ActionBindingMap = z.infer<typeof bindingMapSchema>;
export type PrimitiveActionDefinition = z.infer<typeof primitiveActionDefinitionSchema>;
export type CompositeActionDefinition = z.infer<typeof compositeActionDefinitionSchema>;
export type ActionDefinition = z.infer<typeof actionDefinitionSchema>;
