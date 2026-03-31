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
5. Composability via composite actions

The specification explicitly DOES NOT include:

- Planning logic
- Dynamic tool discovery
- Agent-level reasoning
- Transport-specific binding configuration
- Cross-runtime portability of primitive binding configuration

## 3. Action Types

### 3.1 Primitive Action

A primitive action is executed directly by a runtime-provided implementation binding.

The action definition describes the contract, not where the executable implementation lives.
A primitive action MAY be backed by:

- Implementation files inside the package
- Implementation files outside the package
- A host-provided adapter or bridge

Binding rules:

- Primitive binding selection is runtime behavior, not package metadata
- A conforming runtime MUST resolve primitive bindings from environment variables supplied to that runtime
- The exact environment variable names and value format are runtime-defined and outside this core specification
- Primitive binding lookup MUST use the resolved package action identity defined by the Action Runtime Protocol
- Runtimes MUST NOT infer executable behavior from filenames, directory names, or arbitrary package contents
- If a primitive action is selected for execution and no binding is available from the runtime environment, execution MUST fail deterministically

### 3.2 Composite Action

A composite action defines execution as an ordered set of steps.

Each step invokes another action from the same skill package.

## 4. Action Definition

### 4.1 Base Structure

```json
{
  "action_id": "string",
  "kind": "primitive | composite",
  "title": "string",
  "description": "string",
  "input_schema": {},
  "output_schema": {},
  "idempotent": true
}
```

Field optionality conventions:

- Unless explicitly marked optional, every field shown in an object structure MUST be present
- Optional fields MAY be omitted; if present, they MUST satisfy the declared contract
- `null` is not implied by optionality; a field is nullable only when the specification explicitly says it MAY be `null`

Schema dialect:

- `input_schema` and `output_schema` MUST use JSON Schema Draft 2020-12
- If a schema omits `$schema`, runtimes and validators MUST interpret it as Draft 2020-12
- If a schema includes `$schema`, it MUST equal `https://json-schema.org/draft/2020-12/schema`

Identifier rules:

- `action_id` MUST be a non-empty, case-sensitive string
- Package-local `action_id` equality MUST use exact string equality; runtimes and validators MUST NOT trim, case-fold, or Unicode-normalize identifiers before comparison

Action identity model:

