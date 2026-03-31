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
- Remember that the loader reads action directories directly, but the CLI validator also checks the manifest.

## `skill.json` Checklist

- `skill_id` is stable and specific.
- `title` is human-readable.
- `description` is short and accurate.
- `entry_action` exists in the package.
- `entry_action` is package-local.
- `exposed_actions` is minimal and intentional.

The runtime schema makes `version` optional and defaults `exposed_actions` to `[]`.
In this repo, prefer including both explicitly so the package surface stays stable.

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
  - composite `returns` is present and matches `output_schema`
  - nested `steps[].action` references stay package-local
