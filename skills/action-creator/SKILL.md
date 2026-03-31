---
name: action-creator
description: Create or update RFC-aligned primitive and composite actions in this repository. Use when Codex needs to add an action, refactor logic into package-local actions, repair `action.json`, update `actions/actions.json`, define bindings, conditions, visibility, or JSON Schema contracts, or make an action valid under the local runtime and validator.
---

# Action Creator

This skill provides guidance for authoring a single action or a small set of tightly related actions.

## About Actions

Actions are deterministic execution units declared by manifest, not inferred from scripts or prose.

Two action kinds exist:

1. Primitive actions: one runtime-bound execution unit
2. Composite actions: an ordered workflow over package-local actions

In this repo, action authoring spans three surfaces:

- `actions/<action-dir>/action.json`: executable contract
- `actions/actions.json`: package manifest and visibility mirror
- `skill.json`: only when `entry_action` or `exposed_actions` changes

## Core Principles

### Start With The Boundary

Decide the smallest stable unit of work before editing files.
Split when ordering or reuse matters. Keep one action when the behavior is truly atomic.

### Make Contracts Explicit

Define `input_schema` and `output_schema` first.
Every reachable binding must resolve against a real schema path. Do not rely on implied fields.

### Treat Composite `returns` As Required

The current RFC and runtime schema require composite actions to declare `returns`.
Do not copy older guidance that treats last-step output as a valid fallback.

### Keep References Package-Local

Composite `steps[].action` values must reference package-local `action_id` values only.
Runtime-global URIs and filesystem-like references are validation failures for nested calls.

### Separate Runtime Binding From Package Metadata

Primitive executor binding is runtime behavior.
Do not try to encode handler-module paths or runtime wiring in `action.json`.

## Read Before Editing

1. Read [references/action-authoring.md](references/action-authoring.md) for the local checklist.
2. Read [rfc/Action Specification.md](/Users/rien7/Github/skill-action/rfc/Action%20Specification.md) when exact field semantics, bindings, or condition rules matter.
3. Read [rfc/Action Runtime Protocol.md](/Users/rien7/Github/skill-action/rfc/Action%20Runtime%20Protocol.md) when execution or resolution behavior matters.
4. Read [action.ts](/Users/rien7/Github/skill-action/runtime/src/types/action.ts) when you need the exact current parser constraints.

If the task is really about creating or repairing a whole skill package, switch to or also use `action-skill-creator`.

## Action Creation Process

### 1. Understand The Requested Behavior

Reduce the request to a concrete contract:

- what inputs the caller owns
- what output shape downstream code needs
- whether the behavior is atomic or workflow-shaped
- whether execution depends on a primitive handler that already exists

If the action boundary is ambiguous, resolve that before touching schemas.

### 2. Inspect The Containing Skill Package

Read the neighboring files before editing:

- `skill.json`
- `actions/actions.json`
- the target `action.json`
- any upstream or downstream actions that bind into or out of this action

Keep `action_id` stable unless the user explicitly wants a rename.

### 3. Choose The Action Kind

Use `primitive` when one handler can perform the work directly.
Use `composite` when the workflow is deterministic, ordered, and should stay declarative.

For primitive actions:

- keep schemas narrow
- set `side_effect` honestly
- mark `idempotent` conservatively
- remember that implementation binding lives in the runtime, not the package

For composite actions:

- define ordered `steps`
- use only supported bindings such as `$input.foo` and `$steps.step_id.output.bar`
- use bracket notation for keys that are not valid identifiers
- keep `if` expressions deterministic and side-effect free
- declare `returns` explicitly and make it match `output_schema`

### 4. Edit The Contract And Manifest Together

Update all affected files in one pass:

- `actions/<action-dir>/action.json`
- `actions/actions.json`
- `skill.json` when package entry or public surface changes

When editing the manifest:

- keep `action_id`, `path`, and `visibility` aligned with the action definition
- declare each action exactly once
- do not infer visibility from folder names or neighboring files

### 5. Validate Data Flow

Check every edge before finishing:

- every required callee field has an explicit source
- every `$steps.<step_id>.output.*` path is backed by the producer `output_schema`
- every reachable condition references available values
- every `returns` field resolves to a JSON object compatible with `output_schema`
- every nested `action` reference resolves within the same package

### 6. Validate With The Runtime Tooling

Prefer the repo CLI for package checks:

```bash
skill-action-runtime validate-skill-package --skill-package <path-to-skill> --output json
```

If the action is executable, also use `resolve-action`, `validate-action-input`, or `execute-action` as needed.
When primitive execution is involved, provide a handler module only if the runtime actually needs one.

### 7. Iterate On Real Usage

If the action is tricky, test the real call path instead of only reading JSON:

- run the validator
- run the narrowest CLI command that proves the contract
- update schemas, bindings, or visibility when execution surfaces a mismatch

## Authoring Rules

- Prefer explicit `visibility` and `side_effect` even though the runtime schema has defaults.
- Prefer explicit `version` when neighboring actions use repo-standard semver metadata.
- Use step IDs that satisfy `[A-Za-z_][A-Za-z0-9_]*`.
- Keep conditions limited to RFC operators: `==`, `!=`, `>`, `<`, `>=`, `<=`, `&&`, `||`, `!`.
- Keep binding values JSON-shaped; plain strings only become bindings when the entire string matches a supported reference.
- Do not duplicate package-level routing guidance inside action contracts.

## Notes

- If the task is really about creating a whole new package, switch to or also use `action-skill-creator`.
- If the task is mainly about executing or debugging an existing action, switch to or also use `action-runner`.
