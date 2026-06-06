---
name: autodesign-reconcile
description: Private Stage 06 contract for the Autodesign reconcile subskill. Contract-only; checks prerequisites and does not generate reports.
---

# Autodesign Reconcile Contract

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running the deterministic readiness check.

## Required Upstream Artifacts

- `inputs.project-material` at `autodesign/inputs`
- `canonical.project-brief` at `autodesign/outputs/canonical/project-brief.json`
- `canonical.requirements` at `autodesign/outputs/canonical/requirements.json`
- `canonical.brand-direction` at `autodesign/outputs/canonical/brand-direction.json`
- `canonical.screen-model` at `autodesign/outputs/canonical/screen-model.json`
- `canonical.interaction-model` at `autodesign/outputs/canonical/interaction-model.json`
- `visual.reference-set` at `autodesign/outputs/visual-references`
- `pencil.wireframe-set` at `autodesign/outputs/pencil/wireframes`
- `design-system.tokens` at `autodesign/outputs/design-system/tokens.json`
- `prototype.package` at `autodesign/outputs/prototype`
- `handoff.package` at `autodesign/outputs/handoff`

## Output Artifacts

- `log.reconcile-report` at `autodesign/logs/reconcile-report.json`

Stage 06 declares this output only. Do not create or update it.

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill reconcile` must pass.
- `manifest.disabledBehaviors.realSubskillPhaseBehavior` must be `true`.
- The artifact graph must contain every required upstream and output artifact id.

## Fail Fast

- Stop if state validation fails.
- Stop if graph dependencies are missing or cyclic.
- Stop if any required upstream artifact path is missing.
- If all gates pass, report contract-only status and stop before reconcile analysis or report generation.
