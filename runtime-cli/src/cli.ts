import { Command, Option } from "commander";

import {
  ActionRuntime,
  type ExecuteActionRequest,
  type ExecuteSkillRequest,
  type ResolveActionRequest,
  type ValidateActionInputRequest,
} from "@rien7/skill-action-runtime";

import { printResult, readJsonInput, readJsonRequest, readJsonRequestFromStdin } from "./io.js";
import { loadHandlerModule } from "./load-handlers.js";
import { loadRegistries } from "./load-packages.js";
import { toExecutionOptions } from "./options.js";
import { validateSkillPackages } from "./validate-packages.js";

type LoadedRegistries = Awaited<ReturnType<typeof loadRegistries>>;
type LoadedHandlers = Awaited<ReturnType<typeof loadHandlerModule>>;

interface CommonRuntimeCommandOptions {
  handlerModule?: string;
  output?: "json" | "pretty";
  skillPackage?: string[];
  skillsDir?: string;
}

function createRuntimeForCommand(
  options: LoadedRegistries,
  handlers?: LoadedHandlers,
): ActionRuntime {
  return new ActionRuntime({
    actionRegistry: options.actionRegistry,
    skillRegistry: options.skillRegistry,
    ...(handlers?.primitiveHandlers ? { primitiveHandlers: handlers.primitiveHandlers } : {}),
  });
}

async function loadRuntimeContext(
  options: CommonRuntimeCommandOptions,
): Promise<{
  registries: LoadedRegistries;
  handlers: LoadedHandlers | undefined;
}> {
  const registries = await loadRegistries(options);
  const handlers = options.handlerModule ? await loadHandlerModule(options.handlerModule) : undefined;

  return {
    registries,
    handlers,
  };
}

function addPackageOptions(command: Command): Command {
  return command
    .option("--skill-package <dir>", "Load a specific skill package directory", collect, [])
    .option("--skills-dir <dir>", "Load all direct child skill packages in a skills directory")
    .addOption(
      new Option("--output <mode>", "Output formatting").choices(["json", "pretty"]).default("pretty"),
    );
}

function addHandlerModuleOption(command: Command): Command {
  return command.option(
    "--handler-module <path>",
    "Runtime-cli extension: path to an ESM/CJS module exporting primitiveHandlers for primitive execution",
  );
}

function addInputOptions(command: Command): Command {
  return command
    .option("--input-file <path>", "Read JSON input from a file")
    .option("--input-json <json>", "Read JSON input from an inline JSON string");
}

function addRequestOptions(command: Command): Command {
  return command
    .option("--request-file <path>", "Read a full protocol request object from a file")
    .option("--request-json <json>", "Read a full protocol request object from an inline JSON string");
}

function addExecutionOptions(command: Command): Command {
  return command
    .option("--dry-run", "Runtime-cli extension: validate and trace execution without invoking primitive handlers")
    .addOption(
      new Option("--trace-level <level>", "Runtime-cli extension: trace verbosity")
        .choices(["none", "basic", "full"])
        .default("basic"),
    )
    .option("--timeout-ms <ms>", "Execution timeout in milliseconds", parseNumber)
    .option("--max-depth <n>", "Maximum execution depth", parseNumber)
    .option("--max-steps <n>", "Maximum total execution steps", parseNumber);
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parseNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a number, received "${value}".`);
  }
  return parsed;
}

function setExitCodeFromResult(result: unknown): void {
  if (
    result &&
    typeof result === "object" &&
    "ok" in result &&
    (result as { ok: boolean }).ok === false
  ) {
    process.exitCode = 1;
    return;
  }

  if (
    result &&
    typeof result === "object" &&
    "ok" in result &&
    (result as { ok: boolean }).ok === true &&
    "data" in result
  ) {
    const data = (result as { data?: unknown }).data;
    if (
      data &&
      typeof data === "object" &&
      "status" in data &&
      (data as { status?: string }).status === "failed"
    ) {
      process.exitCode = 1;
      return;
    }
  }

  process.exitCode = 0;
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required field "${fieldName}".`);
  }
  return value;
}

async function getResolveActionRequest(options: {
  skillId?: string;
  actionId?: string;
  requestFile?: string;
  requestJson?: string;
}): Promise<ResolveActionRequest> {
  const request = await readJsonRequest(options);
  if (request !== undefined) {
    return request as ResolveActionRequest;
  }

  if (!options.actionId) {
    const stdinRequest = await readJsonRequestFromStdin();
    if (stdinRequest !== undefined) {
      return stdinRequest as ResolveActionRequest;
    }
  }

  return {
    skill_id: requireString(options.skillId, "skill_id"),
    action_id: requireString(options.actionId, "action_id"),
  };
}

async function getValidateActionInputRequest(options: {
  skillId?: string;
  actionId?: string;
  inputFile?: string;
  inputJson?: string;
  requestFile?: string;
  requestJson?: string;
}): Promise<ValidateActionInputRequest> {
  const request = await readJsonRequest(options);
  if (request !== undefined) {
    return request as ValidateActionInputRequest;
  }

  if (!options.actionId) {
    const stdinRequest = await readJsonRequestFromStdin();
    if (stdinRequest !== undefined) {
      return stdinRequest as ValidateActionInputRequest;
    }
  }

  return {
    skill_id: requireString(options.skillId, "skill_id"),
    action_id: requireString(options.actionId, "action_id"),
    input: await readJsonInput(options),
  };
}

