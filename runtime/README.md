# `@skill-action/runtime`

TypeScript runtime for the Skill Action RFCs.

## What It Implements

- `resolveAction`
- `validateActionInput`
- `executeAction`
- `executeSkill`

The runtime is transport-agnostic and designed to be embedded inside a function call boundary, CLI wrapper, or HTTP service.

## Install

```bash
pnpm add @skill-action/runtime
```

## Build

```bash
pnpm install
pnpm check
```

## Quick Start

```ts
import { ActionRuntime, InMemoryActionRegistry, InMemorySkillRegistry } from "@skill-action/runtime";

const actions = new InMemoryActionRegistry([
  {
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
      visibility: "public",
      side_effect: "none",
      idempotent: true
    }
  }
]);

const skills = new InMemorySkillRegistry();

const runtime = new ActionRuntime({
  actionRegistry: actions,
  skillRegistry: skills,
  primitiveHandlers: {
    "math.add": async ({ input }) => {
      const payload = input as { a: number; b: number };
      return { sum: payload.a + payload.b };
    }
  }
});

const response = await runtime.executeAction({
  action_id: "math.add",
  input: { a: 2, b: 3 }
});

console.log(response);
```

## Notes

- Primitive action execution is handler-driven. You register handlers by `action_id`.
- Composite action output currently defaults to the last successfully executed step output. This is an implementation choice because the RFC does not yet define an explicit composite return mapping.
- Skill package loading is available through `loadSkillPackageFromDirectory`.

