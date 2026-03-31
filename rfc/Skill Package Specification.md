# RFC: Skill Package Specification (v1.0.0)

## 1. Overview

This document defines the Skill Package Specification, a language-agnostic format for organizing and distributing skills and their associated actions.

This specification applies to action-based skill packages.
Non-action skills may continue to exist for compatibility, but they are outside the validity rules of this document unless explicitly adapted into this structure.

A Skill Package is the primary unit of:

- Capability definition
- Action grouping
- Workflow entry

It combines:

- Agent-readable capability overview (`SKILL.md`)
- Structured metadata (`skill.json`)
- Executable actions (`actions/`)

## 2. Design Goals

The Skill Package MUST:

1. Be self-contained for package-local actions
2. Be language-independent
3. Support an explicit workflow entry point
4. Separate agent guidance from executable definitions
5. Be compatible with existing skill ecosystems

The Skill Package MUST NOT:

- Require runtime-specific implementation details
- Implicitly infer actions from scripts or docs
- Manage external runtime dependencies in package metadata

In this specification, "self-contained" means the package fully declares:

- its package-local actions
- its package entry action

It does not require the package to declare external primitive bindings.

## 3. Directory Structure

An action-based Skill Package MUST follow this structure:

```txt
skill-package/
  SKILL.md
  skill.json
  actions/
    <action_name>/
      action.json
      (implementation files)
```

## 4. Components

### 4.1 SKILL.md

Purpose:

Provides a high-precision overview intended to be read by an agent before selecting or invoking actions.
Its primary goal is retrieval accuracy and execution guidance, not prose readability for humans.

It SHOULD cover:

- Capability description
- Invocation guidance
- Constraints and decision boundaries
- Usage patterns that help the agent choose the right action path

Requirements:

- MUST be present
- MUST NOT be parsed as executable logic
- SHOULD prioritize precise, low-ambiguity wording over narrative prose
- SHOULD align with `skill.json`, declared actions, and actual runtime behavior
- SHOULD avoid restating action contracts that already live in structured manifests unless needed for agent routing
- MAY include examples and references when they improve execution accuracy

### 4.2 skill.json

Purpose:

Defines structured metadata for the skill.

Structure:

```json
{
  "skill_id": "string",
  "title": "string",
  "description": "string",
  "entry_action": "action_id"
}
```

Field optionality conventions:

- Unless explicitly marked optional, every field shown in `skill.json` MUST be present
- Optional fields MAY be omitted; if omitted, the behavior defined for that field applies
- `null` is not implied by optionality; fields are non-null unless explicitly declared nullable

Identifier rules:

- `skill_id` MUST be a non-empty, case-sensitive string
- `skill_id` equality MUST use exact string equality; tooling and runtimes MUST NOT trim, case-fold, or Unicode-normalize identifiers before comparison

Field definitions:

| Field | Description |
| --- | --- |
| `skill_id` | Unique identifier |
| `title` | Stable display name for catalogs and user-facing metadata |
| `description` | Stable summary for catalogs and user-facing metadata |
| `entry_action` | Default execution entry |

Rules:

- `entry_action` MUST exist in the package
- `title` and `description` SHOULD remain stable metadata and MUST NOT be treated as the primary agent-routing surface; `SKILL.md` is the primary agent-facing guidance document
- `entry_action` and package-local action references MUST compare `action_id` values using the exact identifier rules defined in the Action Specification

### 4.3 Action Directory

Each action MUST be defined in its own directory:

```txt
actions/
  my_action/
    action.json
    (implementation files)
```

Action discovery rules:

- A package-local action exists only when a directory under `actions/` contains `action.json`
- `actions/` MAY contain helper directories that are not actions
- Validators and runtimes MUST ignore subdirectories under `actions/` that do not contain `action.json`
- Tooling and runtimes MUST NOT infer actions from filenames, scripts, or `SKILL.md`

Implementation files are optional.
Implementation files are non-normative in the core package format; their presence alone MUST NOT cause a validator or runtime to infer an executable binding.
For primitive actions, the executable implementation MAY live inside or outside the package.
Primitive binding resolution is runtime behavior and is not described by package metadata.

