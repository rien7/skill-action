# RFC: Action Runtime Protocol (v1.0.0)

## 1. Overview

This document defines the Action Runtime Protocol, a language-agnostic interface for executing actions defined in the Action Specification.

The runtime is responsible for:

- Resolving skills and actions
- Validating inputs
- Executing actions deterministically
- Returning structured execution results

## 2. Design Principles

The runtime MUST:

- Be deterministic
- Be stateless per request unless explicitly extended
- Use structured request/response formats
- Avoid agent-level reasoning

The runtime MUST NOT:

- Perform planning
- Generate workflows dynamically
- Discover capabilities implicitly

## 3. Transport

The protocol is transport-agnostic and MAY be implemented over:

- Function calls
- HTTP
- RPC or gRPC
- CLI using stdin and stdout

All payloads MUST be JSON-compatible.

## 4. Common Response Format

All responses MUST follow:

```json
{
  "ok": true,
  "data": {},
  "error": null,
  "meta": {
    "request_id": "string",
    "spec_version": "1.0.0"
  }
}
```

Protocol-level failure MUST follow:

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  },
  "meta": {
    "request_id": "string",
    "spec_version": "1.0.0"
  }
}
```

Protocol-level failure means the request did not successfully enter execution. Examples include:

- skill or action resolution failure
- request validation failure
- schema compilation failure

For `execute_action` and `execute_skill`, once execution has started, the runtime MUST return `ok: true` with an `Execution Result` in `data`, even if execution later fails.
In that case, execution failure is represented by `data.status: "failed"`.
The outer `error` field is reserved for protocol-level failure.

### 4.1 Field Optionality Conventions

- Unless explicitly marked optional, every field shown in a request or response object MUST be present
- Optional fields MAY be omitted; if omitted, the runtime MUST apply the behavior defined for that field
- `null` is distinct from omission; a field is nullable only when the specification explicitly says it MAY be `null`
- In the common response envelope, exactly one of `data` or `error` MUST be non-null

## 5. Core Interfaces

### 5.1 Resolve Action

`POST /resolve_action`

Request:

```json
{
  "skill_id": "string",
  "action_id": "string"
}
```

Field semantics:

- `skill_id` MUST be present
- `action_id` MUST be present

Response data:

```json
{
  "skill_id": "string",
  "action_id": "string",
  "kind": "primitive | composite"
}
```

Response field semantics:

- `skill_id`, `action_id`, and `kind` MUST be present

### 5.2 Execute Action

`POST /execute_action`

Request:

```json
{
  "skill_id": "string",
  "action_id": "string",
  "input": {},
  "options": {}
}
```

Field semantics:

- `skill_id` MUST be present
- `action_id` MUST be present
- `input` MAY be omitted; if omitted, it defaults to an empty object
- `options` MAY be omitted; if omitted, runtime defaults apply

Response envelope:

```json
{
  "ok": true,
  "data": {
    "execution_id": "string",
    "status": "succeeded | failed",
    "output": {},
    "started_at": "RFC3339",
    "finished_at": "RFC3339"
  },
  "error": null,
  "meta": {
    "request_id": "string",
    "spec_version": "1.0.0"
  }
}
```

If execution cannot start, the runtime MUST return a protocol-level failure response instead.

### 5.3 Execute Skill

`POST /execute_skill`

Request:

```json
{
  "skill_id": "string",
  "input": {},
  "options": {}
}
```

Field semantics:

- `skill_id` MUST be present
- `input` MAY be omitted; if omitted, it defaults to an empty object
- `options` MAY be omitted; if omitted, runtime defaults apply

Behavior:

- Resolve skill
- Execute its `entry_action`

Response semantics:

- If skill resolution and execution startup succeed, return `ok: true` with `Execution Result` in `data`
- If the skill execution later fails, return `ok: true` and set `data.status` to `failed`
- If the request cannot enter execution, return a protocol-level failure response

### 5.4 Validate Input

`POST /validate_action_input`

Request:

```json
{
  "skill_id": "string",
  "action_id": "string",
  "input": {}
}
```

Field semantics:

- `skill_id` MUST be present
- `action_id` MUST be present
- `input` MUST be present

Response data:

```json
{
  "valid": true,
  "skill_id": "string",
  "action_id": "string"
}
```

Response field semantics:

- `valid` MUST be present and MUST equal `true` on success
- `skill_id` and `action_id` MUST identify the action definition used for validation
- If validation fails, the runtime MUST return a protocol-level failure rather than `valid: false`

## 6. Resolution Model

The runtime MUST load action definitions from skill packages.

Resolution rules:

- Loaded skill packages MUST be uniquely identifiable by exact `skill_id`
- If the runtime cannot uniquely identify a loaded skill package for a requested `skill_id`, it MUST return `SKILL_RESOLUTION_AMBIGUOUS`
- For top-level requests, the runtime MUST resolve `skill_id` first and MUST then resolve `action_id` only within that package
- For nested action calls inside a skill, unqualified action identifiers MUST resolve only within the current skill package
- If the addressed package does not contain the requested `action_id`, the runtime MUST return `ACTION_NOT_FOUND` before execution starts for top-level requests, or fail execution deterministically for nested calls
- Package-scoped resolved action identity is the tuple `(skill_id, action_id)`
- Skill identifier equality MUST use exact string equality; runtimes MUST NOT trim, case-fold, or Unicode-normalize `skill_id` values before comparison
- Action identifier equality MUST use exact string equality; runtimes MUST NOT trim, case-fold, or Unicode-normalize `action_id` values before comparison

Primitive binding rules:

- Primitive binding configuration MUST come from environment variables supplied to the runtime
- The exact environment variable names and value format are runtime-defined and outside this core specification
- Primitive binding lookup MUST be keyed by the resolved package action identity
- If a primitive action is reached and no valid binding is available from the runtime environment, execution MUST fail with `PRIMITIVE_BINDING_NOT_FOUND`
- Cross-runtime portability of primitive binding configuration is not guaranteed by this core specification

## 7. Execution Options

```json
{
  "timeout_ms": 30000,
  "max_depth": 20,
  "max_steps": 200
}
```

Field semantics:

- Each execution option MAY be omitted; if omitted, the runtime MUST apply the default shown above
- `timeout_ms` applies only after execution has started, meaning after root resolution and root input validation succeed
- `max_depth` counts action invocation depth
- The root action invocation MUST have depth `0`
- Each nested action invocation MUST increase depth by exactly `1`
- The runtime MUST reject the next nested invocation before execution when it would make depth exceed `max_depth`
- `max_steps` counts reached composite steps, including failed and skipped steps
- The runtime MUST increment the step count when a composite step becomes reached, after condition evaluation determines that the step is either skipped or will execute
- The root action invocation does not itself count as a step
- The runtime MUST fail before executing the next reached step when doing so would make the total reached step count exceed `max_steps`
- If `timeout_ms` is exceeded after execution has started, the runtime MUST return `ok: true` with `data.status: "failed"`

## 8. Execution Result

`Execution Result` is the payload returned in `data` for successful execution startup of `execute_action` and `execute_skill`.
It represents both successful and failed executions after the runtime has entered execution.

```json
{
  "execution_id": "string",
  "status": "succeeded | failed",
  "output": {},
  "started_at": "RFC3339",
  "finished_at": "RFC3339"
}
```

Field semantics:

- `execution_id`, `status`, `started_at`, and `finished_at` MUST be present
- `status: "succeeded"` means execution completed successfully
- `status: "failed"` means execution started but failed during execution
- `output` MUST be present when `status` is `succeeded`
- `output` MAY be partial, `null`, or omitted when `status` is `failed`, but the result object itself MUST still be returned

## 9. Trace Extension

Trace payloads and trace-related execution options are not part of this core specification.

Runtimes MAY provide tracing as an extension, but a conforming core implementation MUST NOT require trace support in order to execute actions correctly.

## 10. Error Model

### 10.1 Resolve Errors

These are protocol-level errors.

- `ACTION_NOT_FOUND`
- `SKILL_NOT_FOUND`
- `SKILL_RESOLUTION_AMBIGUOUS`

### 10.2 Validation Errors

These are protocol-level errors.

- `INVALID_INPUT`
- `SCHEMA_COMPILATION_FAILED`
- `SCHEMA_VALIDATION_FAILED`

Semantics:

- `SCHEMA_COMPILATION_FAILED` means the runtime could not compile or prepare an action `input_schema` or `output_schema`
- `SCHEMA_VALIDATION_FAILED` means a compiled root action input schema rejected the provided request input before execution started
- Nested input or output schema validation failures are execution-result failures and MUST NOT be reported as protocol-level `SCHEMA_VALIDATION_FAILED`

### 10.3 Execution Errors

These are execution-result errors.
For `execute_action` and `execute_skill`, they MUST be represented by `ok: true`, `data.status: "failed"`, and execution details in `data`.

- `INVALID_CONDITION`
- `STEP_EXECUTION_FAILED`
- `ACTION_EXECUTION_FAILED`
- `PRIMITIVE_BINDING_NOT_FOUND`
- `TIMEOUT_EXCEEDED`
- `MAX_DEPTH_EXCEEDED`
- `MAX_STEPS_EXCEEDED`

Examples include:

- a reachable step contains an unresolved binding
- a reachable nested action cannot be resolved after execution has started
- a primitive action has no valid environment-provided binding
- a composite `returns` mapping cannot be resolved
- a step output fails schema validation

### 10.4 Failure Boundary

Protocol-level failure applies only before execution starts. This includes:

- root skill or action resolution
- root input validation
- schema compilation failure
- package loading failure that prevents entry into execution

Execution-result failure applies after execution starts. This includes:

- condition parsing or evaluation failure
- reachable binding resolution failure
- nested action resolution failure
- missing primitive binding
- output validation failure
- timeout and step or depth limit failures

## 11. Execution Semantics

### 11.1 Deterministic Execution

- Steps MUST execute in order
- No implicit reordering is allowed

### 11.2 Input And Output Validation

- Before any action invocation, the runtime MUST validate the effective input against the callee `input_schema`
- For root `execute_action` and `execute_skill` requests, input validation failure is a protocol-level failure because execution has not started yet
- For nested action invocations, input validation failure MUST be reported as an execution-result failure because execution has already started
- After any successful action invocation, the runtime MUST validate the produced output against the callee `output_schema` before storing or returning it as successful output
- Nested output validation failure MUST be reported as an execution-result failure

### 11.3 Failure Handling

- Default: fail-fast
- After execution starts, failure MUST produce an `Execution Result` with `status: "failed"` rather than a protocol-level failure envelope
