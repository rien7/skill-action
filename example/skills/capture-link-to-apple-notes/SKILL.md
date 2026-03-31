---
name: 'capture-link-to-apple-notes'
description: 'Use for requests that match Fetch webpage content through r.jina.ai and save it as a new Apple Note'
---

# Capture Link To Apple Notes

Use this skill to fetch a web page through `https://r.jina.ai/` and save the fetched content into a new Apple Note.

Route matching requests directly to the public entry action `workflow.capture-link`.
Do not start with CLI help or command discovery.
If the environment includes the `action-runner` skill, use it for validation and execution instead of reconstructing CLI usage from scratch.
For normal use, do not read `skill.json` or `handlers.mjs` before the first execution. Read internals only if the public entry path fails.
Treat the `--handler-module` path as a runtime-cli-specific extension that this package uses for `curl` and `osascript` execution.

Minimal required input:

- `url`: the `http` or `https` link to capture

Optional input:

- `note_title`: override the note title instead of using the fetched content or URL
- `account_name`: target Apple Notes account name
- `folder_name`: target Apple Notes folder name
- `dry_run`: run the full workflow without creating a real note

Minimal input example:

```json
{
  "url": "https://www.example.com"
}
```

Run these commands from the repository root.
If you run them from elsewhere, replace the package and handler paths with absolute paths.

Normal execution path:

```bash
skill-action-runtime execute-skill \
  --skill-package ./example/skills/capture-link-to-apple-notes \
  --skill-id capture.link_to_apple_notes \
  --handler-module ./example/skills/capture-link-to-apple-notes/handlers.mjs \
  --trace-level none \
  --input-json '{"url":"https://www.example.com"}' \
  --output json
```

Safe verification path:

```bash
skill-action-runtime execute-skill \
  --skill-package ./example/skills/capture-link-to-apple-notes \
  --skill-id capture.link_to_apple_notes \
  --handler-module ./example/skills/capture-link-to-apple-notes/handlers.mjs \
  --trace-level none \
  --input-json '{"url":"https://www.example.com","dry_run":true}' \
  --output json
```

This package's safe verification uses the input field `dry_run`.
Do not replace it with CLI `--dry-run`, because the CLI flag skips primitive handlers and would not prove the fetch-and-create wiring.

Use `execute-action` only for helper-level debugging.
If you need more detail after a failure, rerun the same command with `--trace-level basic` or `--trace-level full`.
Expect these prerequisites before live note creation:

- macOS with Apple Notes available
- `curl` in `PATH`
- `osascript` in `PATH`
- network access to `r.jina.ai`
- Automation permission allowing the terminal session to control Notes

If execution fails, repair the package and rerun the same `execute-skill` path.
