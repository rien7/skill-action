import { randomUUID } from "node:crypto";

import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";

import { evaluateCondition } from "../execution/conditions.js";
import { resolveBindings } from "../execution/bindings.js";
import type { ActionDefinition, CompositeActionDefinition, PrimitiveActionDefinition } from "../types/action.js";
import { RuntimeError } from "../types/errors.js";
import {
  executeActionRequestSchema,
  executeSkillRequestSchema,
  executionOptionsSchema,
  resolveActionRequestSchema,
  validateActionInputRequestSchema,
  type ExecuteActionRequest,
  type ExecuteSkillRequest,
  type ExecutionOptions,
  type ExecutionResult,
  type ResolveActionRequest,
  type RuntimeFailureResponse,
  type RuntimeMeta,
  type RuntimeResponse,
  type RuntimeSuccessResponse,
  type Trace,
  type TraceStep,
  type ValidateActionInputRequest,
} from "../types/protocol.js";
import type { RegisteredAction, ActionRegistry } from "../registry/action-registry.js";
import type { SkillRegistry } from "../registry/skill-registry.js";

const SPEC_VERSION = "1.0.0";

export interface PrimitiveActionHandlerContext {
  action: PrimitiveActionDefinition;
  input: unknown;
  options: ExecutionOptions;
  requestId: string;
  skillId: string;
}

export type PrimitiveActionHandler = (
  context: PrimitiveActionHandlerContext,
) => Promise<unknown> | unknown;

export type PrimitiveActionHandlerMap = Record<string, PrimitiveActionHandler>;

export interface ActionRuntimeOptions {
  actionRegistry: ActionRegistry;
  skillRegistry: SkillRegistry;
  primitiveHandlers?: PrimitiveActionHandlerMap;
}

interface ExecutionState {
  requestId: string;
  executionId: string;
  startedAt: string;
  options: ExecutionOptions;
  trace: TraceStep[];
  ajv: Ajv;
  validatorCache: Map<string, ValidateFunction>;
  stepCount: number;
}

interface InvocationContext {
  depth: number;
  callMode: "external-action" | "skill-entry" | "nested";
  currentSkillId: string | undefined;
  tracePath: string | undefined;
}

interface ActionSelectionOptions {
  version?: string;
  skillId: string;
}

export function primitiveBindingKey(skillId: string, actionId: string): string {
  return JSON.stringify([skillId, actionId]);
}

export class ActionRuntime {
  private readonly actionRegistry: ActionRegistry;
  private readonly skillRegistry: SkillRegistry;
  private readonly primitiveHandlers: PrimitiveActionHandlerMap;
  private readonly ajv = new Ajv({ allErrors: true, strict: false });
  private readonly validatorCache = new Map<string, ValidateFunction>();

  constructor(options: ActionRuntimeOptions) {
    this.actionRegistry = options.actionRegistry;
    this.skillRegistry = options.skillRegistry;
    this.primitiveHandlers = options.primitiveHandlers ?? {};
  }

  async resolveAction(
    request: ResolveActionRequest,
  ): Promise<RuntimeResponse<{ skill_id: string; action_id: string; kind: ActionDefinition["kind"] }>> {
    return this.respond(async (meta) => {
      const parsed = resolveActionRequestSchema.parse(request);
      await this.skillRegistry.resolve(parsed.skill_id);
      const action = await this.resolveActionForRequest(parsed.action_id, {
        skillId: parsed.skill_id,
      });

      return this.success(meta, {
        skill_id: parsed.skill_id,
        action_id: action.definition.action_id,
        kind: action.definition.kind,
      });
    });
  }

  async validateActionInput(
    request: ValidateActionInputRequest,
  ): Promise<RuntimeResponse<{ valid: true; skill_id: string; action_id: string }>> {
    return this.respond(async (meta) => {
      const parsed = validateActionInputRequestSchema.parse(request);
      await this.skillRegistry.resolve(parsed.skill_id);
      const action = await this.resolveActionForRequest(parsed.action_id, {
        skillId: parsed.skill_id,
      });
      this.validateAgainstSchema(action, "input", parsed.input, "protocol");

      return this.success(meta, {
        valid: true,
        skill_id: parsed.skill_id,
        action_id: action.definition.action_id,
      });
    });
  }

  async executeAction(
    request: ExecuteActionRequest,
  ): Promise<RuntimeResponse<ExecutionResult>> {
    return this.respond(async (meta) => {
      const parsed = executeActionRequestSchema.parse(request);
      const options = executionOptionsSchema.parse(parsed.options ?? {});
      const state = this.createExecutionState(meta.request_id, options);
      await this.skillRegistry.resolve(parsed.skill_id);
      const action = await this.resolveActionForRequest(parsed.action_id, {
        skillId: parsed.skill_id,
      });

      this.assertVisibility(action, {
        callMode: "external-action",
        currentSkillId: parsed.skill_id,
      });

      // Root input validation is protocol-level; if this fails, execution never starts.
      this.validateAgainstSchema(action, "input", parsed.input, "protocol");

      const result = await this.executeStartedAction(action, parsed.input, state, {
        depth: 0,
        callMode: "external-action",
        currentSkillId: parsed.skill_id,
        tracePath: undefined,
      });
      return this.success(meta, result);
    });
  }

