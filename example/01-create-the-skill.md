# Example 1: Create the Skill

This document turns the original creation rollout into a short, human-readable walkthrough.

## Goal

Create a skill that:

- accepts a web link as input
- fetches page content through `https://r.jina.ai/<url>`
- inserts the fetched content into Apple Notes through AppleScript

## Request

The starting request was:

> create a skill with `action-skill-creator`, accept a link as input, fetch the web content through `curl "https://r.jina.ai/<url>"`, then use AppleScript to insert the content into Apple Notes

## What Was Generated

The resulting package lives under [`skills/capture-link-to-apple-notes/`](./skills/capture-link-to-apple-notes).

It contains:

- [`skill.json`](./skills/capture-link-to-apple-notes/skill.json): package metadata
- [`SKILL.md`](./skills/capture-link-to-apple-notes/SKILL.md): routing and execution guidance for later agents
- [`actions/workflow-capture-link/action.json`](./skills/capture-link-to-apple-notes/actions/workflow-capture-link/action.json): the public composite entry action
- [`actions/web-fetch-content/action.json`](./skills/capture-link-to-apple-notes/actions/web-fetch-content/action.json): fetches page content through `r.jina.ai`
- [`actions/notes-create-note/action.json`](./skills/capture-link-to-apple-notes/actions/notes-create-note/action.json): creates the Apple Note
- [`handlers.mjs`](./skills/capture-link-to-apple-notes/handlers.mjs): runtime handler module for the two primitive actions

## Skill Surface

The generated skill exposes:

- `skill_id`: `capture.link_to_apple_notes`
- `entry_action`: `workflow.capture-link`
- required input: `url`
- optional input: `note_title`, `account_name`, `folder_name`, `dry_run`

## Action Graph

The package uses one public composite action plus two package-local primitive actions:

1. `workflow.capture-link`
2. `web.fetch-content`
3. `notes.create-note`

At a high level:

- the workflow accepts the user request
- the fetch action downloads the page content through `r.jina.ai`
- the note action inserts the fetched content into Apple Notes

## Validation Path

Before treating the package as complete, the rollout validated it through the runtime CLI:

- `validate-skill-package`
- `resolve-action`
- `validate-action-input`
- `execute-action` on the fetch helper
- `execute-skill` with a safe input such as `{"url":"https://www.example.com","dry_run":true}`

That validation path matters because it proves more than package shape:

- the manifests resolve correctly
- the helper action wiring is valid
- the public entry action can run end to end
- the workflow can be proven safely before creating a real note

## Result

By the end of the creation rollout, the repository had a runnable skill package that could already:

- fetch real web content
- derive a note title from the fetched page
- support a safe verification mode through `dry_run`
- expose a later reusable public workflow through `execute-skill`

The skill created in this example is the same one used in the second walkthrough: [`02-use-the-skill.md`](./02-use-the-skill.md).
