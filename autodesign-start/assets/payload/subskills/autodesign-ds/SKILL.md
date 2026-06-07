---
name: autodesign-ds
description: Private Stage 08 design-system subskill. Generates DS tokens and component contracts from primitives, selected references, and Pencil wireframes.
---

# Autodesign Design System

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running deterministic readiness checks.

## Required Upstream Artifacts

- `design-system.primitives` at `autodesign/outputs/design-system/primitives.json`
- `visual.reference-set` after approved selected visual references
- `pencil.wireframe-set` at `autodesign/outputs/pencil/wireframes/wireframe-metadata.json`

## Output Artifacts

- `design-system.tokens` at `autodesign/outputs/design-system/tokens.json`
- `design-system.contracts` at `autodesign/outputs/design-system/contracts.json`

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill ds` must pass.
- `visual.reference-selection` must be approved and contain selected records.
- `manifest.disabledBehaviors.designSystemGeneration` must be `false`.
- Primitive inventory and Pencil wireframe metadata with live MCP evidence must already be generated.

## Run

Plan first:

```bash
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace <workspace> --action ds --plan
```

Apply only with explicit approval:

```bash
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace <workspace> --action ds --apply --approve-design-system-generation --actor <actor> --at <timestamp>
```

The script persists tokens and component contracts only. It does not generate frontend code, handoff files, or fake Pencil output.
