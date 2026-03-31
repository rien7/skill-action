import { z } from "zod";

const jsonObjectSchema = z.record(z.string(), z.unknown());
const bindingMapSchema = z.record(z.string(), z.unknown());
const actionIdentifierSchema = z.string().min(1);
const stepIdentifierSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);

export const visibilitySchema = z.enum(["public", "skill", "internal"]);
export const sideEffectSchema = z.enum(["none", "local", "external"]);

export const actionStepSchema = z.object({
  id: stepIdentifierSchema,
  action: actionIdentifierSchema,
  with: bindingMapSchema.default({}),
  if: z.string().min(1).optional(),
});

const actionBaseSchema = z.object({
  action_id: actionIdentifierSchema,
  version: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  input_schema: jsonObjectSchema,
  output_schema: jsonObjectSchema,
  visibility: visibilitySchema.default("public"),
  side_effect: sideEffectSchema.default("none"),
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

export const actionReferenceSchema = z.object({
  action_id: actionIdentifierSchema,
  path: z.string().min(1),
  visibility: visibilitySchema.default("public"),
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
