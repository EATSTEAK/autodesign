---
name: autodesign-ux
description: Private Stage 05 contract for the Autodesign UX subskill. Contract-only; checks prerequisites and does not generate artifacts.
---

# Autodesign UX Contract

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running the deterministic readiness check.

## Required Upstream Artifacts

- `canonical.screen-model` at `autodesign/outputs/canonical/screen-model.json`

## Output Artifacts

- `canonical.interaction-model` at `autodesign/outputs/canonical/interaction-model.json`

Stage 05 declares this output only. Do not create or update it.

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill ux` must pass.
- `manifest.disabledBehaviors.canonicalGeneration` must be `true`.
- `manifest.disabledBehaviors.realSubskillPhaseBehavior` must be `true`.
- The artifact graph must contain every required upstream and output artifact id.

## Fail Fast

- Stop if state validation fails.
- Stop if graph dependencies are missing or cyclic.
- Stop if `canonical.screen-model` is missing at its graph path.
- If all gates pass, report contract-only status and stop before UX, flow, or interaction-model generation.
