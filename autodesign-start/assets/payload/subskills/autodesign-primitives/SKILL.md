---
name: autodesign-primitives
description: Private Stage 08 primitives subskill. Generates deterministic primitive inventory from selected visual references and canonical brand direction.
---

# Autodesign Primitives

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running deterministic readiness checks.

## Required Upstream Artifacts

- `canonical.brand-direction` at `autodesign/outputs/canonical/brand-direction.json`
- `visual.reference-set` after approved selected visual references

## Output Artifacts

- `design-system.primitives` at `autodesign/outputs/design-system/primitives.json`

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill primitives` must pass.
- `visual.reference-selection` must be approved and contain selected records.
- `manifest.disabledBehaviors.designSystemGeneration` must be `false`.

## Run

Plan first:

```bash
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace <workspace> --action primitives --plan
```

Apply only with explicit approval:

```bash
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace <workspace> --action primitives --apply --approve-design-system-primitives --actor <actor> --at <timestamp>
```

The script derives primitive inventory from canonical brand metadata and selected-reference records. It does not sample image pixels, create images, or fake visual evidence.
