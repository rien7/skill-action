---
name: action-skill-creator
description: Create or update RFC-core action skill packages using bundled package rules and runtime-cli validation guidance. Use when Codex needs to scaffold a new package under `skills/`, migrate a legacy skill into `SKILL.md + skill.json + actions/*/action.json`, define `entry_action`, or repair package layout and action graphs for an existing action skill.
---

# Action Skill Creator

This skill provides guidance for building or repairing a complete action-based skill package.

## Package Anatomy

The RFC-core package layout is:

```txt
skills/<skill-folder>/
  SKILL.md
  skill.json
  actions/
    <action-dir>/
      action.json
      (optional implementation files)
```

The package is the distribution boundary.
Actions are the execution units inside that boundary.

## Fast Path

For a new package:

1. Resolve the workspace root that should receive `skills/<skill-folder>/`.
2. Read [references/fast-path.md](references/fast-path.md).
3. Run [scripts/bootstrap-package.sh](scripts/bootstrap-package.sh) to create a minimal valid package under `skills/`.
4. Replace the starter schemas and workflow with the requested capability.
5. Validate through `skill-action-runtime`.
6. If the environment includes the `action-runner` skill, prefer it for validation and execution.

## Read Before Editing

1. Read [references/package-checklist.md](references/package-checklist.md).
2. Read [references/fast-path.md](references/fast-path.md).
3. Read [references/package-rules.md](references/package-rules.md).
4. If you need primitive execution through `--handler-module`, read [references/handler-module.md](references/handler-module.md).
5. If you need a starter handler file, copy [assets/handler-module-template.mjs](assets/handler-module-template.mjs).

Do not require repository source, RFC files, or installed package source as part of the normal workflow.

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
- the exact execution path a later agent should use first:
  - `execute-skill` versus `execute-action`
  - required `--skill-id` and `--action-id`
  - a minimal valid input example
- which environment prerequisites must be checked before live execution

If this is a new package, bootstrap from the local bootstrap script first.
Do not hand-author the package from scratch unless the task is explicitly about manifest authoring.

Only plan package-local `handlers.*` wiring when the task explicitly targets a runtime-cli-specific extension or an existing package already depends on it.
Do not introduce handler-module coupling as the default way to make a skill executable.

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
- one or more `actions/<action-dir>/action.json`

For a brand-new package, prefer this order:

1. scaffold the minimal package with the bootstrap script
2. rename the starter action ids and titles
3. replace starter schemas and workflow
4. add `handlers.*` only if primitive execution really needs the runtime-cli extension

Add `handlers.*` only when the task explicitly calls for a runtime-cli-specific extension or when you are repairing an existing package that already depends on it.

For `skill.json`, ensure:

- `skill_id`, `title`, `description`, and `entry_action` are correct
- `entry_action` points to a package-local action

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

- route matching requests straight to the package `entry_action`; do not start by reading CLI help or enumerating commands
- name the `entry_action` explicitly
- state the minimal required input fields in user terms
- state the exact execution path when shell execution is needed:
  - prefer `execute-skill` for normal use through the package `entry_action`
  - use `execute-action` only for targeted debugging or helper-level checks
- if the environment includes the `action-runner` skill, prefer it for validation and execution
- list hard runtime prerequisites such as OS, binaries, permissions, network access, or external apps
- tell the agent to repair failing actions first and then rerun the same execution path before concluding the package works

If the package intentionally depends on a runtime-cli-specific extension such as `--handler-module`, `SKILL.md` must label that path as implementation-specific rather than RFC-core behavior.

Do not turn `SKILL.md` into a duplicate of `skill.json` or `action.json`.
Use it to explain decisions an agent cannot infer from raw manifests.

### 6. Validate The Package

Run the CLI after substantial edits:

```bash
skill-action-runtime validate-skill-package --skill-package <absolute-path-to-skill> --output json
```

When the package is intended to execute, also use:

- `resolve-action`
- `validate-action-input`
- `execute-action`
- `execute-skill`

Choose the narrowest command that proves the package works.
For a user-facing workflow, prefer proving the happy path with `execute-skill` because that is the real entry path later agents should take.
Always prefer an explicit absolute `--skill-package` path over cwd-based discovery when the session did not start in this repo.
If live execution has side effects or environment constraints, use `--dry-run` only when it can still prove something meaningful.
Do not rely on `--dry-run` for composite workflows whose later bindings depend on primitive step outputs, because skipped steps may leave `$steps.*.output` references unresolved.
In that case, combine `resolve-action`, `validate-action-input`, targeted helper checks, and the closest safe real execution you can run.

Do not stop at package-shape validation when the package claims to be runnable.
If execution fails because of bindings, pathing, or implementation bugs, repair the package and rerun before finishing.
If stderr contains environment noise and the runtime response still points to a concrete code or binding failure, fix the concrete failure first instead of downgrading it to a caveat.

### 7. Iterate On Real Usage

After validation, refine the package where usage exposes friction:

- split actions that were too broad
- collapse actions that added no value
- tighten schemas
- strengthen `SKILL.md` routing so later agents take the direct execution path
- remove ambiguity that caused detours into CLI exploration or helper action misuse
- remove unnecessary runtime-cli-specific wiring when the RFC does not require it

- Use lowercase hyphen-case for the skill folder name.
- Keep YAML frontmatter limited to `name` and `description`.
- Write the body in imperative form.
- Describe what the skill does in human terms in `SKILL.md`, but keep execution logic in action definitions.
- In `SKILL.md`, describe the first action to invoke in operational terms, not just the capability summary.
- Prefer one composite `entry_action` for the main workflow.
- Do not blur package boundaries just because actions share implementation details.
- Do not assume action-to-action parameter compatibility; verify schemas and bindings explicitly.
- Treat composite `returns` as required, not optional.
- Do not introduce `handlers.*` as a default package artifact for RFC-core skills.
- If a package deliberately uses runtime-cli-specific `handlers.*`, document that path as an extension and verify it through the actual CLI behavior.
- If an implementation depends on platform permissions or automation approval, say so in `SKILL.md` and validate that failure mode explicitly.

## Output Checklist

Before finishing, confirm all of the following:

- The package directory lives under `skills/`.
- A new package started from the local bootstrap script unless there was a concrete reason not to.
- `skill.json` has a stable `skill_id`, `title`, `description`, and `entry_action`.
- Every `action.json` uses valid `kind` and `idempotent` values.
- Composite actions use ordered `steps` with explicit `with` bindings.
- The skill boundary still matches the requested workflow boundary.
- Every action-to-action handoff has a checked input/output contract.
- Composite outputs declare explicit `returns` compatible with `output_schema`.
- Input and output schemas are present and JSON Schema-compatible.
- The package naming and file layout match the RFC.
- `SKILL.md` tells a later agent to invoke the public workflow directly, with no CLI-help detour.
- `SKILL.md` includes a minimal valid input example and the correct execution path.
- `SKILL.md` tells later agents to use `action-runner` when that skill is available in the environment.
- Executable packages were proven through the real entry path, or the remaining environment blocker is stated precisely.

## Notes

- Keep the skill package focused. If a requested capability is only one reusable operation, prefer creating or updating an action inside an existing skill instead of inventing a new skill.
- When the task is mainly about authoring one action, switch to or also use `action-creator`.
