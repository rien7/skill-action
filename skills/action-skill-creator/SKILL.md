---
name: action-skill-creator
description: Create or update action-based skill packages in this repository using the current RFCs, runtime types, and runtime-cli validation rules. Use when Codex needs to scaffold a new package under `skills/`, migrate a legacy skill into `SKILL.md + skill.json + actions/actions.json + actions/*/action.json`, define `entry_action` and `exposed_actions`, or repair package layout, manifests, and action graphs for an existing action skill.
---

# Action Skill Creator

This skill provides guidance for building or repairing a complete action-based skill package.

## About Action-Based Skill Packages

An action-based skill package separates three concerns:

- `SKILL.md`: agent-facing routing and execution guidance
- `skill.json`: package metadata and entrypoint
- `actions/`: executable action contracts

The package is the distribution boundary.
Actions are the execution units inside that boundary.

## Core Principles

### Keep The Package Explicit

Do not rely on inference from filenames, scripts, or prose.
Declare the package entrypoint, public surface, and action manifest intentionally.

### Design The Capability Boundary First

Group actions that belong to one user-facing capability.
Split packages when workflows only share infrastructure and not an execution surface.

### Treat The Runtime And Validator As Part Of The Spec Surface

Use the RFCs for normative intent and the current runtime types plus CLI validator for concrete enforcement.
If a field is accepted or rejected by the current parser, write the package to that behavior.
Do not let runtime-specific extensions redefine the RFC surface.
If you use package-local handlers or other CLI-specific wiring, treat them as implementation-specific extensions rather than standard package requirements.

### Optimize For Immediate Invocation

Create the package so a later agent can use it immediately without exploring the CLI first.
`SKILL.md` must tell the agent which user requests map to the skill, which action to invoke first, what minimal input shape to pass, and when to repair instead of detouring into tool discovery.

### Keep Action Graphs Local And Deterministic

Nested composite steps must reference package-local `action_id` values only.
Composite actions must declare explicit `returns`.
Do not encode executor wiring in package metadata.

## Package Anatomy

The repo-standard package layout is:

```txt
skills/<skill-folder>/
  SKILL.md
  skill.json
  actions/
    actions.json
    <action-dir>/
      action.json
      (optional implementation files)
```

The core loader reads `skill.json` and every `actions/*/action.json`.
The CLI validator also checks `actions/actions.json`, so treat that manifest as required in this repo even though action discovery itself comes from directories.

## Read Before Editing

1. Read [references/package-checklist.md](references/package-checklist.md).
2. Read [Skill Package Specification.md](/Users/rien7/Github/skill-action/rfc/Skill%20Package%20Specification.md) when package-shape semantics matter.
3. Read [Action Specification.md](/Users/rien7/Github/skill-action/rfc/Action%20Specification.md) when action graph rules matter.
4. Read [Action Runtime Protocol.md](/Users/rien7/Github/skill-action/rfc/Action%20Runtime%20Protocol.md) when entrypoint and execution behavior matter.
5. Read [skill.ts](/Users/rien7/Github/skill-action/runtime/src/types/skill.ts) and [action.ts](/Users/rien7/Github/skill-action/runtime/src/types/action.ts) for the exact current parser surface.
6. If you are explicitly repairing or authoring a runtime-cli-specific extension that uses a `handlers.*` module, read [runtime.ts](/Users/rien7/Github/skill-action/runtime/src/core/runtime.ts), [load-handlers.ts](/Users/rien7/Github/skill-action/runtime-cli/src/load-handlers.ts), and [handlers.mjs](/Users/rien7/Github/skill-action/runtime-cli/test/fixtures/handlers.mjs) for the exact extension behavior.

## Skill Package Creation Process

### 1. Understand The Capability With Concrete Requests

Reduce the package to concrete user-facing examples:

- what the skill should help accomplish
- what the main workflow is
- what helper operations exist behind that workflow
- what should be callable externally versus helper-only

If the boundary is unclear, resolve that first.

### 2. Plan The Package Surface

Before writing files, decide:

- skill folder name
- `skill_id`
- human-facing `title` and `description`
- `entry_action`
- `exposed_actions`
- which actions are `public`, `skill`, or `internal`
- the exact execution path a later agent should use first:
  - `execute-skill` versus `execute-action`
  - required `--skill-id` and `--action-id`
  - a minimal valid input example
  - which environment prerequisites must be checked before live execution

Only plan package-local `handlers.*` wiring when the task explicitly targets a runtime-cli-specific extension or an existing package already depends on it.
Do not introduce handler-module coupling as the default way to make a skill executable.

The runtime schema makes `version` optional and defaults `exposed_actions` to `[]`.
In this repo, prefer including `version` explicitly and declaring `exposed_actions` intentionally for a stable public surface.

### 3. Plan The Action Graph

For each workflow, decide:

- which action is primitive versus composite
- how inputs move from caller to callee
- which step outputs are referenced downstream
- what the final composite `returns` object should be

Do not invent implicit field mapping.
Every handoff should be schema-backed.

### 4. Create Or Update The Package Files

Touch these files together:

- `SKILL.md`
- `skill.json`
- `actions/actions.json`
- one or more `actions/<action-dir>/action.json`

Add `handlers.*` only when the task explicitly calls for a runtime-cli-specific extension or when you are repairing an existing package that already depends on it.

For `skill.json`, ensure:

- `skill_id`, `title`, `description`, and `entry_action` are correct
- `entry_action` points to a package-local action
- `exposed_actions` contains only intentionally callable actions

For `actions/actions.json`, ensure:

- each action appears exactly once
- each `path` resolves to a real action directory
- each manifest `visibility` matches the action definition

