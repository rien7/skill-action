import { access, readdir } from "node:fs/promises";
import path from "node:path";

import {
  InMemoryActionRegistry,
  InMemorySkillRegistry,
  loadSkillPackageFromDirectory,
  type RegisteredAction,
  type RegisteredSkill,
} from "@rien7/skill-action-runtime";

import type { CommonCommandOptions } from "./types.js";

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function discoverDefaultPackageDirs(cwd: string): Promise<string[]> {
  if (await exists(path.join(cwd, "skill.json"))) {
    return [cwd];
  }

  const skillsDir = path.join(cwd, "skills");
  if (!(await exists(skillsDir))) {
    return [];
  }

  const entries = await readdir(skillsDir, { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(skillsDir, entry.name));

  const checks = await Promise.all(
    dirs.map(async (dir) => ({
      dir,
      hasSkill: await exists(path.join(dir, "skill.json")),
    })),
  );

  return checks.filter((item) => item.hasSkill).map((item) => item.dir);
}

async function expandSkillsDir(skillsDir: string): Promise<string[]> {
  const entries = await readdir(skillsDir, { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(skillsDir, entry.name));

  const checks = await Promise.all(
    dirs.map(async (dir) => ({
      dir,
      hasSkill: await exists(path.join(dir, "skill.json")),
    })),
  );

  return checks.filter((item) => item.hasSkill).map((item) => item.dir);
}

async function normalizePackageDirs(options: CommonCommandOptions): Promise<string[]> {
  const explicitPackages = options.skillPackage ?? [];
  const explicitSkillsDir = options.skillsDir ? await expandSkillsDir(options.skillsDir) : [];

  const dirs = [...explicitPackages, ...explicitSkillsDir];
  if (dirs.length > 0) {
    return Array.from(new Set(dirs));
  }

  return discoverDefaultPackageDirs(process.cwd());
}

export async function loadPackageDirs(options: CommonCommandOptions): Promise<string[]> {
  return normalizePackageDirs(options);
}

export async function loadRegistries(options: CommonCommandOptions): Promise<{
  actionRegistry: InMemoryActionRegistry;
  skillRegistry: InMemorySkillRegistry;
  actions: RegisteredAction[];
  skills: RegisteredSkill[];
}> {
  const packageDirs = await loadPackageDirs(options);
  if (packageDirs.length === 0) {
    throw new Error(
      "No skill packages found. Provide --skill-package or --skills-dir, or run the command inside a skill package or repo root with a skills/ directory.",
    );
  }

  const loaded = await Promise.all(packageDirs.map((dir) => loadSkillPackageFromDirectory(dir)));

  const actionRegistry = new InMemoryActionRegistry();
  const skillRegistry = new InMemorySkillRegistry();
  const actions: RegisteredAction[] = [];
  const skills: RegisteredSkill[] = [];

  for (const item of loaded) {
    skills.push(item.skill);
    skillRegistry.register(item.skill);

    for (const action of item.actions) {
      actions.push(action);
      actionRegistry.register(action);
    }
  }

  return {
    actionRegistry,
    skillRegistry,
    actions,
    skills,
  };
}
