---
name: autodesign-wireframe
description: Private Stage 05 contract for the Autodesign wireframe subskill. Contract-only; checks prerequisites and does not use Pencil.
---

# Autodesign Wireframe Contract

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running the deterministic readiness check.

## Required Upstream Artifacts

- `canonical.screen-model` at `autodesign/outputs/canonical/screen-model.json`
- `canonical.interaction-model` at `autodesign/outputs/canonical/interaction-model.json`

## Output Artifacts

- `pencil.wireframe-set` at `autodesign/outputs/pencil/wireframes`

Stage 05 declares this output only. Do not create Pencil files or update design files.

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill wireframe` must pass.
- `manifest.disabledBehaviors.pencilOperations` must be `true`.
- `manifest.disabledBehaviors.realSubskillPhaseBehavior` must be `true`.
- The artifact graph must contain every required upstream and output artifact id.

## Fail Fast

- Stop if state validation fails.
- Stop if graph dependencies are missing or cyclic.
- Stop if any required canonical upstream file is missing.
- If all gates pass, report contract-only status and stop before wireframe or Pencil operations.
