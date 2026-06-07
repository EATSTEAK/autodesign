---
name: autodesign-handoff
description: Private Stage 09 handoff subskill. Generates frontend handoff documentation as JSON and Markdown only, after Stage 08 prototype and QA gates pass.
---

# Autodesign Handoff Contract

This private payload subskill is not public. Enter it only through `autodesign-start` after running the deterministic readiness check.

## Required Upstream Artifacts

- `canonical.project-brief`
- `canonical.requirements`
- `canonical.brand-direction`
- `canonical.ux-rules`
- `canonical.screen-model`
- `canonical.navigation`
- `canonical.interaction-model`
- `canonical.screen-state-matrix`
- `canonical.coverage-matrix`
- `canonical.visual-anchor-proposals`
- `log.decision-log`
- `visual.reference-selection`
- `visual.reference-set`
- `pencil.live-check`
- `pencil.wireframe-set`
- `pencil.canvas-exports`
- `design-system.primitives`
- `design-system.tokens`
- `design-system.contracts`
- `prototype.package`
- `prototype.canvas-exports`
- `prototype.visual-qa-report`
- `prototype.refinement-log`

## Output Artifacts

- `handoff.package` at `autodesign/outputs/handoff`
- `autodesign/outputs/handoff/handoff-package.json`
- `autodesign/outputs/handoff/README.md`

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill handoff` must pass.
- `manifest.disabledBehaviors.handoff` must be `false`.
- Selected visual references must be approved.
- Pencil live-check and wireframe records must be generated from real Pencil MCP evidence.
- DS primitives, tokens, and contracts must be generated.
- Prototype package and visual QA report must be generated.
- Refinement attempt state must satisfy the max-two-refinement gate.
- Apply requires `--approve-handoff-generation`, `--actor`, and `--at`.

## Required Command

Plan first:

```bash
node autodesign-start/assets/payload/scripts/generate-handoff.mjs --workspace <workspace> --action handoff --plan
```

Apply only after explicit approval:

```bash
node autodesign-start/assets/payload/scripts/generate-handoff.mjs --workspace <workspace> --action handoff --apply --approve-handoff-generation --actor <actor> --at <timestamp>
```

## Fail Fast

- Stop if state validation fails.
- Stop if graph dependencies are missing or cyclic.
- Stop if any required upstream artifact path is absent.
- Stop if prototype visual QA is not approved.
- Stop if the plan would write outside `autodesign/outputs/handoff/`, except for manifest and artifact graph state updates.
- Stop if the plan would write anything other than JSON or Markdown handoff documentation.
- Do not generate frontend source files, executable prototype code, images, or Pencil changes.
