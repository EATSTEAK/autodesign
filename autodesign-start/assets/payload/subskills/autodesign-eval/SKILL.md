---
name: autodesign-eval
description: Private Stage 05 contract for the Autodesign eval subskill. Contract-only; checks prerequisites and does not generate reports.
---

# Autodesign Eval Contract

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running the deterministic readiness check.

## Required Upstream Artifacts

- `handoff.package` at `autodesign/outputs/handoff`
- `log.reconcile-report` at `autodesign/logs/reconcile-report.json`

## Output Artifacts

- `log.eval-report` at `autodesign/logs/eval-report.json`

Stage 05 declares this output only. Do not create or update it.

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill eval` must pass.
- `manifest.disabledBehaviors.realSubskillPhaseBehavior` must be `true`.
- The artifact graph must contain every required upstream and output artifact id.

## Fail Fast

- Stop if state validation fails.
- Stop if graph dependencies are missing or cyclic.
- Stop if any required upstream artifact path is missing.
- If all gates pass, report contract-only status and stop before evaluation or report generation.
