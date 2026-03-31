# Fast Path

Use this file for the shortest reliable route to a runnable RFC-core action skill package.

## Default Rule

For a new skill package:

1. run the local scaffold script in `scripts/bootstrap-package.sh`
2. replace the starter action ids, schemas, and workflow with the requested capability
3. validate with an explicit `--skill-package` path
4. if `action-runner` is available in the environment, prefer it for validation and execution

Do not start by reading repository source, RFC files, or installed package source.

## Scaffold Command

```bash
/Users/rien7/Github/skill-action/skills/action-skill-creator/scripts/bootstrap-package.sh \
  --target /Users/rien7/Github/skill-action/skills/my-skill \
  --skill-id my.skill \
  --title "My Skill" \
  --description "Short description of the user-facing workflow" \
  --entry-action workflow.main \
  --helper-action helper.step
```

This creates:

- `skill.json`
- one composite entry action
- one primitive helper action
- `SKILL.md` with direct execution guidance

Keep the first happy-path run lean:

- prefer `execute-skill` over exploratory reads when the public path is already known
- prefer `--trace-level none` on success-path execution
- document any workflow-defined verification input separately from CLI `--dry-run`

## First Validation Commands

```bash
skill-action-runtime validate-skill-package \
  --skill-package /Users/rien7/Github/skill-action/skills/my-skill \
  --output json
```

```bash
skill-action-runtime resolve-action \
  --skill-package /Users/rien7/Github/skill-action/skills/my-skill \
  --request-json '{"skill_id":"my.skill","action_id":"workflow.main"}' \
  --output json
```

```bash
skill-action-runtime validate-action-input \
  --skill-package /Users/rien7/Github/skill-action/skills/my-skill \
  --skill-id my.skill \
  --action-id workflow.main \
  --input-json '{"value":1}' \
  --output json
```

## When To Read More

Read [package-rules.md](package-rules.md) when:

- action graph semantics are unclear
- package boundary is ambiguous
- schema or binding behavior must be justified precisely

Read [handler-module.md](handler-module.md) when:

- you are using `--handler-module`
- primitive execution needs a local compatibility template
- you need the bundled dual-key strategy for handler registration
