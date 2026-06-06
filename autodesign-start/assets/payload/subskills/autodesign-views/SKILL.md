---
name: autodesign-views
description: Private Stage 06 canonical subskill for view taxonomy, screen model, navigation, and coverage generation.
---

# Autodesign Views

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running the deterministic readiness check.

## Required Upstream Artifacts

- `canonical.requirements` at `autodesign/outputs/canonical/requirements.json`

## Output Artifacts

- `canonical.screen-model` at `autodesign/outputs/canonical/screen-model.json`
- `canonical.navigation` at `autodesign/outputs/canonical/navigation.json`
- `canonical.coverage-matrix` at `autodesign/outputs/canonical/coverage-matrix.json`
- `log.decision-log` at `autodesign/logs/decision-log.json`

## Deterministic Script

Plan first:

```bash
node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace <workspace> --subskill views --plan
```

Apply only with explicit approval and deterministic record metadata:

```bash
node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace <workspace> --subskill views --apply --approve-canonical-generation --actor <actor> --at <timestamp>
```

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill views` must pass.
- `manifest.disabledBehaviors.canonicalGeneration` must be `false`.
- The artifact graph must contain every required upstream and output artifact id.

## Fail Fast

- Stop if state validation fails.
- Stop if graph dependencies are missing or cyclic.
- Stop if `canonical.requirements` is missing at its graph path.
- Do not create images, Pencil files, visual references, design-system outputs, prototypes, or handoff material.
