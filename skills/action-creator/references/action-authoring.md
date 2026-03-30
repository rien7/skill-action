# Action Authoring

Use this file when designing or reviewing a single action.

## Required Fields

Every action needs:

- `action_id`
- `version`
- `kind`
- `title`
- `description`
- `input_schema`
- `output_schema`
- `visibility`
- `side_effect`
- `idempotent`

Composite actions also need:

- `steps`

## Choosing `kind`

- Choose `primitive` when one handler can perform the work directly.
- Choose `composite` when the workflow is stable, ordered, and built from other actions.

## Binding Rules

- Use `$input.foo` to reference top-level input.
- Use `$steps.step_id.output.foo` to reference prior step output.
- Keep step IDs stable and simple because conditions and bindings depend on them.
- Check that every bound field exists in the producer schema before relying on it.
- Check that the resolved object matches the callee's `input_schema`; do not hand-wave shape conversion.

## Condition Rules

The local runtime currently supports:

- comparison: `==`, `!=`, `>`, `<`, `>=`, `<=`
- boolean: `&&`, `||`, `!`

Keep conditions deterministic and side-effect free.

## Visibility Heuristics

- `public`: external call path is intentional
- `skill`: helper action that should only run inside the skill boundary
- `internal`: helper action used only by other actions

Default to the narrowest visibility that works.

## Runtime Convention

The RFC defines explicit composite `returns` bindings, and the local runtime supports them.
If `returns` is omitted, the runtime still uses the last successful step output as a compatibility fallback.
Use that fallback only when the output contract is truly equivalent; otherwise define `returns` explicitly.

## Boundary Questions

Before building or refactoring an action, make sure you can answer:

- What is the smallest stable unit of work here?
- Should this stay one action or split into smaller actions?
- Is the action meant to be `public`, `skill`, or `internal`?
- Does execution require a runtime-global primitive executor or handler module?
- Do all action-to-action parameter handoffs have an explicit, schema-backed mapping?
