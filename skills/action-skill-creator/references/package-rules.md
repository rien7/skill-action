# Package Rules

Use this file as the bundled rules reference for action skill packages.

## Required Package Files

Every package should contain:

- `SKILL.md`
- `skill.json`
- at least one `actions/<action-dir>/action.json`

## `skill.json`

Write these fields explicitly:

- `skill_id`
- `title`
- `description`
- `entry_action`

Rules:

- `entry_action` must point to a package-local action
- prefer one composite `entry_action` for the main workflow

## `action.json`

Every action should define:

- `action_id`
- `kind`
- `title`
- `description`
- `input_schema`
- `output_schema`
- `idempotent`

Composite actions also need:

- `steps`
- `returns`

## Action Graph Rules

- nested `steps[].action` values must reference package-local `action_id` values only
- use `$input.foo` for top-level input bindings
- use `$steps.stepId.output.foo` for previous step output bindings
- use bracket notation when a field name is not a valid identifier
- every required callee field needs an explicit source
- every referenced output path must exist in the producer `output_schema`
- `returns` must resolve to an object compatible with the composite `output_schema`

## Execution Rules

- `execute-skill` is the normal user-facing path through `entry_action`
- `execute-action` is for targeted debugging or helper-level checks
- `validate-skill-package` proves package shape, not execution
- `validate-action-input` proves input-schema acceptance, not handler availability
- if the environment includes `action-runner`, prefer it for validation and execution

## Design Guidance

- keep the package boundary aligned with one user-facing capability
- split packages when workflows share infrastructure but not a stable execution surface
- keep runtime wiring out of manifests
- prefer a minimal valid package first, then customize
- if execution fails, repair the package and rerun the same public path
