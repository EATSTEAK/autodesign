---
name: autodesign-interview
description: Private Stage 05 contract for the Autodesign interview subskill. Contract-only; checks prerequisites and does not generate artifacts.
---

# Autodesign Interview Contract

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running the deterministic readiness check.

## Required Upstream Artifacts

- `inputs.project-material` at `autodesign/inputs`

## Output Artifacts

- `canonical.project-brief` at `autodesign/outputs/canonical/project-brief.json`

Stage 05 declares this output only. Do not create or update it.

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill interview` must pass.
- `manifest.disabledBehaviors.canonicalGeneration` must be `true`.
- `manifest.disabledBehaviors.realSubskillPhaseBehavior` must be `true`.
- The artifact graph must contain every required upstream and output artifact id.

## Fail Fast

- Stop if state validation fails.
- Stop if graph dependencies are missing or cyclic.
- Stop if `autodesign/inputs` is missing.
- If all gates pass, report contract-only status and stop before interview, synthesis, or artifact generation.
