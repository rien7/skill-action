# Package Checklist

Use this file when creating or reviewing a full action-based skill package.

## Required Files

```txt
<skill-folder>/
  SKILL.md
  skill.json
  actions/
    <action-name>/
      action.json
```

## Local Conventions

- Keep skills under the repository `skills/` folder.
- Treat the skill as the distribution unit and actions as execution units.
- Prefer a composite `entry_action` for the main workflow.
- Do not infer actions from filenames, scripts, or docs.
- If `action-runner` is available in the environment, prefer it for validation and execution.

## `skill.json` Checklist

- `skill_id` is stable and specific.
- `title` is human-readable.
- `description` is short and accurate.
- `entry_action` exists in the package.
- `entry_action` is package-local.

## Design Guidance

- Use one skill when actions belong to the same user-facing capability.
- Split skills when capabilities would otherwise share only infrastructure and not workflow.
- Keep explicit boundaries between package metadata, action definitions, and runtime behavior.
- Make the package immediately usable by a later agent:
  - `SKILL.md` should map matching requests to the public workflow directly
  - `SKILL.md` should name the `entry_action`
  - `SKILL.md` should give a minimal valid input example
  - `SKILL.md` should say whether normal execution should use `execute-skill` or another path
  - `SKILL.md` should prefer `action-runner` when that skill is available
  - `SKILL.md` should list platform or permission prerequisites
- Do not add `handlers.*` by default for RFC-core packages.
- If the package deliberately uses a runtime-cli-specific `handlers.*` extension:
  - export `primitiveHandlers`
  - use the exact key format required by the current runtime source
  - make sure each key uses the package `skill_id` and primitive `action_id` verbatim
  - mark the path as implementation-specific rather than RFC-core behavior
- Confirm the package boundary before scaffolding:
  - what belongs in this skill
  - what should stay in another skill or in runtime-global registrations
- Check every action handoff:
  - the caller's `with` bindings satisfy the callee's `input_schema`
  - referenced step outputs exist in the producer's `output_schema`
  - composite `returns` is present and matches `output_schema`
  - nested `steps[].action` references stay package-local
- Prove the executable path, not just the package shape:
  - validate the package
  - resolve the public action
  - validate a minimal happy-path input
  - execute through the real public entry path when safely possible
  - do not treat `--dry-run` as proof for composite workflows that need primitive outputs for downstream bindings
  - do not dismiss a concrete runtime error as an environment caveat when the response identifies a missing handler, bad binding, or code-level failure
  - if execution fails, repair the package and rerun before considering the skill complete
