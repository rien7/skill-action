#!/usr/bin/env bash

set -euo pipefail

target_dir=""
skill_id=""
title=""
description=""
entry_action="workflow.main"
helper_action="helper.step"

json_string() {
  node -p 'JSON.stringify(process.argv[1])' "$1"
}

yaml_single_quote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/''/g")"
}

usage() {
  cat <<'EOF'
Usage:
  bootstrap-package.sh \
    --target /abs/path/to/skills/my-skill \
    --skill-id my.skill \
    --title "My Skill" \
    --description "Short description" \
    [--entry-action workflow.main] \
    [--helper-action helper.step]

Creates a minimal valid action-skill package with one public composite entry action
and one primitive helper action.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      target_dir="${2:-}"
      shift 2
      ;;
    --skill-id)
      skill_id="${2:-}"
      shift 2
      ;;
    --title)
      title="${2:-}"
      shift 2
      ;;
    --description)
      description="${2:-}"
      shift 2
      ;;
    --entry-action)
      entry_action="${2:-}"
      shift 2
      ;;
    --helper-action)
      helper_action="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$target_dir" || -z "$skill_id" || -z "$title" || -z "$description" ]]; then
  usage >&2
  exit 1
fi

if [[ "$target_dir" != /* ]]; then
  printf 'Target must be an absolute path: %s\n' "$target_dir" >&2
  exit 1
fi

if [[ -e "$target_dir" ]]; then
  printf 'Target already exists: %s\n' "$target_dir" >&2
  exit 1
fi

entry_dir="$(printf '%s' "$entry_action" | tr '.' '-')"
helper_dir="$(printf '%s' "$helper_action" | tr '.' '-')"

skill_id_json="$(json_string "$skill_id")"
title_json="$(json_string "$title")"
description_json="$(json_string "$description")"
entry_action_json="$(json_string "$entry_action")"
helper_action_json="$(json_string "$helper_action")"
entry_dir_json="$(json_string "$entry_dir")"
helper_dir_json="$(json_string "$helper_dir")"
skill_name_yaml="$(yaml_single_quote "$(basename "$target_dir")")"
skill_description_yaml="$(yaml_single_quote "Use for requests that match $description")"

mkdir -p "$target_dir/actions/$entry_dir" "$target_dir/actions/$helper_dir"

cat >"$target_dir/skill.json" <<EOF
{
  "skill_id": $skill_id_json,
  "title": $title_json,
  "description": $description_json,
  "entry_action": $entry_action_json
}
EOF

cat >"$target_dir/actions/$helper_dir/action.json" <<EOF
{
  "action_id": $helper_action_json,
  "kind": "primitive",
  "title": "Helper Step",
  "description": "Starter primitive action. Replace this contract with the real helper behavior.",
  "input_schema": {
    "type": "object",
    "properties": {
      "value": {
        "type": "number"
      }
    },
    "required": ["value"],
    "additionalProperties": false
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "value": {
        "type": "number"
      }
    },
    "required": ["value"],
    "additionalProperties": false
  },
  "idempotent": true
}
EOF

cat >"$target_dir/actions/$entry_dir/action.json" <<EOF
{
  "action_id": $entry_action_json,
  "kind": "composite",
  "title": $title_json,
  "description": $description_json,
  "input_schema": {
    "type": "object",
    "properties": {
      "value": {
        "type": "number"
      }
    },
    "required": ["value"],
    "additionalProperties": false
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "value": {
        "type": "number"
      }
    },
    "required": ["value"],
    "additionalProperties": false
  },
  "idempotent": true,
  "steps": [
    {
      "id": "runHelper",
      "action": $helper_action_json,
      "with": {
        "value": "\$input.value"
      }
    }
  ],
  "returns": {
    "value": "\$steps.runHelper.output.value"
  }
}
EOF

cat >"$target_dir/SKILL.md" <<EOF
---
name: $skill_name_yaml
description: $skill_description_yaml
---

# $(printf '%s' "$title")

Use this skill when the request matches the package capability described in \`skill.json\`.

Route matching requests directly to the public entry action \`$entry_action\`.
Do not start with CLI help or command discovery.
If the environment includes the \`action-runner\` skill, use it for validation and execution instead of reconstructing CLI usage from scratch.
For normal use, do not read \`skill.json\` or implementation files before the first execution. Read internals only if the public entry path fails.

Minimal input example:

\`\`\`json
{
  "value": 1
}
\`\`\`

Normal execution path:

\`\`\`bash
skill-action-runtime execute-skill \\
  --skill-package $target_dir \\
  --skill-id $(printf '%s' "$skill_id") \\
  --trace-level none \\
  --input-json '{"value":1}' \\
  --output json
\`\`\`

Use \`execute-action\` only for helper-level debugging.
If the package later adds a workflow-defined verification input such as \`dry_run\`, document it separately from CLI \`--dry-run\` because the CLI flag skips primitive handlers.
If you need more detail after a failure, rerun the same command with \`--trace-level basic\` or \`--trace-level full\`.
If execution fails, repair the package and rerun the same \`execute-skill\` path.
EOF

printf 'Created package: %s\n' "$target_dir"
