---
name: autodesign-brand
description: Private Stage 06 canonical subskill for brand direction generation.
---

# Autodesign Brand

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running the deterministic readiness check.

## Required Upstream Artifacts

- `canonical.project-brief` at `autodesign/outputs/canonical/project-brief.json`
- `canonical.requirements` at `autodesign/outputs/canonical/requirements.json`

## Output Artifacts

- `canonical.brand-direction` at `autodesign/outputs/canonical/brand-direction.json`
- `log.decision-log` at `autodesign/logs/decision-log.json`

## Deterministic Script

Plan first:

```bash
node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace <workspace> --subskill brand --plan
```

Apply only with explicit approval and deterministic record metadata:

```bash
node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace <workspace> --subskill brand --apply --approve-canonical-generation --actor <actor> --at <timestamp>
```

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill brand` must pass.
- `manifest.disabledBehaviors.canonicalGeneration` must be `false`.
- The artifact graph must contain every required upstream and output artifact id.

## Fail Fast

- Stop if state validation fails.
- Stop if graph dependencies are missing or cyclic.
- Stop if any required canonical upstream file is missing.
- Do not create images, Pencil files, visual references, design-system outputs, prototypes, or handoff material.
