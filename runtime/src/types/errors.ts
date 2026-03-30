export const RUNTIME_ERROR_CODES = [
  "ACTION_NOT_FOUND",
  "VERSION_NOT_FOUND",
  "SKILL_NOT_FOUND",
  "INVALID_INPUT",
  "SCHEMA_VALIDATION_FAILED",
  "STEP_EXECUTION_FAILED",
  "ACTION_EXECUTION_FAILED",
  "TIMEOUT_EXCEEDED",
  "MAX_DEPTH_EXCEEDED",
  "MAX_STEPS_EXCEEDED",
  "VISIBILITY_VIOLATION",
  "ACTION_NOT_CALLABLE",
  "INVALID_CONDITION",
] as const;

export type RuntimeErrorCode = (typeof RUNTIME_ERROR_CODES)[number];

export class RuntimeError extends Error {
  readonly code: RuntimeErrorCode;
  readonly details: unknown;

  constructor(code: RuntimeErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "RuntimeError";
    this.code = code;
    this.details = details ?? null;
  }
}

