---
name: action-skill-creator
description: Create or update an action-based skill package in this repository using the local RFCs and runtime conventions. Use when Codex needs to scaffold a new skill under `skills/`, migrate a legacy skill into `SKILL.md + skill.json + actions/actions.json + actions/*/action.json`, define `entry_action` and `exposed_actions`, or fix package layout and metadata for an existing action skill.
---

# Action Skill Creator

## Overview

Create complete skill packages that match the local Action, Skill Package, and Runtime RFCs.
Keep the package explicit, deterministic, and minimal so the runtime can load it without guessing.

## Workflow

1. Inspect the repository context before writing files.
2. Read [references/package-checklist.md](references/package-checklist.md) for the required package shape and local conventions.
3. Read the root RFCs only when the task needs exact wording or deeper protocol detail:
   - `../../Skill Package Specification.md`
   - `../../Action Specification.md`
   - `../../Action Runtime Protocol.md`
4. Decide the skill boundary:
   - Keep the skill as the distribution and entrypoint unit.
   - Keep actions as the execution units.
   - Avoid mixing unrelated workflows into one skill package.
   - If the package boundary is ambiguous, stop and ask targeted questions before writing files.
   - Confirm which flows belong in one skill, which should be split, and which actions must stay package-local versus runtime-global.
5. Confirm the action graph before scaffolding:
   - What is the `entry_action`?
   - Which actions are intentionally exposed?
   - Which actions are helpers only?
   - Where do primitive executors actually live if they are not packaged in the skill?
6. Confirm parameter flow across actions:
   - Every composite `with` binding must match the callee `input_schema`.
   - Every `$steps.<step_id>.output.*` reference must be supported by the producer's `output_schema`.
   - Decide whether the workflow needs explicit `returns` instead of relying on compatibility fallback.
   - If any parameter contract is unclear, ask before inventing fields or implicit mappings.
7. Create or update these files together:
   - `SKILL.md`
   - `skill.json`
   - `actions/actions.json`
   - one or more `actions/<action-name>/action.json`
8. Make `entry_action` point at the main workflow.
9. Keep `exposed_actions` minimal and intentionally chosen.
10. Validate that every referenced action exists and every action in the manifest resolves to a real directory.

## Authoring Rules

- Use lowercase hyphen-case for the skill folder name.
- Keep YAML frontmatter limited to `name` and `description`.
- Write the body in imperative form.
- Describe what the skill does in human terms in `SKILL.md`, but keep execution logic in action definitions.
- Prefer one public composite `entry_action` for the main workflow.
- Use `skill` or `internal` visibility for helper actions unless there is a real external use case.
- Do not rely on implicit discovery; declare everything explicitly in `actions/actions.json`.
- Do not blur package boundaries just because actions share implementation details.
- Do not assume action-to-action parameter compatibility; verify schemas and bindings explicitly.
- Prefer explicit composite `returns` when the final output should be stable or user-facing.

## Output Checklist

Before finishing, confirm all of the following:

- The package directory lives under `skills/`.
- `skill.json` has a stable `skill_id`, `version`, `title`, `description`, `entry_action`, and `exposed_actions`.
- `actions/actions.json` declares every action exactly once.
- Every `action.json` uses valid `kind`, `visibility`, `side_effect`, and `idempotent` values.
- Composite actions use ordered `steps` with explicit `with` bindings.
- The skill boundary and exposed surface still match the requested workflow boundary.
- Every action-to-action handoff has a checked input/output contract.
- Composite outputs use explicit `returns` when compatibility fallback would be ambiguous.
- Input and output schemas are present and JSON Schema-compatible.
- The package naming and file layout match the RFC.

## Validation

Run the local validator after substantial edits:

```bash
python3 /Users/rien7/.codex/skills/.system/skill-creator/scripts/quick_validate.py <path-to-skill>
```

If the skill also ships runnable actions or runtime-facing examples, run the relevant repo checks before finishing.

## Notes

- Keep the skill package focused. If a requested capability is only one reusable operation, prefer creating or updating an action inside an existing skill instead of inventing a new skill.
- When the task is mainly about authoring one action, switch to or also use `action-creator`.
