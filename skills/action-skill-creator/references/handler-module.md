# Handler Module

Use this file when a package intentionally depends on the runtime-cli-specific `--handler-module` extension.

## Default Rule

Do not add `handlers.*` by default.
Only use a handler module when primitive execution actually needs local runtime-bound code.

## Export Shape

The module should export `primitiveHandlers`, either as a named export or through the default export object.

## Compatibility Rule

Different runtime builds may address primitive handlers by different keys.
To maximize compatibility when the skill is distributed without source access, register both keys for each primitive action:

- `action_id`
- `JSON.stringify([skill_id, action_id])`

That removes the need to inspect runtime source just to discover the binding key shape.

## Suggested Pattern

Use the template in `assets/handler-module-template.mjs`.

When filling it in:

- keep `skill_id` and `action_id` exactly aligned with package manifests
- register both key forms for every primitive action
- keep primitive handlers narrow and schema-compatible
- validate with the real `execute-skill` path as early as possible

## Validation Steps

1. validate the package shape
2. run the public workflow through `execute-skill`
3. if primitive execution fails, inspect whether the expected action id was registered in `primitiveHandlers`
4. fix the handler and rerun the same execution path
