---
name: autodesign-skillopt
description: Private Stage 06 contract for the Autodesign skill optimization subskill. Contract-only; checks prerequisites and does not change skills.
---

# Autodesign Skillopt Contract

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running the deterministic readiness check.

## Required Upstream Artifacts

- `log.eval-report` at `autodesign/logs/eval-report.json`

## Output Artifacts

- `log.skillopt-report` at `autodesign/logs/skillopt-report.json`

Stage 06 declares this output only. Do not create reports, modify skills, or optimize runtime behavior.

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill skillopt` must pass.
- `manifest.disabledBehaviors.realSubskillPhaseBehavior` must be `true`.
- The artifact graph must contain every required upstream and output artifact id.

## Fail Fast

- Stop if state validation fails.
- Stop if graph dependencies are missing or cyclic.
- Stop if `log.eval-report` is missing at its graph path.
- If all gates pass, report contract-only status and stop before skill optimization or report generation.