  async executeSkill(
    request: ExecuteSkillRequest,
  ): Promise<RuntimeResponse<ExecutionResult>> {
    return this.respond(async (meta) => {
      const parsed = executeSkillRequestSchema.parse(request);
      const options = executionOptionsSchema.parse(parsed.options ?? {});
      const state = this.createExecutionState(meta.request_id, options);
      const skill = await this.skillRegistry.resolve(parsed.skill_id);
      const action = await this.resolveActionForRequest(skill.definition.entry_action, {
        skillId: skill.definition.skill_id,
      });

      this.assertVisibility(action, {
        callMode: "skill-entry",
        currentSkillId: skill.definition.skill_id,
      });

      // Root input validation is protocol-level; if this fails, execution never starts.
      this.validateAgainstSchema(action, "input", parsed.input, "protocol");

      const result = await this.executeStartedAction(action, parsed.input, state, {
        depth: 0,
        callMode: "skill-entry",
        currentSkillId: skill.definition.skill_id,
        tracePath: undefined,
      });
      return this.success(meta, result);
    });
  }

  private async executeStartedAction(
    action: RegisteredAction,
    input: unknown,
    state: ExecutionState,
    context: InvocationContext,
  ): Promise<ExecutionResult> {
    try {
      const output = await this.executeRegisteredAction(action, input, state, context, false);
      return this.buildExecutionResult(state, "succeeded", output);
    } catch {
      return this.buildExecutionResult(state, "failed", null);
    }
  }

  private async executeRegisteredAction(
    action: RegisteredAction,
    input: unknown,
    state: ExecutionState,
    context: InvocationContext,
    validateInput = true,
  ): Promise<unknown> {
    this.checkTimeout(state);

    if (context.depth > state.options.max_depth) {
      throw new RuntimeError("MAX_DEPTH_EXCEEDED", "Maximum execution depth exceeded.", {
        max_depth: state.options.max_depth,
      });
    }

    if (validateInput) {
      this.validateAgainstSchema(action, "input", input, "execution");
    }

    const effectiveSkillId = context.currentSkillId ?? action.skillId;
    if (action.definition.kind === "primitive") {
      return this.executePrimitive(
        action as RegisteredAction & { definition: PrimitiveActionDefinition },
        input,
        state,
        {
          ...context,
          currentSkillId: effectiveSkillId,
        },
      );
    }

    return this.executeComposite(
      action as RegisteredAction & { definition: CompositeActionDefinition },
      input,
      state,
      {
        ...context,
        currentSkillId: effectiveSkillId,
      },
    );
  }

  private async executePrimitive(
    action: RegisteredAction & { definition: PrimitiveActionDefinition },
    input: unknown,
    state: ExecutionState,
    context: InvocationContext,
  ): Promise<unknown> {
    const stepId = context.tracePath ?? "root";
    const startedAt = new Date().toISOString();
    let output: unknown = null;
    let status: TraceStep["status"] = "succeeded";
    let error: unknown = null;

    if (state.options.dry_run) {
      status = "skipped";
    } else {
      const skillId = action.skillId ?? context.currentSkillId;
      if (!skillId) {
        throw new RuntimeError(
          "PRIMITIVE_BINDING_NOT_FOUND",
          `Primitive action "${action.definition.action_id}" is missing package identity.`,
          {
            skill_id: null,
            action_id: action.definition.action_id,
          },
        );
      }

      const handler =
        this.primitiveHandlers[primitiveBindingKey(skillId, action.definition.action_id)];

      if (!handler) {
        throw new RuntimeError(
          "PRIMITIVE_BINDING_NOT_FOUND",
          `No primitive binding was registered for action "${action.definition.action_id}" in skill "${skillId}".`,
          {
            skill_id: skillId,
            action_id: action.definition.action_id,
          },
        );
      }

      try {
        output = await handler({
          action: action.definition,
          input,
          options: state.options,
          requestId: state.requestId,
          skillId,
        });
        this.checkTimeout(state);
      } catch (cause) {
        error = cause;
        status = "failed";
      }
    }

    const finishedAt = new Date().toISOString();
    state.trace.push({
      step_id: stepId,
      action_id: action.definition.action_id,
      status,
      input,
      output: output ?? null,
      error,
      started_at: startedAt,
      finished_at: finishedAt,
    });

    if (status === "failed") {
      throw new RuntimeError(
        "STEP_EXECUTION_FAILED",
        `Primitive action "${action.definition.action_id}" failed.`,
        error,
      );
    }

    if (status !== "skipped") {
      this.validateAgainstSchema(action, "output", output, "execution");
    }

    return output;
  }

