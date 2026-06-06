---
name: autodesign-visuals
description: Private Stage 06 contract for the Autodesign visual reference subskill. Contract-only; does not generate visual references or images.
---

# Autodesign Visuals Contract

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running the deterministic readiness check.

## Required Upstream Artifacts

- `canonical.brand-direction` at `autodesign/outputs/canonical/brand-direction.json`
- `canonical.screen-model` at `autodesign/outputs/canonical/screen-model.json`
- `canonical.interaction-model` at `autodesign/outputs/canonical/interaction-model.json`
- `canonical.visual-anchor-proposals` at `autodesign/outputs/canonical/visual-anchor-proposals.json`

## Output Artifacts

- `visual.reference-set` at `autodesign/outputs/visual-references`

Stage 06 declares this downstream output only. Do not create references, call image generation, or update visual-reference files.

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill visuals` must pass.
- `manifest.disabledBehaviors.imageGeneration` must be `true`.
- `manifest.disabledBehaviors.visualReferenceGeneration` must be `true`.
- `manifest.disabledBehaviors.realSubskillPhaseBehavior` must be `true`.
- The artifact graph must contain every required upstream and output artifact id.

## Fail Fast

- Stop if state validation fails.
- Stop if graph dependencies are missing or cyclic.
- Stop if any required canonical upstream file is missing.
- If all gates pass, report contract-only status and stop before visual reference or image generation.
