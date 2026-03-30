import { isDeepStrictEqual } from "node:util";

import { RuntimeError } from "../types/errors.js";
import { resolveReference, type BindingState } from "./bindings.js";

type Token =
  | { type: "reference"; value: string }
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "boolean"; value: boolean }
  | { type: "null"; value: null }
  | { type: "operator"; value: string }
  | { type: "paren"; value: "(" | ")" };

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index]!;

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    const twoChar = expression.slice(index, index + 2);
    if (["==", "!=", ">=", "<=", "&&", "||"].includes(twoChar)) {
      tokens.push({ type: "operator", value: twoChar });
      index += 2;
      continue;
    }

    if (["!", ">", "<"].includes(char)) {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      index += 1;
      continue;
    }

    if (char === "$") {
      let end = index + 1;
      while (end < expression.length && /[A-Za-z0-9_$.]/.test(expression[end]!)) {
        end += 1;
      }
      tokens.push({ type: "reference", value: expression.slice(index, end) });
      index = end;
      continue;
    }

    if (char === '"' || char === "'") {
      let end = index + 1;
      while (end < expression.length && expression[end] !== char) {
        end += 1;
      }
      if (end >= expression.length) {
        throw new RuntimeError("INVALID_CONDITION", "Unterminated string in condition.", {
          expression,
        });
      }
      tokens.push({
        type: "string",
        value: expression.slice(index + 1, end),
      });
      index = end + 1;
      continue;
    }

    if (/[0-9.-]/.test(char)) {
      let end = index + 1;
      while (end < expression.length && /[0-9._-]/.test(expression[end]!)) {
        end += 1;
      }
      const raw = expression.slice(index, end).replaceAll("_", "");
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        throw new RuntimeError("INVALID_CONDITION", "Invalid number in condition.", {
          expression,
          value: raw,
        });
      }
      tokens.push({ type: "number", value: parsed });
      index = end;
      continue;
    }

    const keywordMatch = expression.slice(index).match(/^(true|false|null)\b/);
    if (keywordMatch) {
      const [keyword] = keywordMatch;
      if (keyword === "true" || keyword === "false") {
        tokens.push({ type: "boolean", value: keyword === "true" });
      } else {
        tokens.push({ type: "null", value: null });
      }
      index += keyword.length;
      continue;
    }

    throw new RuntimeError("INVALID_CONDITION", "Unsupported token in condition.", {
      expression,
      token: char,
    });
  }

  return tokens;
}

class TokenStream {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  peek(): Token | undefined {
    return this.tokens[this.index];
  }

  next(): Token | undefined {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }

  expectParen(value: "(" | ")"): void {
    const token = this.next();
    if (!token || token.type !== "paren" || token.value !== value) {
      throw new RuntimeError("INVALID_CONDITION", `Expected "${value}" in condition.`);
    }
  }
}

function compare(left: unknown, operator: string, right: unknown): boolean {
  switch (operator) {
    case "==":
      return isDeepStrictEqual(left, right);
    case "!=":
      return !isDeepStrictEqual(left, right);
    case ">":
      return (left as number | string) > (right as number | string);
    case "<":
      return (left as number | string) < (right as number | string);
    case ">=":
      return (left as number | string) >= (right as number | string);
    case "<=":
      return (left as number | string) <= (right as number | string);
    default:
      throw new RuntimeError("INVALID_CONDITION", `Unsupported operator "${operator}".`);
  }
}

function parsePrimary(stream: TokenStream, state: BindingState): unknown {
  const token = stream.next();

  if (!token) {
    throw new RuntimeError("INVALID_CONDITION", "Unexpected end of condition.");
  }

  if (token.type === "paren" && token.value === "(") {
    const value = parseOr(stream, state);
    stream.expectParen(")");
    return value;
  }

  if (token.type === "reference") {
    return resolveReference(token.value, state);
  }

  if (token.type === "number" || token.type === "string" || token.type === "boolean") {
    return token.value;
  }

  if (token.type === "null") {
    return null;
  }

  throw new RuntimeError("INVALID_CONDITION", "Unexpected token in condition.", {
    token,
  });
}

function parseUnary(stream: TokenStream, state: BindingState): unknown {
  const token = stream.peek();
  if (token?.type === "operator" && token.value === "!") {
    stream.next();
    return !Boolean(parseUnary(stream, state));
  }
  return parseComparison(stream, state);
}

function parseComparison(stream: TokenStream, state: BindingState): unknown {
  let left = parsePrimary(stream, state);
  const token = stream.peek();

  if (token?.type === "operator" && ["==", "!=", ">", "<", ">=", "<="].includes(token.value)) {
    stream.next();
    const right = parsePrimary(stream, state);
    left = compare(left, token.value, right);
  }

  return left;
}

function parseAnd(stream: TokenStream, state: BindingState): unknown {
  let left = parseUnary(stream, state);

  while (stream.peek()?.type === "operator" && stream.peek()?.value === "&&") {
    stream.next();
    left = Boolean(left) && Boolean(parseUnary(stream, state));
  }

  return left;
}

function parseOr(stream: TokenStream, state: BindingState): unknown {
  let left = parseAnd(stream, state);

  while (stream.peek()?.type === "operator" && stream.peek()?.value === "||") {
    stream.next();
    left = Boolean(left) || Boolean(parseAnd(stream, state));
  }

  return left;
}

export function evaluateCondition(expression: string, state: BindingState): boolean {
  const stream = new TokenStream(tokenize(expression));
  const result = parseOr(stream, state);
  return Boolean(result);
}

