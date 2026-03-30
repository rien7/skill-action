import path from "node:path";
import { pathToFileURL } from "node:url";

import { actionDefinitionSchema } from "@rien7/skill-action-runtime";

import type { HandlerModuleShape } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export async function loadHandlerModule(modulePath?: string): Promise<HandlerModuleShape> {
  if (!modulePath) {
    return {};
  }

  const loaded = await import(pathToFileURL(path.resolve(modulePath)).href);
  const source = isRecord(loaded.default) ? loaded.default : loaded;

  const result: HandlerModuleShape = {};

  if (Array.isArray(source.globalActions)) {
    result.globalActions = source.globalActions.map((action: unknown) => actionDefinitionSchema.parse(action));
  }

  if (isRecord(source.primitiveHandlers)) {
    result.primitiveHandlers =
      source.primitiveHandlers as NonNullable<HandlerModuleShape["primitiveHandlers"]>;
  }

  if (typeof source.fallbackPrimitiveHandler === "function") {
    result.fallbackPrimitiveHandler =
      source.fallbackPrimitiveHandler as NonNullable<HandlerModuleShape["fallbackPrimitiveHandler"]>;
  }

  return result;
}
