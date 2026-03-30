import { readFile } from "node:fs/promises";

import type { RuntimeInputOptions, RuntimeRequestOptions } from "./types.js";

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    process.stdin.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    process.stdin.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    process.stdin.on("error", reject);
  });
}

async function readJsonFromString(content: string): Promise<unknown> {
  return JSON.parse(content) as unknown;
}

async function readJsonFromFile(filePath: string): Promise<unknown> {
  return readJsonFromString(await readFile(filePath, "utf8"));
}

export async function readJsonRequest(options: RuntimeRequestOptions): Promise<unknown | undefined> {
  if (options.requestJson) {
    return readJsonFromString(options.requestJson);
  }

  if (options.requestFile) {
    return readJsonFromFile(options.requestFile);
  }

  return undefined;
}

export async function readJsonRequestFromStdin(): Promise<unknown | undefined> {
  if (!process.stdin.isTTY) {
    const content = await readStdin();
    if (content.trim().length > 0) {
      return readJsonFromString(content);
    }
  }

  return undefined;
}

export async function readJsonInput(options: RuntimeInputOptions): Promise<unknown> {
  if (options.inputJson) {
    return readJsonFromString(options.inputJson);
  }

  if (options.inputFile) {
    return readJsonFromFile(options.inputFile);
  }

  if (!process.stdin.isTTY) {
    const content = await readStdin();
    if (content.trim().length > 0) {
      return readJsonFromString(content);
    }
  }

  return {};
}

export function printResult(value: unknown, mode: "json" | "pretty" = "pretty"): void {
  const spacing = mode === "pretty" ? 2 : 0;
  process.stdout.write(`${JSON.stringify(value, null, spacing)}\n`);
}
