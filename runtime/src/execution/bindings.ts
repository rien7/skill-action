import type { JsonObject } from "../types/json.js";

export interface BindingState {
  input: unknown;
  stepOutputs: Record<string, unknown>;
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

export function resolveReference(reference: string, state: BindingState): unknown {
  if (reference === "$input") {
    return state.input;
  }

  if (reference.startsWith("$input.")) {
    return readPath(state.input, getPathSegments(reference.slice("$input.".length)));
  }

  if (reference.startsWith("$steps.")) {
    const segments = getPathSegments(reference.slice("$steps.".length));
    const [stepId, maybeOutput, ...rest] = segments;

    if (!stepId || maybeOutput !== "output") {
      return undefined;
    }

    const stepOutput = state.stepOutputs[stepId];
    return rest.length === 0 ? stepOutput : readPath(stepOutput, rest);
  }

  return undefined;
}

export function resolveBindings(value: unknown, state: BindingState): unknown {
  if (typeof value === "string" && value.startsWith("$")) {
    return resolveReference(value, state);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveBindings(item, state));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as JsonObject).map(([key, nested]) => [
      key,
      resolveBindings(nested, state),
    ]);
    return Object.fromEntries(entries);
  }

  return value;
}

