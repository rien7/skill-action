# `@rien7/skill-action-runtime-cli`

CLI for the Skill Action runtime.

## Install

```bash
pnpm add -g @rien7/skill-action-runtime-cli
```

## Commands

- `skill-action-runtime list-skills`
- `skill-action-runtime list-actions`
- `skill-action-runtime validate-skill-package`
- `skill-action-runtime resolve-action`
- `skill-action-runtime validate-action-input`
- `skill-action-runtime execute-action`
- `skill-action-runtime execute-skill`

## Protocol Transport Usage

The four core protocol commands can be used in two ways:

1. Convenience flags such as `--action-id`, `--skill-id`, `--input-file`, and execution options
2. Full protocol requests via:
   - `--request-json <json>`
   - `--request-file <path>`
   - stdin when no request flags are provided

Example with a full request object:

```bash
echo '{"action_id":"workflow.increment","input":{"value":4},"options":{"trace_level":"full"}}' \
  | skill-action-runtime execute-action --skill-package ./test/fixtures/sample-skill
```

This keeps the CLI aligned with the RFC's `CLI (stdin/stdout)` transport model while still allowing shorter flag-based usage.

## Package Loading

Provide either:

- `--skill-package <dir>` one or more times
- `--skills-dir <dir>` to load every direct child skill package

If neither is provided, the CLI will:

1. Use the current directory if it looks like a skill package
2. Else use `<cwd>/skills` if it exists

## Discovery And Validation

List loaded skills:

```bash
skill-action-runtime list-skills --skills-dir ./skills
```

List loaded actions:

```bash
skill-action-runtime list-actions --skills-dir ./skills
```

Validate one or more packages:

```bash
skill-action-runtime validate-skill-package --skills-dir ./skills
```

The validation command checks package-level consistency such as:

- `entry_action` resolves
- `exposed_actions` resolve
- `actions/actions.json` matches `action.json`
- manifest visibility matches action visibility
- fully-qualified global action references are reported as external dependencies

## Primitive Execution

For `resolve-action`, `validate-action-input`, `execute-action`, and `execute-skill`, you may provide a handler module.
The handler module can supply primitive executors and runtime-global action definitions.

```bash
skill-action-runtime execute-skill \
  --skills-dir ./skills \
  --skill-id my.skill \
  --input-file ./input.json \
  --handler-module ./handlers.mjs
```

The handler module may export:

- `globalActions`
- `primitiveHandlers`
- `fallbackPrimitiveHandler`
- or a default object containing either field

## Build

```bash
pnpm install
pnpm check
```
