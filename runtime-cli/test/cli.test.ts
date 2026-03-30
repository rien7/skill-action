import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runCli } from "../src/cli.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures");
const sampleSkillDir = path.join(fixturesDir, "sample-skill");
const invalidSkillDir = path.join(fixturesDir, "invalid-skill");
const globalRefSkillDir = path.join(fixturesDir, "global-ref-skill");
const duplicateSkillDir = path.join(fixturesDir, "duplicate-skill");
const handlerModulePath = path.join(fixturesDir, "handlers.mjs");

function captureStreams() {
  const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

  return {
    stdout,
    stderr,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe("runtime CLI", () => {
  it("lists skills from discovered packages", async () => {
    const io = captureStreams();

    await runCli([
      "list-skills",
      "--skill-package",
      sampleSkillDir,
      "--output",
      "json",
    ]);

    const output = io.stdout.mock.calls.map(([chunk]) => String(chunk)).join("");
    const parsed = JSON.parse(output) as {
      skills: Array<{ skill_id: string }>;
    };

    expect(parsed.skills).toHaveLength(1);
    expect(parsed.skills[0]?.skill_id).toBe("sample.skill");
  });

  it("lists actions from discovered packages and handler module globals", async () => {
    const io = captureStreams();

    await runCli([
      "list-actions",
      "--skill-package",
      sampleSkillDir,
      "--handler-module",
      handlerModulePath,
      "--output",
      "json",
    ]);

    const output = io.stdout.mock.calls.map(([chunk]) => String(chunk)).join("");
    const parsed = JSON.parse(output) as {
      actions: Array<{ action_id: string }>;
    };

    expect(parsed.actions.map((item) => item.action_id)).toEqual([
      "math.add-one",
      "workflow.increment",
      "cli://math/add-one",
    ]);
  });

  it("validates a correct skill package", async () => {
    const io = captureStreams();

    await runCli([
      "validate-skill-package",
      "--skill-package",
      sampleSkillDir,
      "--output",
      "json",
    ]);

    const output = io.stdout.mock.calls.map(([chunk]) => String(chunk)).join("");
    const parsed = JSON.parse(output) as {
      valid: boolean;
      issue_count: number;
      packages: Array<{ external_dependencies: string[] }>;
    };

    expect(parsed.valid).toBe(true);
    expect(parsed.issue_count).toBe(0);
    expect(parsed.packages[0]?.external_dependencies).toEqual([]);
    expect(process.exitCode).toBe(0);
  });

  it("records external dependencies for fully-qualified global action references", async () => {
    const io = captureStreams();

    await runCli([
      "validate-skill-package",
      "--skill-package",
      globalRefSkillDir,
      "--output",
      "json",
    ]);

    const output = io.stdout.mock.calls.map(([chunk]) => String(chunk)).join("");
    const parsed = JSON.parse(output) as {
      valid: boolean;
      packages: Array<{ external_dependencies: string[] }>;
    };

    expect(parsed.valid).toBe(true);
    expect(parsed.packages[0]?.external_dependencies).toEqual([
      "cli://math/add-one",
    ]);
  });

  it("reports package validation issues for an invalid skill package", async () => {
    const io = captureStreams();

    await runCli([
      "validate-skill-package",
      "--skill-package",
      invalidSkillDir,
      "--output",
      "json",
    ]);

    const output = io.stdout.mock.calls.map(([chunk]) => String(chunk)).join("");
    const parsed = JSON.parse(output) as {
      valid: boolean;
      issue_count: number;
      packages: Array<{ issues: Array<{ code: string }> }>;
    };

    expect(parsed.valid).toBe(false);
    expect(parsed.issue_count).toBeGreaterThan(0);
    expect(parsed.packages[0]?.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "ACTION_ID_MISMATCH",
        "VISIBILITY_MISMATCH",
        "ENTRY_ACTION_NOT_FOUND",
        "EXPOSED_ACTION_NOT_FOUND",
      ]),
    );
    expect(process.exitCode).toBe(1);
  });

  it("resolves an action from a skill package", async () => {
    const io = captureStreams();

    await runCli([
      "resolve-action",
      "--skill-package",
      sampleSkillDir,
      "--action-id",
      "workflow.increment",
      "--output",
      "json",
    ]);

    const output = io.stdout.mock.calls.map(([chunk]) => String(chunk)).join("");
    const parsed = JSON.parse(output) as { ok: boolean; data: { action: { action_id: string } } };

    expect(parsed.ok).toBe(true);
    expect(parsed.data.action.action_id).toBe("workflow.increment");
  });

  it("fails resolve-action when top-level action ids are ambiguous", async () => {
    const io = captureStreams();

    await runCli([
      "resolve-action",
      "--skill-package",
      sampleSkillDir,
      "--skill-package",
      duplicateSkillDir,
      "--action-id",
      "workflow.increment",
      "--output",
      "json",
    ]);

    const output = io.stdout.mock.calls.map(([chunk]) => String(chunk)).join("");
    const parsed = JSON.parse(output) as { ok: boolean; error?: { code?: string } };

    expect(parsed.ok).toBe(false);
    expect(parsed.error?.code).toBe("ACTION_RESOLUTION_AMBIGUOUS");
    expect(process.exitCode).toBe(1);
  });

  it("accepts a full protocol request for resolve-action", async () => {
    const io = captureStreams();

    await runCli([
      "resolve-action",
      "--skill-package",
      sampleSkillDir,
      "--request-json",
      "{\"action_id\":\"workflow.increment\"}",
      "--output",
      "json",
    ]);

    const output = io.stdout.mock.calls.map(([chunk]) => String(chunk)).join("");
    const parsed = JSON.parse(output) as { ok: boolean; data: { action: { action_id: string } } };

    expect(parsed.ok).toBe(true);
    expect(parsed.data.action.action_id).toBe("workflow.increment");
  });

  it("resolves a global action provided by the handler module", async () => {
    const io = captureStreams();

    await runCli([
      "resolve-action",
      "--skill-package",
      sampleSkillDir,
      "--handler-module",
      handlerModulePath,
      "--action-id",
      "cli://math/add-one",
      "--output",
      "json",
    ]);

    const output = io.stdout.mock.calls.map(([chunk]) => String(chunk)).join("");
    const parsed = JSON.parse(output) as { ok: boolean; data: { action: { action_id: string } } };

    expect(parsed.ok).toBe(true);
    expect(parsed.data.action.action_id).toBe("cli://math/add-one");
  });

  it("executes a skill using a handler module", async () => {
    const io = captureStreams();

    await runCli([
      "execute-skill",
      "--skill-package",
      sampleSkillDir,
      "--skill-id",
      "sample.skill",
      "--input-json",
      "{\"value\": 4}",
      "--handler-module",
      handlerModulePath,
      "--output",
      "json",
    ]);

    const output = io.stdout.mock.calls.map(([chunk]) => String(chunk)).join("");
    const parsed = JSON.parse(output) as {
      ok: boolean;
      data: { output: { value: number } };
    };

    expect(parsed.ok).toBe(true);
    expect(parsed.data.output.value).toBe(5);
  });

  it("executes a skill through a fully-qualified global action reference", async () => {
    const io = captureStreams();

    await runCli([
      "execute-skill",
      "--skill-package",
      globalRefSkillDir,
      "--skill-id",
      "global.ref.skill",
      "--input-json",
      "{\"value\": 4}",
      "--handler-module",
      handlerModulePath,
      "--output",
      "json",
    ]);

    const output = io.stdout.mock.calls.map(([chunk]) => String(chunk)).join("");
    const parsed = JSON.parse(output) as {
      ok: boolean;
      data: { output: { value: number } };
    };

    expect(parsed.ok).toBe(true);
    expect(parsed.data.output.value).toBe(5);
  });

  it("accepts a full protocol request for execute-skill", async () => {
    const io = captureStreams();

    await runCli([
      "execute-skill",
      "--skill-package",
      sampleSkillDir,
      "--handler-module",
      handlerModulePath,
      "--request-json",
      "{\"skill_id\":\"sample.skill\",\"input\":{\"value\":4},\"options\":{\"trace_level\":\"basic\"}}",
      "--output",
      "json",
    ]);

    const output = io.stdout.mock.calls.map(([chunk]) => String(chunk)).join("");
    const parsed = JSON.parse(output) as {
      ok: boolean;
      data: { output: { value: number } };
    };

    expect(parsed.ok).toBe(true);
    expect(parsed.data.output.value).toBe(5);
  });

  it("fails execution without handlers for primitive actions", async () => {
    const io = captureStreams();

    await runCli([
      "execute-skill",
      "--skill-package",
      sampleSkillDir,
      "--skill-id",
      "sample.skill",
      "--input-json",
      "{\"value\": 4}",
      "--output",
      "json",
    ]);

    const output = io.stdout.mock.calls.map(([chunk]) => String(chunk)).join("");
    const parsed = JSON.parse(output) as {
      ok: boolean;
      data?: { status?: string };
      error?: { code?: string };
    };

    expect(parsed.ok).toBe(true);
    expect(parsed.data?.status).toBe("failed");
    expect(process.exitCode).toBe(1);
  });
});
