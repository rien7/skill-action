import { z } from "zod";

export const executionOptionsSchema = z.object({
  dry_run: z.boolean().default(false),
  trace_level: z.enum(["none", "basic", "full"]).default("basic"),
  timeout_ms: z.number().int().positive().default(30000),
  max_depth: z.number().int().positive().default(20),
  max_steps: z.number().int().positive().default(200),
});

export const resolveActionRequestSchema = z.object({
  skill_id: z.string().min(1),
  action_id: z.string().min(1),
});

export const executeActionRequestSchema = z.object({
  skill_id: z.string().min(1),
  action_id: z.string().min(1),
  input: z.unknown().default({}),
  options: executionOptionsSchema.partial().optional(),
});

export const executeSkillRequestSchema = z.object({
  skill_id: z.string().min(1),
  input: z.unknown().default({}),
  options: executionOptionsSchema.partial().optional(),
});

export const validateActionInputRequestSchema = z.object({
  skill_id: z.string().min(1),
  action_id: z.string().min(1),
  input: z.unknown(),
});

export const traceStepSchema = z.object({
  step_id: z.string().min(1),
  action_id: z.string().min(1),
  status: z.enum(["succeeded", "failed", "skipped"]),
  input: z.unknown(),
  output: z.unknown().nullable(),
  error: z.unknown().nullable(),
  started_at: z.string().min(1),
  finished_at: z.string().min(1),
});

export const traceSchema = z.object({
  steps: z.array(traceStepSchema),
});

export const executionResultSchema = z.object({
  execution_id: z.string().min(1),
  status: z.enum(["succeeded", "failed"]),
  output: z.unknown().nullable(),
  trace: traceSchema,
  started_at: z.string().min(1),
  finished_at: z.string().min(1),
});

export const runtimeMetaSchema = z.object({
  request_id: z.string().min(1),
  spec_version: z.string().min(1),
});

export const runtimeErrorPayloadSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().nullable(),
});

export type ExecutionOptions = z.infer<typeof executionOptionsSchema>;
export type ResolveActionRequest = z.infer<typeof resolveActionRequestSchema>;
export type ExecuteActionRequest = z.infer<typeof executeActionRequestSchema>;
export type ExecuteSkillRequest = z.infer<typeof executeSkillRequestSchema>;
export type ValidateActionInputRequest = z.infer<typeof validateActionInputRequestSchema>;
export type TraceStep = z.infer<typeof traceStepSchema>;
export type Trace = z.infer<typeof traceSchema>;
export type ExecutionResult = z.infer<typeof executionResultSchema>;
export type RuntimeMeta = z.infer<typeof runtimeMetaSchema>;
export type RuntimeErrorPayload = z.infer<typeof runtimeErrorPayloadSchema>;

export type RuntimeSuccessResponse<T> = {
  ok: true;
  data: T;
  error: null;
  meta: RuntimeMeta;
};

export type RuntimeFailureResponse = {
  ok: false;
  data: null;
  error: RuntimeErrorPayload;
  meta: RuntimeMeta;
};

export type RuntimeResponse<T> = RuntimeSuccessResponse<T> | RuntimeFailureResponse;