async function getExecuteActionRequest(options: {
  skillId?: string;
  actionId?: string;
  inputFile?: string;
  inputJson?: string;
  requestFile?: string;
  requestJson?: string;
  dryRun?: boolean;
  traceLevel?: "none" | "basic" | "full";
  timeoutMs?: number;
  maxDepth?: number;
  maxSteps?: number;
}): Promise<ExecuteActionRequest> {
  const request = await readJsonRequest(options);
  if (request !== undefined) {
    return request as ExecuteActionRequest;
  }

  if (!options.actionId) {
    const stdinRequest = await readJsonRequestFromStdin();
    if (stdinRequest !== undefined) {
      return stdinRequest as ExecuteActionRequest;
    }
  }

  return {
    skill_id: requireString(options.skillId, "skill_id"),
    action_id: requireString(options.actionId, "action_id"),
    input: await readJsonInput(options),
    options: toExecutionOptions(options),
  };
}

async function getExecuteSkillRequest(options: {
  skillId?: string;
  inputFile?: string;
  inputJson?: string;
  requestFile?: string;
  requestJson?: string;
  dryRun?: boolean;
  traceLevel?: "none" | "basic" | "full";
  timeoutMs?: number;
  maxDepth?: number;
  maxSteps?: number;
}): Promise<ExecuteSkillRequest> {
  const request = await readJsonRequest(options);
  if (request !== undefined) {
    return request as ExecuteSkillRequest;
  }

  if (!options.skillId) {
    const stdinRequest = await readJsonRequestFromStdin();
    if (stdinRequest !== undefined) {
      return stdinRequest as ExecuteSkillRequest;
    }
  }

  return {
    skill_id: requireString(options.skillId, "skill_id"),
    input: await readJsonInput(options),
    options: toExecutionOptions(options),
  };
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name("skill-action-runtime")
    .description("CLI for the Skill Action runtime")
    .showHelpAfterError();

  addPackageOptions(
    program
      .command("list-skills")
      .action(async (options) => {
        const registries = await loadRegistries(options);
        const result = {
          skills: registries.skills.map((skill) => ({
            skill_id: skill.definition.skill_id,
            title: skill.definition.title,
            description: skill.definition.description,
            entry_action: skill.definition.entry_action,
            source_path: skill.sourcePath ?? null,
          })),
        };
        printResult(result, options.output);
        process.exitCode = 0;
      }),
  );

  addHandlerModuleOption(
    addPackageOptions(
      program
        .command("list-actions")
        .option("--skill-id <id>", "Filter actions by skill id")
        .option("--kind <kind>", "Filter actions by kind")
        .action(async (options) => {
          const { registries } = await loadRuntimeContext(options);
          const actions = registries.actions
            .filter((action) => !options.skillId || action.skillId === options.skillId)
            .filter((action) => !options.kind || action.definition.kind === options.kind)
            .map((action) => ({
              action_id: action.definition.action_id,
              kind: action.definition.kind,
              idempotent: action.definition.idempotent,
              skill_id: action.skillId ?? null,
              source_path: action.sourcePath ?? null,
            }));

          printResult({ actions }, options.output);
          process.exitCode = 0;
        }),
    ),
  );

  addPackageOptions(
    program
      .command("validate-skill-package")
      .action(async (options) => {
        const result = await validateSkillPackages(options);
        printResult(result, options.output);
        process.exitCode = result.valid ? 0 : 1;
      }),
  );

  addHandlerModuleOption(
    addPackageOptions(
      addRequestOptions(
        program
            .command("resolve-action")
            .option("--skill-id <id>", "Skill identifier containing the action")
            .option("--action-id <id>", "Action identifier to resolve")
            .action(async (options) => {
              const { registries, handlers } = await loadRuntimeContext(options);
              const runtime = createRuntimeForCommand(registries, handlers);
            const result = await runtime.resolveAction(await getResolveActionRequest(options));
            printResult(result, options.output);
            setExitCodeFromResult(result);
          }),
      ),
    ),
  );

  addHandlerModuleOption(
    addRequestOptions(
      addInputOptions(
        addPackageOptions(
          program
            .command("validate-action-input")
            .option("--skill-id <id>", "Skill identifier containing the action")
            .option("--action-id <id>", "Action identifier to validate")
            .action(async (options) => {
              const { registries, handlers } = await loadRuntimeContext(options);
              const runtime = createRuntimeForCommand(registries, handlers);
              const result = await runtime.validateActionInput(
                await getValidateActionInputRequest(options),
              );
              printResult(result, options.output);
              setExitCodeFromResult(result);
            }),
        ),
      ),
    ),
  );

  addHandlerModuleOption(
    addRequestOptions(
      addExecutionOptions(
        addInputOptions(
          addPackageOptions(
            program
              .command("execute-action")
              .option("--skill-id <id>", "Skill identifier containing the action")
              .option("--action-id <id>", "Action identifier to execute")
              .action(async (options) => {
                const { registries, handlers } = await loadRuntimeContext(options);
                const runtime = createRuntimeForCommand(registries, handlers);
                const result = await runtime.executeAction(await getExecuteActionRequest(options));
                printResult(result, options.output);
                setExitCodeFromResult(result);
              }),
          ),
        ),
      ),
    ),
  );

  addHandlerModuleOption(
    addRequestOptions(
      addExecutionOptions(
        addInputOptions(
          addPackageOptions(
            program
              .command("execute-skill")
              .option("--skill-id <id>", "Skill identifier to execute")
              .action(async (options) => {
                const { registries, handlers } = await loadRuntimeContext(options);
                const runtime = createRuntimeForCommand(registries, handlers);
                const result = await runtime.executeSkill(await getExecuteSkillRequest(options));
                printResult(result, options.output);
                setExitCodeFromResult(result);
              }),
          ),
        ),
      ),
    ),
  );

  return program;
}

export async function runCli(argv: string[]): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv, { from: "user" });
}
