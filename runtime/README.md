# `@rien7/skill-action-runtime`

TypeScript runtime for the Skill Action RFCs.

## What It Implements

- `resolveAction`
- `validateActionInput`
- `executeAction`
- `executeSkill`

The runtime is transport-agnostic and designed to be embedded inside a function call boundary, CLI wrapper, or HTTP service.

## Install

```bash
pnpm add @rien7/skill-action-runtime
```

## Build

```bash
pnpm install
pnpm check
```

## Quick Start

```ts
import { ActionRuntime, InMemoryActionRegistry, InMemorySkillRegistry } from "@rien7/skill-action-runtime";

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
          b: { type: "number" }
        },
        required: ["a", "b"],
        additionalProperties: false
      },
      output_schema: {
        type: "object",
        properties: {
          sum: { type: "number" }
        },
        required: ["sum"],
        additionalProperties: false
      },
      idempotent: true
    }
  }
]);

const skills = new InMemorySkillRegistry([
  {
    definition: {
      skill_id: "math.skill",
      title: "Math",
      description: "Math operations",
      entry_action: "math.add"
    }
  }
]);

const runtime = new ActionRuntime({
  actionRegistry: actions,
  skillRegistry: skills,
  primitiveHandlers: {
    "[\"math.skill\",\"math.add\"]": async ({ input }) => {
      const payload = input as { a: number; b: number };
      return { sum: payload.a + payload.b };
    }
  }
});

const response = await runtime.executeSkill({
  skill_id: "math.skill",
  input: { a: 2, b: 3 }
});

console.log(response);
```

## Notes

- Primitive action execution is handler-driven. The runtime resolves primitive handlers by package action identity.
- Nested composite steps resolve package-local `action_id` values only.
- Composite actions require explicit RFC `returns` mappings.
- Skill package loading is available through `loadSkillPackageFromDirectory`.
