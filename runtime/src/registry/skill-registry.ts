import type { SkillDefinition } from "../types/skill.js";
import { RuntimeError } from "../types/errors.js";

export interface RegisteredSkill {
  definition: SkillDefinition;
  sourcePath?: string;
}

export interface SkillRegistry {
  resolve(skillId: string, version?: string): Promise<RegisteredSkill>;
}

export class InMemorySkillRegistry implements SkillRegistry {
  private readonly skills = new Map<string, RegisteredSkill[]>();

  constructor(initialSkills: RegisteredSkill[] = []) {
    for (const skill of initialSkills) {
      this.register(skill);
    }
  }

  register(skill: RegisteredSkill): void {
    const existing = this.skills.get(skill.definition.skill_id) ?? [];
    existing.push(skill);
    this.skills.set(skill.definition.skill_id, existing);
  }

  async resolve(skillId: string, version?: string): Promise<RegisteredSkill> {
    const entries = this.skills.get(skillId);
    if (!entries || entries.length === 0) {
      throw new RuntimeError("SKILL_NOT_FOUND", `Skill "${skillId}" was not found.`, {
        skill_id: skillId,
      });
    }

    if (!version) {
      return entries[entries.length - 1]!;
    }

    const match = entries.find((entry) => entry.definition.version === version);
    if (!match) {
      throw new RuntimeError(
        "VERSION_NOT_FOUND",
        `Version "${version}" was not found for skill "${skillId}".`,
        {
          skill_id: skillId,
          version,
        },
      );
    }

    return match;
  }
}

