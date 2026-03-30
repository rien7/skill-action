---
name: action-runner
description: Run the published Skill Action runtime CLI to inspect skill packages, resolve actions, validate inputs, and execute actions or skills with RFC-aligned error handling.
---

# Action Runner

## Overview

Use the published CLI package `@rien7/skill-action-runtime-cli` when you need to inspect or exercise the local action runtime from the shell.
Keep requests aligned with the local RFC transport model: JSON-compatible requests in, structured JSON out, and a strict distinction between protocol-level failure and execution-result failure.

## Workflow

1. Clarify the goal before running commands:
   - inspect loaded skills or actions
   - validate a skill package
   - resolve an action
   - validate action input
   - execute an action
   - execute a skill
2. Confirm the boundary of the request:
   - which skill package or `skills/` directory should be loaded
   - whether the target is a top-level `action_id` or `skill_id`
   - whether an action ID is package-local or a fully-qualified runtime-global reference
   - whether primitive execution requires `--handler-module`
3. Confirm parameter contracts for execution requests:
   - input JSON matches the target `input_schema`
   - composite step outputs referenced downstream are actually produced upstream
   - explicit `returns` should be preferred when the final output contract matters
4. Before running the CLI, verify the binary exists:

```bash
command -v skill-action-runtime
```

5. If the binary is missing, stop and return an explicit install hint:

```bash
pnpm add -g @rien7/skill-action-runtime-cli
```

Mention the package name exactly and do not pretend the command ran.

6. If the task needs primitive execution, confirm the handler module path and expected exports:
   - `primitiveHandlers`
   - optional `fallbackPrimitiveHandler`
   - optional `globalActions`
7. Prefer the narrowest command that answers the user's question, and prefer `--output json` when you need to inspect or quote the result programmatically.
8. When a command fails, distinguish between:
   - shell or command-availability failure
   - protocol-level failure: outer response has `ok: false`
   - execution-result failure: outer response has `ok: true` and `data.status: "failed"`
9. Report the command outcome with the key stdout or stderr details and a concrete next step.

## Command Patterns

List discovered skills:

```bash
skill-action-runtime list-skills --skills-dir ./skills --output json
```

List actions, optionally with handler-provided globals:

```bash
skill-action-runtime list-actions --skill-package ./skills/my-skill --handler-module ./handlers.mjs --output json
```

Validate one or more skill packages:

```bash
skill-action-runtime validate-skill-package --skills-dir ./skills --output json
```

Resolve an action:

```bash
skill-action-runtime resolve-action --skill-package ./skills/my-skill --action-id workflow.main --output json
```

Validate action input:

```bash
skill-action-runtime validate-action-input --skill-package ./skills/my-skill --action-id workflow.main --input-file ./input.json --output json
```

Execute an action:

```bash
skill-action-runtime execute-action --skill-package ./skills/my-skill --action-id workflow.main --input-file ./input.json --output json
```

Execute a skill:

```bash
skill-action-runtime execute-skill --skill-package ./skills/my-skill --skill-id my.skill --input-file ./input.json --output json
```

## Error Handling

- If `skill-action-runtime` is not installed, return the install command for `@rien7/skill-action-runtime-cli`.
- If the CLI says no skill packages were found, tell the user to pass `--skill-package` or `--skills-dir`, or run from a skill package or repo root with `skills/`.
- If the response is `ok: false`, treat it as request or resolution failure and surface the response `error.code` and `error.message`.
- If the response is `ok: true` with `data.status: "failed"`, treat it as execution failure and surface the failing step, trace summary, or executor-related error.
- If primitive execution fails because no executor is bound, tell the user the runtime needs a matching handler module or runtime-global binding for that primitive action.
- If an action ID is ambiguous at top level, tell the user to load fewer packages or use a fully-qualified target.

## Notes

- The CLI is a transport wrapper around the runtime, so it should reflect RFC semantics rather than inventing a different error model.
- Do not silently recover from schema or binding mismatches; surface them and explain which action edge is incompatible.
