import { RuntimeError, type RuntimeErrorCode } from "../types/errors.js";
import type { JsonObject } from "../types/json.js";

export interface BindingState {
  input: unknown;
  stepOutputs: Record<string, unknown>;
}

interface ResolveReferenceOptions {
  strict?: boolean;
  failureCode?: RuntimeErrorCode;
  reason?: "binding" | "condition";
}

function getPathSegments(reference: string): string[] {
  return reference.split(".").filter(Boolean);
}

function readPath(source: unknown, segments: string[]): unknown {
  let current = source;

  for (const segment of segments) {
    if (current === null || typeof current !== "object" || !(segment in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function handleUnresolvedReference(
  reference: string,
  options: ResolveReferenceOptions,
): undefined {
  if (!options.strict) {
    return undefined;
  }

  throw new RuntimeError(
    options.failureCode ?? "ACTION_EXECUTION_FAILED",
    `Unresolved ${options.reason ?? "binding"} reference "${reference}".`,
    {
      reference,
      reason: options.reason ?? "binding",
    },
  );
}

export function resolveReference(
  reference: string,
  state: BindingState,
  options: ResolveReferenceOptions = {},
): unknown {
  if (reference === "$input") {
    return state.input;
  }

  if (reference.startsWith("$input.")) {
    const resolved = readPath(state.input, getPathSegments(reference.slice("$input.".length)));
    return resolved === undefined ? handleUnresolvedReference(reference, options) : resolved;
  }

  if (reference.startsWith("$steps.")) {
    const segments = getPathSegments(reference.slice("$steps.".length));
    const [stepId, maybeOutput, ...rest] = segments;

    if (!stepId || maybeOutput !== "output") {
      return handleUnresolvedReference(reference, options);
    }

    const stepOutput = state.stepOutputs[stepId];
    const resolved = rest.length === 0 ? stepOutput : readPath(stepOutput, rest);
    return resolved === undefined ? handleUnresolvedReference(reference, options) : resolved;
  }

  return handleUnresolvedReference(reference, options);
}

export function resolveBindings(
  value: unknown,
  state: BindingState,
  options: ResolveReferenceOptions = {},
): unknown {
  if (typeof value === "string" && value.startsWith("$")) {
    return resolveReference(value, state, {
      strict: true,
      ...(options.failureCode ? { failureCode: options.failureCode } : {}),
      reason: options.reason ?? "binding",
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveBindings(item, state, options));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as JsonObject).map(([key, nested]) => [
      key,
      resolveBindings(nested, state, options),
    ]);
    return Object.fromEntries(entries);
  }

  return value;
}
