---
name: autodesign-bootstrap-runtime
description: Private Stage 06 contract for the Autodesign bootstrap and state runtime boundary. Do not expose as a public skill and do not run generation behavior.
---

# Autodesign Bootstrap Runtime Contract

This private payload subskill documents the bootstrap and state boundary. It is not a public install-time skill; `autodesign-start` remains the only public router.

## Required Upstream Artifacts

None.

## Output Files

- `AGENTS.md`
- `.codex/config.toml`
- `autodesign/manifest.json`
- `autodesign/artifact-graph.json`
- `autodesign/.system/install-state.json`

The bootstrap runtime may only copy the workspace template when invoked by `autodesign-start` with explicit approval flags. It must not create phase artifacts.

## Hard Gates

- `scripts/bootstrap.mjs --plan` must run before any apply.
- `--approve-bootstrap` is required for writes.
- `--approve-overwrite` is required when the plan reports overwrites.
- `scripts/validate-state.mjs` and `scripts/check-dependencies.mjs` must pass after materialization.
- `manifest.disabledBehaviors.realSubskillPhaseBehavior` must remain `true`.

## Fail Fast

- Stop if the bootstrap target is missing or not an absolute workspace path.
- Stop if apply is requested without the required approval flags.
- Stop if state validation or dependency checks fail after materialization.
- Stop after reporting bootstrap/state status; do not generate canonical artifacts, images, Pencil files, visual references, design-system outputs, prototypes, handoff packages, reports, or real subskill behavior.
