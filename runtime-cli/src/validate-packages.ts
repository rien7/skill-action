import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  actionDefinitionSchema,
  actionManifestSchema,
  skillDefinitionSchema,
  type ActionDefinition,
  type ActionManifest,
  type SkillDefinition,
} from "@rien7/skill-action-runtime";

import type { CommonCommandOptions } from "./types.js";
import { loadPackageDirs } from "./load-packages.js";

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

export interface ValidationIssue {
  severity: "error";
  code: string;
  message: string;
  package_dir: string;
  file?: string;
  skill_id?: string;
  action_id?: string;
}

export interface PackageValidationResult {
  package_dir: string;
  valid: boolean;
  skill?: {
    skill_id: string;
    title: string;
    entry_action: string;
  };
  action_count: number;
  issues: ValidationIssue[];
}

export interface ValidationSummary {
  valid: boolean;
  package_count: number;
  issue_count: number;
  packages: PackageValidationResult[];
}

function pushIssue(
  issues: ValidationIssue[],
  issue: Omit<ValidationIssue, "severity">,
): void {
  issues.push({
    severity: "error",
    ...issue,
  });
}

async function loadSkillDefinition(
  packageDir: string,
  issues: ValidationIssue[],
): Promise<{ definition?: SkillDefinition; filePath: string }> {
  const filePath = path.join(packageDir, "skill.json");

  try {
    return {
      definition: skillDefinitionSchema.parse(await readJson(filePath)),
      filePath,
    };
  } catch (error) {
    pushIssue(issues, {
      code: "INVALID_SKILL_JSON",
      message: error instanceof Error ? error.message : "Failed to parse skill.json",
      package_dir: packageDir,
      file: filePath,
    });
    return { filePath };
  }
}

async function loadManifest(
  packageDir: string,
  issues: ValidationIssue[],
): Promise<{ manifest?: ActionManifest; filePath: string }> {
  const filePath = path.join(packageDir, "actions", "actions.json");

  try {
    return {
      manifest: actionManifestSchema.parse(await readJson(filePath)),
      filePath,
    };
  } catch (error) {
    pushIssue(issues, {
      code: "INVALID_ACTION_MANIFEST",
      message: error instanceof Error ? error.message : "Failed to parse actions/actions.json",
      package_dir: packageDir,
      file: filePath,
    });
    return { filePath };
  }
}

async function loadActionDefinitions(
  packageDir: string,
  manifest: ActionManifest,
  issues: ValidationIssue[],
): Promise<Map<string, ActionDefinition>> {
  const definitions = new Map<string, ActionDefinition>();
  const seenManifestIds = new Set<string>();

  for (const reference of manifest.actions) {
    if (seenManifestIds.has(reference.action_id)) {
      pushIssue(issues, {
        code: "DUPLICATE_ACTION_ID",
        message: `Duplicate action_id "${reference.action_id}" in actions/actions.json.`,
        package_dir: packageDir,
        file: path.join(packageDir, "actions", "actions.json"),
        action_id: reference.action_id,
      });
      continue;
    }

    seenManifestIds.add(reference.action_id);

    const filePath = path.join(packageDir, "actions", reference.path, "action.json");

    try {
      const definition = actionDefinitionSchema.parse(await readJson(filePath));

      if (definition.action_id !== reference.action_id) {
        pushIssue(issues, {
          code: "ACTION_ID_MISMATCH",
          message: `Manifest action_id "${reference.action_id}" does not match action.json action_id "${definition.action_id}".`,
          package_dir: packageDir,
          file: filePath,
          action_id: reference.action_id,
        });
      }

      if (definition.visibility !== reference.visibility) {
        pushIssue(issues, {
          code: "VISIBILITY_MISMATCH",
          message: `Manifest visibility "${reference.visibility}" does not match action.json visibility "${definition.visibility}".`,
          package_dir: packageDir,
          file: filePath,
          action_id: reference.action_id,
        });
      }

      definitions.set(reference.action_id, definition);
    } catch (error) {
      pushIssue(issues, {
        code: "INVALID_ACTION_JSON",
        message: error instanceof Error ? error.message : "Failed to parse action.json",
        package_dir: packageDir,
        file: filePath,
        action_id: reference.action_id,
      });
    }
  }

  return definitions;
}

async function validatePackage(packageDir: string): Promise<PackageValidationResult> {
  const issues: ValidationIssue[] = [];
  const skill = await loadSkillDefinition(packageDir, issues);
  const manifest = await loadManifest(packageDir, issues);
  const actions = manifest.manifest
    ? await loadActionDefinitions(packageDir, manifest.manifest, issues)
    : new Map<string, ActionDefinition>();

  if (skill.definition) {
    if (!actions.has(skill.definition.entry_action)) {
      pushIssue(issues, {
        code: "ENTRY_ACTION_NOT_FOUND",
        message: `entry_action "${skill.definition.entry_action}" does not resolve to a declared action.`,
        package_dir: packageDir,
        file: skill.filePath,
        skill_id: skill.definition.skill_id,
      });
    }

    for (const actionId of skill.definition.exposed_actions) {
      if (!actions.has(actionId)) {
        pushIssue(issues, {
          code: "EXPOSED_ACTION_NOT_FOUND",
          message: `exposed_actions entry "${actionId}" does not resolve to a declared action.`,
          package_dir: packageDir,
          file: skill.filePath,
          skill_id: skill.definition.skill_id,
          action_id: actionId,
        });
      }
    }
  }

  return {
    package_dir: packageDir,
    valid: issues.length === 0,
    ...(skill.definition
      ? {
          skill: {
            skill_id: skill.definition.skill_id,
            title: skill.definition.title,
            entry_action: skill.definition.entry_action,
          },
        }
      : {}),
    action_count: actions.size,
    issues,
  };
}

export async function validateSkillPackages(options: CommonCommandOptions): Promise<ValidationSummary> {
  const packageDirs = await loadPackageDirs(options);
  if (packageDirs.length === 0) {
    throw new Error(
      "No skill packages found. Provide --skill-package or --skills-dir, or run the command inside a skill package or repo root with a skills/ directory.",
    );
  }

  const packages = await Promise.all(packageDirs.map((dir) => validatePackage(dir)));
  const issueCount = packages.reduce((sum, item) => sum + item.issues.length, 0);

  return {
    valid: issueCount === 0,
    package_count: packages.length,
    issue_count: issueCount,
    packages,
  };
}
