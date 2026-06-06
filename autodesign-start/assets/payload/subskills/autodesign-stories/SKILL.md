---
name: autodesign-stories
description: Private Stage 05 contract for the Autodesign stories subskill. Contract-only; checks prerequisites and does not generate artifacts.
---

# Autodesign Stories Contract

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running the deterministic readiness check.

## Required Upstream Artifacts

- `canonical.project-brief` at `autodesign/outputs/canonical/project-brief.json`

## Output Artifacts

- `canonical.requirements` at `autodesign/outputs/canonical/requirements.json`

Stage 05 declares this output only. Do not create or update it.

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill stories` must pass.
- `manifest.disabledBehaviors.canonicalGeneration` must be `true`.
- `manifest.disabledBehaviors.realSubskillPhaseBehavior` must be `true`.
- The artifact graph must contain every required upstream and output artifact id.

## Fail Fast

- Stop if state validation fails.
- Stop if graph dependencies are missing or cyclic.
- Stop if `canonical.project-brief` is missing at its graph path.
- If all gates pass, report contract-only status and stop before story, requirement, or artifact generation.
