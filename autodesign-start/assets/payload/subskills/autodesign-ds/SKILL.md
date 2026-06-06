---
name: autodesign-ds
description: Private Stage 05 contract for the Autodesign design-system subskill. Contract-only; checks prerequisites and does not generate DS artifacts.
---

# Autodesign Design System Contract

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running the deterministic readiness check.

## Required Upstream Artifacts

- `design-system.primitives` at `autodesign/outputs/design-system/primitives.json`
- `visual.reference-set` at `autodesign/outputs/visual-references`
- `pencil.wireframe-set` at `autodesign/outputs/pencil/wireframes`

## Output Artifacts

- `design-system.tokens` at `autodesign/outputs/design-system/tokens.json`

Stage 05 declares this output only. Do not create or update it.

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill ds` must pass.
- `manifest.disabledBehaviors.designSystemGeneration` must be `true`.
- `manifest.disabledBehaviors.realSubskillPhaseBehavior` must be `true`.
- The artifact graph must contain every required upstream and output artifact id.

## Fail Fast

- Stop if state validation fails.
- Stop if graph dependencies are missing or cyclic.
- Stop if any required upstream artifact path is missing.
- If all gates pass, report contract-only status and stop before design-system or token generation.
