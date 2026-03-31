import type {
  PrimitiveActionHandler,
  PrimitiveActionHandlerMap,
} from "@rien7/skill-action-runtime";

export interface CommonCommandOptions {
  skillPackage?: string[];
  skillsDir?: string;
  output?: "json" | "pretty";
}

export interface RuntimeExecutionOptionFlags {
  dryRun?: boolean;
  traceLevel?: "none" | "basic" | "full";
  timeoutMs?: number;
  maxDepth?: number;
  maxSteps?: number;
}

export interface RuntimeInputOptions {
  inputFile?: string;
  inputJson?: string;
}

export interface RuntimeRequestOptions {
  requestFile?: string;
  requestJson?: string;
}

export interface HandlerModuleShape {
  primitiveHandlers?: PrimitiveActionHandlerMap;
}
