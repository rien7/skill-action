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
      if (entries.length === 1) {
        return entries[0]!;
      }

      throw new RuntimeError(
        "SKILL_RESOLUTION_AMBIGUOUS",
        `Skill "${skillId}" resolved to multiple packages.`,
        {
          skill_id: skillId,
          candidates: entries.map((entry) => ({
            version: entry.definition.version ?? null,
            source_path: entry.sourcePath ?? null,
          })),
        },
      );
    }

    const matches = entries.filter((entry) => entry.definition.version === version);
    if (matches.length === 0) {
      throw new RuntimeError(
        "VERSION_NOT_FOUND",
        `Version "${version}" was not found for skill "${skillId}".`,
        {
          skill_id: skillId,
          version,
        },
      );
    }

    if (matches.length > 1) {
      throw new RuntimeError(
        "SKILL_RESOLUTION_AMBIGUOUS",
        `Skill "${skillId}" resolved to multiple packages.`,
        {
          skill_id: skillId,
          version,
          candidates: matches.map((entry) => ({
            source_path: entry.sourcePath ?? null,
          })),
        },
      );
    }

    return matches[0]!;
  }
}
