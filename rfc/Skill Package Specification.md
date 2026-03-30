# RFC: Skill Package Specification (v1.0.0)

## 1. Overview

This document defines the Skill Package Specification, a language-agnostic format for organizing and distributing skills and their associated actions.

This specification applies to action-based skill packages.
Non-action skills may continue to exist for compatibility, but they are outside the validity rules of this document unless explicitly adapted into this structure.

A Skill Package is the primary unit of:

- Capability definition
- Action grouping
- Workflow exposure

It combines:

- Human-readable context (`SKILL.md`)
- Structured metadata (`skill.json`)
- Executable actions (`actions/`)

## 2. Design Goals

The Skill Package MUST:

1. Be self-contained
2. Be language-independent
3. Support explicit action exposure
4. Separate documentation from execution
5. Be compatible with existing skill ecosystems

The Skill Package MUST NOT:

- Require runtime-specific implementation details
- Implicitly infer actions from scripts or docs

## 3. Directory Structure

An action-based Skill Package MUST follow this structure:

```txt
skill-package/
  SKILL.md
  skill.json
  actions/
    actions.json
    <action_name>/
      action.json
      (implementation files)
```

## 4. Components

### 4.1 SKILL.md

Purpose:

Provides human-readable context for:

- Capability description
- Usage guidance
- Best practices

Requirements:

- MUST be present
- MUST NOT be parsed as executable logic
- MAY include examples and references

### 4.2 skill.json

Purpose:

Defines structured metadata for the skill.

Structure:

```json
{
  "skill_id": "string",
  "version": "string",
  "title": "string",
  "description": "string",
  "entry_action": "action_id",
  "exposed_actions": [
    "action_id"
  ]
}
```

Field definitions:

| Field | Description |
| --- | --- |
| `skill_id` | Unique identifier |
| `version` | Skill version |
| `title` | Human-readable name |
| `description` | Short description |
| `entry_action` | Default execution entry |
| `exposed_actions` | Actions callable externally |

Rules:

- `entry_action` MUST exist in the package
- `exposed_actions` MUST reference valid actions
- `exposed_actions` SHOULD be minimal

### 4.3 actions/actions.json

Purpose:

Declares all actions included in the skill package.

Structure:

```json
{
  "actions": [
    {
      "action_id": "string",
      "path": "relative/path",
      "visibility": "public | skill | internal"
    }
  ]
}
```

Rules:

- Each `action_id` MUST be unique
- Each `path` MUST resolve to a valid action directory
- `visibility` MUST align with Action Specification

### 4.4 Action Directory

Each action MUST be defined in its own directory:

```txt
actions/
  my_action/
    action.json
    (implementation files)
```

Implementation files are optional.
For primitive actions, the executable implementation MAY live outside the package and be supplied by a runtime-global registration such as a CLI, MCP, path-based adapter, or another explicit executor binding.

### 4.5 action.json

Purpose:

Defines the action according to the Action Specification.

Example:

```json
{
  "action_id": "workflow.review_component",
  "version": "1.0.0",
  "kind": "composite",
  "title": "Review Component",
  "description": "Analyze component files and produce feedback",
  "input_schema": {
    "type": "object",
    "properties": {
      "files": {
        "type": "array",
        "items": { "type": "string" }
      }
    },
    "required": ["files"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "summary": { "type": "string" }
    }
  },
  "visibility": "public",
  "side_effect": "none",
  "idempotent": true
}
```

## 5. Action Referencing

### 5.1 Internal References

Actions within the same package MUST reference each other by `action_id`.

Composite steps MAY also reference runtime-global actions using a fully-qualified global identifier.

### 5.2 Resolution Rules

Runtime MUST:

1. Resolve unqualified `action_id` via the current package first
2. Load corresponding `action.json` for package-local actions
3. Validate consistency for package-local actions
4. Resolve fully-qualified global references via the runtime's global action registry

For unqualified identifiers used inside a skill package:

- package-local actions take precedence
- runtime-global registrations are fallback resolution only

If a selected action cannot be resolved locally or globally, the runtime MUST report an error deterministically.

## 6. Entry Action

The `entry_action` defines:

- Default execution path for the skill
- Primary workflow for the capability

Requirements:

- MUST be a valid action
- SHOULD be a composite action
- SHOULD represent the main use case
- MUST resolve within the package itself, not via a global action registry

## 7. Visibility Model

Visibility defines callable scope.

| Value | Meaning |
| --- | --- |
| `public` | Callable externally |
| `skill` | Callable only via skill |
| `internal` | Callable only within actions |

Enforcement:

Runtime MUST enforce visibility constraints.

## 8. Packaging Rules

### 8.1 Self-Containment

A skill package MUST include:

- All required action definitions
- All referenced actions

### 8.2 No Implicit Actions

Actions MUST NOT be inferred from:

- File names
- Scripts
- Documentation

All actions MUST be declared in `actions.json`.

### 8.3 External Primitive Bindings

Primitive action definitions MAY depend on executors that are not packaged in the skill itself.

Examples:

- a CLI adapter registered by path
- an MCP adapter registered in the runtime
- a host-provided primitive handler module

The package defines the contract for such actions, but not the transport-specific implementation binding.
If the runtime chooses one of these actions during execution and no binding is registered, the runtime MUST report an execution failure.

### 8.4 Multi-Package Resolution

When multiple skill packages are loaded:

- unqualified action references inside a skill MUST resolve to actions declared in that same skill package before any global fallback is attempted
- runtime-global CLI/MCP/path registrations MAY satisfy unresolved external references
- top-level unqualified action lookup MUST be deterministic; ambiguous matches MUST produce an error rather than depending on load order

## 9. Versioning

### 9.1 Skill Version

```json
{
  "version": "1.0.0"
}
```

### 9.2 Action Version

Each action MUST also define its own version.

## 10. Validation Requirements

A valid skill package MUST satisfy:

1. `skill.json` exists and is valid
2. `actions/actions.json` exists
3. All package-local actions resolve correctly
4. All unqualified package-local references exist
5. All schemas are valid JSON Schema

Validation boundary:

- package validation MUST verify package-local references such as `entry_action`, `exposed_actions`, and unqualified internal step references
- package validation MAY record fully-qualified global action references as external dependencies
- package validation MUST NOT silently infer missing local actions from implementation files or documentation

## 11. Execution Flow

When executing a skill:

1. Load `skill.json`
2. Resolve `entry_action`
3. Execute via runtime protocol

## 12. Compatibility

The Skill Package Specification is designed to:

- Extend existing skill ecosystems
- Remain backward compatible with non-action-based skills

Non-action skills MAY omit `actions/`, but such packages are outside the validity rules of this action-based specification.

## 13. Non-Goals

This specification does NOT define:

- Runtime behavior (see Action Runtime Protocol)
- Execution semantics (see Action Specification)
- Agent behavior

## 14. Summary

A Skill Package defines:

- What a capability is (`SKILL.md`)
- How it is structured (`skill.json`)
- How it executes (`actions/`)

It serves as the bridge between human-readable skills and deterministic execution.
