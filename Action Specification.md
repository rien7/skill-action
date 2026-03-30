# RFC: Action Specification (v1.0.0)

## 1. Overview

This document defines the Action Specification, a language-agnostic format for describing executable units used within a skill system.

An Action is a deterministic execution unit with:

- Explicit input/output schemas
- Defined execution behavior
- Optional composition via steps

Actions are designed to enable predictable, reusable, and composable workflows, independent of agent reasoning.

## 2. Design Goals

The Action Specification MUST satisfy:

1. Deterministic execution
2. Language-independent representation
3. Explicit data flow
4. Structured validation
5. Composability (via composite actions)

The specification explicitly DOES NOT include:

- Planning logic
- Dynamic tool discovery
- Agent-level reasoning

## 3. Action Types

### 3.1 Primitive Action

A primitive action is executed directly by a runtime executor.

Examples:

- HTTP request
- Shell command
- Database query
- Script execution

### 3.2 Composite Action

A composite action defines execution as an ordered set of steps.

Each step invokes another action.

## 4. Action Definition

### 4.1 Base Structure

```json
{
  "action_id": "string",
  "version": "string",
  "kind": "primitive | composite",
  "title": "string",
  "description": "string",
  "input_schema": {},
  "output_schema": {},
  "visibility": "public | skill | internal",
  "side_effect": "none | local | external",
  "idempotent": true
}
```

## 5. Composite Action Definition

### 5.1 Steps

Composite actions MUST define steps.

```json
{
  "steps": [
    {
      "id": "string",
      "action": "action_id",
      "with": {},
      "if": "expression (optional)"
    }
  ]
}
```

### 5.2 Execution Semantics

- Steps are executed in order.
- Each step receives resolved input.
- Step output is stored in execution context.
- Steps MAY be conditionally skipped via `if`.

## 6. Data Binding

### 6.1 Supported References

- `$input.xxx`
- `$steps.step_id.output.xxx`

### 6.2 Resolution Rules

- References MUST resolve before execution.
- Missing references MUST produce a validation error.

## 7. Condition Expressions

Conditions MUST be deterministic and side-effect free.

### 7.1 Supported Operators

- Comparison: `==`, `!=`, `>`, `<`, `>=`, `<=`
- Boolean: `&&`, `||`, `!`

### 7.2 Example

```txt
$steps.check.output.success == true
```

### 7.3 Restrictions

- No arbitrary scripting allowed
- No function execution allowed

## 8. Execution Semantics

### 8.1 Step Execution

For each step:

1. Evaluate condition (if present)
2. If false, mark as skipped
3. Else:
   - Resolve input
   - Execute action
   - Store output

### 8.2 Failure Behavior

- Default: fail-fast
- Any step failure -> entire action fails

## 9. Visibility

Defines where an action may be invoked:

| Value | Meaning |
| --- | --- |
| `public` | Callable externally |
| `skill` | Callable only within skill |
| `internal` | Callable only within actions |

## 10. Side Effects

Defines execution impact:

| Value | Meaning |
| --- | --- |
| `none` | Pure function |
| `local` | Local state change |
| `external` | External system impact |

## 11. Idempotency

`idempotent: true` indicates:

- Safe to retry
- Same input -> same effect

## 12. Versioning

Each action MUST include:

```json
{
  "version": "1.0.0"
}
```

## 13. Non-Goals

This specification does NOT define:

- Execution engine
- Scheduling
- Distributed execution
- Agent behavior

These are defined in the Action Runtime Protocol.

## 14. Summary

Actions define what to execute, not when or why.

They serve as the deterministic foundation for structured execution systems.
