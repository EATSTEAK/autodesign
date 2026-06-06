---
name: autodesign-interview
description: Private Stage 06 canonical subskill for project brief and interview intent generation.
---

# Autodesign Interview

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running the deterministic readiness check.

## Required Upstream Artifacts

- `inputs.project-material` at `autodesign/inputs`

## Output Artifacts

- `canonical.project-brief` at `autodesign/outputs/canonical/project-brief.json`
- `log.decision-log` at `autodesign/logs/decision-log.json`

## Deterministic Script

Plan first:

```bash
node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace <workspace> --subskill interview --plan
```

Apply only with explicit approval and deterministic record metadata:

```bash
node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace <workspace> --subskill interview --apply --approve-canonical-generation --actor <actor> --at <timestamp>
```

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill interview` must pass.
- `manifest.disabledBehaviors.canonicalGeneration` must be `false`.
- The artifact graph must contain every required upstream and output artifact id.

## Fail Fast

- Stop if state validation fails.
- Stop if graph dependencies are missing or cyclic.
- Stop if `autodesign/inputs` is missing.
- Stop if no real project input files exist under `autodesign/inputs`.
- Do not create images, Pencil files, visual references, design-system outputs, prototypes, or handoff material.
