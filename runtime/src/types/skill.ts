import { z } from "zod";

export const skillDefinitionSchema = z.object({
  skill_id: z.string().min(1),
  version: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  entry_action: z.string().min(1),
  exposed_actions: z.array(z.string().min(1)).default([]),
});

export type SkillDefinition = z.infer<typeof skillDefinitionSchema>;
