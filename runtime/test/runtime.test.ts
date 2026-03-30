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
        returns: {
          sum: "$steps.addAgain.output.sum",
        },
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

  it("returns protocol-level failure when executeAction input is invalid before execution starts", async () => {
    const runtime = createRuntime();
    const response = await runtime.executeAction({
      action_id: "math.add",
      input: { a: "bad", b: 2 },
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe("INVALID_INPUT");
    }
  });

  it("executes a composite action with explicit returns", async () => {
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

  it("returns a failed execution result after execution has started", async () => {
    const actions = new InMemoryActionRegistry([
      {
        definition: {
          action_id: "math.explode",
          version: "1.0.0",
          kind: "primitive",
          title: "Explode",
          description: "Always fails during execution",
          input_schema: {
            type: "object",
            properties: {
              value: { type: "number" },
            },
            required: ["value"],
            additionalProperties: false,
          },
          output_schema: {
            type: "object",
            properties: {
              value: { type: "number" },
            },
            required: ["value"],
            additionalProperties: false,
          },
          visibility: "public",
          side_effect: "none",
          idempotent: true,
        },
      },
    ]);

    const runtime = new ActionRuntime({
      actionRegistry: actions,
      skillRegistry: new InMemorySkillRegistry(),
      primitiveHandlers: {
        "math.explode": () => {
          throw new Error("boom");
        },
      },
    });

    const response = await runtime.executeAction({
      action_id: "math.explode",
      input: { value: 1 },
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data.status).toBe("failed");
      expect(response.data.output).toBeNull();
      expect(response.data.trace.steps).toHaveLength(1);
      expect(response.data.trace.steps[0]?.status).toBe("failed");
    }
  });

  it("fails top-level unqualified resolution when multiple candidates exist", async () => {
    const runtime = new ActionRuntime({
      actionRegistry: new InMemoryActionRegistry([
        {
          skillId: "skill.one",
          definition: {
            action_id: "shared.echo",
            version: "1.0.0",
            kind: "primitive",
            title: "Echo One",
            description: "First candidate",
            input_schema: { type: "object", additionalProperties: true },
            output_schema: { type: "object", additionalProperties: true },
            visibility: "public",
            side_effect: "none",
            idempotent: true,
          },
        },
        {
          skillId: "skill.two",
          definition: {
            action_id: "shared.echo",
            version: "1.0.0",
            kind: "primitive",
            title: "Echo Two",
            description: "Second candidate",
            input_schema: { type: "object", additionalProperties: true },
            output_schema: { type: "object", additionalProperties: true },
            visibility: "public",
            side_effect: "none",
            idempotent: true,
          },
        },
      ]),
      skillRegistry: new InMemorySkillRegistry(),
    });

    const response = await runtime.resolveAction({ action_id: "shared.echo" });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe("ACTION_RESOLUTION_AMBIGUOUS");
    }
  });

  it("prefers skill-local actions before global fallback during nested execution", async () => {
    const actionRegistry = new InMemoryActionRegistry([
      {
        definition: {
          action_id: "math.add",
          version: "1.0.0",
          kind: "primitive",
          title: "Global Add",
          description: "Global candidate that should not win nested resolution",
          input_schema: {
            type: "object",
            properties: {
              value: { type: "number" },
            },
            required: ["value"],
            additionalProperties: false,
          },
          output_schema: {
            type: "object",
            properties: {
              value: { type: "number" },
            },
            required: ["value"],
            additionalProperties: false,
          },
          visibility: "public",
          side_effect: "none",
          idempotent: true,
        },
      },
      {
        skillId: "sample.skill",
        definition: {
          action_id: "math.add",
          version: "1.0.0",
          kind: "primitive",
          title: "Local Add",
          description: "Skill-local candidate",
          input_schema: {
            type: "object",
            properties: {
              value: { type: "number" },
            },
            required: ["value"],
            additionalProperties: false,
          },
          output_schema: {
            type: "object",
            properties: {
              value: { type: "number" },
            },
            required: ["value"],
            additionalProperties: false,
          },
          visibility: "internal",
          side_effect: "none",
          idempotent: true,
        },
      },
      {
        skillId: "sample.skill",
        definition: {
          action_id: "workflow.run",
          version: "1.0.0",
          kind: "composite",
          title: "Run",
          description: "Use local action first",
          input_schema: {
            type: "object",
            properties: {
              value: { type: "number" },
            },
            required: ["value"],
            additionalProperties: false,
          },
          output_schema: {
            type: "object",
            properties: {
              value: { type: "number" },
            },
            required: ["value"],
            additionalProperties: false,
          },
          visibility: "public",
          side_effect: "none",
          idempotent: true,
          steps: [
            {
              id: "compute",
              action: "math.add",
              with: {
                value: "$input.value",
              },
            },
          ],
          returns: {
            value: "$steps.compute.output.value",
          },
        },
      },
      {
        definition: {
          action_id: "util.increment",
          version: "1.0.0",
          kind: "primitive",
          title: "Global Increment",
          description: "Global fallback action",
          input_schema: {
            type: "object",
            properties: {
              value: { type: "number" },
            },
            required: ["value"],
            additionalProperties: false,
          },
          output_schema: {
            type: "object",
            properties: {
              value: { type: "number" },
            },
            required: ["value"],
            additionalProperties: false,
          },
          visibility: "public",
          side_effect: "none",
          idempotent: true,
        },
      },
      {
        skillId: "fallback.skill",
        definition: {
          action_id: "workflow.globalFallback",
          version: "1.0.0",
          kind: "composite",
          title: "Fallback",
          description: "Use global fallback when local action is absent",
          input_schema: {
            type: "object",
            properties: {
              value: { type: "number" },
            },
            required: ["value"],
            additionalProperties: false,
          },
          output_schema: {
            type: "object",
            properties: {
              value: { type: "number" },
            },
            required: ["value"],
            additionalProperties: false,
          },
          visibility: "public",
          side_effect: "none",
          idempotent: true,
          steps: [
            {
              id: "compute",
              action: "util.increment",
              with: {
                value: "$input.value",
              },
            },
          ],
          returns: {
            value: "$steps.compute.output.value",
          },
        },
      },
    ]);

    const skillRegistry = new InMemorySkillRegistry([
      {
        definition: {
          skill_id: "sample.skill",
          version: "1.0.0",
          title: "Sample",
          description: "Uses local action",
          entry_action: "workflow.run",
          exposed_actions: ["workflow.run"],
        },
      },
      {
        definition: {
          skill_id: "fallback.skill",
          version: "1.0.0",
          title: "Fallback",
          description: "Uses global fallback action",
          entry_action: "workflow.globalFallback",
          exposed_actions: ["workflow.globalFallback"],
        },
      },
    ]);

    const runtime = new ActionRuntime({
      actionRegistry,
      skillRegistry,
      primitiveHandlers: {
        "math.add": ({ currentSkillId, input }) => ({
          value: (input as { value: number }).value + (currentSkillId === "sample.skill" ? 1 : 100),
        }),
        "util.increment": ({ input }) => ({
          value: (input as { value: number }).value + 10,
        }),
      },
    });

    const localResponse = await runtime.executeSkill({
      skill_id: "sample.skill",
      input: { value: 2 },
    });
    const fallbackResponse = await runtime.executeSkill({
      skill_id: "fallback.skill",
      input: { value: 2 },
    });

    expect(localResponse.ok).toBe(true);
    expect(fallbackResponse.ok).toBe(true);
    if (localResponse.ok && fallbackResponse.ok) {
      expect(localResponse.data.output).toEqual({ value: 3 });
      expect(fallbackResponse.data.output).toEqual({ value: 12 });
    }
  });
});
