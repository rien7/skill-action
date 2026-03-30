import { z } from "zod";

const jsonObjectSchema = z.record(z.string(), z.unknown());
const bindingMapSchema = z.record(z.string(), z.unknown());

export const visibilitySchema = z.enum(["public", "skill", "internal"]);
export const sideEffectSchema = z.enum(["none", "local", "external"]);

export const actionStepSchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
  with: bindingMapSchema.default({}),
  if: z.string().min(1).optional(),
});

const actionBaseSchema = z.object({
  action_id: z.string().min(1),
  version: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  input_schema: jsonObjectSchema,
  output_schema: jsonObjectSchema,
  visibility: visibilitySchema,
  side_effect: sideEffectSchema,
  idempotent: z.boolean(),
});

export const primitiveActionDefinitionSchema = actionBaseSchema.extend({
  kind: z.literal("primitive"),
});

export const compositeActionDefinitionSchema = actionBaseSchema.extend({
  kind: z.literal("composite"),
  steps: z.array(actionStepSchema).min(1),
  returns: bindingMapSchema.optional(),
});

export const actionDefinitionSchema = z.discriminatedUnion("kind", [
  primitiveActionDefinitionSchema,
  compositeActionDefinitionSchema,
]);

export const actionReferenceSchema = z.object({
  action_id: z.string().min(1),
  path: z.string().min(1),
  visibility: visibilitySchema,
});

export const actionManifestSchema = z.object({
  actions: z.array(actionReferenceSchema),
});

export type Visibility = z.infer<typeof visibilitySchema>;
export type ActionBindingMap = z.infer<typeof bindingMapSchema>;
export type PrimitiveActionDefinition = z.infer<typeof primitiveActionDefinitionSchema>;
export type CompositeActionDefinition = z.infer<typeof compositeActionDefinitionSchema>;
export type ActionDefinition = z.infer<typeof actionDefinitionSchema>;
export type ActionReference = z.infer<typeof actionReferenceSchema>;
export type ActionManifest = z.infer<typeof actionManifestSchema>;
