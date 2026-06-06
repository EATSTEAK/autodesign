---
name: autodesign-visual-anchors
description: Private Stage 06 canonical subskill for primary visual anchor proposals. Generates planning-only proposals and does not create visual references or images.
---

# Autodesign Visual Anchors

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running the deterministic readiness check.

## Required Upstream Artifacts

- `canonical.brand-direction` at `autodesign/outputs/canonical/brand-direction.json`
- `canonical.screen-model` at `autodesign/outputs/canonical/screen-model.json`
- `canonical.interaction-model` at `autodesign/outputs/canonical/interaction-model.json`

## Output Artifacts

- `canonical.visual-anchor-proposals` at `autodesign/outputs/canonical/visual-anchor-proposals.json`
- `log.decision-log` at `autodesign/logs/decision-log.json`

## Deterministic Script

Plan first:

```bash
node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace <workspace> --subskill visual-anchors --plan
```

Apply only with explicit approval and deterministic record metadata:

```bash
node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace <workspace> --subskill visual-anchors --apply --approve-canonical-generation --actor <actor> --at <timestamp>
```

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill visual-anchors` must pass.
- `manifest.disabledBehaviors.canonicalGeneration` must be `false`.
- UX platform selection must be present in project input files.
- The artifact graph must contain every required upstream and output artifact id.

## Boundary

Stage 06 creates proposals only. It must not approve a visual anchor, create visual reference files, call image generation, perform Pencil operations, generate a design system, generate a prototype, or generate handoff material.
