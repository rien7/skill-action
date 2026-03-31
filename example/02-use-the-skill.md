# Example 2: Use the Generated Skill

This document turns the original usage rollout into a short, human-readable walkthrough.

## Goal

Use the generated `capture-link-to-apple-notes` skill to save a real web page into Apple Notes.

## Request

The usage request was:

> use `capture-link-to-apple-notes` to save this page: `https://openai.com/index/our-approach-to-the-model-spec/`

## Execution Path

The skill is designed to route matching requests directly to its public entry action:

- `skill_id`: `capture.link_to_apple_notes`
- `entry_action`: `workflow.capture-link`

In this example, the runtime path is:

1. load the skill package
2. execute `workflow.capture-link`
3. run `web.fetch-content`
4. run `notes.create-note`
5. return the final workflow output

The package also supports a safe verification mode through `dry_run`, so the same workflow can be proven without creating a real note first.

## What Happened

The usage rollout performed the real workflow against the OpenAI page.

The result was:

- the page content was fetched successfully through `https://r.jina.ai/`
- a note was created in Apple Notes
- the created note used the fetched page title as its title
- the workflow returned structured output such as the source URL, fetch URL, note title, account name, folder name, creation status, note ID, and content preview

## Why This Matters

This example is the smallest complete demonstration in the repository of an action-based skill that is both:

- authored as a package with explicit contracts
- executed later as a reusable workflow through the runtime

It shows the intended lifecycle clearly:

1. describe a capability in natural language
2. compile that capability into a skill package
3. validate the package through the runtime
4. reuse the generated package in a later request

## Files To Inspect

If you want to inspect the checked-in package after reading this walkthrough, start with:

- [`skills/capture-link-to-apple-notes/SKILL.md`](./skills/capture-link-to-apple-notes/SKILL.md)
- [`skills/capture-link-to-apple-notes/skill.json`](./skills/capture-link-to-apple-notes/skill.json)
- [`skills/capture-link-to-apple-notes/actions/workflow-capture-link/action.json`](./skills/capture-link-to-apple-notes/actions/workflow-capture-link/action.json)
- [`skills/capture-link-to-apple-notes/actions/web-fetch-content/action.json`](./skills/capture-link-to-apple-notes/actions/web-fetch-content/action.json)
- [`skills/capture-link-to-apple-notes/actions/notes-create-note/action.json`](./skills/capture-link-to-apple-notes/actions/notes-create-note/action.json)
- [`skills/capture-link-to-apple-notes/handlers.mjs`](./skills/capture-link-to-apple-notes/handlers.mjs)
