---
name: autodesign-reconcile
description: Private Stage 09 reconcile subskill. Generates advisory dirty-propagation reports from artifact graph preserve/may-change policies after handoff docs exist.
---

# Autodesign Reconcile Contract

This private payload subskill is not public. Enter it only through `autodesign-start` after running the deterministic readiness check.

## Required Upstream Artifacts

- `inputs.project-material`
- `canonical.project-brief`
- `canonical.requirements`
- `canonical.brand-direction`
- `canonical.screen-model`
- `canonical.interaction-model`
- `visual.reference-set`
- `pencil.wireframe-set`
- `design-system.tokens`
- `prototype.package`
- `handoff.package`

## Output Artifacts

- `log.reconcile-report` at `autodesign/logs/reconcile-report.json`

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill reconcile` must pass.
- `handoff.package` must be generated and present.
- At least one changed upstream artifact id must be supplied with `--changed`.
- Apply requires `--approve-reconcile-report`, `--actor`, and `--at`.

## Required Command

Plan first:

```bash
node autodesign-start/assets/payload/scripts/generate-handoff.mjs --workspace <workspace> --action reconcile --changed <artifact-id> --plan
```

Apply only after explicit approval:

```bash
node autodesign-start/assets/payload/scripts/generate-handoff.mjs --workspace <workspace> --action reconcile --changed <artifact-id> --apply --approve-reconcile-report --actor <actor> --at <timestamp>
```

## Fail Fast

- Stop if state validation fails.
- Stop if graph dependencies are missing or cyclic.
- Stop if any required upstream artifact path is absent.
- Stop if `handoff.package` is not generated.
- Stop if `--changed` is missing or references an unknown artifact id.
- Write only `autodesign/logs/reconcile-report.json` plus manifest and artifact graph state updates.
- Do not mutate upstream artifacts, design files, Pencil state, images, or frontend code.
