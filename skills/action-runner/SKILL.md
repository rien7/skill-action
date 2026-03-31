---
name: action-runner
description: Run the Skill Action runtime CLI to inspect skill packages, validate manifests, resolve actions, validate input, and execute actions or skills with RFC-aligned request and response handling. Use when Codex needs to drive `skill-action-runtime` from the shell, interpret its structured output, or debug package loading, validation, resolution, and execution failures.
---

# Action Runner

This skill provides guidance for using the local `skill-action-runtime` CLI as a transport wrapper over the runtime.

## About The CLI

The CLI is not a separate orchestration system.
Treat it as a shell transport for the runtime protocol:

- JSON-compatible requests in
- structured JSON or pretty output out
- protocol-level failure outside execution
- execution failure represented inside `data.status`

## Core Principles

### Choose The Narrowest Command

Use the smallest command that answers the question:

- `list-skills`
- `list-actions`
- `validate-skill-package`
- `resolve-action`
- `validate-action-input`
- `execute-action`
- `execute-skill`

Prefer `--output json` when you need to inspect or quote fields programmatically.

### Match The Runtime Loading Model

The CLI loads packages in this order:

1. explicit `--skill-package <dir>` entries
2. explicit `--skills-dir <dir>` direct children that contain `skill.json`
3. current directory if it contains `skill.json`
4. otherwise `<cwd>/skills` direct children that contain `skill.json`

Do not assume recursive discovery.

### Distinguish Input Payload From Full Request Payload

For `resolve-action`, `validate-action-input`, `execute-action`, and `execute-skill`, the CLI supports two request styles:

1. Convenience flags such as `--skill-id`, `--action-id`, `--input-file`, and execution options
2. Full protocol requests via `--request-json`, `--request-file`, or stdin when the required target flag is omitted

Use full request payloads when you need to test exact protocol shapes.

### Keep Failure Modes Separate

Treat these as different classes of failure:

- shell failure: binary missing, bad path, unreadable files
- protocol failure: outer response has `ok: false`
- execution failure: outer response has `ok: true` and `data.status: "failed"`

Do not blur them in the report.

### Treat Source As The Current Truth

When README examples and implementation diverge, follow `runtime-cli/src`.
Treat `--handler-module` as a runtime-cli-specific extension, not as RFC-core runtime behavior.
As of the current implementation, `--handler-module` loads `primitiveHandlers` only.
Primitive handler keys for that extension must match `primitiveBindingKey(skillId, actionId)` from the runtime source exactly.
At the current implementation, that key is `JSON.stringify([skillId, actionId])`.

## CLI Workflow

### 1. Clarify The Goal

Decide which of these you need:

- inspect loaded skills
- inspect loaded actions
- validate package structure and manifest consistency
- resolve one action within one skill
- validate one action input payload
- execute one action
- execute one skill through `entry_action`

### 2. Verify The Binary

Check the executable before constructing bigger commands:

```bash
command -v skill-action-runtime
```

If it is missing, stop and surface the exact install command:

```bash
pnpm add -g @rien7/skill-action-runtime-cli
```

### 3. Load The Right Packages

Confirm which package set should be visible.
Use explicit flags when ambiguity would matter.

- Use `--skill-package` for one or a few specific packages.
- Use `--skills-dir` when the caller wants every direct child package in a `skills/` folder.
- Avoid mixing unrelated packages when action names could collide semantically.

### 4. Choose The Right Request Shape

Use convenience flags for routine checks.
Use `--request-json`, `--request-file`, or stdin for exact protocol requests.

For input payloads:

- `--input-file <path>`
- `--input-json <json>`

For full request objects:

- `--request-file <path>`
- `--request-json <json>`
- stdin when no request flags are given and the required target flag is omitted

### 5. Add Execution Options Intentionally

`execute-action` and `execute-skill` support:

- `--dry-run`
- `--trace-level none|basic|full`
- `--timeout-ms <ms>`
- `--max-depth <n>`
- `--max-steps <n>`

`--dry-run` and trace options are runtime-cli-specific execution extensions rather than RFC-core protocol fields.
Use `--dry-run` when you want implementation-level validation and trace behavior without invoking primitive handlers.

### 6. Interpret The Result Correctly

Read the outer envelope first:

- `ok: false`: protocol failure before execution started
- `ok: true` plus `data.status: "succeeded"`: execution success
- `ok: true` plus `data.status: "failed"`: execution started but failed

The CLI exits non-zero for both protocol failures and execution failures.

## Command Patterns

List discovered skills:

```bash
skill-action-runtime list-skills --skills-dir ./skills --output json
```

List actions:

```bash
skill-action-runtime list-actions --skill-package ./skills/my-skill --output json
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
skill-action-runtime execute-action --skill-package ./skills/my-skill --skill-id my.skill --action-id workflow.main --input-file ./input.json --output json
```

Execute a skill:

```bash
skill-action-runtime execute-skill --skill-package ./skills/my-skill --skill-id my.skill --input-file ./input.json --output json
```

Use a full protocol request over stdin when you need to test exact runtime envelopes:

```bash
echo '{"skill_id":"sample.skill","action_id":"workflow.increment","input":{"value":4}}' \
  | skill-action-runtime execute-action --skill-package ./runtime-cli/test/fixtures/sample-skill --output json
```

## Validation And Debugging Notes

- `validate-skill-package` checks package-level consistency such as `entry_action`, `exposed_actions`, manifest/action alignment, and nested action locality.
- `resolve-action` proves top-level addressability, not successful execution.
- `validate-action-input` proves input-schema acceptance, not handler availability.
- `execute-skill` always enters through the package `entry_action`.
- If you are using the runtime-cli-specific `--handler-module` extension and primitive execution fails, check whether the addressed primitive action has a loaded handler under `primitiveHandlers`.
- For that extension path, verify the exported key string exactly matches the runtime binding key for that `skill_id` and `action_id`.
- If the runtime response identifies a concrete binding or handler error, do not collapse it into a generic environment caveat.

## Reporting Rules

- Quote the command you ran when that helps reproduce the result.
- Surface the decisive fields, not the whole payload dump.
- Include the exact `error.code` and `error.message` for protocol failures.
- Include the failing status, trace hint, or missing binding detail for execution failures.
- If package discovery failed, tell the user which loading rule the CLI tried and which explicit flag would remove ambiguity.

## Notes

- The CLI should reflect RFC semantics rather than inventing a different error model.
- Prefer RFC-core command paths in documentation and guidance; mention runtime-cli-specific extensions only when they are actually needed.
- Do not silently recover from schema or binding mismatches; surface the incompatible edge directly.
