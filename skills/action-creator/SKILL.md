---
name: action-creator
description: Create or update RFC-aligned actions in this repository, including primitive actions, composite workflows, action manifests, bindings, conditions, visibility, and JSON Schema input or output contracts. Use when Codex needs to add a new action, refactor logic into actions, repair an `action.json`, update `actions/actions.json`, or make an action runnable by the local runtime.
---

# Action Creator

## Overview

Create deterministic actions that fit the local runtime and package conventions.
Favor explicit schemas, explicit bindings, and intentional visibility over convenience shortcuts.

## Workflow

1. Inspect the surrounding skill package before editing anything.
2. Read [references/action-authoring.md](references/action-authoring.md) for the local authoring rules.
3. Read `../../Action Specification.md` when the task needs exact semantics for action shape, steps, bindings, or conditions.
4. Decide whether the action should be:
   - `primitive` for a single execution unit
   - `composite` for an ordered workflow over other actions
5. Confirm the action boundary before editing:
   - what this action owns
   - whether the behavior should stay in one action or be split
   - whether the call path is package-local, skill-level, or public
   - whether execution depends on a runtime-global primitive executor
6. Confirm parameter contracts before writing bindings:
   - every required input field has an explicit source
   - every `$steps.<step_id>.output.*` reference is backed by the producing action's `output_schema`
   - the composite action's final output uses explicit `returns` when the result contract matters
   - if any edge is ambiguous, ask before inventing intermediate fields
7. Update all affected files together:
   - `actions/<action-name>/action.json`
   - `actions/actions.json`
   - `skill.json` if `entry_action` or `exposed_actions` changes
8. Keep action IDs stable and descriptive.
9. Validate schemas, bindings, and visibility before finishing.

## Primitive Actions

- Use a primitive action when one runtime handler or one stable unit of work is enough.
- Define narrow `input_schema` and `output_schema`.
- Set `side_effect` honestly:
  - `none` for pure computation or read-only logic
  - `local` for local file or state changes
  - `external` for network calls or external systems
- Mark `idempotent` conservatively.

## Composite Actions

- Use a composite action when the workflow is deterministic and step order matters.
- Keep `steps` explicit and ordered.
- Bind values with:
  - `$input.*`
  - `$steps.<step_id>.output.*`
- Keep conditions side-effect free.
- Avoid hiding routing logic in runtime assumptions; express it in the action definition.
- Verify that each step input matches the called action's schema before finalizing the workflow.
- Prefer explicit `returns` for stable output contracts instead of relying on last-step fallback.

## Visibility Rules

- Use `public` only for actions intended to be called from outside the skill.
- Use `skill` for skill-internal helper actions that may still be entrypoints from `executeSkill`.
- Use `internal` for step-only helpers.
- Prefer the narrowest visibility that still supports the intended call path.

## Runtime Notes

- The local runtime validates schemas with Ajv and parses protocol definitions with Zod.
- Composite actions now support explicit RFC `returns` bindings. If `returns` is omitted, the runtime falls back to the last successfully executed step output for compatibility.
- If a new action changes runtime assumptions, update tests in `runtime/test/` when relevant.

## Validation

Before finishing:

- Confirm the manifest entry exists and matches the action file.
- Confirm every referenced action ID resolves.
- Confirm conditions use only supported operators.
- Confirm every step binding and `returns` binding resolves against real schemas.
- Confirm upstream and downstream action parameters match at every handoff.
- Confirm schemas match the actual handler or workflow output.
- Run runtime checks when the action affects executable behavior.

## Notes

- When the task is really about creating a whole new package, switch to or also use `action-skill-creator`.
