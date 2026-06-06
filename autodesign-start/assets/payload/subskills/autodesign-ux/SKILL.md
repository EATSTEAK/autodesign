---
name: autodesign-ux
description: Private Stage 06 canonical subskill for UX rules, interaction model, and screen-state matrix generation.
---

# Autodesign UX

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running the deterministic readiness check.

## Required Upstream Artifacts

- `canonical.project-brief` at `autodesign/outputs/canonical/project-brief.json`
- `canonical.requirements` at `autodesign/outputs/canonical/requirements.json`
- `canonical.screen-model` at `autodesign/outputs/canonical/screen-model.json`

## Output Artifacts

- `canonical.ux-rules` at `autodesign/outputs/canonical/ux-rules.json`
- `canonical.interaction-model` at `autodesign/outputs/canonical/interaction-model.json`
- `canonical.screen-state-matrix` at `autodesign/outputs/canonical/screen-state-matrix.json`
- `canonical.coverage-matrix` at `autodesign/outputs/canonical/coverage-matrix.json`
- `log.decision-log` at `autodesign/logs/decision-log.json`

## Deterministic Script

Plan first:

```bash
node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace <workspace> --subskill ux --plan
```

Apply only with explicit approval and deterministic record metadata:

```bash
node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace <workspace> --subskill ux --apply --approve-canonical-generation --actor <actor> --at <timestamp>
```

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill ux` must pass.
- `manifest.disabledBehaviors.canonicalGeneration` must be `false`.
- UX platform selection must be present in project input files.
- The artifact graph must contain every required upstream and output artifact id.

## Fail Fast

- Stop if state validation fails.
- Stop if graph dependencies are missing or cyclic.
- Stop if `canonical.screen-model` is missing at its graph path.
- Stop if UX platform selection is missing from project input files.
- Do not create images, Pencil files, visual references, design-system outputs, prototypes, or handoff material.
