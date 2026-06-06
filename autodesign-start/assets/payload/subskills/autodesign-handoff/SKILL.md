---
name: autodesign-handoff
description: Private Stage 05 contract for the Autodesign handoff subskill. Contract-only; checks prerequisites and does not generate handoff packages.
---

# Autodesign Handoff Contract

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running the deterministic readiness check.

## Required Upstream Artifacts

- `canonical.project-brief` at `autodesign/outputs/canonical/project-brief.json`
- `canonical.requirements` at `autodesign/outputs/canonical/requirements.json`
- `canonical.brand-direction` at `autodesign/outputs/canonical/brand-direction.json`
- `canonical.screen-model` at `autodesign/outputs/canonical/screen-model.json`
- `canonical.interaction-model` at `autodesign/outputs/canonical/interaction-model.json`
- `visual.reference-set` at `autodesign/outputs/visual-references`
- `pencil.wireframe-set` at `autodesign/outputs/pencil/wireframes`
- `design-system.tokens` at `autodesign/outputs/design-system/tokens.json`
- `prototype.package` at `autodesign/outputs/prototype`

## Output Artifacts

- `handoff.package` at `autodesign/outputs/handoff`

Stage 05 declares this output only. Do not create or update it.

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill handoff` must pass.
- `manifest.disabledBehaviors.handoff` must be `true`.
- `manifest.disabledBehaviors.realSubskillPhaseBehavior` must be `true`.
- The artifact graph must contain every required upstream and output artifact id.

## Fail Fast

- Stop if state validation fails.
- Stop if graph dependencies are missing or cyclic.
- Stop if any required upstream artifact path is missing.
- If all gates pass, report contract-only status and stop before handoff packaging or export.