### 4.4 action.json

Purpose:

Defines the action according to the Action Specification.

Example:

```json
{
  "action_id": "workflow.review_component",
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
  "idempotent": true
}
```

## 5. Action Referencing

### 5.1 Internal References

Actions within the same package MUST reference each other by `action_id`.

Package-to-package action calls are not part of this core specification.
Composite steps inside a skill package MUST use package-local `action_id` values only.

### 5.2 Resolution Rules

Runtime MUST:

1. Resolve unqualified `action_id` via the current package
2. Load the corresponding `action.json` for package-local actions
3. Validate consistency for package-local actions

If a selected package-local action cannot be resolved, the runtime MUST report an error deterministically.

## 6. Entry Action

The `entry_action` defines:

- Default execution path for the skill
- Primary workflow for the capability

Requirements:

- MUST be a valid package-local action
- SHOULD represent the main use case

## 7. Top-Level Addressing

Top-level callers address a package action through the Action Runtime Protocol using `skill_id` and `action_id`.

`execute_skill` always invokes `entry_action`.

## 8. Packaging Rules

### 8.1 Self-Containment

A skill package MUST include:

- All required local action definitions
- All referenced package-local actions

### 8.2 No Implicit Actions

Actions MUST NOT be inferred from:

- File names without `action.json`
- Scripts
- Documentation

### 8.3 Primitive Bindings

Primitive action implementations MAY depend on runtime-provided bindings that are not packaged in the skill itself.

The package defines the action contract, but not the binding configuration.
Skill package metadata MUST NOT declare or manage external primitive bindings.
If the runtime reaches a primitive action and no valid environment-provided binding exists, execution MUST fail.

### 8.4 Multi-Package Resolution

When multiple skill packages are loaded:

- `skill_id` lookup MUST be deterministic
- duplicate `skill_id` values MUST be rejected or reported as ambiguous by the runtime
- package-local action references inside a skill MUST resolve only within that same skill package

## 9. Validation Requirements

A valid skill package MUST satisfy:

1. `skill.json` exists and is valid
2. `actions/` exists
3. Every discovered package-local action directory contains `action.json`
4. All package-local action identifiers are unique within the package
5. All package-local references exist
6. All schemas are valid JSON Schema Draft 2020-12
7. Every composite action defines an explicit `returns` object
8. Every composite action defines an `output_schema` for a JSON object
9. Every composite action defines at least one step

Validation boundary:

- package validation MUST verify package-local references such as `entry_action` and unqualified internal step references
- package validation MUST verify that every composite action defines `returns`
- package validation MUST verify that every composite action `output_schema` describes a JSON object
- package validation MUST verify that every composite action `steps` array contains at least one step
- package validation MUST validate `input_schema` and `output_schema` against JSON Schema Draft 2020-12
- package validation MUST ignore subdirectories under `actions/` that do not contain `action.json`
- package validation MUST NOT silently infer missing local actions from implementation files or `SKILL.md`
- package validation MUST compare `skill_id` and `action_id` values using the exact identifier rules defined by this specification and the Action Specification

## 10. Execution Flow

When executing a skill:

1. Load `skill.json`
2. Resolve `entry_action`
3. Execute via the Action Runtime Protocol

## 11. Compatibility

The Skill Package Specification is designed to:

- Extend existing skill ecosystems
- Remain backward compatible with non-action-based skills

Non-action skills MAY omit `actions/`, but such packages are outside the validity rules of this action-based specification.

## 12. Non-Goals

This specification does NOT define:

- Runtime behavior beyond package loading and package-local resolution
- Execution semantics beyond what is defined in the Action Specification
- Agent behavior
- External dependency management

## 13. Summary

A Skill Package defines:

- How an agent should understand and route the capability (`SKILL.md`)
- How it is identified (`skill.json`)
- Which package-local actions exist (`actions/`)
- Which action is the workflow entry (`entry_action`)

It serves as the bridge between agent-readable capability guidance and deterministic execution.
