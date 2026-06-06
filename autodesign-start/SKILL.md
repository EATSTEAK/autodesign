---
name: autodesign-start
description: Start Autodesign setup from the eatsteak/autodesign skill package. Use when the user asks to initialize, start, install-check, bootstrap, validate state, inspect the artifact graph, check subskill readiness, record gates, or compute dirty artifacts. In Stage 05, only run explicit bootstrap, state-management, and contract-readiness scripts and do not run generation behavior.
---

# Autodesign Start

This is the only public skill exposed by the `eatsteak/autodesign` package at install time.

## Current Stage

Stage 05 provides a one-shot bootstrap runtime that materializes the bundled Autodesign workspace template into a target project, deterministic manifest and artifact graph state-management scripts, and private subskill contract readiness checks.

Do not generate canonical artifacts, create Pencil files, call image generation, run design-system logic, generate visual references, generate prototypes, hand off to another phase, generate reports, optimize skills, or execute real expanded subskill behavior from this skill. Detailed generators and expanded subskill behavior belong to later stages.

## Bundled Payload

Runtime assets live under `assets/payload/`:

- `subskills/` for private contract-only Autodesign subskills.
- `schemas/` for manifest and artifact graph JSON schema files.
- `scripts/bootstrap.mjs` for deterministic plan/apply workspace materialization.
- `scripts/validate-state.mjs`, `scripts/check-dependencies.mjs`, `scripts/can-run-subskill.mjs`, `scripts/record-gate.mjs`, and `scripts/dirty-artifacts.mjs` for Stage 05 state and contract readiness management.
- `hooks/` for no-op lifecycle hook adapters.
- `workspace-template/` for files materialized by the bootstrap runtime.

Read `assets/payload/payload-manifest.json` for the concrete Stage 05 payload inventory.

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

## State Commands

Validate manifest and graph JSON:

```bash
node autodesign-start/assets/payload/scripts/validate-state.mjs --workspace /absolute/path/to/project
```

Check required upstream dependencies and cycles:

```bash
node autodesign-start/assets/payload/scripts/check-dependencies.mjs --workspace /absolute/path/to/project
```

Check whether a named private subskill contract can be entered:

```bash
node autodesign-start/assets/payload/scripts/can-run-subskill.mjs --workspace /absolute/path/to/project --subskill interview
```

Compute dirty downstream artifacts from changed upstreams:

```bash
node autodesign-start/assets/payload/scripts/dirty-artifacts.mjs --workspace /absolute/path/to/project --changed canonical.requirements
```

Record an approval gate only with an explicit actor, timestamp, and write approval:

```bash
node autodesign-start/assets/payload/scripts/record-gate.mjs --workspace /absolute/path/to/project --gate state.record-gate --status approved --actor <actor> --at <timestamp> --approve-record
```

## Materialized Files

The bootstrap runtime copies `assets/payload/workspace-template/` into the target project. Stage 05 materializes:

- `AGENTS.md`
- `.codex/config.toml`
- `.codex/hooks/*.mjs`
- `autodesign/README.md`
- `autodesign/manifest.json`
- `autodesign/artifact-graph.json`
- `autodesign/.system/install-state.json`
- marker README files under `autodesign/inputs/`, `autodesign/outputs/`, and `autodesign/logs/`

## When Invoked

1. Confirm that `autodesign-start` is installed and visible.
2. Locate `assets/payload/scripts/bootstrap.mjs`.
3. Run the plan command against the requested target workspace.
4. Report planned file actions and approval gates.
5. Apply only with the explicit approval flags described above.
6. For private subskill requests, run `can-run-subskill.mjs` and report readiness. Do not run real phase behavior.
