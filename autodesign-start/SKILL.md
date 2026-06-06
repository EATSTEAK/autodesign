---
name: autodesign-start
description: Start Autodesign setup from the eatsteak/autodesign skill package. Use when the user asks to initialize, start, install-check, bootstrap, or run Autodesign. In Stage 03, only run the explicit bootstrap plan/apply runtime and do not run generation behavior.
---

# Autodesign Start

This is the only public skill exposed by the `eatsteak/autodesign` package at install time.

## Current Stage

Stage 03 provides a one-shot bootstrap runtime that materializes the bundled Autodesign workspace template into a target project.

Do not generate canonical artifacts, create Pencil files, call image generation, run design-system logic, generate visual references, hand off to another phase, or execute real expanded subskill behavior from this skill. Detailed generators and expanded subskill behavior belong to later stages.

## Bundled Payload

Runtime assets live under `assets/payload/`:

- `subskills/` for private no-op Autodesign subskill placeholders.
- `scripts/bootstrap.mjs` for deterministic plan/apply workspace materialization.
- `hooks/` for no-op lifecycle hook adapters.
- `workspace-template/` for files materialized by the bootstrap runtime.

Read `assets/payload/payload-manifest.json` for the concrete Stage 03 payload inventory.

## Bootstrap Command

Always plan before applying:

```bash
node autodesign-start/assets/payload/scripts/bootstrap.mjs --target /absolute/path/to/project --plan
```

Apply only after the user explicitly approves the bootstrap write:

```bash
node autodesign-start/assets/payload/scripts/bootstrap.mjs --target /absolute/path/to/project --apply --approve-bootstrap
```

If the plan reports any `overwrite` actions, apply only after the user separately approves overwrites:

```bash
node autodesign-start/assets/payload/scripts/bootstrap.mjs --target /absolute/path/to/project --apply --approve-bootstrap --approve-overwrite
```

## Approval Gates

1. Run `--plan` first and report the `create`, `overwrite`, and `preserve` counts.
2. Do not run `--apply` unless the user explicitly approves writing bootstrap files.
3. Pass `--approve-bootstrap` with every `--apply` command.
4. If the plan contains `overwrite`, ask for explicit overwrite approval and pass `--approve-overwrite`.
5. Never treat approval to bootstrap as approval to run later Autodesign generation phases.

## Materialized Files

The bootstrap runtime copies `assets/payload/workspace-template/` into the target project. Stage 03 materializes:

- `AGENTS.md`
- `.codex/config.toml`
- `.codex/hooks/*.mjs`
- `autodesign/README.md`
- `autodesign/.system/install-state.json`
- marker README files under `autodesign/inputs/`, `autodesign/outputs/`, and `autodesign/logs/`

## When Invoked

1. Confirm that `autodesign-start` is installed and visible.
2. Locate `assets/payload/scripts/bootstrap.mjs`.
3. Run the plan command against the requested target workspace.
4. Report planned file actions and approval gates.
5. Apply only with the explicit approval flags described above.
