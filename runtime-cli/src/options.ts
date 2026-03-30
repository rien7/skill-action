import type { ExecutionOptions } from "@rien7/skill-action-runtime";

import type { RuntimeExecutionOptionFlags } from "./types.js";

export function toExecutionOptions(flags: RuntimeExecutionOptionFlags): Partial<ExecutionOptions> {
  const result: Partial<ExecutionOptions> = {};

  if (flags.dryRun !== undefined) {
    result.dry_run = flags.dryRun;
  }

  if (flags.traceLevel !== undefined) {
    result.trace_level = flags.traceLevel;
  }

  if (flags.timeoutMs !== undefined) {
    result.timeout_ms = flags.timeoutMs;
  }

  if (flags.maxDepth !== undefined) {
    result.max_depth = flags.maxDepth;
  }

  if (flags.maxSteps !== undefined) {
    result.max_steps = flags.maxSteps;
  }

  return result;
}
