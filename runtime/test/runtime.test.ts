import { describe, expect, it } from "vitest";

import { ActionRuntime, primitiveBindingKey } from "../src/core/runtime.js";
import { InMemoryActionRegistry } from "../src/registry/action-registry.js";
import { InMemorySkillRegistry } from "../src/registry/skill-registry.js";

function createRuntime() {
  const actions = new InMemoryActionRegistry([
    {
      skillId: "math.skill",
      definition: {
        action_id: "math.add",
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
        idempotent: true,
      },
    },
    {
      skillId: "math.skill",
      definition: {
        action_id: "math.seed",
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
        idempotent: true,
      },
    },
    {
      skillId: "math.skill",
      definition: {
        action_id: "workflow.doubleAdd",
        kind: "composite",
        title: "Double add",
        description: "Add twice using explicit returns.",
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
        idempotent: true,
        steps: [
          {
            id: "seed",
            action: "math.seed",
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
            id: "add_again",
            action: "math.add",
            with: {
              a: "$steps.add.output.sum",
              b: "$input.b",
            },
            if: "$steps.add.output.sum >= 1 && $input.b >= 1",
          },
        ],
        returns: {
          sum: "$steps.add_again.output.sum",
        },
      },
    },
    {
      skillId: "bindings.skill",
      definition: {
        action_id: "workflow.bracketBinding",
        kind: "composite",
        title: "Bracket Binding",
        description: "Use bracket notation in bindings.",
        input_schema: {
          type: "object",
          properties: {
            "field-name": { type: "number" },
          },
          required: ["field-name"],
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
        idempotent: true,
        steps: [
          {
            id: "compute",
            action: "bindings.echo",
            with: {
              value: "$input[\"field-name\"]",
            },
          },
        ],
        returns: {
          value: "$steps.compute.output.value",
        },
      },
    },
    {
      skillId: "bindings.skill",
      definition: {
        action_id: "bindings.echo",
        kind: "primitive",
        title: "Echo",
        description: "Echo a number",
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
        idempotent: true,
      },
    },
  ]);

  const skills = new InMemorySkillRegistry([
    {
      definition: {
        skill_id: "math.skill",
        title: "Math",
        description: "Math operations",
        entry_action: "workflow.doubleAdd",
      },
    },
    {
      definition: {
        skill_id: "bindings.skill",
        title: "Bindings",
        description: "Binding tests",
        entry_action: "workflow.bracketBinding",
      },
    },
  ]);

  return new ActionRuntime({
    actionRegistry: actions,
    skillRegistry: skills,
    primitiveHandlers: {
      [primitiveBindingKey("math.skill", "math.seed")]: () => ({ sum: 1 }),
      [primitiveBindingKey("math.skill", "math.add")]: ({ input }) => {
        const payload = input as { a: number; b: number };
        return { sum: payload.a + payload.b };
      },
      [primitiveBindingKey("bindings.skill", "bindings.echo")]: ({ input }) => {
        return { value: (input as { value: number }).value };
      },
    },
  });
}

describe("ActionRuntime", () => {
  it("resolves an action within the addressed skill package", async () => {
    const runtime = createRuntime();
    const response = await runtime.resolveAction({
      skill_id: "math.skill",
      action_id: "math.add",
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data).toEqual({
        skill_id: "math.skill",
        action_id: "math.add",
        kind: "primitive",
      });
    }
  });

  it("returns protocol failure when root input validation fails", async () => {
    const runtime = createRuntime();
    const response = await runtime.executeAction({
      skill_id: "math.skill",
      action_id: "math.add",
      input: { a: "bad", b: 2 },
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe("SCHEMA_VALIDATION_FAILED");
    }
  });

  it("validates action input against the addressed package action", async () => {
    const runtime = createRuntime();
    const response = await runtime.validateActionInput({
      skill_id: "math.skill",
      action_id: "math.add",
      input: { a: 2, b: 3 },
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data).toEqual({
        valid: true,
        skill_id: "math.skill",
        action_id: "math.add",
      });
    }
  });

  it("executes a composite action with explicit returns", async () => {
    const runtime = createRuntime();
    const response = await runtime.executeAction({
      skill_id: "math.skill",
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
        "add_again",
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

  it("supports bracket-notation bindings", async () => {
    const runtime = createRuntime();
    const response = await runtime.executeSkill({
      skill_id: "bindings.skill",
      input: { "field-name": 7 },
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data.output).toEqual({ value: 7 });
    }
  });

  it("returns an execution failure when primitive binding is missing", async () => {
    const runtime = new ActionRuntime({
      actionRegistry: new InMemoryActionRegistry([
        {
          skillId: "math.skill",
          definition: {
            action_id: "math.add",
            kind: "primitive",
            title: "Add",
            description: "Add two numbers",
            input_schema: { type: "object", additionalProperties: true },
            output_schema: { type: "object", additionalProperties: true },
            idempotent: true,
          },
        },
      ]),
      skillRegistry: new InMemorySkillRegistry([
        {
          definition: {
            skill_id: "math.skill",
            title: "Math",
            description: "Math",
            entry_action: "math.add",
          },
        },
      ]),
    });

    const response = await runtime.executeSkill({
      skill_id: "math.skill",
      input: {},
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data.status).toBe("failed");
    }
  });

  it("treats duplicate skill ids as protocol-level ambiguity", async () => {
    const runtime = new ActionRuntime({
      actionRegistry: new InMemoryActionRegistry(),
      skillRegistry: new InMemorySkillRegistry([
        {
          definition: {
            skill_id: "dup.skill",
            title: "One",
            description: "First",
            entry_action: "a",
          },
        },
        {
          definition: {
            skill_id: "dup.skill",
            title: "Two",
            description: "Second",
            entry_action: "a",
          },
        },
      ]),
    });

    const response = await runtime.resolveAction({
      skill_id: "dup.skill",
      action_id: "a",
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe("SKILL_RESOLUTION_AMBIGUOUS");
    }
  });

  it("keys primitive bindings by package action identity", async () => {
    const runtime = new ActionRuntime({
      actionRegistry: new InMemoryActionRegistry([
        {
          skillId: "one.skill",
          definition: {
            action_id: "math.shared",
            kind: "primitive",
            title: "Shared",
        description: "Shared id",
        input_schema: { type: "object", additionalProperties: true },
        output_schema: { type: "object", additionalProperties: true },
        idempotent: true,
      },
    },
        {
          skillId: "two.skill",
          definition: {
            action_id: "math.shared",
            kind: "primitive",
            title: "Shared",
        description: "Shared id",
        input_schema: { type: "object", additionalProperties: true },
        output_schema: { type: "object", additionalProperties: true },
        idempotent: true,
      },
    },
      ]),
      skillRegistry: new InMemorySkillRegistry([
        {
          definition: {
            skill_id: "one.skill",
            title: "One",
            description: "One",
            entry_action: "math.shared",
          },
        },
        {
          definition: {
            skill_id: "two.skill",
            title: "Two",
            description: "Two",
            entry_action: "math.shared",
          },
        },
      ]),
      primitiveHandlers: {
        [primitiveBindingKey("one.skill", "math.shared")]: () => ({ value: 1 }),
        [primitiveBindingKey("two.skill", "math.shared")]: () => ({ value: 2 }),
      },
    });

    const one = await runtime.executeSkill({ skill_id: "one.skill", input: {} });
    const two = await runtime.executeSkill({ skill_id: "two.skill", input: {} });

    expect(one.ok).toBe(true);
    expect(two.ok).toBe(true);
    if (one.ok && two.ok) {
      expect(one.data.output).toEqual({ value: 1 });
      expect(two.data.output).toEqual({ value: 2 });
    }
  });

  it("applies max_steps to reached composite steps only", async () => {
    const runtime = createRuntime();
    const response = await runtime.executeAction({
      skill_id: "math.skill",
      action_id: "workflow.doubleAdd",
      input: { a: 2, b: 3 },
      options: {
        max_steps: 2,
      },
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data.status).toBe("failed");
    }
  });
});
