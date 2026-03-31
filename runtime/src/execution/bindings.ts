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

interface ParsedReference {
  root: "input" | "steps";
  stepId?: string;
  path: string[];
}

function readJsonStringLiteral(source: string, start: number): { value: string; nextIndex: number } {
  let index = start + 1;
  let escaped = false;

  while (index < source.length) {
    const char = source[index]!;
    if (!escaped && char === "\"") {
      return {
        value: JSON.parse(source.slice(start, index + 1)) as string,
        nextIndex: index + 1,
      };
    }

    escaped = !escaped && char === "\\";
    if (char !== "\\") {
      escaped = false;
    }
    index += 1;
  }

  throw new RuntimeError("ACTION_EXECUTION_FAILED", "Unterminated JSON string literal in binding.", {
    reference: source,
  });
}

function readBindingPath(reference: string, startIndex: number): { path: string[]; nextIndex: number } {
  const path: string[] = [];
  let index = startIndex;

  while (index < reference.length) {
    const char = reference[index]!;

    if (char === ".") {
      const match = reference.slice(index + 1).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (!match) {
        return { path, nextIndex: -1 };
      }

      path.push(match[0]);
      index += 1 + match[0].length;
      continue;
    }

    if (char === "[") {
      if (reference[index + 1] !== "\"") {
        return { path, nextIndex: -1 };
      }

      const parsed = readJsonStringLiteral(reference, index + 1);
      if (reference[parsed.nextIndex] !== "]") {
        return { path, nextIndex: -1 };
      }

      path.push(parsed.value);
      index = parsed.nextIndex + 1;
      continue;
    }

    return { path, nextIndex: -1 };
  }

  return { path, nextIndex: index };
}

function parseReference(reference: string): ParsedReference | null {
  if (reference === "$input") {
    return {
      root: "input",
      path: [],
    };
  }

  if (reference.startsWith("$input")) {
    const parsed = readBindingPath(reference, "$input".length);
    if (parsed.nextIndex !== reference.length) {
      return null;
    }

    return {
      root: "input",
      path: parsed.path,
    };
  }

  if (!reference.startsWith("$steps.")) {
    return null;
  }

  const afterPrefix = reference.slice("$steps.".length);
  const stepIdMatch = afterPrefix.match(/^[A-Za-z_][A-Za-z0-9_]*/);
  if (!stepIdMatch) {
    return null;
  }

  const stepId = stepIdMatch[0];
  const outputPrefix = `.output`;
  const outputStart = "$steps.".length + stepId.length;
  if (!reference.startsWith(outputPrefix, outputStart)) {
    return null;
  }

  const parsed = readBindingPath(reference, outputStart + outputPrefix.length);
  if (parsed.nextIndex !== reference.length) {
    return null;
  }

  return {
    root: "steps",
    stepId,
    path: parsed.path,
  };
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
  const parsed = parseReference(reference);
  if (!parsed) {
    return handleUnresolvedReference(reference, options);
  }

  if (parsed.root === "input") {
    const resolved = parsed.path.length === 0 ? state.input : readPath(state.input, parsed.path);
    return resolved === undefined ? handleUnresolvedReference(reference, options) : resolved;
  }

  const stepOutput = state.stepOutputs[parsed.stepId!];
  const resolved = parsed.path.length === 0 ? stepOutput : readPath(stepOutput, parsed.path);
  return resolved === undefined ? handleUnresolvedReference(reference, options) : resolved;
}

export function isBindingReference(value: string): boolean {
  return parseReference(value) !== null;
}

export function resolveBindings(
  value: unknown,
  state: BindingState,
  options: ResolveReferenceOptions = {},
): unknown {
  if (typeof value === "string" && isBindingReference(value)) {
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
