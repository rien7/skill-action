import { readFile } from "node:fs/promises";
import path from "node:path";

import { actionDefinitionSchema, actionManifestSchema } from "../types/action.js";
import { skillDefinitionSchema } from "../types/skill.js";
import type { RegisteredAction } from "./action-registry.js";
import type { RegisteredSkill } from "./skill-registry.js";

async function readJsonFile(filePath: string): Promise<unknown> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as unknown;
}

export async function loadSkillPackageFromDirectory(rootDir: string): Promise<{
  skill: RegisteredSkill;
  actions: RegisteredAction[];
}> {
  const skillPath = path.join(rootDir, "skill.json");
  const manifestPath = path.join(rootDir, "actions", "actions.json");

  const skill = skillDefinitionSchema.parse(await readJsonFile(skillPath));
  const manifest = actionManifestSchema.parse(await readJsonFile(manifestPath));

  const actions = await Promise.all(
    manifest.actions.map(async (reference) => {
      const actionDirectory = path.join(rootDir, "actions", reference.path);
      const actionPath = path.join(actionDirectory, "action.json");
      const definition = actionDefinitionSchema.parse(await readJsonFile(actionPath));

      return {
        definition,
        skillId: skill.skill_id,
        sourcePath: actionPath,
      } satisfies RegisteredAction;
    }),
  );

  return {
    skill: {
      definition: skill,
      sourcePath: skillPath,
    },
    actions,
  };
}