For each `action.json`, ensure:

- the contract matches the actual role of the action
- composite steps reference package-local `action_id` values only
- composite actions declare explicit `returns`
- schemas describe the real input and output objects

For runtime-cli-specific `handlers.*` extensions, ensure:

- the module exports `primitiveHandlers`
- each key matches the current runtime binding format exactly
- each handler covers the intended package-local primitive action
- the referenced action ids and `skill_id` values match the package manifests exactly

### 5. Write `SKILL.md` As Agent Routing Guidance

Keep `SKILL.md` focused on:

- what the package does
- when to use it
- capability boundaries
- the workflow an agent should follow when using the skill
- the workflow an agent should follow when editing the package

For executable skills, `SKILL.md` must also make these points explicit:

- route matching requests straight to the public `entry_action`; do not start by reading CLI help or enumerating commands
- name the public action id explicitly
- state the minimal required input fields in user terms
- state the exact execution path when shell execution is needed:
  - prefer `execute-skill` for normal use through the package `entry_action`
  - use `execute-action` only for targeted debugging or helper-level checks
- list hard runtime prerequisites such as OS, binaries, permissions, network access, or external apps
- tell the agent to repair failing actions first and then rerun the same execution path before concluding the package works

If the package intentionally depends on a runtime-cli-specific extension such as `--handler-module`, `SKILL.md` must label that path as implementation-specific rather than RFC-core behavior.

Do not turn `SKILL.md` into a duplicate of `skill.json` or `action.json`.
Use it to explain decisions an agent cannot infer from raw manifests.

### 6. Validate The Package

Run the repo CLI after substantial edits:

```bash
skill-action-runtime validate-skill-package --skill-package <path-to-skill> --output json
```

When the package is intended to execute, also use:

- `resolve-action`
- `validate-action-input`
- `execute-action`
- `execute-skill`

Choose the narrowest command that proves the package works.
For a user-facing workflow, prefer proving the happy path with `execute-skill` because that is the real entry path later agents should take.
If live execution has side effects or environment constraints, use `--dry-run` only when it can still prove something meaningful.
Do not rely on `--dry-run` for composite workflows whose later bindings depend on primitive step outputs, because skipped steps may leave `$steps.*.output` references unresolved.
In that case, combine `resolve-action`, `validate-action-input`, targeted helper checks, and the closest safe real execution you can run.

Do not stop at package-shape validation when the package claims to be runnable.
If execution fails because of bindings, visibility misuse, pathing, or implementation bugs, repair the package and rerun before finishing.
If stderr contains environment noise and the runtime response still points to a concrete code or binding failure, fix the concrete failure first instead of downgrading it to a caveat.

### 7. Iterate On Real Usage

After validation, refine the package where usage exposes friction:

- split actions that were too broad
- collapse actions that added no value
- tighten schemas
- narrow visibility
- simplify `exposed_actions`
- strengthen `SKILL.md` routing so later agents take the direct execution path
- remove ambiguity that caused detours into CLI exploration or helper action misuse
- remove unnecessary runtime-cli-specific wiring when the RFC does not require it

- Use lowercase hyphen-case for the skill folder name.
- Keep YAML frontmatter limited to `name` and `description`.
- Write the body in imperative form.
- Describe what the skill does in human terms in `SKILL.md`, but keep execution logic in action definitions.
- In `SKILL.md`, describe the first action to invoke in operational terms, not just the capability summary.
- Prefer one public composite `entry_action` for the main workflow.
- Use `skill` or `internal` visibility for helper actions unless there is a real external use case.
- Do not rely on implicit discovery; declare everything explicitly in `actions/actions.json`.
- Do not blur package boundaries just because actions share implementation details.
- Do not assume action-to-action parameter compatibility; verify schemas and bindings explicitly.
- Treat composite `returns` as required, not optional.
- Do not introduce `handlers.*` as a default package artifact for RFC-core skills.
- If a package deliberately uses runtime-cli-specific `handlers.*`, document that path as an extension and verify it against the current runtime source.
- If an implementation depends on platform permissions or automation approval, say so in `SKILL.md` and validate that failure mode explicitly.

## Output Checklist

Before finishing, confirm all of the following:

- The package directory lives under `skills/`.
- `skill.json` has a stable `skill_id`, `version`, `title`, `description`, `entry_action`, and `exposed_actions`.
- `actions/actions.json` declares every action exactly once.
- Every `action.json` uses valid `kind`, `visibility`, `side_effect`, and `idempotent` values.
- Composite actions use ordered `steps` with explicit `with` bindings.
- The skill boundary and exposed surface still match the requested workflow boundary.
- Every action-to-action handoff has a checked input/output contract.
- Composite outputs declare explicit `returns` compatible with `output_schema`.
- Input and output schemas are present and JSON Schema-compatible.
- The package naming and file layout match the RFC.
- `SKILL.md` tells a later agent to invoke the public workflow directly, with no CLI-help detour.
- `SKILL.md` includes a minimal valid input example and the correct execution path.
- Executable packages were proven through the real entry path, or the remaining environment blocker is stated precisely.

## Validation

Run the package validator after substantial edits:

```bash
skill-action-runtime validate-skill-package --skill-package <path-to-skill> --output json
```

If the edited package also changes agent-facing routing guidance, you may additionally run:

```bash
python3 /Users/rien7/.codex/skills/.system/skill-creator/scripts/quick_validate.py <path-to-skill>
```

## Notes

- Keep the skill package focused. If a requested capability is only one reusable operation, prefer creating or updating an action inside an existing skill instead of inventing a new skill.
- When the task is mainly about authoring one action, switch to or also use `action-creator`.
