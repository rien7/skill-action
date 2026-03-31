# Action Authoring

Use this file when designing or reviewing a single action.

## Required Fields

Every action needs:

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

## Choosing `kind`

- Choose `primitive` when one handler can perform the work directly.
- Choose `composite` when the workflow is stable, ordered, and built from other actions.

## Binding Rules

- Use `$input.foo` to reference top-level input.
- Use `$steps.step_id.output.foo` to reference prior step output.
- Use bracket notation such as `$input["field-name"]` when a key is not a valid identifier.
- Keep step IDs stable and simple because conditions and bindings depend on them.
- Check that every bound field exists in the producer schema before relying on it.
- Check that the resolved object matches the callee's `input_schema`; do not hand-wave shape conversion.
- Remember that composite `returns` uses the same binding model as `with`.

## Condition Rules

The local runtime currently supports:

- comparison: `==`, `!=`, `>`, `<`, `>=`, `<=`
- boolean: `&&`, `||`, `!`

Keep conditions deterministic and side-effect free.

## Runtime Convention

- Composite `returns` is required by the current RFC and runtime schema.
- Nested composite steps must reference package-local `action_id` values only.
- Primitive execution binding lives in the runtime environment, not in `action.json`.

## Boundary Questions

Before building or refactoring an action, make sure you can answer:

- What is the smallest stable unit of work here?
- Should this stay one action or split into smaller actions?
- Does execution require a runtime-provided primitive handler?
- Do all action-to-action parameter handoffs have an explicit, schema-backed mapping?
