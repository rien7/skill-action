# RFC: Action Runtime Protocol (v1.0.0)

## 1. Overview

This document defines the Action Runtime Protocol, a language-agnostic interface for executing actions defined in the Action Specification.

The runtime is responsible for:

- Resolving actions and skills
- Validating inputs
- Executing actions deterministically
- Producing structured outputs and traces

## 2. Design Principles

The runtime MUST:

- Be deterministic
- Be stateless per request (unless explicitly extended)
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
- RPC / gRPC
- CLI (stdin/stdout)

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

On failure:

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  },
  "meta": {}
}
```

## 5. Core Interfaces

### 5.1 Resolve Action

`POST /resolve_action`

Request:

```json
{
  "action_id": "string",
  "version": "optional"
}
```

### 5.2 Execute Action

`POST /execute_action`

Request:

```json
{
  "action_id": "string",
  "input": {},
  "options": {}
}
```

Response data:

```json
{
  "execution_id": "string",
  "status": "succeeded | failed",
  "output": {},
  "trace": {}
}
```

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

Behavior:

- Resolve skill
- Execute its `entry_action`

### 5.4 Validate Input

`POST /validate_action_input`

Request:

```json
{
  "action_id": "string",
  "input": {}
}
```

## 6. Execution Options

```json
{
  "dry_run": false,
  "trace_level": "none | basic | full",
  "timeout_ms": 30000,
  "max_depth": 20,
  "max_steps": 200
}
```

## 7. Execution Result

```json
{
  "execution_id": "string",
  "status": "succeeded | failed",
  "output": {},
  "trace": {},
  "started_at": "RFC3339",
  "finished_at": "RFC3339"
}
```

## 8. Trace Format

```json
{
  "steps": [
    {
      "step_id": "string",
      "action_id": "string",
      "status": "succeeded | failed | skipped",
      "input": {},
      "output": {},
      "error": null,
      "started_at": "",
      "finished_at": ""
    }
  ]
}
```

## 9. Error Model

### 9.1 Resolve Errors

- `ACTION_NOT_FOUND`
- `VERSION_NOT_FOUND`

### 9.2 Validation Errors

- `INVALID_INPUT`
- `SCHEMA_VALIDATION_FAILED`

### 9.3 Execution Errors

- `STEP_EXECUTION_FAILED`
- `ACTION_EXECUTION_FAILED`
- `TIMEOUT_EXCEEDED`
- `MAX_DEPTH_EXCEEDED`
- `MAX_STEPS_EXCEEDED`

### 9.4 Policy Errors

- `VISIBILITY_VIOLATION`
- `ACTION_NOT_CALLABLE`

## 10. Execution Semantics

### 10.1 Deterministic Execution

- Steps MUST execute in order
- No implicit reordering allowed

### 10.2 Condition Evaluation

- MUST evaluate before execution
- MUST NOT have side effects

### 10.3 Failure Handling

- Default: fail-fast
