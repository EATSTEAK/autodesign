---
name: autodesign-primitives
description: Private Stage 06 contract for the Autodesign primitives subskill. Contract-only; checks prerequisites and does not generate design-system artifacts.
---

# Autodesign Primitives Contract

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running the deterministic readiness check.

## Required Upstream Artifacts

- `canonical.brand-direction` at `autodesign/outputs/canonical/brand-direction.json`
- `visual.reference-set` at `autodesign/outputs/visual-references`

## Output Artifacts

- `design-system.primitives` at `autodesign/outputs/design-system/primitives.json`

Stage 06 declares this output only. Do not create or update it.

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill primitives` must pass.
- `manifest.disabledBehaviors.designSystemGeneration` must be `true`.
- `manifest.disabledBehaviors.realSubskillPhaseBehavior` must be `true`.
- The artifact graph must contain every required upstream and output artifact id.

## Fail Fast

- Stop if state validation fails.
- Stop if graph dependencies are missing or cyclic.
- Stop if any required upstream artifact path is missing.
- If all gates pass, report contract-only status and stop before primitive or token generation.
