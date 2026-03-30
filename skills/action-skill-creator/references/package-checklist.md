# Package Checklist

Use this file when creating or reviewing a full action-based skill package.

## Required Files

```txt
<skill-folder>/
  SKILL.md
  skill.json
  actions/
    actions.json
    <action-name>/
      action.json
```

## Local Conventions

- Keep skills under the repository `skills/` folder.
- Treat the skill as the distribution unit and actions as execution units.
- Prefer an exposed composite `entry_action` for the main workflow.
- Keep helper actions `skill` or `internal` unless there is a concrete external call path.
- Declare every action in `actions/actions.json`; do not infer actions from files.

## `skill.json` Checklist

- `skill_id` is stable and specific.
- `version` starts at `1.0.0` unless the task says otherwise.
- `title` is human-readable.
- `description` is short and accurate.
- `entry_action` exists in the package.
- `exposed_actions` is minimal.

## `actions/actions.json` Checklist

- Each `action_id` is unique.
- Each `path` resolves to a real action directory.
- `visibility` matches the action's own `action.json`.

## Design Guidance

- Use one skill when actions belong to the same user-facing capability.
- Split skills when capabilities would otherwise share only infrastructure and not workflow.
- Keep explicit boundaries between package metadata, action definitions, and runtime behavior.
- Confirm the package boundary before scaffolding:
  - what belongs in this skill
  - what should stay in another skill or in runtime-global registrations
  - which actions are externally callable versus helper-only
- Check every action handoff:
  - the caller's `with` bindings satisfy the callee's `input_schema`
  - referenced step outputs exist in the producer's `output_schema`
  - explicit `returns` is used when the final output contract needs to be stable
