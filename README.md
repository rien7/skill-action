# skill-action

[中文说明](./README.zh-CN.md)

An RFC-driven runtime system for Action/Skill packages.

## What This Is

`skill-action` is an Action/Skill runtime system built from RFCs first.

It treats Actions and Skill packages as explicit contracts with:

- deterministic execution semantics
- schema-first input and output boundaries
- package-local composition rules
- protocol-defined resolution, validation, and execution behavior

The goal is to make agent-like capabilities executable as stable runtime units instead of leaving them as loosely defined prompts or framework-specific conventions.

## Why This Exists

This project exists to collapse agent-like behavior into a model that is:

- deterministic: execution follows explicit steps, bindings, conditions, and returns
- schema-first: every Action has a typed contract for validation and interoperability
- composable: primitive and composite Actions can be assembled into local Skill graphs
- inspectable: resolution, validation, and execution are protocol surfaces rather than hidden framework behavior

In practice, this means you can take capabilities that often feel "agentic" and re-express them as runtime-loadable packages with predictable semantics.

## What Is In This Repository

### `rfc/`

The normative specification layer of the project.

- [`rfc/Action Specification.md`](./rfc/Action%20Specification.md): Action model, bindings, conditions, composite execution, `returns`
- [`rfc/Action Runtime Protocol.md`](./rfc/Action%20Runtime%20Protocol.md): transport, request/response shapes, error model, execution semantics
- [`rfc/Skill Package Specification.md`](./rfc/Skill%20Package%20Specification.md): package layout, `skill.json`, `actions/actions.json`, entry action, exposure rules

### `runtime/`

The TypeScript runtime implementation published as [`@rien7/skill-action-runtime`](./runtime/README.md).

It implements the core protocol operations:

- `resolveAction`
- `validateActionInput`
- `executeAction`
- `executeSkill`

### `runtime-cli/`

The command-line runtime published as [`@rien7/skill-action-runtime-cli`](./runtime-cli/README.md).

It exposes the RFC model through a CLI transport for:

- discovery
- validation
- resolution
- execution

### `skills/`

Skill packages and authoring helpers that use the same package model defined in the RFCs.

Current examples in this repo are focused on authoring and running action-based skills:

- `skills/action-creator`
- `skills/action-runner`
- `skills/action-skill-creator`

## Getting Started

### 1. Read the RFC summary

Read the three RFCs in this order:

1. [Action Specification](./rfc/Action%20Specification.md)
2. [Action Runtime Protocol](./rfc/Action%20Runtime%20Protocol.md)
3. [Skill Package Specification](./rfc/Skill%20Package%20Specification.md)

If you only read one section from each:

- from the Action RFC: action kinds, bindings, conditions, composite `returns`
- from the Protocol RFC: request/response model, error model, deterministic execution
- from the Skill Package RFC: package layout, `entry_action`, `exposed_actions`, local resolution rules

### 2. Install the runtime and CLI

Install the published packages:

```bash
pnpm add @rien7/skill-action-runtime
pnpm add -g @rien7/skill-action-runtime-cli
```

For local development inside this repo, install and build per package:

```bash
cd runtime
pnpm install
pnpm check
```

```bash
cd runtime-cli
pnpm install
pnpm check
```

### 3. Run a sample Skill package

This repository includes a sample package at [`runtime-cli/test/fixtures/sample-skill`](./runtime-cli/test/fixtures/sample-skill).

Validate it:

```bash
cd runtime-cli
skill-action-runtime validate-skill-package --skill-package ./test/fixtures/sample-skill
```

Execute its public entry flow:

```bash
cd runtime-cli
echo '{"skill_id":"sample.skill","input":{"value":4}}' \
  | skill-action-runtime execute-skill \
      --skill-package ./test/fixtures/sample-skill \
      --handler-module ./test/fixtures/handlers.mjs
```

What this sample demonstrates:

- `sample.skill` exposes `workflow.increment` as its entry action
- `workflow.increment` is a composite Action
- it calls the internal primitive Action `math.add-one`
- primitive execution is provided through the handler module

## Reading Path By Role

- Spec reader: start in `rfc/`
- Runtime integrator: read `rfc/` first, then [`runtime/README.md`](./runtime/README.md)
- CLI user: read `rfc/Action Runtime Protocol.md` first, then [`runtime-cli/README.md`](./runtime-cli/README.md)
- Skill author: read the Skill Package RFC first, then inspect `skills/`

## Repository Principle

The RFCs are the product surface.

The runtime, CLI, and skill packages exist to implement and exercise that surface, not to replace it.
