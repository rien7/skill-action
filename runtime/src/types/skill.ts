import { z } from "zod";

export const skillDefinitionSchema = z.object({
  skill_id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  entry_action: z.string().min(1),
});

export type SkillDefinition = z.infer<typeof skillDefinitionSchema>;