  private async executeComposite(
    action: RegisteredAction & { definition: CompositeActionDefinition },
    input: unknown,
    state: ExecutionState,
    context: InvocationContext,
  ): Promise<unknown> {
    const stepOutputs: Record<string, unknown> = {};

    for (const step of action.definition.steps) {
      this.checkTimeout(state);

      const stepId = context.tracePath ? `${context.tracePath}.${step.id}` : step.id;
      const startedAt = new Date().toISOString();
      const bindingState = {
        input,
        stepOutputs,
      };

      try {
        const reachable = step.if ? evaluateCondition(step.if, bindingState) : true;
        this.incrementStepCount(state);

        if (!reachable) {
          this.pushTrace(state, {
            step_id: stepId,
            action_id: step.action,
            status: "skipped",
            input: null,
            output: null,
            error: null,
            started_at: startedAt,
            finished_at: new Date().toISOString(),
          });
          continue;
        }

        const nestedInput = resolveBindings(step.with, bindingState);
        const nestedAction = await this.resolveActionForRequest(
          step.action,
          {
            skillId: context.currentSkillId ?? action.skillId!,
          },
        );

        this.assertVisibility(nestedAction, {
          callMode: "nested",
          currentSkillId: context.currentSkillId,
        });

        const output = await this.executeRegisteredAction(nestedAction, nestedInput, state, {
          depth: context.depth + 1,
          callMode: "nested",
          currentSkillId: context.currentSkillId,
          tracePath: stepId,
        });
        stepOutputs[step.id] = output;
      } catch (error) {
        if (!this.hasTraceStep(state, stepId)) {
          this.pushTrace(state, {
            step_id: stepId,
            action_id: step.action,
            status: "failed",
            input: null,
            output: null,
            error: error instanceof RuntimeError
              ? {
                  code: error.code,
                  message: error.message,
                  details: error.details ?? null,
                }
              : error,
            started_at: startedAt,
            finished_at: new Date().toISOString(),
          });
        }

        if (!(error instanceof RuntimeError)) {
          throw new RuntimeError(
            "STEP_EXECUTION_FAILED",
            `Step "${step.id}" failed while executing "${step.action}".`,
            error,
          );
        }

        throw error;
      }
    }

    const finalOutput = resolveBindings(action.definition.returns, {
      input,
      stepOutputs,
    });

    this.validateAgainstSchema(action, "output", finalOutput, "execution");
    return finalOutput;
  }

  private validateAgainstSchema(
    action: RegisteredAction,
    target: "input" | "output",
    value: unknown,
    phase: "protocol" | "execution",
  ): void {
    const schema = target === "input" ? action.definition.input_schema : action.definition.output_schema;
    const validator = this.getValidator(action, target, schema);
    const valid = validator(value);

    if (!valid) {
      const errors = this.formatAjvErrors(validator.errors ?? []);
      throw new RuntimeError(
        phase === "protocol" ? "SCHEMA_VALIDATION_FAILED" : "ACTION_EXECUTION_FAILED",
        `${target} validation failed for action "${action.definition.action_id}".`,
        {
          action_id: action.definition.action_id,
          skill_id: action.skillId ?? null,
          target,
          errors,
        },
      );
    }
  }

