import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { actionDefinitionSchema } from "../types/action.js";
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
  const actionsDir = path.join(rootDir, "actions");

  const skill = skillDefinitionSchema.parse(await readJsonFile(skillPath));
  const entries = await readdir(actionsDir, { withFileTypes: true });
  const actionDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(actionsDir, entry.name));

  const loadedActions: Array<RegisteredAction | null> = await Promise.all(
    actionDirs.map(async (actionDirectory) => {
      const actionPath = path.join(actionDirectory, "action.json");
      try {
        const definition = actionDefinitionSchema.parse(await readJsonFile(actionPath));

        return {
          definition,
          skillId: skill.skill_id,
          sourcePath: actionPath,
        } satisfies RegisteredAction;
      } catch (error) {
        if (
          error instanceof Error &&
          (error as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          return null;
        }
        throw error;
      }
    }),
  );

  return {
    skill: {
      definition: skill,
      sourcePath: skillPath,
    },
    actions: loadedActions.filter((action): action is RegisteredAction => action !== null),
  };
}
