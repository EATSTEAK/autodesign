# Stage 09 - Handoff And Hooks

## Objective

Generate frontend handoff documentation without generating frontend code, and replace no-op hook placeholders with limited hook adapters for status injection, schema validation, overwrite warnings, turn summaries, and reconcile alerts.

## Scope

- Add a deterministic handoff/reconcile script that reads canonical, visual, Pencil, DS, prototype, and QA artifacts.
- Persist handoff docs and reconcile reports only after upstream artifacts and gates pass.
- Keep hooks observational and advisory. Hooks must not generate artifacts, mutate design files, call image generation, call Pencil, or create frontend code.
- Update expanded subskill contracts, manifest, artifact graph, payload manifest, and workspace config for Stage 09.

## Validation

- Fresh implementation agent owns Stage 09 edits.
- Independent validation agent must classify the stage as `PASS`, conditional approval, or `NOT READY`.
- Required checks: `validate-state`, `check-dependencies`, `can-run-subskill handoff`, `can-run-subskill reconcile`, `node --check` for new scripts/hooks, `git diff --check`, and a real temp-workspace handoff/reconcile run using Stage 08-generated artifacts.

## Non-Goals

- No frontend source files.
- No executable prototype code.
- No image generation.
- No Pencil MCP mutation.
- No hook-triggered artifact generation.
