---
name: autodesign-wireframe
description: Private Stage 08 wireframe subskill. Records Pencil wireframe metadata and real canvas export paths after selected references and a live Pencil check.
---

# Autodesign Wireframe

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running deterministic readiness checks.

## Required Upstream Artifacts

- `canonical.screen-model` at `autodesign/outputs/canonical/screen-model.json`
- `canonical.interaction-model` at `autodesign/outputs/canonical/interaction-model.json`
- `canonical.screen-state-matrix` at `autodesign/outputs/canonical/screen-state-matrix.json`
- `visual.reference-set` after approved selected visual references
- `pencil.live-check` at `autodesign/outputs/pencil/live-check.json`

## Output Artifacts

- `pencil.wireframe-set` at `autodesign/outputs/pencil/wireframes/wireframe-metadata.json`
- `pencil.canvas-exports` at `autodesign/outputs/pencil/canvas-exports.json`

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill wireframe` must pass.
- `visual.reference-selection` must be approved and contain selected records.
- `manifest.disabledBehaviors.pencilOperations` must be `false`.
- Pencil must be live-checked with real `get_editor_state` evidence before recording wireframes.
- A live Pencil agent must run `batch_design` against the Autodesign-owned virtual `.pen` filePath, create one frame for every canonical screen, run `export_nodes`, and write a `--pencil-evidence-path` JSON record.
- The target virtual `.pen` filePath must be under `autodesign/outputs/pencil/`.
- Evidence must include `batchDesign.createdNodeIds`, `exportNodes.nodeIds`, per-screen frame bindings, and every canvas export path must exist and match the evidence hashes.

## Run

Plan first:

```bash
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace <workspace> --action wireframes --pencil-evidence-path <path> --canvas-export-path <path> --plan
```

Apply only with explicit approval:

```bash
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace <workspace> --action wireframes --pencil-evidence-path <path> --canvas-export-path <path> --apply --approve-pencil-wireframes --actor <actor> --at <timestamp>
```

The script records metadata and export paths only. It does not create or fake Pencil canvas output. Stage 08 is NOT READY until the live Pencil agent has completed `get_editor_state`, `batch_design`, and `export_nodes` and the evidence cross-checks the virtual Pencil filePath plus export file bytes.