- Within a skill package, an action is referenced by exact `action_id`
- Package-scoped external addressing is defined by the Action Runtime Protocol and uses `skill_id` together with `action_id`

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
      "if": "expression"
    }
  ]
}
```

Step field semantics:

- `steps` MUST contain at least one step
- `id` MUST be present
- `id` MUST match the identifier syntax `[A-Za-z_][A-Za-z0-9_]*`
- `action` MUST be present
- `action` MUST reference a package-local `action_id` declared in the same skill package
- `with` MAY be omitted; if omitted, it defaults to an empty object
- `if` MAY be omitted; if omitted, the step is always reachable

Step resolution rules:

- Nested action calls MUST resolve only within the current skill package
- If the referenced package-local action cannot be resolved, execution MUST fail deterministically

### 5.2 Returns

Composite actions MUST define an explicit `returns` object mapping.

```json
{
  "returns": {
    "result": "$steps.finalize.output.result"
  }
}
```

`returns` uses the same binding model as step `with`.
It is resolved after all reachable steps complete successfully and becomes the composite action's final output.

Rules:

- If `returns` is omitted, the action definition is invalid
- Runtimes and validators MUST reject composite actions that omit `returns`
- Composite action `output_schema` MUST describe a JSON object
- Composite action `returns` MUST resolve to a JSON object

### 5.3 Binding Value Model

The `with` object and the `returns` object MAY contain arbitrary JSON values.

Binding resolution rules:

- If a value is an object, the runtime MUST resolve each property value recursively
- If a value is an array, the runtime MUST resolve each element recursively
- If a value is a string and the entire string matches a supported binding reference, the runtime MUST resolve it as a binding
- Any other string MUST be treated as a literal string; v1 does not support string interpolation or template expansion
- Numbers, booleans, and `null` MUST be treated as literals

This model applies identically to step `with` values and composite `returns` values.

### 5.4 Execution Semantics

- Steps are executed in order
- Each step receives resolved input
- Step output is stored in execution context
- Steps MAY be conditionally skipped via `if`
- After all reachable step execution completes successfully, `returns` is resolved

## 6. Data Binding

### 6.1 Supported References

- `$input.xxx`
- `$input`
- `$input["field-name"]`
- `$steps.step_id.output.xxx`
- `$steps.step_id.output`
- `$steps.step_id.output["field-name"]`

### 6.2 Path Syntax

Bindings use two path forms:

- Dot notation segments, which MUST match the identifier syntax `[A-Za-z_][A-Za-z0-9_]*`
- Bracket notation segments, which MUST use a JSON double-quoted string literal

Rules:

- `step_id` MUST always use identifier syntax and therefore appears only in dot notation
- Bracket notation MUST be used when an object key contains characters not allowed by identifier syntax
- Array indexing is not supported in v1 bindings
- If a binding path cannot be parsed or resolved under these rules, execution MUST fail deterministically

### 6.3 Resolution Rules

- Bindings for a step MUST resolve when that step is reached
- Bindings inside `returns` MUST resolve after all reachable steps complete
- Missing references in a reachable step or in `returns` MUST produce deterministic action execution failure
- Bindings in unreachable branches do not need to resolve

## 7. Condition Expressions

Conditions MUST be deterministic and side-effect free.

### 7.1 Supported Operators

- Comparison: `==`, `!=`, `>`, `<`, `>=`, `<=`
- Boolean: `&&`, `||`, `!`

### 7.2 Grammar And Precedence

Conditions use a restricted expression grammar:

```txt
expression := or_expression
or_expression := and_expression ( "||" and_expression )*
and_expression := unary_expression ( "&&" unary_expression )*
unary_expression := "!" unary_expression | comparison | "(" expression ")"
comparison := operand ( comparator operand )?
comparator := "==" | "!=" | ">" | "<" | ">=" | "<="
operand := binding | boolean | number | string_literal | null
binding := "$input" binding_path? | "$steps." identifier ".output" binding_path?
binding_path := ( "." identifier | "[" string_literal "]" )*
identifier := /[A-Za-z_][A-Za-z0-9_]*/
string_literal := JSON double-quoted string literal
```

Evaluation rules:

- Parentheses MUST be supported
- `!` binds tighter than comparison operators
- Comparison operators bind tighter than `&&`
- `&&` binds tighter than `||`
- If a referenced binding is unavailable in a reachable step condition, execution MUST fail deterministically
- String literals MUST use JSON string escaping rules
- Equality and inequality comparisons MUST compare JSON values using deep equality, without implicit type coercion
- For object equality, key order MUST NOT affect the result
- For array equality, element order MUST affect the result
- Ordering operators (`>`, `<`, `>=`, `<=`) MUST apply only to numbers; applying them to any other type MUST fail deterministically
- A bare operand used as a condition result MUST resolve to a boolean; other types MUST fail deterministically

### 7.3 Example

```txt
$steps.check.output.success == true
```

### 7.4 Restrictions

- No arbitrary scripting allowed
- No function execution allowed

## 8. Execution Semantics

### 8.1 Step Execution

For each step:

1. Evaluate condition if present
2. If false, mark the step as skipped
3. Else:
   - Resolve input
   - Validate resolved input against the callee `input_schema`
   - Execute action
   - Validate the produced output against the callee `output_schema`
   - Store output
4. After all reachable steps succeed:
   - Resolve `returns`
   - Validate final output against `output_schema`

### 8.2 Failure Behavior

- Default: fail-fast
- Any step failure causes the entire action to fail
- Any `returns` binding failure causes the entire action to fail
- Any nested input or output schema validation failure causes the entire action to fail

## 9. Idempotency

`idempotent` MUST be present and MUST be a boolean.

Semantics:

- `idempotent: true` means the runtime MAY automatically retry the action when retry is otherwise safe and appropriate
- `idempotent: false` means the runtime MUST NOT automatically retry the action

## 10. Non-Goals

This specification does NOT define:

- Transport-specific execution engine
- Scheduling
- Distributed execution
- Agent behavior
- Trace payloads

These are defined by the Action Runtime Protocol or by extensions outside this core specification.

## 11. Summary

Actions define what to execute, not when or why.

They serve as the deterministic foundation for structured execution systems.
