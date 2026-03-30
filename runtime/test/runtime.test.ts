import { describe, expect, it } from "vitest";

import { ActionRuntime } from "../src/core/runtime.js";
import { InMemoryActionRegistry } from "../src/registry/action-registry.js";
import { InMemorySkillRegistry } from "../src/registry/skill-registry.js";

function createRuntime() {
  const actions = new InMemoryActionRegistry([
    {
      skillId: "math.skill",
      definition: {
        action_id: "math.add",
        version: "1.0.0",
        kind: "primitive",
        title: "Add",
        description: "Add two numbers",
        input_schema: {
          type: "object",
          properties: {
            a: { type: "number" },
            b: { type: "number" },
          },
          required: ["a", "b"],
          additionalProperties: false,
        },
        output_schema: {
          type: "object",
          properties: {
            sum: { type: "number" },
          },
          required: ["sum"],
          additionalProperties: false,
        },
        visibility: "public",
        side_effect: "none",
        idempotent: true,
      },
    },
    {
      skillId: "math.skill",
      definition: {
        action_id: "math.internalSeed",
        version: "1.0.0",
        kind: "primitive",
        title: "Seed",
        description: "Provide a starting value",
        input_schema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        output_schema: {
          type: "object",
          properties: {
            sum: { type: "number" },
          },
          required: ["sum"],
          additionalProperties: false,
        },
        visibility: "internal",
        side_effect: "none",
        idempotent: true,
      },
    },
    {
      skillId: "math.skill",
      definition: {
        action_id: "workflow.doubleAdd",
        version: "1.0.0",
        kind: "composite",
        title: "Double add",
        description: "Use two steps to add and then add again.",
        input_schema: {
          type: "object",
          properties: {
            a: { type: "number" },
            b: { type: "number" },
          },
          required: ["a", "b"],
          additionalProperties: false,
        },
        output_schema: {
          type: "object",
          properties: {
            sum: { type: "number" },
          },
          required: ["sum"],
          additionalProperties: false,
        },
        visibility: "public",
        side_effect: "none",
        idempotent: true,
        steps: [
          {
            id: "seed",
            action: "math.internalSeed",
            with: {},
          },
          {
            id: "add",
            action: "math.add",
            with: {
              a: "$steps.seed.output.sum",
              b: "$input.a",
            },
          },
          {
            id: "addAgain",
            action: "math.add",
            with: {
              a: "$steps.add.output.sum",
              b: "$input.b",
            },
            if: "$steps.add.output.sum >= 1 && $input.b >= 1",
          },
        ],
      },
    },
  ]);

  const skills = new InMemorySkillRegistry([
    {
      definition: {
        skill_id: "math.skill",
        version: "1.0.0",
        title: "Math",
        description: "Math operations",
        entry_action: "workflow.doubleAdd",
        exposed_actions: ["workflow.doubleAdd"],
      },
    },
  ]);

  return new ActionRuntime({
    actionRegistry: actions,
    skillRegistry: skills,
    primitiveHandlers: {
      "math.internalSeed": () => ({ sum: 1 }),
      "math.add": ({ input }) => {
        const payload = input as { a: number; b: number };
        return {
          sum: payload.a + payload.b,
        };
      },
    },
  });
}

describe("ActionRuntime", () => {
  it("resolves an action definition", async () => {
    const runtime = createRuntime();
    const response = await runtime.resolveAction({ action_id: "math.add" });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data.action.action_id).toBe("math.add");
    }
  });

  it("rejects invalid action input", async () => {
    const runtime = createRuntime();
    const response = await runtime.validateActionInput({
      action_id: "math.add",
      input: { a: "bad", b: 2 },
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe("INVALID_INPUT");
    }
  });

  it("executes a composite action deterministically", async () => {
    const runtime = createRuntime();
    const response = await runtime.executeAction({
      action_id: "workflow.doubleAdd",
      input: { a: 2, b: 3 },
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data.status).toBe("succeeded");
      expect(response.data.output).toEqual({ sum: 6 });
      expect(response.data.trace.steps.map((step) => step.step_id)).toEqual([
        "seed",
        "add",
        "addAgain",
      ]);
    }
  });

  it("executes a skill via entry_action", async () => {
    const runtime = createRuntime();
    const response = await runtime.executeSkill({
      skill_id: "math.skill",
      input: { a: 4, b: 5 },
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data.output).toEqual({ sum: 10 });
    }
  });

  it("blocks external execution of internal actions", async () => {
    const runtime = createRuntime();
    const response = await runtime.executeAction({
      action_id: "math.internalSeed",
      input: {},
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe("VISIBILITY_VIOLATION");
    }
  });
});