  private getValidator(
    action: RegisteredAction,
    target: "input" | "output",
    schema: Record<string, unknown>,
  ): ValidateFunction {
    const cacheKey = `${action.definition.action_id}@${action.definition.version}:${target}`;
    const cached = this.validatorCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const validator = this.ajv.compile(schema);
      this.validatorCache.set(cacheKey, validator);
      return validator;
    } catch (error) {
      throw new RuntimeError(
        "SCHEMA_COMPILATION_FAILED",
        `Failed to compile ${target} schema for action "${action.definition.action_id}".`,
        error,
      );
    }
  }

  private formatAjvErrors(errors: ErrorObject[]): Array<Record<string, unknown>> {
    return errors.map((error) => ({
      instancePath: error.instancePath,
      schemaPath: error.schemaPath,
      keyword: error.keyword,
      message: error.message,
      params: error.params,
    }));
  }

  private assertVisibility(
    action: RegisteredAction,
    context: Pick<InvocationContext, "callMode" | "currentSkillId">,
  ): void {
    const visibility = action.definition.visibility;

    if (visibility === "public") {
      return;
    }

    if (visibility === "skill") {
      if (context.currentSkillId && context.currentSkillId === action.skillId) {
        return;
      }

      throw new RuntimeError(
        "VISIBILITY_VIOLATION",
        `Action "${action.definition.action_id}" is restricted to skill scope.`,
        {
          action_id: action.definition.action_id,
          visibility,
          current_skill_id: context.currentSkillId ?? null,
        },
      );
    }

    if (
      visibility === "internal" &&
      context.callMode === "nested" &&
      context.currentSkillId &&
      context.currentSkillId === action.skillId
    ) {
      return;
    }

    throw new RuntimeError(
      "VISIBILITY_VIOLATION",
      `Action "${action.definition.action_id}" is restricted to internal action scope.`,
      {
        action_id: action.definition.action_id,
        visibility,
        current_skill_id: context.currentSkillId ?? null,
      },
    );
  }

  private incrementStepCount(state: ExecutionState): void {
    if (state.stepCount + 1 > state.options.max_steps) {
      throw new RuntimeError("MAX_STEPS_EXCEEDED", "Maximum execution steps exceeded.", {
        max_steps: state.options.max_steps,
      });
    }
    state.stepCount += 1;
  }

  private checkTimeout(state: ExecutionState): void {
    const elapsedMs = Date.now() - Date.parse(state.startedAt);
    if (elapsedMs > state.options.timeout_ms) {
      throw new RuntimeError("TIMEOUT_EXCEEDED", "Execution timeout exceeded.", {
        timeout_ms: state.options.timeout_ms,
        elapsed_ms: elapsedMs,
      });
    }
  }

  private async resolveActionForRequest(
    actionId: string,
    options: ActionSelectionOptions,
  ): Promise<RegisteredAction> {
    const candidates = await this.actionRegistry.list(actionId, options.version);
    const localCandidates = candidates.filter((candidate) => candidate.skillId === options.skillId);
    return this.selectResolvedAction(actionId, localCandidates, options.version);
  }

  private selectResolvedAction(
    actionId: string,
    candidates: RegisteredAction[],
    version?: string,
  ): RegisteredAction {
    if (candidates.length === 1) {
      return candidates[0]!;
    }

    if (candidates.length === 0) {
      throw new RuntimeError(
        version ? "VERSION_NOT_FOUND" : "ACTION_NOT_FOUND",
        version
          ? `Version "${version}" was not found for action "${actionId}".`
          : `Action "${actionId}" was not found.`,
        version
          ? {
              action_id: actionId,
              version,
            }
          : {
              action_id: actionId,
            },
      );
    }

    throw new RuntimeError(
      "ACTION_RESOLUTION_AMBIGUOUS",
      `Action "${actionId}" resolved to multiple candidates.`,
      {
        action_id: actionId,
        candidates: candidates.map((candidate) => ({
          version: candidate.definition.version,
          skill_id: candidate.skillId ?? null,
          source_path: candidate.sourcePath ?? null,
        })),
      },
    );
  }

  private createExecutionState(requestId: string, options: ExecutionOptions): ExecutionState {
    return {
      requestId,
      executionId: randomUUID(),
      startedAt: new Date().toISOString(),
      options,
      trace: [],
      ajv: this.ajv,
      validatorCache: this.validatorCache,
      stepCount: 0,
    };
  }

  private buildExecutionResult(
    state: ExecutionState,
    status: ExecutionResult["status"],
    output: unknown,
  ): ExecutionResult {
    return {
      execution_id: state.executionId,
      status,
      output: output ?? null,
      trace: {
        steps: state.options.trace_level === "none" ? [] : state.trace,
      },
      started_at: state.startedAt,
      finished_at: new Date().toISOString(),
    };
  }

  private hasTraceStep(state: ExecutionState, stepId: string): boolean {
    return state.trace.some((step) => step.step_id === stepId);
  }

  private pushTrace(state: ExecutionState, step: TraceStep): void {
    state.trace.push(step);
  }

  private async respond<T>(
    fn: (meta: RuntimeMeta) => Promise<RuntimeSuccessResponse<T>>,
  ): Promise<RuntimeResponse<T>> {
    const meta = {
      request_id: randomUUID(),
      spec_version: SPEC_VERSION,
    } satisfies RuntimeMeta;

    try {
      return await fn(meta);
    } catch (error) {
      return this.failure(meta, error);
    }
  }

  private success<T>(meta: RuntimeMeta, data: T): RuntimeSuccessResponse<T> {
    return {
      ok: true,
      data,
      error: null,
      meta,
    };
  }

  private failure(meta: RuntimeMeta, error: unknown): RuntimeFailureResponse {
    const normalized =
      error instanceof RuntimeError
        ? error
        : new RuntimeError("ACTION_EXECUTION_FAILED", "Unexpected runtime failure.", error);

    return {
      ok: false,
      data: null,
      error: {
        code: normalized.code,
        message: normalized.message,
        details: normalized.details ?? null,
      },
      meta,
    };
  }
}
