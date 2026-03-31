import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import {
  actionDefinitionSchema,
  actionManifestSchema,
  isRuntimeGlobalActionReference,
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

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
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
  external_dependencies: string[];
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
  if (!(await exists(filePath))) {
    return { filePath };
  }

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
  manifest: ActionManifest | undefined,
  issues: ValidationIssue[],
): Promise<Map<string, ActionDefinition>> {
  const definitions = new Map<string, ActionDefinition>();
  const actionsDir = path.join(packageDir, "actions");
  if (!(await exists(actionsDir))) {
    pushIssue(issues, {
      code: "MISSING_ACTIONS_DIR",
      message: `Missing actions directory at "${actionsDir}".`,
      package_dir: packageDir,
      file: actionsDir,
    });
    return definitions;
  }

  const entries = await readdir(actionsDir, { withFileTypes: true });
  const actionDirs = entries.filter((entry) => entry.isDirectory());
  const manifestEntries = new Map((manifest?.actions ?? []).map((entry) => [entry.path, entry]));
  const seenManifestIds = new Set<string>();

  for (const reference of manifest?.actions ?? []) {
    if (seenManifestIds.has(reference.action_id)) {
      pushIssue(issues, {
        code: "DUPLICATE_ACTION_ID",
        message: `Duplicate action_id "${reference.action_id}" in actions/actions.json.`,
        package_dir: packageDir,
        file: path.join(packageDir, "actions", "actions.json"),
        action_id: reference.action_id,
      });
    }
    seenManifestIds.add(reference.action_id);
  }

  for (const entry of actionDirs) {
    const filePath = path.join(actionsDir, entry.name, "action.json");
    if (!(await exists(filePath))) {
      continue;
    }

    try {
      const definition = actionDefinitionSchema.parse(await readJson(filePath));

      if (definitions.has(definition.action_id)) {
        pushIssue(issues, {
          code: "DUPLICATE_ACTION_ID",
          message: `Duplicate action_id "${definition.action_id}" across package action definitions.`,
          package_dir: packageDir,
          file: filePath,
          action_id: definition.action_id,
        });
        continue;
      }

      const manifestEntry = manifestEntries.get(entry.name);
      if (manifestEntry && definition.action_id !== manifestEntry.action_id) {
        pushIssue(issues, {
          code: "ACTION_ID_MISMATCH",
          message: `Manifest action_id "${manifestEntry.action_id}" does not match action.json action_id "${definition.action_id}".`,
          package_dir: packageDir,
          file: filePath,
          action_id: manifestEntry.action_id,
        });
      }

      if (manifestEntry && definition.visibility !== manifestEntry.visibility) {
        pushIssue(issues, {
          code: "VISIBILITY_MISMATCH",
          message: `Manifest visibility "${manifestEntry.visibility}" does not match action.json visibility "${definition.visibility}".`,
          package_dir: packageDir,
          file: filePath,
          action_id: definition.action_id,
        });
      }

      definitions.set(definition.action_id, definition);
    } catch (error) {
      pushIssue(issues, {
        code: "INVALID_ACTION_JSON",
        message: error instanceof Error ? error.message : "Failed to parse action.json",
        package_dir: packageDir,
        file: filePath,
      });
    }
  }

  return definitions;
}

function validateActionReferences(
  packageDir: string,
  actions: Map<string, ActionDefinition>,
  issues: ValidationIssue[],
): string[] {
  const externalDependencies = new Set<string>();

  for (const [actionId, definition] of actions.entries()) {
    if (definition.kind !== "composite") {
      continue;
    }

    for (const step of definition.steps) {
      if (isRuntimeGlobalActionReference(step.action)) {
        pushIssue(issues, {
          code: "ACTION_REFERENCE_NOT_LOCAL",
          message: `Step "${step.id}" in action "${actionId}" must reference a package-local action_id.`,
          package_dir: packageDir,
          action_id: actionId,
        });
      } else if (!actions.has(step.action)) {
        pushIssue(issues, {
          code: "ACTION_REFERENCE_NOT_FOUND",
          message: `Step "${step.id}" in action "${actionId}" references undeclared action "${step.action}".`,
          package_dir: packageDir,
          action_id: actionId,
        });
      }
    }
  }

  return [...externalDependencies].sort();
}

async function validatePackage(packageDir: string): Promise<PackageValidationResult> {
  const issues: ValidationIssue[] = [];
  const skill = await loadSkillDefinition(packageDir, issues);
  const manifest = await loadManifest(packageDir, issues);
  const actions = await loadActionDefinitions(packageDir, manifest.manifest, issues);
  const externalDependencies = validateActionReferences(packageDir, actions, issues);

  if (skill.definition) {
    if (isRuntimeGlobalActionReference(skill.definition.entry_action)) {
      pushIssue(issues, {
        code: "ENTRY_ACTION_MUST_BE_LOCAL",
        message: `entry_action "${skill.definition.entry_action}" must resolve to a package-local action.`,
        package_dir: packageDir,
        file: skill.filePath,
        skill_id: skill.definition.skill_id,
      });
    } else if (!actions.has(skill.definition.entry_action)) {
      pushIssue(issues, {
        code: "ENTRY_ACTION_NOT_FOUND",
        message: `entry_action "${skill.definition.entry_action}" does not resolve to a declared action.`,
        package_dir: packageDir,
        file: skill.filePath,
        skill_id: skill.definition.skill_id,
      });
    }

    for (const actionId of skill.definition.exposed_actions) {
      if (isRuntimeGlobalActionReference(actionId) || !actions.has(actionId)) {
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
    external_dependencies: externalDependencies,
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
