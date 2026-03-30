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
  currentSkillId: string | undefined;
}

export type PrimitiveActionHandler = (
  context: PrimitiveActionHandlerContext,
) => Promise<unknown> | unknown;

export type PrimitiveActionHandlerMap = Record<string, PrimitiveActionHandler>;

export interface ActionRuntimeOptions {
  actionRegistry: ActionRegistry;
  skillRegistry: SkillRegistry;
  primitiveHandlers?: PrimitiveActionHandlerMap;
  fallbackPrimitiveHandler?: PrimitiveActionHandler;
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

export class ActionRuntime {
  private readonly actionRegistry: ActionRegistry;
  private readonly skillRegistry: SkillRegistry;
  private readonly primitiveHandlers: PrimitiveActionHandlerMap;
  private readonly fallbackPrimitiveHandler: PrimitiveActionHandler | undefined;
  private readonly ajv = new Ajv({ allErrors: true, strict: false });
  private readonly validatorCache = new Map<string, ValidateFunction>();

  constructor(options: ActionRuntimeOptions) {
    this.actionRegistry = options.actionRegistry;
    this.skillRegistry = options.skillRegistry;
    this.primitiveHandlers = options.primitiveHandlers ?? {};
    this.fallbackPrimitiveHandler = options.fallbackPrimitiveHandler;
  }

  async resolveAction(
    request: ResolveActionRequest,
  ): Promise<RuntimeResponse<{ action: ActionDefinition; skill_id?: string }>> {
    return this.respond(async (meta) => {
      const parsed = resolveActionRequestSchema.parse(request);
      const action = await this.actionRegistry.resolve(parsed.action_id, parsed.version);

      return this.success(meta, action.skillId
        ? {
            action: action.definition,
            skill_id: action.skillId,
          }
        : {
            action: action.definition,
          });
    });
  }

  async validateActionInput(
    request: ValidateActionInputRequest,
  ): Promise<RuntimeResponse<{ valid: true }>> {
    return this.respond(async (meta) => {
      const parsed = validateActionInputRequestSchema.parse(request);
      const action = await this.actionRegistry.resolve(parsed.action_id, parsed.version);
      this.validateAgainstSchema(action, "input", parsed.input);

      return this.success(meta, { valid: true });
    });
  }

  async executeAction(
    request: ExecuteActionRequest,
  ): Promise<RuntimeResponse<ExecutionResult>> {
    return this.respond(async (meta) => {
      const parsed = executeActionRequestSchema.parse(request);
      const options = executionOptionsSchema.parse(parsed.options ?? {});
      const state = this.createExecutionState(meta.request_id, options);
      const action = await this.actionRegistry.resolve(parsed.action_id);

      this.assertVisibility(action, {
        callMode: "external-action",
        currentSkillId: undefined,
      });

      const output = await this.executeRegisteredAction(action, parsed.input, state, {
        depth: 1,
        callMode: "external-action",
        currentSkillId: undefined,
        tracePath: undefined,
      });

      const result = this.buildExecutionResult(state, output);
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
      const action = await this.actionRegistry.resolve(skill.definition.entry_action);

      this.assertVisibility(action, {
        callMode: "skill-entry",
        currentSkillId: skill.definition.skill_id,
      });

      const output = await this.executeRegisteredAction(action, parsed.input, state, {
        depth: 1,
        callMode: "skill-entry",
        currentSkillId: skill.definition.skill_id,
        tracePath: undefined,
      });

      const result = this.buildExecutionResult(state, output);
      return this.success(meta, result);
    });
  }

  private async executeRegisteredAction(
    action: RegisteredAction,
    input: unknown,
    state: ExecutionState,
    context: InvocationContext,
  ): Promise<unknown> {
    if (context.depth > state.options.max_depth) {
      throw new RuntimeError("MAX_DEPTH_EXCEEDED", "Maximum execution depth exceeded.", {
        max_depth: state.options.max_depth,
      });
    }

    this.validateAgainstSchema(action, "input", input);

    const effectiveSkillId = context.currentSkillId ?? action.skillId;
    if (action.definition.kind === "primitive") {
      return this.executePrimitive(action as RegisteredAction & { definition: PrimitiveActionDefinition }, input, state, {
        ...context,
        currentSkillId: effectiveSkillId,
      });
    }

    return this.executeComposite(action as RegisteredAction & { definition: CompositeActionDefinition }, input, state, {
      ...context,
      currentSkillId: effectiveSkillId,
    });
  }

  private async executePrimitive(
    action: RegisteredAction & { definition: PrimitiveActionDefinition },
    input: unknown,
    state: ExecutionState,
    context: InvocationContext,
  ): Promise<unknown> {
    this.incrementStepCount(state);

    const stepId = context.tracePath ?? "root";
    const startedAt = new Date().toISOString();
    let output: unknown = null;
    let status: TraceStep["status"] = "succeeded";
    let error: unknown = null;

    if (state.options.dry_run) {
      status = "skipped";
    } else {
      const handler =
        this.primitiveHandlers[action.definition.action_id] ?? this.fallbackPrimitiveHandler;

      if (!handler) {
        throw new RuntimeError(
          "ACTION_EXECUTION_FAILED",
          `No primitive handler was registered for action "${action.definition.action_id}".`,
          {
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
          currentSkillId: context.currentSkillId,
        });
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
      this.validateAgainstSchema(action, "output", output);
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
    let lastOutput: unknown = null;

    for (const step of action.definition.steps) {
      this.incrementStepCount(state);

      const stepId = context.tracePath ? `${context.tracePath}.${step.id}` : step.id;
      const startedAt = new Date().toISOString();
      const bindingState = {
        input,
        stepOutputs,
      };

      if (step.if && !evaluateCondition(step.if, bindingState)) {
        state.trace.push({
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
      const nestedAction = await this.actionRegistry.resolve(step.action);

      this.assertVisibility(nestedAction, {
        callMode: "nested",
        currentSkillId: context.currentSkillId,
      });

      try {
        const output = await this.executeRegisteredAction(nestedAction, nestedInput, state, {
          depth: context.depth + 1,
          callMode: "nested",
          currentSkillId: context.currentSkillId,
          tracePath: stepId,
        });
        stepOutputs[step.id] = output;
        lastOutput = output;
      } catch (error) {
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

    return lastOutput;
  }

  private validateAgainstSchema(
    action: RegisteredAction,
    target: "input" | "output",
    value: unknown,
  ): void {
    const schema = target === "input" ? action.definition.input_schema : action.definition.output_schema;
    const validator = this.getValidator(action, target, schema);
    const valid = validator(value);

    if (!valid) {
      const errors = this.formatAjvErrors(validator.errors ?? []);
      throw new RuntimeError(
        "INVALID_INPUT",
        `${target} validation failed for action "${action.definition.action_id}".`,
        {
          action_id: action.definition.action_id,
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
        "SCHEMA_VALIDATION_FAILED",
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
    state.stepCount += 1;
    if (state.stepCount > state.options.max_steps) {
      throw new RuntimeError("MAX_STEPS_EXCEEDED", "Maximum execution steps exceeded.", {
        max_steps: state.options.max_steps,
      });
    }
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

  private buildExecutionResult(state: ExecutionState, output: unknown): ExecutionResult {
    return {
      execution_id: state.executionId,
      status: "succeeded",
      output: output ?? null,
      trace: {
        steps: state.options.trace_level === "none" ? [] : state.trace,
      },
      started_at: state.startedAt,
      finished_at: new Date().toISOString(),
    };
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
